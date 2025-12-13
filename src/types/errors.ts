/**
 * Error Types for AI Newsletter Generator v2
 *
 * Hierarchy:
 * - RecoverableError: User can retry (network, rate limit, timeout)
 * - FatalError: Cannot recover automatically (auth, validation, config)
 * - UnexpectedError: Bugs that should not happen
 */

// =============================================================================
// BASE ERROR CLASSES
// =============================================================================

/**
 * Base class for errors that can be recovered from by retrying
 */
export class RecoverableError extends Error {
  constructor(
    message: string,
    public retryFn?: () => Promise<void>,
    public retryDelay: number = 1000
  ) {
    super(message);
    this.name = 'RecoverableError';
    Object.setPrototypeOf(this, RecoverableError.prototype);
  }
}

/**
 * Base class for errors that cannot be recovered automatically
 */
export class FatalError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'FatalError';
    Object.setPrototypeOf(this, FatalError.prototype);
  }
}

// =============================================================================
// RECOVERABLE ERRORS
// =============================================================================

/**
 * Network-related errors (connection refused, DNS failure, etc.)
 */
export class NetworkError extends RecoverableError {
  constructor(message: string, retryFn?: () => Promise<void>) {
    super(message, retryFn, 1000);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Rate limiting errors from APIs
 */
export class RateLimitError extends RecoverableError {
  constructor(
    message: string,
    public retryAfter: number,
    retryFn?: () => Promise<void>
  ) {
    super(message, retryFn, retryAfter);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends RecoverableError {
  constructor(message: string, retryFn?: () => Promise<void>) {
    super(message, retryFn, 0);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Temporary service unavailable errors (503, etc.)
 */
export class ServiceUnavailableError extends RecoverableError {
  constructor(
    message: string,
    public serviceName: string,
    retryFn?: () => Promise<void>
  ) {
    super(message, retryFn, 5000);
    this.name = 'ServiceUnavailableError';
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

// =============================================================================
// FATAL ERRORS
// =============================================================================

/**
 * Authentication errors (invalid API key, expired token, etc.)
 */
export class AuthenticationError extends FatalError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization errors (insufficient permissions)
 */
export class AuthorizationError extends FatalError {
  constructor(message: string, public requiredPermission?: string) {
    super(message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Validation errors (invalid input data)
 */
export class ValidationError extends FatalError {
  constructor(
    message: string,
    public fields?: string[],
    public details?: Record<string, string>
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Configuration errors (missing environment variables, etc.)
 */
export class ConfigurationError extends FatalError {
  constructor(
    message: string,
    public missingConfig: string
  ) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends FatalError {
  constructor(
    message: string,
    public resourceType: string,
    public resourceId?: string
  ) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

// =============================================================================
// ERROR STATE FOR UI
// =============================================================================

/**
 * Standard error state structure for React components
 */
export interface ErrorState {
  message: string;
  onRetry?: () => Promise<void>;
  code?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Create an ErrorState from any error
 */
export function createErrorState(
  error: unknown,
  defaultRetryFn?: () => Promise<void>
): ErrorState {
  if (error instanceof RecoverableError) {
    return {
      message: error.message,
      onRetry: error.retryFn || defaultRetryFn,
      code: error.name,
      recoverable: true,
    };
  }

  if (error instanceof FatalError) {
    return {
      message: error.message,
      code: error.code,
      recoverable: false,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
      onRetry: defaultRetryFn,
      recoverable: true,
    };
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    onRetry: defaultRetryFn,
    recoverable: true,
  };
}

// =============================================================================
// ERROR UTILITIES
// =============================================================================

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: unknown): error is RecoverableError {
  return error instanceof RecoverableError;
}

/**
 * Check if an error is fatal
 */
export function isFatalError(error: unknown): error is FatalError {
  return error instanceof FatalError;
}

/**
 * Convert HTTP status code to appropriate error type
 */
export function httpErrorFromStatus(
  status: number,
  message: string,
  retryFn?: () => Promise<void>
): Error {
  switch (status) {
    case 400:
      return new ValidationError(message);
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError(message, 'resource');
    case 429:
      return new RateLimitError(message, 60000, retryFn);
    case 500:
    case 502:
    case 504:
      return new NetworkError(message, retryFn);
    case 503:
      return new ServiceUnavailableError(message, 'server', retryFn);
    default:
      return new Error(message);
  }
}

/**
 * User-friendly error messages mapping
 */
export const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  AUTH_ERROR: 'Your API key is invalid or expired. Please check your settings.',
  AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  CONFIG_ERROR: 'The application is not properly configured. Please contact support.',
  NOT_FOUND: 'The requested resource was not found.',
  NetworkError: 'Unable to connect. Please check your internet connection.',
  RateLimitError: 'Too many requests. Please wait a moment and try again.',
  TimeoutError: 'The request took too long. Please try again.',
  ServiceUnavailableError: 'The service is temporarily unavailable. Please try again later.',
};

/**
 * Get user-friendly message for an error
 */
export function getUserFriendlyMessage(error: ErrorState): string {
  if (error.code && USER_FRIENDLY_MESSAGES[error.code]) {
    return USER_FRIENDLY_MESSAGES[error.code];
  }
  return error.message;
}
