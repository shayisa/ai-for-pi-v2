/**
 * Request Processor
 *
 * Central request processing engine that orchestrates:
 * - Intent classification
 * - Authentication resolution
 * - Validation
 * - Tool execution
 * - Response building
 *
 * ## Purpose
 * - Process requests through the complete Control Plane pipeline
 * - Coordinate between all Control Plane modules
 * - Handle execution plans with sequential/parallel tool calls
 * - Provide consistent error handling and recovery
 *
 * ## Usage
 * ```typescript
 * import { processRequest, createRequestHandler } from './requestProcessor';
 *
 * // Process a request
 * const result = await processRequest(req, res);
 *
 * // Create Express handler
 * app.post('/api/generate', createRequestHandler('newsletter.generate'));
 * ```
 *
 * @module control-plane/invocation/requestProcessor
 */

import type { RequestContext, InvocationResult, ResolvedIntent, ExecutionStep } from '../types/index.ts';
import { classifyIntent, resolveAuth, getAuthType } from '../resolver/index.ts';
import { getTool, getEnabledTool } from '../registration/index.ts';
import { logger, tracer, metrics, auditTrail } from '../feedback/index.ts';
import { validateInput } from '../validators/index.ts';
import {
  createContextFromRequest,
  withContext,
  withAuth,
  withIntent,
  getElapsedTime,
} from './contextManager.ts';
import {
  ResponseBuilder,
  ErrorCodes,
  errorCodeToStatus,
  type ApiResponse,
} from './responseBuilder.ts';
import type { ZodSchema } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Request handler options
 */
export interface RequestHandlerOptions {
  /** Input validation schema */
  inputSchema?: ZodSchema;
  /** Output validation schema */
  outputSchema?: ZodSchema;
  /** Override authentication type */
  authType?: 'api_key' | 'oauth' | 'none';
  /** Custom timeout in ms */
  timeout?: number;
  /** Skip rate limiting */
  skipRateLimit?: boolean;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  correlationId: string;
  userId?: string;
  userEmail?: string;
  previousResult?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Express-like request interface
 */
export interface ExpressRequest {
  method: string;
  path: string;
  url?: string;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  context?: RequestContext;
}

/**
 * Express-like response interface
 */
export interface ExpressResponse {
  status: (code: number) => ExpressResponse;
  json: (data: unknown) => void;
  send: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

// =============================================================================
// REQUEST PROCESSING
// =============================================================================

/**
 * Process a request through the Control Plane pipeline
 */
export async function processRequest<T = unknown>(
  req: ExpressRequest,
  options: RequestHandlerOptions = {}
): Promise<InvocationResult<T>> {
  // Create or get existing context
  const context = req.context || createContextFromRequest(req);
  const trace = tracer.startTrace(context.correlationId, `${req.method} ${req.path}`);
  const log = logger;

  try {
    // Step 1: Classify intent
    const classifySpan = trace.startSpan('classify_intent');
    const intent = classifyIntent(req.method, req.path);
    classifySpan.end();

    if (!intent) {
      log.warn(
        'requestProcessor',
        'no_intent_match',
        `No intent match for ${req.method} ${req.path}`,
        { correlationId: context.correlationId }
      );

      return {
        success: false,
        correlationId: context.correlationId,
        duration: getElapsedTime(context),
        error: {
          code: ErrorCodes.ROUTE_NOT_FOUND,
          message: `No handler found for ${req.method} ${req.path}`,
        },
      };
    }

    // Update context with intent
    const contextWithIntent = withIntent(context, {
      action: intent.action,
      resource: intent.resource,
      tools: intent.tools,
    });

    log.info(
      'requestProcessor',
      'intent_classified',
      `Intent: ${intent.resource}.${intent.action}`,
      {
        correlationId: context.correlationId,
        tools: intent.tools,
        authRequired: intent.authRequired,
      }
    );

    // Step 2: Authenticate if required
    if (intent.authRequired) {
      const authSpan = trace.startSpan('authenticate');
      const authType = options.authType || getAuthType(req.method, req.path);

      const authResult = await resolveAuth(req.headers, authType, {
        correlationId: context.correlationId,
        service: intent.tools[0], // Primary tool determines service
        ipAddress: req.ip,
      });

      authSpan.end();

      if (!authResult.valid) {
        log.warn(
          'requestProcessor',
          'auth_failed',
          `Authentication failed: ${authResult.error?.message}`,
          { correlationId: context.correlationId }
        );

        return {
          success: false,
          correlationId: context.correlationId,
          duration: getElapsedTime(context),
          error: {
            code: authResult.error?.code || ErrorCodes.UNAUTHORIZED,
            message: authResult.error?.message || 'Authentication failed',
          },
        };
      }

      // Update context with auth
      withAuth(contextWithIntent, {
        userId: authResult.userId,
        userEmail: authResult.userEmail,
        service: authResult.service,
        authType: authResult.type,
      });
    }

    // Step 3: Validate input if schema provided
    if (options.inputSchema && req.body) {
      const validateSpan = trace.startSpan('validate_input');
      const validation = validateInput(req.body, options.inputSchema);
      validateSpan.end();

      if (!validation.success) {
        const validationErrors = 'error' in validation ? validation.error.errors : [];
        log.warn(
          'requestProcessor',
          'validation_failed',
          'Input validation failed',
          {
            correlationId: context.correlationId,
            errors: validationErrors,
          }
        );

        return {
          success: false,
          correlationId: context.correlationId,
          duration: getElapsedTime(context),
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Input validation failed',
            details: { errors: validationErrors },
          },
        };
      }
    }

    // Step 4: Check rate limits (unless skipped)
    if (!options.skipRateLimit) {
      const primaryTool = intent.tools[0];
      const tool = getTool(primaryTool);
      if (tool) {
        // Convert rate limit tier to a numeric limit
        const tierLimits: Record<string, number> = {
          low: 10,
          medium: 50,
          high: 200,
          unlimited: 10000,
        };
        const tier = (tool.metadata?.rateLimitTier as string) || 'medium';
        const limit = tierLimits[tier] || tierLimits.medium;

        const rateLimitResult = metrics.checkRateLimit(primaryTool, limit);

        if (!rateLimitResult.allowed) {
          log.warn(
            'requestProcessor',
            'rate_limited',
            `Rate limit exceeded for ${primaryTool}`,
            {
              correlationId: context.correlationId,
              tool: primaryTool,
              resetAt: rateLimitResult.resetAt,
            }
          );

          return {
            success: false,
            correlationId: context.correlationId,
            duration: getElapsedTime(context),
            error: {
              code: ErrorCodes.RATE_LIMITED,
              message: `Rate limit exceeded. Try again after ${rateLimitResult.resetAt?.toISOString()}`,
              details: {
                limit: rateLimitResult.limit,
                remaining: rateLimitResult.remaining,
                resetAt: rateLimitResult.resetAt?.toISOString(),
              },
            },
          };
        }
      }
    }

    // Step 5: Execute tools
    const executeSpan = trace.startSpan('execute_tools');
    const result = await executeIntentPlan<T>(
      intent,
      {
        correlationId: context.correlationId,
        userId: context.userId,
        userEmail: context.userEmail,
      },
      {
        body: req.body,
        params: req.params,
        query: req.query,
      },
      trace,
      options.timeout
    );
    executeSpan.end();

    // Step 6: Record metrics
    metrics.record('request', getElapsedTime(context), {
      intent: `${intent.resource}.${intent.action}`,
      success: result.success,
    });

    trace.end();

    return {
      ...result,
      correlationId: context.correlationId,
      duration: getElapsedTime(context),
    };
  } catch (error) {
    const err = error as Error;
    log.error(
      'requestProcessor',
      'processing_error',
      `Request processing failed: ${err.message}`,
      err,
      {
        correlationId: context.correlationId,
      }
    );

    trace.end();

    return {
      success: false,
      correlationId: context.correlationId,
      duration: getElapsedTime(context),
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: err.message,
      },
    };
  }
}

// =============================================================================
// TOOL EXECUTION
// =============================================================================

/**
 * Execute an intent's execution plan
 */
async function executeIntentPlan<T>(
  intent: ResolvedIntent,
  executionContext: ToolExecutionContext,
  requestData: {
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
  },
  trace: ReturnType<typeof tracer.startTrace>,
  timeout?: number
): Promise<InvocationResult<T>> {
  const { executionPlan } = intent;
  const results: Map<number, unknown> = new Map();
  let finalResult: unknown;

  // Group steps by order for parallel execution
  const stepsByOrder = new Map<number, ExecutionStep[]>();
  for (const step of executionPlan) {
    const existing = stepsByOrder.get(step.order) || [];
    existing.push(step);
    stepsByOrder.set(step.order, existing);
  }

  // Execute steps in order
  const orders = Array.from(stepsByOrder.keys()).sort((a, b) => a - b);

  for (const order of orders) {
    const steps = stepsByOrder.get(order)!;

    // Check dependencies
    for (const step of steps) {
      for (const depOrder of step.dependsOn) {
        if (!results.has(depOrder)) {
          return {
            success: false,
            correlationId: executionContext.correlationId,
            error: {
              code: ErrorCodes.INTERNAL_ERROR,
              message: `Dependency order ${depOrder} not satisfied for tool ${step.toolId}`,
            },
          };
        }
      }
    }

    // Execute steps (in parallel if multiple at same order)
    if (steps.length === 1) {
      const step = steps[0];
      const result = await executeStep(
        step,
        executionContext,
        requestData,
        results,
        trace,
        timeout || step.timeout
      );

      if (!result.success) {
        return result as InvocationResult<T>;
      }

      results.set(order, result.data);
      finalResult = result.data;
    } else {
      // Parallel execution
      const promises = steps.map((step) =>
        executeStep(
          step,
          executionContext,
          requestData,
          results,
          trace,
          timeout || step.timeout
        )
      );

      const stepResults = await Promise.all(promises);

      // Check for failures
      for (let i = 0; i < stepResults.length; i++) {
        if (!stepResults[i].success) {
          return stepResults[i] as InvocationResult<T>;
        }
        results.set(order, stepResults[i].data);
      }

      // Use last result as final
      finalResult = stepResults[stepResults.length - 1].data;
    }
  }

  return {
    success: true,
    correlationId: executionContext.correlationId,
    data: finalResult as T,
  };
}

/**
 * Execute a single step
 */
async function executeStep(
  step: ExecutionStep,
  executionContext: ToolExecutionContext,
  requestData: {
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
  },
  previousResults: Map<number, unknown>,
  trace: ReturnType<typeof tracer.startTrace>,
  timeout?: number
): Promise<InvocationResult<unknown>> {
  const span = trace.startSpan(`tool:${step.toolId}`);

  try {
    // Get the tool
    const tool = getEnabledTool(step.toolId);
    if (!tool) {
      span.error(new Error(`Tool ${step.toolId} not available`));
      return {
        success: false,
        correlationId: executionContext.correlationId,
        error: {
          code: ErrorCodes.TOOL_DISABLED,
          message: `Tool ${step.toolId} is not available or disabled`,
        },
      };
    }

    // Build tool input
    const toolInput = {
      ...(typeof requestData.body === 'object' && requestData.body !== null ? requestData.body : {}),
      params: requestData.params,
      query: requestData.query,
    };

    // Get previous result if depends on other steps
    let previousResult: unknown;
    if (step.dependsOn.length > 0) {
      // Use the most recent dependency result
      const latestDep = Math.max(...step.dependsOn);
      previousResult = previousResults.get(latestDep);
    }

    // Execute with timeout
    const timeoutMs = timeout || step.timeout || 30000;
    const startTime = Date.now();

    const result = await Promise.race([
      tool.handler(toolInput, {
        correlationId: executionContext.correlationId,
        userId: executionContext.userId,
        userEmail: executionContext.userEmail,
        previousResult,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool ${step.toolId} timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    const duration = Date.now() - startTime;

    // Record metrics
    metrics.record(`tool:${step.toolId}`, duration, { success: true });

    span.end();

    return {
      success: true,
      correlationId: executionContext.correlationId,
      data: result,
      duration,
    };
  } catch (error) {
    const err = error as Error;
    span.error(err);

    // Record failure metrics
    metrics.record(`tool:${step.toolId}`, 0, {
      success: false,
      error: err.message,
    });

    return {
      success: false,
      correlationId: executionContext.correlationId,
      error: {
        code: ErrorCodes.TOOL_EXECUTION_ERROR,
        message: err.message,
      },
    };
  }
}

// =============================================================================
// EXPRESS HANDLER FACTORY
// =============================================================================

/**
 * Create an Express request handler for a specific intent
 */
export function createRequestHandler(
  intentPattern: string,
  options: RequestHandlerOptions = {}
) {
  return async (
    req: ExpressRequest,
    res: ExpressResponse
  ): Promise<void> => {
    const result = await processRequest(req, options);

    const builder = new ResponseBuilder(result.correlationId);

    if (result.success) {
      builder.data(result.data).duration(result.duration || 0);
    } else {
      builder
        .error(result.error?.message || 'Unknown error', result.error?.code || ErrorCodes.INTERNAL_ERROR)
        .duration(result.duration || 0);

      if (result.error?.details) {
        builder.errorDetails(result.error.details);
      }
    }

    const response = builder.build();
    res.status(builder.getStatus()).json(response);
  };
}

/**
 * Create a handler that processes requests with context
 */
export function withRequestContext<T>(
  handler: (
    req: ExpressRequest,
    res: ExpressResponse,
    context: RequestContext
  ) => Promise<T>
) {
  return async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    const context = req.context || createContextFromRequest(req);

    await withContext(context, async () => {
      await handler(req, res, context);
    });
  };
}

// =============================================================================
// DIRECT TOOL INVOCATION
// =============================================================================

/**
 * Invoke a tool directly (bypassing intent classification)
 */
export async function invokeTool<T = unknown>(
  toolId: string,
  input: unknown,
  context: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
  } = {}
): Promise<InvocationResult<T>> {
  const correlationId = context.correlationId || `direct-${Date.now()}`;
  const trace = tracer.startTrace(correlationId, `direct:${toolId}`);
  const span = trace.startSpan(`tool:${toolId}`);

  try {
    const tool = getEnabledTool(toolId);
    if (!tool) {
      span.error(new Error(`Tool ${toolId} not available`));
      return {
        success: false,
        correlationId,
        error: {
          code: ErrorCodes.TOOL_DISABLED,
          message: `Tool ${toolId} is not available or disabled`,
        },
      };
    }

    const startTime = Date.now();
    const result = await tool.handler(input, {
      correlationId,
      userId: context.userId,
      userEmail: context.userEmail,
    });

    const duration = Date.now() - startTime;
    metrics.record(`tool:${toolId}`, duration, { success: true, direct: true });

    span.end();
    trace.end();

    return {
      success: true,
      correlationId,
      data: result as T,
      duration,
    };
  } catch (error) {
    const err = error as Error;
    span.error(err);
    trace.end();

    return {
      success: false,
      correlationId,
      error: {
        code: ErrorCodes.TOOL_EXECUTION_ERROR,
        message: err.message,
      },
    };
  }
}
