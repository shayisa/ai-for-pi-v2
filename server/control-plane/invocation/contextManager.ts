/**
 * Context Manager
 *
 * Manages request context throughout the request lifecycle.
 * Provides correlation ID generation, context propagation, and cleanup.
 *
 * ## Purpose
 * - Generate and manage correlation IDs
 * - Create and propagate request context
 * - Manage context lifecycle (create, extend, cleanup)
 * - Provide async context storage for cross-module access
 *
 * ## Usage
 * ```typescript
 * import { createContext, getContext, withContext } from './contextManager';
 *
 * // Create context for a new request
 * const ctx = createContext(req);
 *
 * // Access context anywhere in the call stack
 * const currentCtx = getContext();
 *
 * // Execute code with specific context
 * await withContext(ctx, async () => {
 *   // context is available here
 * });
 * ```
 *
 * @module control-plane/invocation/contextManager
 */

import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import type { RequestContext } from '../types/index.ts';
import { logger } from '../feedback/index.ts';

// =============================================================================
// ASYNC CONTEXT STORAGE
// =============================================================================

/**
 * Async local storage for request context
 * Allows accessing context anywhere in the async call stack
 */
const contextStorage = new AsyncLocalStorage<RequestContext>();

// =============================================================================
// CORRELATION ID GENERATION
// =============================================================================

/**
 * Generate a new correlation ID
 * Format: req-{timestamp}-{uuid-prefix}
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const uuid = uuidv4().split('-')[0];
  return `req-${timestamp}-${uuid}`;
}

/**
 * Validate a correlation ID format
 */
export function isValidCorrelationId(id: string): boolean {
  // Support both new format (req-xxx-xxx) and legacy UUIDs
  return /^req-[a-z0-9]+-[a-z0-9]+$/i.test(id) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// =============================================================================
// CONTEXT CREATION
// =============================================================================

/**
 * Options for context creation
 */
export interface CreateContextOptions {
  /** Existing correlation ID to use */
  correlationId?: string;
  /** User ID */
  userId?: string;
  /** User email */
  userEmail?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new request context
 */
export function createContext(options: CreateContextOptions = {}): RequestContext {
  const correlationId = options.correlationId || generateCorrelationId();

  // Validate if existing correlation ID is provided
  if (options.correlationId && !isValidCorrelationId(options.correlationId)) {
    logger.warn(
      'contextManager',
      'invalid_correlation_id',
      `Invalid correlation ID format: ${options.correlationId}, generating new one`,
      { providedId: options.correlationId }
    );
  }

  const context: RequestContext = {
    correlationId,
    startTime: Date.now(),
    userId: options.userId,
    userEmail: options.userEmail,
    metadata: {
      ...options.metadata,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      createdAt: new Date().toISOString(),
    },
  };

  logger.debug(
    'contextManager',
    'context_created',
    `Request context created: ${correlationId}`,
    { userId: options.userId, userEmail: options.userEmail }
  );

  return context;
}

/**
 * Create context from Express request object
 */
export function createContextFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  method?: string;
  path?: string;
  url?: string;
  user?: { id?: string; email?: string };
}): RequestContext {
  // Extract correlation ID from headers or generate new one
  const headerCorrelationId =
    req.headers?.['x-correlation-id'] ||
    req.headers?.['x-request-id'];

  const correlationId =
    typeof headerCorrelationId === 'string'
      ? headerCorrelationId
      : Array.isArray(headerCorrelationId)
        ? headerCorrelationId[0]
        : generateCorrelationId();

  // Extract user agent
  const userAgentHeader = req.headers?.['user-agent'];
  const userAgent =
    typeof userAgentHeader === 'string'
      ? userAgentHeader
      : Array.isArray(userAgentHeader)
        ? userAgentHeader[0]
        : undefined;

  return createContext({
    correlationId,
    userId: req.user?.id,
    userEmail: req.user?.email,
    ipAddress: req.ip,
    userAgent,
    metadata: {
      method: req.method,
      path: req.path || req.url,
    },
  });
}

// =============================================================================
// CONTEXT ACCESS
// =============================================================================

/**
 * Get the current request context from async storage
 * Returns undefined if no context is set
 */
export function getContext(): RequestContext | undefined {
  return contextStorage.getStore();
}

/**
 * Get the current context or throw if none exists
 */
export function requireContext(): RequestContext {
  const ctx = getContext();
  if (!ctx) {
    throw new Error('No request context available. Ensure code runs within withContext()');
  }
  return ctx;
}

/**
 * Get the current correlation ID
 * Returns 'unknown' if no context is set
 */
export function getCorrelationId(): string {
  return getContext()?.correlationId || 'unknown';
}

// =============================================================================
// CONTEXT EXECUTION
// =============================================================================

/**
 * Execute a function with a specific request context
 * The context will be available via getContext() within the function
 */
export async function withContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): Promise<T> {
  return contextStorage.run(context, fn);
}

/**
 * Execute a synchronous function with a specific request context
 */
export function withContextSync<T>(
  context: RequestContext,
  fn: () => T
): T {
  return contextStorage.run(context, fn);
}

// =============================================================================
// CONTEXT EXTENSION
// =============================================================================

/**
 * Extend the current context with additional data
 * Returns a new context object (immutable)
 */
export function extendContext(
  context: RequestContext,
  extensions: Partial<Omit<RequestContext, 'correlationId' | 'startTime'>>
): RequestContext {
  return {
    ...context,
    userId: extensions.userId ?? context.userId,
    userEmail: extensions.userEmail ?? context.userEmail,
    metadata: {
      ...context.metadata,
      ...extensions.metadata,
    },
  };
}

/**
 * Add authentication info to context after auth resolution
 */
export function withAuth(
  context: RequestContext,
  auth: {
    userId?: string;
    userEmail?: string;
    service?: string;
    authType?: 'api_key' | 'oauth' | 'none';
  }
): RequestContext {
  return extendContext(context, {
    userId: auth.userId,
    userEmail: auth.userEmail,
    metadata: {
      authService: auth.service,
      authType: auth.authType,
    },
  });
}

/**
 * Add intent info to context after intent classification
 */
export function withIntent(
  context: RequestContext,
  intent: {
    action: string;
    resource: string;
    tools: string[];
  }
): RequestContext {
  return extendContext(context, {
    metadata: {
      intentAction: intent.action,
      intentResource: intent.resource,
      intentTools: intent.tools,
    },
  });
}

// =============================================================================
// CONTEXT CLEANUP
// =============================================================================

/**
 * Calculate elapsed time from context start
 */
export function getElapsedTime(context: RequestContext): number {
  return Date.now() - context.startTime;
}

/**
 * Finalize context and log completion
 */
export function finalizeContext(
  context: RequestContext,
  result: {
    success: boolean;
    statusCode?: number;
    error?: Error;
  }
): void {
  const duration = getElapsedTime(context);

  if (result.success) {
    logger.info(
      'contextManager',
      'request_completed',
      `Request completed in ${duration}ms`,
      {
        correlationId: context.correlationId,
        duration,
        statusCode: result.statusCode || 200,
        userId: context.userId,
      }
    );
  } else {
    logger.error(
      'contextManager',
      'request_failed',
      `Request failed after ${duration}ms: ${result.error?.message || 'Unknown error'}`,
      result.error || undefined,
      {
        correlationId: context.correlationId,
        duration,
        statusCode: result.statusCode || 500,
        userId: context.userId,
      }
    );
  }
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware to create and attach request context
 */
export function contextMiddleware() {
  return (
    req: { context?: RequestContext; headers?: Record<string, string | string[] | undefined>; ip?: string; method?: string; path?: string; url?: string },
    res: { on?: (event: string, callback: () => void) => void; statusCode?: number },
    next: () => void
  ): void => {
    const context = createContextFromRequest(req);
    req.context = context;

    // Run the rest of the request handling within context
    contextStorage.run(context, () => {
      // Log request completion when response finishes
      if (res.on) {
        res.on('finish', () => {
          finalizeContext(context, {
            success: (res.statusCode || 200) < 400,
            statusCode: res.statusCode,
          });
        });
      }

      next();
    });
  };
}

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

/**
 * Express request with context
 */
export interface RequestWithContext {
  context: RequestContext;
  correlationId: string;
}

/**
 * Type guard to check if request has context
 */
export function hasContext(
  req: { context?: RequestContext }
): req is { context: RequestContext } {
  return req.context !== undefined;
}
