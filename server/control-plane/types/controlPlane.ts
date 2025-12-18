/**
 * Control Plane Type Definitions
 *
 * Central type definitions for the Control Plane architecture.
 * All modules import types from here to ensure consistency.
 *
 * @module control-plane/types
 * @see docs/architecture/CONTROL_PLANE.md
 */

// =============================================================================
// LOGGING & TRACING TYPES
// =============================================================================

/**
 * Log severity levels following RFC 5424 syslog standard
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure for structured logging
 *
 * Every log entry includes a correlationId for request tracing.
 * This enables debugging by following a single request across all modules.
 *
 * @example
 * {
 *   correlationId: 'req-abc123',
 *   timestamp: new Date(),
 *   level: 'info',
 *   module: 'newsletter',
 *   action: 'generate',
 *   message: 'Newsletter generated successfully',
 *   duration: 1234,
 *   metadata: { sections: 3, imageCount: 3 }
 * }
 */
export interface LogEntry {
  /** Unique ID to trace request across modules */
  correlationId: string;
  /** When the log was created */
  timestamp: Date;
  /** Severity level */
  level: LogLevel;
  /** Which module generated this log */
  module: string;
  /** What action was being performed */
  action: string;
  /** Human-readable message */
  message: string;
  /** Duration in milliseconds (for performance tracking) */
  duration?: number;
  /** Additional context data */
  metadata?: Record<string, unknown>;
  /** User ID if authenticated */
  userId?: string;
  /** Error details if level is 'error' */
  error?: ErrorInfo;
}

/**
 * Error information structure for logging
 */
export interface ErrorInfo {
  /** Error class name */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace (only in development) */
  stack?: string;
  /** Error code for categorization */
  code?: string;
}

// =============================================================================
// REQUEST CONTEXT TYPES
// =============================================================================

/**
 * Request context passed through the Control Plane
 *
 * Contains all information needed to process and trace a request.
 */
export interface RequestContext {
  /** Unique ID for this request (used in all logs) */
  correlationId: string;
  /** When the request started (timestamp in ms) */
  startTime: number;
  /** User ID if authenticated */
  userId?: string;
  /** User email if available */
  userEmail?: string;
  /** Source of the request */
  source?: 'api' | 'internal' | 'scheduled';
  /** Original request metadata */
  request?: {
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
  };
  /** Accumulated metadata during processing */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// INVOCATION TYPES
// =============================================================================

/**
 * Result of a Control Plane invocation
 */
export interface InvocationResult<T = unknown> {
  /** Whether the invocation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: ControlPlaneError;
  /** Request correlation ID */
  correlationId?: string;
  /** How long the invocation took (ms) */
  duration?: number;
  /** Execution metadata */
  metadata?: {
    /** Which tool was invoked */
    toolId?: string;
    /** Timestamp of completion */
    completedAt?: Date;
    /** Additional metadata */
    [key: string]: unknown;
  };
}

/**
 * Control Plane error structure
 */
export interface ControlPlaneError {
  /** Error code for categorization */
  code: string;
  /** Human-readable message */
  message: string;
  /** Whether the client can retry */
  recoverable?: boolean;
  /** Suggested retry delay in ms */
  retryAfter?: number;
  /** Additional error context */
  details?: Record<string, unknown>;
}

// =============================================================================
// TOOL REGISTRY TYPES
// =============================================================================

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  /** Request correlation ID */
  correlationId: string;
  /** User ID if authenticated */
  userId?: string;
  /** User email if available */
  userEmail?: string;
  /** Result from previous tool in chain */
  previousResult?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool categories for organization and filtering
 */
export type ToolCategory = 'ai' | 'storage' | 'email' | 'auth' | 'data' | 'search';

/**
 * Rate limit tiers
 */
export type RateLimitTier = 'low' | 'medium' | 'high' | 'unlimited';

/**
 * Tool definition in the registry
 */
export interface Tool {
  /** Unique tool identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** Rate limit tier */
  rateLimitTier: RateLimitTier;
  /** Whether authentication is required */
  requiresAuth: boolean;
  /** Authentication type if required */
  authType?: 'api_key' | 'oauth' | 'none';
  /** Input validation schema reference */
  inputSchemaRef?: string;
  /** Output validation schema reference */
  outputSchemaRef?: string;
  /** Tool-specific metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Validation result structure
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if failed */
  errors?: ValidationError[];
  /** Sanitized input if successful */
  sanitizedInput?: unknown;
}

/**
 * Single validation error
 */
export interface ValidationError {
  /** Field path that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Expected value/type */
  expected?: string;
  /** Received value/type */
  received?: string;
}

// =============================================================================
// INTENT RESOLUTION TYPES
// =============================================================================

/**
 * Resolved intent from a request
 */
export interface ResolvedIntent {
  /** Action being performed */
  action: string;
  /** Resource being acted upon */
  resource: string;
  /** Sub-action if applicable */
  subAction?: string;
  /** Tools needed to fulfill this intent */
  tools: string[];
  /** Whether authentication is required */
  authRequired: boolean;
  /** Execution plan */
  executionPlan: ExecutionStep[];
}

/**
 * Single step in an execution plan
 */
export interface ExecutionStep {
  /** Step order (0-indexed) */
  order: number;
  /** Tool to execute */
  toolId: string;
  /** Whether this step can run in parallel with others */
  parallel: boolean;
  /** Steps this depends on (must complete first) */
  dependsOn: number[];
  /** Timeout in milliseconds */
  timeout?: number;
}

// =============================================================================
// AUDIT TYPES
// =============================================================================

/**
 * Audit log entry for security-sensitive operations
 */
export interface AuditEntry {
  /** Unique audit entry ID */
  id: string;
  /** When the action occurred */
  timestamp: Date;
  /** Request correlation ID */
  correlationId: string;
  /** User who performed the action */
  userId?: string;
  /** User email */
  userEmail?: string;
  /** Type of action */
  action: AuditAction;
  /** Resource type */
  resourceType: string;
  /** Resource identifier */
  resourceId?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** IP address of the requester */
  ipAddress?: string;
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Audit action types
 */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'auth_success'
  | 'auth_failure'
  | 'api_key_validate'
  | 'oauth_grant'
  | 'oauth_revoke'
  | 'export'
  | 'send_email';

// =============================================================================
// METRICS TYPES
// =============================================================================

/**
 * Performance metrics for a module/operation
 */
export interface Metrics {
  /** Module name */
  module: string;
  /** Operation name */
  operation: string;
  /** Number of invocations */
  count: number;
  /** Total duration across all invocations (ms) */
  totalDuration: number;
  /** Average duration (ms) */
  avgDuration: number;
  /** Min duration (ms) */
  minDuration: number;
  /** Max duration (ms) */
  maxDuration: number;
  /** Number of errors */
  errorCount: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** When metrics collection started */
  startedAt: Date;
  /** When metrics were last updated */
  lastUpdatedAt: Date;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Whether the limit is exceeded */
  exceeded?: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Total requests allowed in window */
  limit: number;
  /** When the window resets */
  resetAt?: Date;
  /** Retry after (seconds) if exceeded */
  retryAfter?: number;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data if successful */
  data?: T;
  /** Error details if failed */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** Response metadata */
  meta?: {
    correlationId: string;
    duration: number;
    timestamp: string;
  };
}
