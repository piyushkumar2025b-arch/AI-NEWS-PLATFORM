import { ErrorCode } from './codes.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = ErrorCode.INTERNAL_ERROR) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, ErrorCode.VALIDATION_ERROR);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, ErrorCode.NOT_FOUND);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 401, ErrorCode.UNAUTHORIZED);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED);
  }
}

export class SourceError extends AppError {
  public sourceId: string;
  public details?: any;

  constructor(message: string, sourceId: string, code: string = ErrorCode.SOURCE_UNAVAILABLE, details?: any) {
    super(message, 502, code);
    this.sourceId = sourceId;
    this.details = details;
  }
}

export class SourceTimeoutError extends SourceError {
  constructor(sourceId: string, timeoutMs: number) {
    super(`Request to source '${sourceId}' timed out after ${timeoutMs}ms`, sourceId, ErrorCode.SOURCE_TIMEOUT);
  }
}

export class SourceRateLimitError extends SourceError {
  public retryAfterSeconds?: number;

  constructor(sourceId: string, retryAfterSeconds?: number) {
    super(`Source '${sourceId}' exceeded rate limit. Retry after ${retryAfterSeconds || 'some'} seconds.`, sourceId, ErrorCode.SOURCE_RATE_LIMIT);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class SourceAuthenticationError extends SourceError {
  constructor(sourceId: string, message?: string) {
    super(message || `Authentication failed for source '${sourceId}'`, sourceId, ErrorCode.UNAUTHORIZED);
  }
}

export class ParserError extends AppError {
  constructor(message: string) {
    super(message, 422, ErrorCode.PROTOCOL_ERROR);
  }
}

