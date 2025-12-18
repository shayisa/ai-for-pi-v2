/**
 * Middleware Chain
 *
 * Composable middleware system for request processing pipeline.
 * Allows building complex middleware chains with error handling and tracing.
 *
 * ## Purpose
 * - Compose multiple middlewares into a chain
 * - Provide consistent error handling across middleware
 * - Enable conditional middleware execution
 * - Support async middleware functions
 *
 * ## Usage
 * ```typescript
 * import { MiddlewareChain, createMiddleware } from './middlewareChain';
 *
 * const chain = new MiddlewareChain()
 *   .use(contextMiddleware)
 *   .use(authMiddleware, { when: (req) => req.intent?.authRequired })
 *   .use(validationMiddleware)
 *   .use(rateLimitMiddleware);
 *
 * // Apply to Express
 * app.use(chain.handler());
 * ```
 *
 * @module control-plane/router/middlewareChain
 */

import type { RequestContext } from '../types';
import { logger, tracer } from '../feedback';
import { getContext, getCorrelationId } from '../invocation/contextManager';
import { ErrorCodes, sendError } from '../invocation/responseBuilder';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Express-like request interface
 */
export interface MiddlewareRequest {
  method?: string;
  path?: string;
  url?: string;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  context?: RequestContext;
  intent?: {
    action: string;
    resource: string;
    authRequired: boolean;
    tools: string[];
  };
  auth?: {
    valid: boolean;
    userId?: string;
    userEmail?: string;
  };
  [key: string]: unknown;
}

/**
 * Express-like response interface
 */
export interface MiddlewareResponse {
  status: (code: number) => MiddlewareResponse;
  json: (data: unknown) => void;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
  headersSent?: boolean;
  [key: string]: unknown;
}

/**
 * Next function type
 */
export type NextFunction = (error?: unknown) => void;

/**
 * Middleware function type
 */
export type Middleware = (
  req: MiddlewareRequest,
  res: MiddlewareResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * Async middleware function type
 */
export type AsyncMiddleware = (
  req: MiddlewareRequest,
  res: MiddlewareResponse
) => Promise<void>;

/**
 * Error handling middleware
 */
export type ErrorMiddleware = (
  error: Error,
  req: MiddlewareRequest,
  res: MiddlewareResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * Middleware condition function
 */
export type MiddlewareCondition = (req: MiddlewareRequest) => boolean;

/**
 * Middleware options
 */
export interface MiddlewareOptions {
  /** Condition for when to run this middleware */
  when?: MiddlewareCondition;
  /** Name for tracing/logging */
  name?: string;
  /** Skip on error */
  skipOnError?: boolean;
}

// =============================================================================
// MIDDLEWARE HELPERS
// =============================================================================

/**
 * Create a named middleware with options
 */
export function createMiddleware(
  fn: Middleware,
  options: MiddlewareOptions = {}
): Middleware {
  const name = options.name || fn.name || 'anonymous';

  const wrappedMiddleware: Middleware = async (req, res, next) => {
    // Check condition
    if (options.when && !options.when(req)) {
      return next();
    }

    const correlationId = req.context?.correlationId || getCorrelationId();

    try {
      logger.debug(
        'middlewareChain',
        'middleware_start',
        `Executing middleware: ${name}`,
        { correlationId, middleware: name }
      );

      await fn(req, res, next);

      logger.debug(
        'middlewareChain',
        'middleware_end',
        `Completed middleware: ${name}`,
        { correlationId, middleware: name }
      );
    } catch (error) {
      const err = error as Error;
      logger.error(
        'middlewareChain',
        'middleware_error',
        `Middleware ${name} failed: ${err.message}`,
        err,
        { correlationId, middleware: name }
      );
      next(error);
    }
  };

  // Preserve function name for debugging
  Object.defineProperty(wrappedMiddleware, 'name', { value: name });

  return wrappedMiddleware;
}

/**
 * Wrap an async function as middleware
 */
export function asyncMiddleware(fn: AsyncMiddleware): Middleware {
  return async (req, res, next) => {
    try {
      await fn(req, res);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create middleware that only runs on specific paths
 */
export function pathMiddleware(
  pattern: string | RegExp,
  middleware: Middleware
): Middleware {
  const regex = typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern;

  return (req, res, next) => {
    const path = req.path || req.url || '';
    if (regex.test(path)) {
      return middleware(req, res, next);
    }
    next();
  };
}

/**
 * Create middleware that only runs on specific methods
 */
export function methodMiddleware(
  methods: string | string[],
  middleware: Middleware
): Middleware {
  const methodList = Array.isArray(methods)
    ? methods.map((m) => m.toUpperCase())
    : [methods.toUpperCase()];

  return (req, res, next) => {
    if (methodList.includes((req.method || '').toUpperCase())) {
      return middleware(req, res, next);
    }
    next();
  };
}

// =============================================================================
// MIDDLEWARE CHAIN CLASS
// =============================================================================

/**
 * Middleware entry in the chain
 */
interface MiddlewareEntry {
  middleware: Middleware;
  options: MiddlewareOptions;
}

/**
 * Middleware chain for composing request handling
 */
export class MiddlewareChain {
  private middlewares: MiddlewareEntry[] = [];
  private errorHandler?: ErrorMiddleware;

  /**
   * Add middleware to the chain
   */
  use(middleware: Middleware, options: MiddlewareOptions = {}): this {
    this.middlewares.push({
      middleware: createMiddleware(middleware, options),
      options,
    });
    return this;
  }

  /**
   * Add conditional middleware
   */
  useWhen(
    condition: MiddlewareCondition,
    middleware: Middleware,
    options: Omit<MiddlewareOptions, 'when'> = {}
  ): this {
    return this.use(middleware, { ...options, when: condition });
  }

  /**
   * Add path-specific middleware
   */
  usePath(
    pattern: string | RegExp,
    middleware: Middleware,
    options: MiddlewareOptions = {}
  ): this {
    return this.use(pathMiddleware(pattern, middleware), options);
  }

  /**
   * Add method-specific middleware
   */
  useMethod(
    methods: string | string[],
    middleware: Middleware,
    options: MiddlewareOptions = {}
  ): this {
    return this.use(methodMiddleware(methods, middleware), options);
  }

  /**
   * Set error handler
   */
  onError(handler: ErrorMiddleware): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Get the number of middlewares in the chain
   */
  get length(): number {
    return this.middlewares.length;
  }

  /**
   * Execute the middleware chain
   */
  async execute(
    req: MiddlewareRequest,
    res: MiddlewareResponse
  ): Promise<void> {
    let index = 0;
    let currentError: Error | undefined;

    const next: NextFunction = (error?: unknown) => {
      if (error) {
        currentError = error instanceof Error ? error : new Error(String(error));
      }
    };

    // Execute middlewares in sequence
    while (index < this.middlewares.length) {
      const { middleware, options } = this.middlewares[index];

      // Skip if there's an error and skipOnError is set
      if (currentError && options.skipOnError) {
        index++;
        continue;
      }

      // Skip if response already sent
      if (res.headersSent) {
        break;
      }

      try {
        await middleware(req, res, next);
      } catch (error) {
        currentError = error instanceof Error ? error : new Error(String(error));
      }

      index++;
    }

    // Handle any errors
    if (currentError && this.errorHandler && !res.headersSent) {
      await this.errorHandler(currentError, req, res, next);
    } else if (currentError && !res.headersSent) {
      // Default error handling
      this.handleError(currentError, req, res);
    }
  }

  /**
   * Default error handler
   */
  private handleError(
    error: Error,
    req: MiddlewareRequest,
    res: MiddlewareResponse
  ): void {
    const correlationId = req.context?.correlationId || getCorrelationId();

    logger.error(
      'middlewareChain',
      'unhandled_error',
      `Unhandled middleware error: ${error.message}`,
      error,
      { correlationId }
    );

    sendError(
      res,
      error.message,
      ErrorCodes.INTERNAL_ERROR,
      correlationId
    );
  }

  /**
   * Create Express-compatible handler
   */
  handler(): Middleware {
    return async (req, res, next) => {
      await this.execute(req, res);
      if (!res.headersSent) {
        next();
      }
    };
  }

  /**
   * Merge another chain into this one
   */
  merge(other: MiddlewareChain): this {
    for (const entry of other.middlewares) {
      this.middlewares.push(entry);
    }
    return this;
  }

  /**
   * Clone the chain
   */
  clone(): MiddlewareChain {
    const cloned = new MiddlewareChain();
    cloned.middlewares = [...this.middlewares];
    cloned.errorHandler = this.errorHandler;
    return cloned;
  }
}

// =============================================================================
// COMMON MIDDLEWARES
// =============================================================================

/**
 * Request logging middleware
 */
export const requestLoggerMiddleware = createMiddleware(
  (req, res, next) => {
    const correlationId = req.context?.correlationId || 'unknown';
    const method = req.method || 'UNKNOWN';
    const path = req.path || req.url || '/';

    logger.info(
      'requestLogger',
      'request_received',
      `${method} ${path}`,
      { correlationId, method, path, ip: req.ip }
    );

    next();
  },
  { name: 'requestLogger' }
);

/**
 * Error recovery middleware
 */
export const errorRecoveryMiddleware: ErrorMiddleware = (error, req, res, next) => {
  const correlationId = req.context?.correlationId || getCorrelationId();

  // Log the error
  logger.error(
    'errorRecovery',
    'request_error',
    `Request failed: ${error.message}`,
    error,
    {
      correlationId,
      path: req.path || req.url,
      method: req.method,
    }
  );

  // Determine error code
  let code: string = ErrorCodes.INTERNAL_ERROR;
  let status = 500;

  if (error.name === 'ValidationError') {
    code = ErrorCodes.VALIDATION_ERROR;
    status = 400;
  } else if (error.name === 'UnauthorizedError') {
    code = ErrorCodes.UNAUTHORIZED;
    status = 401;
  } else if (error.name === 'NotFoundError') {
    code = ErrorCodes.NOT_FOUND;
    status = 404;
  }

  // Send error response
  if (!res.headersSent) {
    res.status(status).json({
      success: false,
      error: {
        code,
        message: error.message,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * CORS middleware factory
 */
export function corsMiddleware(options: {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
} = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID'],
    credentials = false,
  } = options;

  return (req, res, next) => {
    const requestOrigin = req.headers?.origin as string | undefined;

    // Determine allowed origin
    let allowedOrigin = '*';
    if (typeof origin === 'function') {
      allowedOrigin = requestOrigin && origin(requestOrigin) ? requestOrigin : '';
    } else if (Array.isArray(origin)) {
      allowedOrigin = requestOrigin && origin.includes(requestOrigin) ? requestOrigin : '';
    } else {
      allowedOrigin = origin;
    }

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    next();
  };
}

/**
 * Request timeout middleware factory
 */
export function timeoutMiddleware(ms: number): Middleware {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const correlationId = req.context?.correlationId || getCorrelationId();
        logger.warn(
          'timeout',
          'request_timeout',
          `Request timed out after ${ms}ms`,
          { correlationId, path: req.path }
        );

        sendError(
          res,
          `Request timed out after ${ms}ms`,
          ErrorCodes.SERVICE_UNAVAILABLE,
          correlationId
        );
      }
    }, ms);

    // Clear timeout when response ends
    const originalJson = res.json.bind(res);
    res.json = (data: unknown) => {
      clearTimeout(timeout);
      return originalJson(data);
    };

    next();
  };
}

// =============================================================================
// CHAIN FACTORIES
// =============================================================================

/**
 * Create a standard API middleware chain
 */
export function createApiChain(): MiddlewareChain {
  return new MiddlewareChain()
    .use(requestLoggerMiddleware)
    .onError(errorRecoveryMiddleware);
}

/**
 * Create a chain with CORS
 */
export function createCorsChain(
  corsOptions?: Parameters<typeof corsMiddleware>[0]
): MiddlewareChain {
  return createApiChain().use(corsMiddleware(corsOptions), { name: 'cors' });
}
