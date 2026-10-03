import crypto from 'crypto';
import { settings } from '../config/settings.js';
import { Logger } from '../config/logging.js';
import { mediaResolver } from '../services/media_resolver.js';
import {
  AppError,
  SourceTimeoutError,
  SourceRateLimitError,
  SourceAuthenticationError,
  SourceError
} from '../errors/exceptions.js';
import { ErrorCode } from '../errors/codes.js';
import { circuitBreakerRegistry, CircuitBreakerOpenError } from '../resilience/circuit_breaker.js';

const logger = new Logger('HttpClient');

export interface HttpRequestOptions {
  method?: string;
  sourceId?: string;
  requestId?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  signal?: AbortSignal;
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: any;
  data: T;
  durationMs: number;
  requestId: string;
  retryCount: number;
}

export class HttpClient {
  private static hostQueues: Map<string, Promise<any>> = new Map();
  private static lastHostTime: Map<string, number> = new Map();
  private static instance: HttpClient;

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async acquireHostSlot(hostname: string): Promise<() => void> {
    if (hostname !== 'export.arxiv.org') {
      return () => {};
    }
    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    const previousLock = HttpClient.hostQueues.get(hostname) || Promise.resolve();
    HttpClient.hostQueues.set(hostname, lockPromise);

    try {
      await previousLock;
    } catch {}

    const now = Date.now();
    const lastTime = HttpClient.lastHostTime.get(hostname) || 0;
    const elapsed = now - lastTime;
    if (elapsed < 1500) {
      await this.sleep(1500 - elapsed);
    }

    let released = false;
    return () => {
      if (!released) {
        released = true;
        HttpClient.lastHostTime.set(hostname, Date.now());
        releaseLock();
      }
    };
  }

  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const sourceId = options.sourceId || 'external';
    const breaker = circuitBreakerRegistry.getOrCreate(sourceId);

    return breaker.execute(
      () => this.executeRequest<T>(url, options),
      err => {
        if (err instanceof CircuitBreakerOpenError) {
          throw new SourceError(
            `Circuit breaker for '${sourceId}' is OPEN. Fast failing to protect resources. Retry in ${Math.ceil(err.retryAfterMs / 1000)}s.`,
            sourceId,
            ErrorCode.SOURCE_UNAVAILABLE,
            { circuitOpen: true, retryAfterMs: err.retryAfterMs }
          );
        }
        throw err;
      }
    );
  }

  public async executeRequest<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const method = options.method || 'GET';
    const sourceId = options.sourceId || 'external';
    const requestId = options.requestId || `req_${crypto.randomBytes(6).toString('hex')}`;
    const timeoutMs = options.timeoutMs ?? settings.requestTimeout;
    const maxRetries = options.maxRetries ?? settings.maxRetries;

    const parsedUrl = new URL(url);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null && v !== '') {
          parsedUrl.searchParams.append(k, String(v));
        }
      }
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new SourceError(`Invalid protocol ${parsedUrl.protocol}`, sourceId, ErrorCode.VALIDATION_ERROR);
    }

    const initialPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);
    if (initialPort !== 80 && initialPort !== 443) {
      throw new SourceError(`Forbidden outbound port ${initialPort}`, sourceId, ErrorCode.VALIDATION_ERROR);
    }

    if (mediaResolver.isPrivateOrRestrictedHost(parsedUrl.hostname)) {
      throw new SourceError(`Blocked attempt to reach restricted host: ${parsedUrl.hostname}`, sourceId, ErrorCode.VALIDATION_ERROR);
    }

    const isSafeHost = await mediaResolver.verifyDnsSafety(parsedUrl.hostname);
    if (!isSafeHost) {
      throw new SourceError(`DNS validation blocked unsafe host: ${parsedUrl.hostname}`, sourceId, ErrorCode.VALIDATION_ERROR);
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml;q=0.9, application/json;q=0.8, text/plain;q=0.5, */*;q=0.2',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(options.headers || {})
    };

    let attempt = 0;

    while (attempt <= maxRetries) {
      if (options.signal?.aborted) {
        throw new SourceError(`Request aborted by caller`, sourceId, ErrorCode.SOURCE_UNAVAILABLE, { aborted: true });
      }

      attempt++;
      const attemptStart = Date.now();

      try {
        logger.debug(`HTTP ${method} ${parsedUrl.toString()} (Attempt ${attempt}/${maxRetries + 1})`, {
          requestId,
          sourceId,
          attempt
        });

        const controller = new AbortController();
        const onCallerAbort = () => controller.abort(options.signal?.reason);

        if (options.signal) {
          if (options.signal.aborted) {
            controller.abort(options.signal.reason);
          } else {
            options.signal.addEventListener('abort', onCallerAbort, { once: true });
          }
        }

        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let targetUrl = parsedUrl.toString();
        let redirectHop = 0;
        let response: any;

        try {
          while (true) {
            const currentUrl = new URL(targetUrl);
            const releaseSlot = await this.acquireHostSlot(currentUrl.hostname);

            try {
              response = await fetch(targetUrl, {
                method,
                headers,
                body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
                signal: controller.signal,
                redirect: 'manual'
              });
            } finally {
              releaseSlot();
            }

            if (response.status >= 300 && response.status < 400) {
              const loc = response.headers.get('location');
              if (!loc) break;
              redirectHop++;
              if (redirectHop > 3) {
                throw new SourceError('Exceeded maximum redirect depth', sourceId, ErrorCode.PROTOCOL_ERROR);
              }

              const nextUrl = new URL(loc, targetUrl);
              if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
                throw new SourceError('Invalid redirect protocol', sourceId, ErrorCode.VALIDATION_ERROR);
              }

              const nextPort = nextUrl.port ? parseInt(nextUrl.port, 10) : (nextUrl.protocol === 'https:' ? 443 : 80);
              if (nextPort !== 80 && nextPort !== 443) {
                throw new SourceError('Forbidden redirect port', sourceId, ErrorCode.VALIDATION_ERROR);
              }

              if (mediaResolver.isPrivateOrRestrictedHost(nextUrl.hostname)) {
                throw new SourceError(`SSRF blocked in redirect: ${nextUrl.hostname}`, sourceId, ErrorCode.VALIDATION_ERROR);
              }

              const nextSafe = await mediaResolver.verifyDnsSafety(nextUrl.hostname);
              if (!nextSafe) {
                throw new SourceError(`SSRF DNS blocked in redirect: ${nextUrl.hostname}`, sourceId, ErrorCode.VALIDATION_ERROR);
              }

              targetUrl = nextUrl.toString();
              continue;
            }

            break;
          }
        } finally {
          clearTimeout(timer);
          if (options.signal) {
            options.signal.removeEventListener('abort', onCallerAbort);
          }
        }

        const durationMs = Date.now() - attemptStart;

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          let delayMs = Math.min(settings.backoffBase * Math.pow(2, attempt - 1) * 1000, settings.backoffMax * 1000);
          if (retryAfter) {
            const parsedSeconds = parseInt(retryAfter, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              delayMs = Math.min(parsedSeconds * 1000, 30000);
            }
          }
          if (attempt <= maxRetries && !options.signal?.aborted) {
            logger.info(`Source '${sourceId}' rate-limited (429). Retrying in ${delayMs}ms...`, { sourceId, requestId, attempt, delayMs });
            await this.sleep(delayMs);
            continue;
          } else {
            throw new SourceRateLimitError(sourceId, Math.ceil(delayMs / 1000));
          }
        }

        if ([408, 500, 502, 503, 504].includes(response.status)) {
          if (attempt <= maxRetries && !options.signal?.aborted) {
            const jitter = Math.random() * 500;
            const delayMs = Math.min(settings.backoffBase * Math.pow(2, attempt - 1) * 1000 + jitter, settings.backoffMax * 1000);
            logger.info(`Source '${sourceId}' responded with HTTP ${response.status}. Retrying in ${Math.round(delayMs)}ms...`, { sourceId, status: response.status, attempt, delayMs });
            await this.sleep(delayMs);
            continue;
          }
        }

        if (response.status === 401 || response.status === 403) {
          throw new SourceAuthenticationError(sourceId, `Source '${sourceId}' rejected request with HTTP ${response.status}`);
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new SourceError(`Source '${sourceId}' HTTP ${response.status}: ${response.statusText || 'Error'}`, sourceId, ErrorCode.SOURCE_INVALID_RESPONSE, { status: response.status, body: errText.slice(0, 300) });
        }

        const contentType = response.headers.get('content-type') || '';
        let data: any;
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data,
          durationMs,
          requestId,
          retryCount: attempt - 1
        };
      } catch (err: any) {
        if (options.signal?.aborted) {
          throw new SourceError(`Request aborted by caller`, sourceId, ErrorCode.SOURCE_UNAVAILABLE, { aborted: true });
        }

        const isAbort = err.name === 'AbortError' || err.code === 'ABORT_ERR' || err.cause?.name === 'AbortError' || (typeof err.message === 'string' && err.message.toLowerCase().includes('aborted'));

        if (isAbort) {
          if (attempt <= maxRetries) {
            const delayMs = settings.backoffBase * 1000;
            logger.debug(`Request to '${sourceId}' timed out. Retrying (attempt ${attempt + 1})...`, { requestId, sourceId });
            await this.sleep(delayMs);
            continue;
          }
          throw new SourceTimeoutError(sourceId, timeoutMs);
        }

        if (err instanceof AppError) {
          throw err;
        }

        const errMsg = err.cause?.message ? `${err.message} (${err.cause.message})` : err.message;
        if (attempt <= maxRetries) {
          const delayMs = Math.min(settings.backoffBase * Math.pow(2, attempt - 1) * 1000, 10000);
          logger.debug(`Network note querying '${sourceId}': ${errMsg}. Retrying in ${delayMs}ms...`, { requestId, sourceId, error: errMsg });
          await this.sleep(delayMs);
          continue;
        }

        throw new SourceError(`Failed to connect to '${sourceId}': ${errMsg}`, sourceId, ErrorCode.SOURCE_UNAVAILABLE, { originalError: errMsg });
      }
    }

    throw new SourceError(`Source '${sourceId}' exhausted all ${maxRetries} retries`, sourceId, ErrorCode.SOURCE_UNAVAILABLE);
  }

  public async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  public async post<T = any>(url: string, body?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }
}

export const httpClient = HttpClient.getInstance();
