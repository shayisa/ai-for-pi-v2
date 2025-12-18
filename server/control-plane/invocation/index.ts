/**
 * Invocation Module - Public Exports
 *
 * Provides request processing, context management, and response building.
 *
 * @module control-plane/invocation
 */

// Context Manager
export {
  generateCorrelationId,
  isValidCorrelationId,
  createContext,
  createContextFromRequest,
  getContext,
  requireContext,
  getCorrelationId,
  withContext,
  withContextSync,
  extendContext,
  withAuth,
  withIntent,
  getElapsedTime,
  finalizeContext,
  contextMiddleware,
  hasContext,
  type CreateContextOptions,
  type RequestWithContext,
} from './contextManager.ts';

// Response Builder
export {
  successResponse,
  errorResponse,
  fromInvocationResult,
  ErrorCodes,
  errorCodeToStatus,
  ResponseBuilder,
  sendSuccess,
  sendError,
  sendResponse,
  wrapItem,
  wrapList,
  wrapCreated,
  wrapDeleted,
  type ApiResponse,
  type ApiError,
  type ResponseMeta,
  type PaginationMeta,
  type RateLimitMeta,
  type ErrorCode,
} from './responseBuilder.ts';

// Request Processor
export {
  processRequest,
  createRequestHandler,
  withRequestContext,
  invokeTool,
  type RequestHandlerOptions,
  type ToolExecutionContext,
  type ExpressRequest,
  type ExpressResponse,
} from './requestProcessor.ts';
