import http from 'http';
import https from 'https';
import dns from 'dns';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { mediaResolver } from '../services/media_resolver.js';
import { generateCardSvg } from '../services/card_generator.js';
import { getEditorialImage } from '../services/editorial_images.js';
import { isLowQualityMedia, upgradeMediaQuality } from '../utils/media_quality.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('MediaHandler');

interface CachedImage {
  buffer: Buffer;
  contentType: string;
  etag: string;
  expiresAt: number;
}

export class MediaHandler {
  private proxyCache: Map<string, CachedImage> = new Map();
  private maxCacheEntries = 250;
  private currentCacheBytes = 0;
  private maxCacheBytes = 80 * 1024 * 1024; // Strict 80 MB total memory budget
  private positiveTtlMs = 1000 * 60 * 60 * 24 * 3; // 3 days in-memory
  private negativeCache: Map<string, number> = new Map();
  private maxNegativeEntries = 500;
  private negativeTtlMs = 1000 * 30; // 30 seconds for transient failures

  private recordNegative(key: string) {
    if (this.negativeCache.size >= this.maxNegativeEntries) {
      const oldest = this.negativeCache.keys().next().value;
      if (oldest) this.negativeCache.delete(oldest);
    }
    this.negativeCache.set(key, Date.now() + this.negativeTtlMs);
  }

  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;

  // SingleFlight map to deduplicate in-flight media resolution requests across concurrent clients
  private inFlightResolutions: Map<string, Promise<{ imageUrl: string | null }>> = new Map();
  // In-memory fast cache for resolved media URLs
  private resolvedUrlCache: Map<string, { imageUrl: string | null; expiresAt: number }> = new Map();
  private maxResolvedCacheEntries = 1000;
  private resolvedTtlMs = 1000 * 60 * 60 * 24; // 24 hours

  constructor() {
    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 128,
      maxFreeSockets: 32,
      timeout: 5000,
    });
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 128,
      maxFreeSockets: 32,
      timeout: 5000,
    });
  }

  /**
   * Internal deduplicated resolver using SingleFlight pattern
   */
  private async executeDeduplicatedResolution(rawUrl: string, title?: string): Promise<{ imageUrl: string | null }> {
    const cacheKey = rawUrl.trim();
    const cached = this.resolvedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { imageUrl: cached.imageUrl };
    }

    // Check if an existing resolution for this exact URL is already in-flight
    const inFlight = this.inFlightResolutions.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const promise = (async () => {
      try {
        const resolved = await mediaResolver.resolveMedia(rawUrl, title);
        const imageUrl = resolved?.imageUrl || null;
        if (this.resolvedUrlCache.size >= this.maxResolvedCacheEntries) {
          const firstKey = this.resolvedUrlCache.keys().next().value;
          if (firstKey) this.resolvedUrlCache.delete(firstKey);
        }
        this.resolvedUrlCache.set(cacheKey, {
          imageUrl,
          expiresAt: Date.now() + (imageUrl ? this.resolvedTtlMs : 60000) // 1m for negative
        });
        return { imageUrl };
      } catch {
        return { imageUrl: null };
      } finally {
        this.inFlightResolutions.delete(cacheKey);
      }
    })();

    this.inFlightResolutions.set(cacheKey, promise);
    return promise;
  }

  /**
   * Dynamically resolves genuine OpenGraph/publisher media for an article on-demand with SingleFlight deduplication.
   */
  public async resolveArticleMedia(req: any, res: any) {
    const rawUrl = req.query.url as string;
    const title = req.query.title as string;
    const articleId = req.query.articleId as string;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    try {
      const resolved = await this.executeDeduplicatedResolution(rawUrl, title);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      
      if (resolved.imageUrl) {
        if (articleId) {
          const { newsRepository } = await import('../database/repository.js');
          const art = newsRepository.getArticleById(articleId);
          if (art) {
            art.image_url = resolved.imageUrl;
            if (!art.media) art.media = [];
            if (!art.media.some(m => m.url === resolved.imageUrl)) {
              art.media.unshift({
                type: 'image',
                url: resolved.imageUrl,
                source: 'publisher'
              });
            }
            newsRepository.updateArticle(art);
          }
        }
        return res.json({ success: true, imageUrl: resolved.imageUrl });
      }
      return res.json({ success: false, imageUrl: null });
    } catch {
      return res.json({ success: false, imageUrl: null });
    }
  }

  /**
   * Batch resolves genuine OpenGraph media for multiple URLs in a single request.
   */
  public async resolveBatch(req: any, res: any) {
    try {
      const items: Array<{ url: string; title?: string; articleId?: string }> = Array.isArray(req.body?.items)
        ? req.body.items
        : Array.isArray(req.body?.urls)
        ? req.body.urls.map((u: string) => ({ url: u }))
        : [];

      if (!items.length) {
        return res.json({ success: true, results: {} });
      }

      const results: Record<string, string | null> = {};
      const concurrency = 5;
      for (let i = 0; i < items.length; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        await Promise.allSettled(
          chunk.map(async (item) => {
            if (!item.url) return;
            const res = await this.executeDeduplicatedResolution(item.url, item.title);
            results[item.url] = res.imageUrl;
          })
        );
      }

      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.json({
        success: true,
        results,
        count: Object.keys(results).length
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Generates or delivers a real, high-resolution photography image for any article.
   */
  public renderCard(req: any, res: any) {
    const title = (req.query.title as string) || 'AI Technology Dispatch';
    const category = (req.query.category as string) || 'technology';
    const sourceId = (req.query.sourceId as string) || '';
    const domain = (req.query.domain as string) || '';

    const photoUrl = getEditorialImage(title, category, sourceId, domain);
    if (photoUrl.startsWith('/')) {
      const publicPath = path.join(process.cwd(), 'public', photoUrl);
      if (fs.existsSync(publicPath)) {
        const buffer = fs.readFileSync(publicPath);
        const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400, immutable');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(buffer);
      }
    }

    return res.redirect(302, photoUrl);
  }

  /**
   * High-speed proxy with connection pooling, tunneling retry, and zero-latency in-memory caching.
   */
  public async proxyImage(req: any, res: any, next: any) {
    const rawUrl = req.query.url as string;
    const fallbackTitle = (req.query.title as string) || '';
    const fallbackCat = (req.query.category as string) || 'technology';
    const fallbackSource = (req.query.sourceId as string) || '';
    const fallbackDomain = (req.query.domain as string) || '';

    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required "url" parameter' },
        request_id: req.requestId,
      });
    }

    let cleanUrl = rawUrl.trim();

    if (isLowQualityMedia(cleanUrl)) {
      return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
    }

    const upgraded = upgradeMediaQuality(cleanUrl);
    if (upgraded) {
      cleanUrl = upgraded;
    }

    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
      }

      const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80;
      if (port !== 80 && port !== 443) {
        return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
      }

      const cacheKey = parsed.toString();

      // Check positive cache first (Zero Latency hit: <0.5ms)
      const cached = this.proxyCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const clientEtag = req.headers['if-none-match'];
        if (clientEtag && clientEtag === cached.etag) {
          return res.status(304).end();
        }
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Content-Length', cached.buffer.length);
        res.setHeader('ETag', cached.etag);
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400, immutable');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (cached.contentType.includes('svg')) {
          res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
        }
        return res.end(cached.buffer);
      }

      // Check negative cache
      const negExpires = this.negativeCache.get(cacheKey);
      if (negExpires && negExpires > Date.now()) {
        if (fallbackTitle) {
          return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
        }
        return res.status(404).end();
      }

      // SSRF checks
      if (mediaResolver.isPrivateOrRestrictedHost(parsed.hostname)) {
        logger.warn(`Media proxy blocked restricted host: ${parsed.hostname}`);
        this.negativeCache.set(cacheKey, Date.now() + this.negativeTtlMs);
        if (fallbackTitle) {
          return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
        }
        return res.status(403).end();
      }

      const isSafe = await mediaResolver.verifyDnsSafety(parsed.hostname);
      if (!isSafe) {
        logger.warn(`Media proxy blocked unsafe host via DNS: ${parsed.hostname}`);
        this.recordNegative(cacheKey);
        if (fallbackTitle) {
          return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
        }
        return res.status(403).end();
      }

      // Tunneling fetch with redirect following, anti-hotlink bypass, and retry
      const result = await this.tunnelFetch(parsed, 5);
      if (!result) {
        this.recordNegative(cacheKey);
        if (fallbackTitle) {
          return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
        }
        return res.status(404).end();
      }

      // Save to positive cache with strict byte limit eviction
      const etag = `"${crypto.createHash('md5').update(result.buffer).digest('hex')}"`;
      const newItemBytes = result.buffer.length;

      if (newItemBytes <= 5 * 1024 * 1024) {
        while (
          this.proxyCache.size > 0 &&
          (this.currentCacheBytes + newItemBytes > this.maxCacheBytes || this.proxyCache.size >= this.maxCacheEntries)
        ) {
          const oldestKey = this.proxyCache.keys().next().value;
          if (!oldestKey) break;
          const oldItem = this.proxyCache.get(oldestKey);
          if (oldItem) {
            this.currentCacheBytes -= oldItem.buffer.length;
          }
          this.proxyCache.delete(oldestKey);
        }

        this.proxyCache.set(cacheKey, {
          buffer: result.buffer,
          contentType: result.contentType,
          etag,
          expiresAt: Date.now() + this.positiveTtlMs,
        });
        this.currentCacheBytes += newItemBytes;
      }

      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Length', result.buffer.length);
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (result.contentType.includes('svg')) {
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      }

      return res.end(result.buffer);
    } catch (err: any) {
      logger.debug(`Proxy exception for ${rawUrl}: ${err.message}`);
      if (fallbackTitle) {
        return this.sendFallbackCard(res, fallbackTitle, fallbackCat, fallbackSource, fallbackDomain);
      }
      return res.status(404).end();
    }
  }

  private sendFallbackCard(res: any, title: string, category: string, sourceId: string, domain: string) {
    if (res.headersSent) return;
    return res.status(404).json({ success: false, error: 'Media unavailable' });
  }

  /**
   * Executes an intense tunneling fetch with browser emulation headers,
   * internal redirect following, and anti-hotlinking bypass retries.
   */
  private async tunnelFetch(
    url: URL,
    maxRedirects: number = 5,
    customHeaders: Record<string, string> = {}
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    return new Promise(resolve => {
      const client = url.protocol === 'https:' ? https : http;
      const agent = url.protocol === 'https:' ? this.httpsAgent : this.httpAgent;

      const safeLookup = (hostname: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts;
          opts = {};
        }
        dns.lookup(hostname, { all: true, family: 4 }, (err, addresses) => {
          if (err) return cb(err);
          if (!addresses || addresses.length === 0) return cb(new Error('DNS resolution empty'));
          const safe = addresses.filter(addr => !mediaResolver.isPrivateOrRestrictedHost(addr.address));
          if (safe.length === 0) {
            return cb(new Error(`SSRF blocked: IP for host ${hostname} is restricted`));
          }
          if (opts && opts.all) {
            cb(null, safe);
          } else {
            cb(null, safe[0].address, 4);
          }
        });
      };

      const targetOrigin = `${url.protocol}//${url.hostname}`;
      const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `${targetOrigin}/`,
        'Origin': targetOrigin,
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Connection': 'keep-alive',
        ...customHeaders
      };

      const req = client.get(
        url.toString(),
        {
          agent,
          family: 4,
          lookup: safeLookup,
          headers: defaultHeaders,
          timeout: 4000,
        },
        async upstreamRes => {
          // Follow redirects internally to eliminate client roundtrips
          if (upstreamRes.statusCode && upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
            req.destroy();
            if (maxRedirects <= 0) return resolve(null);
            try {
              const nextUrl = new URL(upstreamRes.headers.location, url.toString());
              if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') return resolve(null);
              if (mediaResolver.isPrivateOrRestrictedHost(nextUrl.hostname)) return resolve(null);
              const redirected = await this.tunnelFetch(nextUrl, maxRedirects - 1, customHeaders);
              return resolve(redirected);
            } catch {
              return resolve(null);
            }
          }

          // Anti-hotlink bypass: If 401 or 403, retry once with origin / referer of the target host
          if ((upstreamRes.statusCode === 403 || upstreamRes.statusCode === 401) && !customHeaders['Referer']) {
            req.destroy();
            const retried = await this.tunnelFetch(url, maxRedirects, {
              'Referer': `${url.protocol}//${url.hostname}/`,
              'Origin': `${url.protocol}//${url.hostname}`
            });
            return resolve(retried);
          }

          if (!upstreamRes.statusCode || upstreamRes.statusCode < 200 || upstreamRes.statusCode >= 300) {
            req.destroy();
            return resolve(null);
          }

          const rawContentType = upstreamRes.headers['content-type'] || 'image/jpeg';
          const contentType = rawContentType.split(';')[0].trim().toLowerCase();
          if (contentType.includes('text/html') || contentType.includes('application/json')) {
            req.destroy();
            return resolve(null);
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;
          const maxBytes = 10 * 1024 * 1024; // 10MB max

          upstreamRes.on('data', chunk => {
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
              req.destroy();
              return resolve(null);
            }
            chunks.push(chunk);
          });

          upstreamRes.on('end', () => {
            if (chunks.length === 0) return resolve(null);
            const fullBuffer = Buffer.concat(chunks);
            return resolve({ buffer: fullBuffer, contentType });
          });

          upstreamRes.on('error', () => resolve(null));
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });

      req.on('error', () => resolve(null));
    });
  }
}

export const mediaHandler = new MediaHandler();
