/**
 * Feedback Module - Public Exports
 *
 * Provides logging, audit trail, metrics, and tracing capabilities
 * for the Control Plane architecture.
 *
 * @module control-plane/feedback
 * @see docs/architecture/LOGGING_GUIDE.md
 */

// Logger exports
export {
  logger,
  createRequestLogger,
  generateCorrelationId,
  configureLogger,
  resetLoggerConfig,
  getRecentLogs,
  clearLogBuffer,
  type RequestLogger,
} from './logger.ts';

// Audit trail exports
export {
  auditTrail,
  configureAuditTrail,
  resetAuditConfig,
  getRecentAuditEntries,
  clearAuditBuffer,
} from './auditTrail.ts';

// Metrics exports
export {
  metrics,
  configureMetrics,
  resetMetricsConfig,
  clearMetrics,
  startMetricsSummaryLogging,
  stopMetricsSummaryLogging,
} from './metrics.ts';

// Tracing exports
export {
  tracer,
  configureTracing,
  resetTracingConfig,
  clearTraces,
  getRecentTraces,
  getTrace,
  withSpan,
  formatTrace,
  type ActiveTrace,
  type ActiveSpan,
  type Span,
  type Trace,
  type SpanStatus,
  type SpanEvent,
} from './tracing.ts';
