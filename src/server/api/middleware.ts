import crypto from 'crypto';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { settings } from '../config/settings.js';
import { Logger } from '../config/logging.js';

const logger = new Logger('HttpMiddleware');

if (!process.env.NODE_ENV) {
  logger.warn('NODE_ENV is not set; defaulting to strict production security mode (admin authentication required)');
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const rawClientReqId = req.headers['x-request-id'];
  const clientReqId = typeof rawClientReqId === 'string' && /^[a-zA-Z0-9_\-\.]{1,64}$/.test(rawClientReqId)
    ? rawClientReqId
    : null;
  const serverReqId = `req_${crypto.randomBytes(6).toString('hex')}`;
  const finalReqId = clientReqId ? `${serverReqId}_${clientReqId}` : serverReqId;
  (req as any).requestId = finalReqId;
  res.setHeader('X-Request-ID', finalReqId);
  next();
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const reqId = (req as any).requestId;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      requestId: reqId,
      ip: req.ip
    });
  });

  next();
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /\.run\.app$/,
  /\.google\.com$/,
  /\.googleusercontent\.com$/,
  /\.antigravity\.ai$/,
  /(^|\.)ai\.studio$/,
  /\.web\.app$/,
  /\.firebaseapp\.com$/
];

export const corsMiddleware = cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser direct curl / server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    try {
      const parsed = new URL(origin);
      const host = parsed.hostname;

      // 1. Verify against allowed patterns (Cloud Run, Google AI Studio preview, localhost)
      for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
        if (pattern.test(host)) {
          return callback(null, true);
        }
      }

      // 2. Verify against explicitly configured CORS origins
      if (settings.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 3. Verify against configured application URL
      if (settings.appUrl) {
        try {
          if (origin === settings.appUrl || parsed.origin === new URL(settings.appUrl).origin) {
            return callback(null, true);
          }
        } catch {}
      }
    } catch {}

    // Untrusted origin rejected
    callback(new Error(`Not allowed by CORS policy: Origin ${origin} is not permitted`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Admin-Key',
    'X-API-Key',
    'Accept'
  ]
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateLimitMap.entries()) {
    if (now > bucket.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);
rateLimitCleanupInterval.unref?.();

export function rateLimitMiddleware(limitPerMinute = 180) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = rateLimitMap.get(ip);

    if (!bucket || now > bucket.resetAt) {
      if (bucket) {
        rateLimitMap.delete(ip);
      }
      bucket = { count: 1, resetAt: now + 60000 };
      rateLimitMap.set(ip, bucket);
    } else {
      bucket.count++;
    }

    res.setHeader('X-RateLimit-Limit', limitPerMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limitPerMinute - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > limitPerMinute) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit is ${limitPerMinute} requests per minute.`
        },
        request_id: (req as any).requestId
      });
    }

    next();
  };
}

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-admin-key'] || req.headers['x-api-key'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof customHeader === 'string') {
    token = customHeader.trim();
  }

  const configuredKey = settings.adminApiKey;
  if (configuredKey) {
    if (token) {
      const tokenBuf = Buffer.from(token);
      const keyBuf = Buffer.from(configuredKey);
      if (tokenBuf.length === keyBuf.length && crypto.timingSafeEqual(tokenBuf, keyBuf)) {
        return next();
      }
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing admin authentication token'
      },
      request_id: (req as any).requestId
    });
  }

  if (process.env.ALLOW_DEV_ADMIN_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
    logger.warn('Admin route accessed via explicit dev bypass (ALLOW_DEV_ADMIN_BYPASS=true)');
    return next();
  }

  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Admin access requires a configured ADMIN_API_KEY or explicit ALLOW_DEV_ADMIN_BYPASS in development'
    },
    request_id: (req as any).requestId
  });
}
