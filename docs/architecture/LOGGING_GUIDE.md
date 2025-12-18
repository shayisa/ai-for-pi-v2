# Logging & Observability Guide

> **Purpose**: Comprehensive guide to using the Control Plane's logging, audit, metrics, and tracing capabilities.

## Quick Start

```typescript
import {
  generateCorrelationId,
  createRequestLogger,
  tracer,
  metrics,
  auditTrail
} from '../server/control-plane/feedback';

// Every request gets a correlation ID
const correlationId = generateCorrelationId();

// Create a request-scoped logger
const log = createRequestLogger(correlationId, 'my-module');

// Log operations
log.info('start', 'Processing started');
log.warn('warning', 'Something unusual happened');
log.error('failed', 'Operation failed', error);
```

## Correlation IDs

### What They Are

Correlation IDs are unique identifiers that trace a single request across all modules and services. They enable:

- Finding all logs for a specific request
- Tracing request flow through the system
- Debugging issues by following the request path

### Format

```
req-{timestamp-base36}-{random}
Example: req-m5x9y2-abc123
```

### How to Use

```typescript
// Generate a new correlation ID
const correlationId = generateCorrelationId();

// Pass it through your request
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

// Use it in all logging
const log = createRequestLogger(req.correlationId, 'my-module');
log.info('action', 'message');
// Output: [req-m5x9y2-abc123] my-module       action: message
```

### Finding Related Logs

```typescript
// Get all logs for a request
import { getRecentLogs } from '../server/control-plane/feedback';

const requestLogs = getRecentLogs({ correlationId: 'req-m5x9y2-abc123' });
```

## Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Development details | Variable values, function entry/exit |
| `info` | Normal operations | Request started, operation completed |
| `warn` | Potential issues | Rate limit approaching, deprecated API |
| `error` | Failures | Exception caught, operation failed |

### When to Use Each Level

```typescript
// DEBUG: Development-only details
log.debug('parse', 'Parsed input', { fields: Object.keys(input) });

// INFO: Normal business events
log.info('generate', 'Newsletter generation started', { topics: 3 });
log.info('generate', 'Newsletter generation completed', { id: 'nl-123' });

// WARN: Potential problems (not failures)
log.warn('rate-limit', 'Approaching API rate limit', { remaining: 5 });
log.warn('deprecated', 'Using deprecated endpoint');

// ERROR: Actual failures
log.error('generate', 'Newsletter generation failed', error);
```

## Structured Logging

### Log Entry Structure

```typescript
interface LogEntry {
  correlationId: string;    // Request trace ID
  timestamp: Date;          // When logged
  level: LogLevel;          // debug/info/warn/error
  module: string;           // Which module logged
  action: string;           // What was being done
  message: string;          // Human-readable message
  duration?: number;        // Operation time (ms)
  userId?: string;          // User if authenticated
  metadata?: object;        // Additional context
  error?: ErrorInfo;        // Error details if applicable
}
```

### Adding Context with Metadata

```typescript
// Good: Relevant, searchable metadata
log.info('generate', 'Newsletter generated', {
  newsletterId: 'nl-123',
  sections: 3,
  imageCount: 3,
  audience: ['business', 'forensic']
});

// Avoid: Too much data, sensitive info
log.info('generate', 'Newsletter generated', {
  fullNewsletter: newsletter,  // Too large
  apiKey: key,                 // Sensitive - will be redacted
});
```

### Automatic Sanitization

The logger automatically redacts sensitive data:

```typescript
// These keys are automatically redacted
const SENSITIVE_KEYS = [
  'password', 'secret', 'token', 'apiKey', 'api_key',
  'authorization', 'auth', 'credential'
];

log.info('auth', 'User authenticated', {
  email: 'user@example.com',
  apiKey: 'sk-secret-key'  // Becomes '[REDACTED]'
});
// Output metadata: { email: 'user@example.com', apiKey: '[REDACTED]' }
```

## Timed Operations

### Using the Timed Logger

```typescript
// Automatically logs duration on completion
const result = await log.timed('ai-call', 'Calling Claude API', async () => {
  return await claudeApi.generate(prompt);
});
// Output: [req-...] newsletter ai-call: Calling Claude API completed (1234ms)

// On error, logs error with duration
// Output: [req-...] newsletter ai-call: Calling Claude API failed (500ms) error: ...
```

### Using Metrics Timer

```typescript
// For aggregated metrics
const timer = metrics.startTimer('newsletter', 'generate');
try {
  const result = await generateNewsletter();
  timer.success();  // Records successful completion
  return result;
} catch (error) {
  timer.failure();  // Records failure
  throw error;
}
```

## Performance Metrics

### Recording Metrics

```typescript
import { metrics } from '../server/control-plane/feedback';

// Timer-based (recommended)
const timer = metrics.startTimer('module', 'operation');
// ... do work ...
timer.success(); // or timer.failure();

// Manual recording
metrics.record('module', 'operation', 1500, true);
```

### Reading Metrics

```typescript
// Get metrics for one operation
const stats = metrics.getMetrics('newsletter', 'generate');
console.log(`
  Count: ${stats.count}
  Avg Duration: ${stats.avgDuration}ms
  Error Rate: ${(stats.errorRate * 100).toFixed(2)}%
`);

// Get detailed metrics with percentiles
const detailed = metrics.getDetailedMetrics('newsletter', 'generate');
console.log(`p50: ${detailed.p50}ms, p90: ${detailed.p90}ms, p99: ${detailed.p99}ms`);

// Get summary for dashboard
const summary = metrics.getSummary();
```

### Rate Limiting

```typescript
// Check rate limit before operation
const limit = metrics.checkRateLimit(
  `user:${userId}:generate`,  // Key
  10,                          // Max requests
  60000                        // Window (ms)
);

if (limit.exceeded) {
  throw new Error(`Rate limit exceeded. Retry after ${limit.retryAfter}s`);
}
```

## Audit Trail

### When to Audit

Always audit:
- Authentication events (success/failure)
- API key validation
- OAuth grants/revocations
- Data creation/deletion
- Email sends
- Data exports

### Audit Methods

```typescript
import { auditTrail } from '../server/control-plane/feedback';

// Authentication
await auditTrail.logAuthSuccess({
  correlationId,
  userEmail: 'user@example.com',
  authMethod: 'oauth',
  ipAddress: req.ip
});

await auditTrail.logAuthFailure({
  correlationId,
  userEmail: 'user@example.com',
  authMethod: 'api_key',
  reason: 'Invalid key',
  ipAddress: req.ip
});

// Data operations
await auditTrail.logCreate({
  correlationId,
  resourceType: 'newsletter',
  resourceId: 'nl-123',
  userEmail: 'user@example.com'
});

await auditTrail.logDelete({
  correlationId,
  resourceType: 'subscriber',
  resourceId: 'sub-456',
  userEmail: 'user@example.com'
});

// Email
await auditTrail.logEmailSend({
  correlationId,
  newsletterId: 'nl-123',
  recipientCount: 50,
  success: true
});
```

## Request Tracing

### Starting a Trace

```typescript
import { tracer, withSpan } from '../server/control-plane/feedback';

const trace = tracer.startTrace(correlationId, 'newsletter-generation');
trace.setContext({
  correlationId,
  source: 'api',
  request: { method: 'POST', path: '/api/generate' }
});
```

### Creating Spans

```typescript
// Manual span management
const span = trace.startSpan('fetch-topics');
span.setTag('source', 'hacker-news');
await fetchTopics();
span.end();

// Nested spans
const parentSpan = trace.startSpan('generate-content');
const childSpan = trace.startSpan('call-claude', parentSpan.id);
await callClaude();
childSpan.end();
parentSpan.end();

// Helper function (recommended)
const result = await withSpan(trace, 'process-images', async (span) => {
  span.setTag('count', '3');
  span.addEvent('started', { timestamp: Date.now() });
  const images = await processImages();
  span.addEvent('completed', { count: images.length });
  return images;
});
```

### Ending a Trace

```typescript
// End trace and get complete data
const completedTrace = trace.end();

// Debug output
import { formatTrace } from '../server/control-plane/feedback';
console.log(formatTrace(completedTrace));
```

## Development vs Production

### Development Mode

- Colored, formatted output
- Debug level enabled
- Stack traces included
- Human-readable timestamps

```
14:32:15.123 INFO  [req-m5x9y2   ] newsletter       generate: Newsletter generated successfully (1234ms)
  metadata: { newsletterId: 'nl-123', sections: 3 }
```

### Production Mode

- JSON output (for log aggregation)
- Info level and above
- No stack traces
- ISO timestamps

```json
{"correlationId":"req-m5x9y2-abc123","timestamp":"2024-12-17T14:32:15.123Z","level":"info","module":"newsletter","action":"generate","message":"Newsletter generated successfully","duration":1234,"metadata":{"newsletterId":"nl-123","sections":3}}
```

## Debugging with Logs

### Finding a Specific Request

```typescript
// Get all logs for a correlation ID
const logs = getRecentLogs({ correlationId: 'req-m5x9y2-abc123' });

// Get all error logs
const errors = getRecentLogs({ level: 'error' });

// Get logs from a specific module
const newsletterLogs = getRecentLogs({ module: 'newsletter' });

// Combine filters
const recentErrors = getRecentLogs({
  level: 'error',
  since: new Date(Date.now() - 60000)  // Last minute
});
```

### Finding Related Traces

```typescript
// Get trace by correlation ID
const trace = getTrace('req-m5x9y2-abc123');

// Get recent traces
const slowTraces = getRecentTraces({ minDuration: 5000 });

// Format for debugging
console.log(formatTrace(trace));
```

## Integration Examples

### Express Middleware Stack

```typescript
import express from 'express';
import {
  generateCorrelationId,
  createRequestLogger,
  tracer,
  metrics
} from '../server/control-plane/feedback';

const app = express();

// 1. Correlation ID middleware (first)
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

// 2. Request logging middleware
app.use((req, res, next) => {
  req.log = createRequestLogger(req.correlationId, 'http');
  req.log.info('request', `${req.method} ${req.path}`);
  res.on('finish', () => {
    req.log.info('response', `${req.method} ${req.path} ${res.statusCode}`);
  });
  next();
});

// 3. Tracing middleware
app.use((req, res, next) => {
  req.trace = tracer.startTrace(req.correlationId, `${req.method} ${req.path}`);
  res.on('finish', () => req.trace.end());
  next();
});

// 4. Metrics middleware
app.use((req, res, next) => {
  const timer = metrics.startTimer('http', req.path);
  res.on('finish', () => {
    res.statusCode >= 400 ? timer.failure() : timer.success();
  });
  next();
});
```

### Route Handler with Full Observability

```typescript
app.post('/api/newsletters', async (req, res) => {
  const { log, trace } = req;

  try {
    // Use withSpan for automatic span management
    const newsletter = await withSpan(trace, 'generate-newsletter', async (span) => {
      span.setTag('topics', req.body.topics.length);

      // Log significant events
      log.info('start', 'Newsletter generation started', {
        topics: req.body.topics
      });

      // Nested timed operations
      const content = await log.timed('claude-api', 'Generating content', async () => {
        return await claudeService.generate(req.body);
      });

      // Audit data creation
      await auditTrail.logCreate({
        correlationId: req.correlationId,
        resourceType: 'newsletter',
        resourceId: content.id,
        userEmail: req.user?.email
      });

      return content;
    });

    res.json({ success: true, data: newsletter });

  } catch (error) {
    log.error('failed', 'Newsletter generation failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Best Practices

### Do's

- Always include correlation ID in request-scoped logging
- Use structured metadata instead of string interpolation
- Log at appropriate levels (info for normal, warn for unusual, error for failures)
- Use timed operations for performance tracking
- Audit security-sensitive operations
- Create spans for significant sub-operations

### Don'ts

- Don't log sensitive data (passwords, tokens, PII)
- Don't log at debug level in production
- Don't create spans for trivial operations
- Don't log the same event multiple times
- Don't use console.log directly (use the logger)

## Troubleshooting

### Logs Not Appearing

1. Check minimum log level configuration
2. Verify NODE_ENV setting
3. Ensure logger is imported from correct path

### Metrics Not Recording

1. Verify metrics are enabled in config
2. Check that timer.success() or timer.failure() is called
3. Ensure metrics module is imported

### Audit Not Persisting

1. Verify persistCallback is configured
2. Check database connection
3. Look for error logs from auditTrail module

### Traces Missing Spans

1. Ensure span.end() is called
2. Check maxSpansPerTrace limit
3. Verify trace is started before creating spans
