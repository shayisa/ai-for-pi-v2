/**
 * Request Tracing
 *
 * Provides distributed tracing capabilities for the Control Plane.
 * Tracks the full lifecycle of requests across modules.
 *
 * ## Purpose
 * - Trace requests across all Control Plane modules
 * - Visualize request flow for debugging
 * - Measure time spent in each module
 * - Identify bottlenecks
 *
 * ## Usage
 * ```typescript
 * import { tracer, createSpan } from './tracing';
 *
 * // Create a trace for a request
 * const trace = tracer.startTrace('req-abc123', 'newsletter-generation');
 *
 * // Create spans for each operation
 * const span = trace.startSpan('fetch-topics');
 * await fetchTopics();
 * span.end();
 *
 * // Nested spans
 * const parentSpan = trace.startSpan('generate-content');
 * const childSpan = trace.startSpan('call-claude', parentSpan.id);
 * await callClaude();
 * childSpan.end();
 * parentSpan.end();
 *
 * // End trace
 * trace.end();
 * ```
 *
 * @module control-plane/feedback/tracing
 * @see docs/architecture/LOGGING_GUIDE.md
 */

import { RequestContext } from '../types/index.ts';
import { logger, generateCorrelationId } from './logger.ts';

// =============================================================================
// SPAN TYPES
// =============================================================================

/**
 * Span status
 */
export type SpanStatus = 'active' | 'completed' | 'error';

/**
 * Span represents a single operation within a trace
 */
export interface Span {
  /** Unique span ID */
  id: string;
  /** Parent span ID (if nested) */
  parentId?: string;
  /** Operation name */
  name: string;
  /** When the span started */
  startTime: Date;
  /** When the span ended */
  endTime?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Span status */
  status: SpanStatus;
  /** Tags for filtering/grouping */
  tags: Record<string, string>;
  /** Events that occurred during the span */
  events: SpanEvent[];
  /** Error if status is 'error' */
  error?: {
    name: string;
    message: string;
  };
}

/**
 * Event within a span
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** When the event occurred */
  timestamp: Date;
  /** Event attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Trace represents the full lifecycle of a request
 */
export interface Trace {
  /** Correlation ID (same as request) */
  correlationId: string;
  /** Trace name */
  name: string;
  /** When the trace started */
  startTime: Date;
  /** When the trace ended */
  endTime?: Date;
  /** Total duration in milliseconds */
  duration?: number;
  /** All spans in this trace */
  spans: Span[];
  /** Request context */
  context?: Partial<RequestContext>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Tracing configuration
 */
interface TracingConfig {
  /** Whether to enable tracing */
  enabled: boolean;
  /** Maximum spans per trace */
  maxSpansPerTrace: number;
  /** Maximum events per span */
  maxEventsPerSpan: number;
  /** Whether to log trace summaries */
  logSummaries: boolean;
  /** Minimum duration to log (ms) */
  minDurationToLog: number;
}

const DEFAULT_CONFIG: TracingConfig = {
  enabled: true,
  maxSpansPerTrace: 100,
  maxEventsPerSpan: 50,
  logSummaries: true,
  minDurationToLog: 100,
};

let config: TracingConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// TRACE STORAGE
// =============================================================================

/**
 * Active traces (by correlation ID)
 */
const activeTraces = new Map<string, Trace>();

/**
 * Completed traces buffer
 */
const TRACE_BUFFER_SIZE = 200;
const traceBuffer: Trace[] = [];

function addToBuffer(trace: Trace): void {
  traceBuffer.push(trace);
  if (traceBuffer.length > TRACE_BUFFER_SIZE) {
    traceBuffer.shift();
  }
}

// =============================================================================
// SPAN MANAGEMENT
// =============================================================================

/**
 * Generate a unique span ID
 */
function generateSpanId(): string {
  return `span-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a new span
 */
function createSpan(name: string, parentId?: string): Span {
  return {
    id: generateSpanId(),
    parentId,
    name,
    startTime: new Date(),
    status: 'active',
    tags: {},
    events: [],
  };
}

// =============================================================================
// TRACE INTERFACE
// =============================================================================

/**
 * Active trace interface
 */
export interface ActiveTrace {
  /** Correlation ID */
  correlationId: string;
  /** Start a new span */
  startSpan(name: string, parentId?: string): ActiveSpan;
  /** Get a span by ID */
  getSpan(spanId: string): Span | undefined;
  /** Add context to the trace */
  setContext(context: Partial<RequestContext>): void;
  /** End the trace */
  end(): Trace;
  /** Get current trace data */
  getData(): Trace;
}

/**
 * Active span interface
 */
export interface ActiveSpan {
  /** Span ID */
  id: string;
  /** Set a tag */
  setTag(key: string, value: string): void;
  /** Add an event */
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  /** End the span successfully */
  end(): void;
  /** End the span with error */
  error(err: Error): void;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Configure tracing
 */
export function configureTracing(options: Partial<TracingConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset tracing configuration to defaults
 */
export function resetTracingConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

/**
 * Clear all traces (for testing)
 */
export function clearTraces(): void {
  activeTraces.clear();
  traceBuffer.length = 0;
}

/**
 * Get recent completed traces
 */
export function getRecentTraces(
  filter?: {
    name?: string;
    minDuration?: number;
    since?: Date;
  },
  limit = 50
): Trace[] {
  let filtered = [...traceBuffer];

  if (filter?.name) {
    filtered = filtered.filter((t) => t.name.includes(filter.name!));
  }
  if (filter?.minDuration !== undefined) {
    filtered = filtered.filter(
      (t) => t.duration !== undefined && t.duration >= filter.minDuration!
    );
  }
  if (filter?.since) {
    filtered = filtered.filter((t) => t.startTime >= filter.since!);
  }

  return filtered.slice(-limit);
}

/**
 * Get trace by correlation ID
 */
export function getTrace(correlationId: string): Trace | undefined {
  // Check active traces first
  const active = activeTraces.get(correlationId);
  if (active) {
    return active;
  }

  // Check buffer
  return traceBuffer.find((t) => t.correlationId === correlationId);
}

/**
 * Tracer service
 */
export const tracer = {
  /**
   * Start a new trace
   */
  startTrace(correlationId?: string, name = 'request'): ActiveTrace {
    const id = correlationId || generateCorrelationId();

    const trace: Trace = {
      correlationId: id,
      name,
      startTime: new Date(),
      spans: [],
    };

    if (config.enabled) {
      activeTraces.set(id, trace);
    }

    return {
      correlationId: id,

      startSpan(spanName: string, parentId?: string): ActiveSpan {
        if (!config.enabled) {
          // Return a no-op span
          return {
            id: 'noop',
            setTag: () => {},
            addEvent: () => {},
            end: () => {},
            error: () => {},
          };
        }

        if (trace.spans.length >= config.maxSpansPerTrace) {
          logger.warn(
            'tracing',
            'span_limit',
            `Max spans reached for trace ${id}`,
            { limit: config.maxSpansPerTrace }
          );
          return {
            id: 'limit-exceeded',
            setTag: () => {},
            addEvent: () => {},
            end: () => {},
            error: () => {},
          };
        }

        const span = createSpan(spanName, parentId);
        trace.spans.push(span);

        return {
          id: span.id,

          setTag(key: string, value: string): void {
            span.tags[key] = value;
          },

          addEvent(eventName: string, attributes?: Record<string, unknown>): void {
            if (span.events.length >= config.maxEventsPerSpan) {
              return;
            }
            span.events.push({
              name: eventName,
              timestamp: new Date(),
              attributes,
            });
          },

          end(): void {
            span.endTime = new Date();
            span.duration = span.endTime.getTime() - span.startTime.getTime();
            span.status = 'completed';
          },

          error(err: Error): void {
            span.endTime = new Date();
            span.duration = span.endTime.getTime() - span.startTime.getTime();
            span.status = 'error';
            span.error = {
              name: err.name,
              message: err.message,
            };
          },
        };
      },

      getSpan(spanId: string): Span | undefined {
        return trace.spans.find((s) => s.id === spanId);
      },

      setContext(context: Partial<RequestContext>): void {
        trace.context = context;
      },

      end(): Trace {
        trace.endTime = new Date();
        trace.duration = trace.endTime.getTime() - trace.startTime.getTime();

        // Close any open spans
        for (const span of trace.spans) {
          if (span.status === 'active') {
            span.endTime = trace.endTime;
            span.duration = span.endTime.getTime() - span.startTime.getTime();
            span.status = 'completed';
          }
        }

        // Remove from active and add to buffer
        activeTraces.delete(id);
        addToBuffer(trace);

        // Log summary if enabled
        if (
          config.logSummaries &&
          trace.duration >= config.minDurationToLog
        ) {
          const errorSpans = trace.spans.filter((s) => s.status === 'error');
          const logLevel = errorSpans.length > 0 ? 'warn' : 'info';

          logger[logLevel](
            'tracing',
            'trace_complete',
            `Trace "${trace.name}" completed in ${trace.duration}ms with ${trace.spans.length} spans`,
            {
              correlationId: trace.correlationId,
              duration: trace.duration,
              spanCount: trace.spans.length,
              errorCount: errorSpans.length,
            }
          );
        }

        return trace;
      },

      getData(): Trace {
        return trace;
      },
    };
  },

  /**
   * Get an existing active trace
   */
  getActiveTrace(correlationId: string): ActiveTrace | undefined {
    const trace = activeTraces.get(correlationId);
    if (!trace) {
      return undefined;
    }

    // Return the same interface
    return this.startTrace(correlationId, trace.name);
  },

  /**
   * Check if a trace is active
   */
  isActive(correlationId: string): boolean {
    return activeTraces.has(correlationId);
  },

  /**
   * Get count of active traces
   */
  getActiveCount(): number {
    return activeTraces.size;
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a span for a function execution
 *
 * @example
 * const result = await withSpan(trace, 'fetch-data', async (span) => {
 *   span.setTag('source', 'api');
 *   return await fetchData();
 * });
 */
export async function withSpan<T>(
  trace: ActiveTrace,
  name: string,
  fn: (span: ActiveSpan) => Promise<T>
): Promise<T> {
  const span = trace.startSpan(name);
  try {
    const result = await fn(span);
    span.end();
    return result;
  } catch (error) {
    span.error(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Format a trace as a string for debugging
 */
export function formatTrace(trace: Trace): string {
  const lines: string[] = [];
  lines.push(`Trace: ${trace.name} [${trace.correlationId}]`);
  lines.push(`Duration: ${trace.duration}ms`);
  lines.push(`Spans: ${trace.spans.length}`);
  lines.push('');

  // Build span tree
  const rootSpans = trace.spans.filter((s) => !s.parentId);

  function formatSpan(span: Span, indent: number): void {
    const status =
      span.status === 'error'
        ? '❌'
        : span.status === 'completed'
          ? '✓'
          : '⏳';
    const prefix = '  '.repeat(indent);
    lines.push(
      `${prefix}${status} ${span.name} (${span.duration || 0}ms)`
    );

    // Format events
    for (const event of span.events) {
      lines.push(`${prefix}  └ ${event.name}`);
    }

    // Format children
    const children = trace.spans.filter((s) => s.parentId === span.id);
    for (const child of children) {
      formatSpan(child, indent + 1);
    }
  }

  for (const span of rootSpans) {
    formatSpan(span, 0);
  }

  return lines.join('\n');
}
