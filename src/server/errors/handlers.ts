import { Request, Response, NextFunction } from 'express';
import { Logger } from '../config/logging.js';

const logger = new Logger('ErrorHandler');

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');
  const message = err.message || 'An unexpected internal error occurred';

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.url} Error: ${message}`, { stack: err.stack });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    },
    request_id: (req as any).requestId
  });
}
