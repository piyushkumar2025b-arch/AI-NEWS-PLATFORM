import { settings } from './settings.js';

const LOG_LEVEL_PRIORITY: Record<string, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['key', 'token', 'secret', 'password', 'authorization', 'apiKey', 'adminApiKey'];
  for (const k of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[k] = '***REDACTED***';
    } else if (typeof sanitized[k] === 'object') {
      sanitized[k] = sanitizeLogData(sanitized[k]);
    }
  }
  return sanitized;
}

export class Logger {
  public context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, any>) {
    const currentPriority = LOG_LEVEL_PRIORITY[settings.logLevel] || 20;
    const targetPriority = LOG_LEVEL_PRIORITY[level];
    if (targetPriority < currentPriority) return;

    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? sanitizeLogData(meta) : undefined;
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(sanitizedMeta || {})
    };

    if (level === 'ERROR') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('DEBUG', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('ERROR', message, meta);
  }

  logFetch(info: {
    sourceId: string;
    status: string;
    durationMs: number;
    itemsReceived: number;
    itemsInserted: number;
    itemsDuplicate: number;
    error?: string | null;
    [key: string]: any;
  }) {
    this.info(
      `FETCH source=${info.sourceId} status=${info.status} duration=${(info.durationMs / 1000).toFixed(2)}s received=${info.itemsReceived} inserted=${info.itemsInserted} duplicate=${info.itemsDuplicate}${info.error ? ` error="${info.error}"` : ''}`,
      {
        ...info,
        durationSec: (info.durationMs / 1000).toFixed(2)
      }
    );
  }
}

export const logger = new Logger('System');
