/**
 * Response Builder
 *
 * Builds standardized API responses with consistent structure,
 * proper status codes, and correlation tracking.
 *
 * ## Purpose
 * - Standardize all API response formats
 * - Include correlation IDs in responses
 * - Handle success and error responses consistently
 * - Support streaming and paginated responses
 *
 * ## Usage
 * ```typescript
 * import { ResponseBuilder, successResponse, errorResponse } from './responseBuilder';
 *
 * // Simple success response
 * res.json(successResponse(data, ctx.correlationId));
 *
 * // Error response
 * res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', ctx.correlationId));
 *
 * // Using builder pattern
 * const response = new ResponseBuilder(ctx)
 *   .data(result)
 *   .meta({ page: 1, total: 100 })
 *   .build();
 * ```
 *
 * @module control-plane/invocation/responseBuilder
 */

import type { RequestContext, InvocationResult } from '../types/index.ts';
import { getCorrelationId } from './contextManager.ts';

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
  correlationId: string;
  timestamp: string;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  /** Request duration in milliseconds */
  duration?: number;
  /** Pagination info */
  pagination?: PaginationMeta;
  /** Rate limit info */
  rateLimit?: RateLimitMeta;
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Rate limit metadata
 */
export interface RateLimitMeta {
  limit: number;
  remaining: number;
  resetAt: string;
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  correlationId?: string,
  meta?: ResponseMeta
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
    correlationId: correlationId || getCorrelationId(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  code: string = 'ERROR',
  correlationId?: string,
  details?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    correlationId: correlationId || getCorrelationId(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a response from an InvocationResult
 */
export function fromInvocationResult<T>(
  result: InvocationResult<T>,
  correlationId?: string
): ApiResponse<T> {
  if (result.success && result.data !== undefined) {
    return successResponse(result.data, correlationId || result.correlationId, {
      duration: result.duration,
    });
  }

  return {
    success: false,
    error: result.error
      ? {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
        }
      : {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
    correlationId: correlationId || result.correlationId,
    timestamp: new Date().toISOString(),
    meta: { duration: result.duration },
  };
}

// =============================================================================
// ERROR CODE MAPPING
// =============================================================================

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Auth errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_OAUTH_TOKEN: 'MISSING_OAUTH_TOKEN',
  INVALID_OAUTH_TOKEN: 'INVALID_OAUTH_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Permission errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

  // Rate limit errors (429)
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TOOL_EXECUTION_ERROR: 'TOOL_EXECUTION_ERROR',

  // Service unavailable (503)
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TOOL_DISABLED: 'TOOL_DISABLED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Map error code to HTTP status
 */
export function errorCodeToStatus(code: string): number {
  const statusMap: Record<string, number> = {
    // 400 Bad Request
    [ErrorCodes.VALIDATION_ERROR]: 400,
    [ErrorCodes.INVALID_INPUT]: 400,
    [ErrorCodes.MISSING_FIELD]: 400,
    [ErrorCodes.INVALID_FORMAT]: 400,

    // 401 Unauthorized
    [ErrorCodes.UNAUTHORIZED]: 401,
    [ErrorCodes.MISSING_API_KEY]: 401,
    [ErrorCodes.INVALID_API_KEY]: 401,
    [ErrorCodes.MISSING_OAUTH_TOKEN]: 401,
    [ErrorCodes.INVALID_OAUTH_TOKEN]: 401,
    [ErrorCodes.TOKEN_EXPIRED]: 401,

    // 403 Forbidden
    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,

    // 404 Not Found
    [ErrorCodes.NOT_FOUND]: 404,
    [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
    [ErrorCodes.ROUTE_NOT_FOUND]: 404,

    // 409 Conflict
    [ErrorCodes.CONFLICT]: 409,
    [ErrorCodes.DUPLICATE_RESOURCE]: 409,

    // 429 Too Many Requests
    [ErrorCodes.RATE_LIMITED]: 429,
    [ErrorCodes.QUOTA_EXCEEDED]: 429,

    // 500 Internal Server Error
    [ErrorCodes.INTERNAL_ERROR]: 500,
    [ErrorCodes.DATABASE_ERROR]: 500,
    [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 500,
    [ErrorCodes.TOOL_EXECUTION_ERROR]: 500,

    // 503 Service Unavailable
    [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
    [ErrorCodes.TOOL_DISABLED]: 503,
  };

  return statusMap[code] || 500;
}

// =============================================================================
// RESPONSE BUILDER CLASS
// =============================================================================

/**
 * Fluent response builder for complex responses
 */
export class ResponseBuilder<T = unknown> {
  private _success: boolean = true;
  private _data?: T;
  private _error?: ApiError;
  private _meta: ResponseMeta = {};
  private _correlationId: string;
  private _statusCode: number = 200;

  constructor(contextOrCorrelationId?: RequestContext | string) {
    if (typeof contextOrCorrelationId === 'string') {
      this._correlationId = contextOrCorrelationId;
    } else if (contextOrCorrelationId) {
      this._correlationId = contextOrCorrelationId.correlationId;
      this._meta.duration = Date.now() - contextOrCorrelationId.startTime;
    } else {
      this._correlationId = getCorrelationId();
    }
  }

  /**
   * Set response data (marks as success)
   */
  data(data: T): this {
    this._success = true;
    this._data = data;
    this._statusCode = 200;
    return this;
  }

  /**
   * Set error (marks as failure)
   */
  error(message: string, code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR): this {
    this._success = false;
    this._error = { code, message };
    this._statusCode = errorCodeToStatus(code);
    return this;
  }

  /**
   * Set error from Error object
   */
  fromError(err: Error, code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR): this {
    this._success = false;
    this._error = {
      code,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
    this._statusCode = errorCodeToStatus(code);
    return this;
  }

  /**
   * Set error details
   */
  errorDetails(details: Record<string, unknown>): this {
    if (this._error) {
      this._error.details = details;
    }
    return this;
  }

  /**
   * Set response metadata
   */
  meta(meta: ResponseMeta): this {
    this._meta = { ...this._meta, ...meta };
    return this;
  }

  /**
   * Set duration in metadata
   */
  duration(ms: number): this {
    this._meta.duration = ms;
    return this;
  }

  /**
   * Set pagination metadata
   */
  pagination(page: number, pageSize: number, total: number): this {
    const totalPages = Math.ceil(total / pageSize);
    this._meta.pagination = {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
    return this;
  }

  /**
   * Set rate limit metadata
   */
  rateLimit(limit: number, remaining: number, resetAt: Date): this {
    this._meta.rateLimit = {
      limit,
      remaining,
      resetAt: resetAt.toISOString(),
    };
    return this;
  }

  /**
   * Set HTTP status code explicitly
   */
  status(code: number): this {
    this._statusCode = code;
    return this;
  }

  /**
   * Get the HTTP status code
   */
  getStatus(): number {
    return this._statusCode;
  }

  /**
   * Build the final response
   */
  build(): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: this._success,
      correlationId: this._correlationId,
      timestamp: new Date().toISOString(),
    };

    if (this._success && this._data !== undefined) {
      response.data = this._data;
    }

    if (!this._success && this._error) {
      response.error = this._error;
    }

    if (Object.keys(this._meta).length > 0) {
      response.meta = this._meta;
    }

    return response;
  }
}

// =============================================================================
// EXPRESS HELPERS
// =============================================================================

/**
 * Send a success response through Express res object
 */
export function sendSuccess<T>(
  res: { status: (code: number) => { json: (data: unknown) => void } },
  data: T,
  correlationId?: string,
  meta?: ResponseMeta,
  status: number = 200
): void {
  res.status(status).json(successResponse(data, correlationId, meta));
}

/**
 * Send an error response through Express res object
 */
export function sendError(
  res: { status: (code: number) => { json: (data: unknown) => void } },
  message: string,
  code: ErrorCode | string = ErrorCodes.INTERNAL_ERROR,
  correlationId?: string,
  details?: Record<string, unknown>
): void {
  const status = errorCodeToStatus(code);
  res.status(status).json(errorResponse(message, code, correlationId, details));
}

/**
 * Send a response from ResponseBuilder
 */
export function sendResponse<T>(
  res: { status: (code: number) => { json: (data: unknown) => void } },
  builder: ResponseBuilder<T>
): void {
  res.status(builder.getStatus()).json(builder.build());
}

// =============================================================================
// RESPONSE TRANSFORMERS
// =============================================================================

/**
 * Wrap a single item response with metadata
 */
export function wrapItem<T>(
  item: T,
  context: RequestContext
): ApiResponse<T> {
  return new ResponseBuilder<T>(context)
    .data(item)
    .build();
}

/**
 * Wrap a list response with pagination
 */
export function wrapList<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
  context: RequestContext
): ApiResponse<T[]> {
  return new ResponseBuilder<T[]>(context)
    .data(items)
    .pagination(page, pageSize, total)
    .build();
}

/**
 * Wrap a created item response (201)
 */
export function wrapCreated<T>(
  item: T,
  context: RequestContext
): ApiResponse<T> {
  return new ResponseBuilder<T>(context)
    .data(item)
    .status(201)
    .build();
}

/**
 * Wrap a deleted response (no content)
 */
export function wrapDeleted(context: RequestContext): ApiResponse<{ deleted: true }> {
  return new ResponseBuilder<{ deleted: true }>(context)
    .data({ deleted: true })
    .build();
}
