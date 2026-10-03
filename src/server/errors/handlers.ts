import { Request, Response, NextFunction } from 'express';
import { Logger } from '../config/logging.js';

const logger = new Logger('ErrorHandler');

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');
  const internalMessage = err.message || 'An unexpected internal error occurred';

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.url} Error: ${internalMessage}`, { stack: err.stack });
  }

  // BUG-004 fix: Prevent disclosure of internal error details and stack messages on 5xx errors
  const clientMessage = statusCode >= 500
    ? 'An unexpected internal server error occurred'
    : internalMessage;

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: clientMessage
    },
    request_id: (req as any).requestId
  });
}
