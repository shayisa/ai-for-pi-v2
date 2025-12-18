# Feedback Module

> **Purpose**: Provide observability infrastructure for the Control Plane, enabling debugging, performance monitoring, and audit compliance.

## Overview

The Feedback module provides four core services:

| Service | Purpose | File |
|---------|---------|------|
| **Logger** | Structured logging with correlation IDs | `logger.ts` |
| **Audit Trail** | Security-sensitive operation logging | `auditTrail.ts` |
| **Metrics** | Performance metrics and rate limiting | `metrics.ts` |
| **Tracing** | Request lifecycle tracing | `tracing.ts` |

## Dependencies

### Internal Modules
- `../types` - Control Plane type definitions

### NPM Packages
- None (pure TypeScript implementation)

### Required Environment Variables
- `NODE_ENV` - Affects log format (`production` = JSON, otherwise formatted)

## Public API

### Logger

```typescript
import { logger, createRequestLogger, generateCorrelationId } from './feedback';

// Module-level logging (no correlation ID)
logger.info('newsletter', 'startup', 'Module initialized');
logger.error('newsletter', 'generation', 'Failed to generate', error);

// Request-scoped logging (includes correlation ID)
const correlationId = generateCorrelationId(); // 'req-m5x9y2-abc123'
const log = createRequestLogger(correlationId, 'newsletter');

log.info('generate', 'Starting newsletter generation', { topics: ['AI'] });
log.warn('generate', 'Rate limit approaching', { remaining: 5 });
log.error('generate', 'Claude API failed', error);

// Timed operations (logs duration automatically)
const result = await log.timed('ai-call', 'Calling Claude API', async () => {
  return await claudeApi.generate(prompt);
});
```

### Audit Trail

```typescript
import { auditTrail } from './feedback';

// Generic audit logging
await auditTrail.log({
  correlationId: 'req-abc123',
  action: 'create',
  resourceType: 'newsletter',
  resourceId: 'nl-123',
  success: true,
  userEmail: 'user@example.com',
  ipAddress: '127.0.0.1',
  details: { sections: 3 }
});

// Specialized audit methods
await auditTrail.logAuthSuccess({
  correlationId: 'req-abc123',
  userEmail: 'user@example.com',
  authMethod: 'oauth',
  ipAddress: '127.0.0.1'
});

await auditTrail.logApiKeyValidation({
  correlationId: 'req-abc123',
  userEmail: 'user@example.com',
  service: 'claude',
  success: true
});

await auditTrail.logEmailSend({
  correlationId: 'req-abc123',
  newsletterId: 'nl-123',
  recipientCount: 50,
  success: true
});
```

### Metrics

```typescript
import { metrics } from './feedback';

// Timer-based metrics
const timer = metrics.startTimer('newsletter', 'generate');
try {
  await generateNewsletter();
  timer.success(); // Records duration with success
} catch (error) {
  timer.failure(); // Records duration with error
  throw error;
}

// Manual recording
metrics.record('newsletter', 'generate', 1500, true);

// Get metrics
const stats = metrics.getMetrics('newsletter', 'generate');
console.log(stats);
// {
//   module: 'newsletter',
//   operation: 'generate',
//   count: 42,
//   avgDuration: 1234,
//   minDuration: 800,
//   maxDuration: 2500,
//   errorCount: 2,
//   errorRate: 0.047
// }

// Detailed metrics with percentiles
const detailed = metrics.getDetailedMetrics('newsletter', 'generate');
console.log(`p50: ${detailed.p50}ms, p90: ${detailed.p90}ms, p99: ${detailed.p99}ms`);

// Rate limiting
const limit = metrics.checkRateLimit('user:123:generate', 10, 60000);
if (limit.exceeded) {
  throw new Error(`Rate limit exceeded. Retry after ${limit.retryAfter}s`);
}

// Summary for dashboards
const summary = metrics.getSummary();
// {
//   totalOperations: 1000,
//   totalErrors: 50,
//   overallErrorRate: 0.05,
//   slowestOperation: 'generation:image',
//   mostErrors: 'external:stability',
//   byModule: { newsletter: {...}, external: {...} }
// }
```

### Tracing

```typescript
import { tracer, withSpan, formatTrace } from './feedback';

// Start a trace for a request
const trace = tracer.startTrace('req-abc123', 'newsletter-generation');

// Create spans for operations
const fetchSpan = trace.startSpan('fetch-topics');
fetchSpan.setTag('source', 'hacker-news');
await fetchTopics();
fetchSpan.end();

// Nested spans
const generateSpan = trace.startSpan('generate-content');
const claudeSpan = trace.startSpan('call-claude', generateSpan.id);
claudeSpan.addEvent('request-sent', { model: 'claude-3-opus' });
await callClaude();
claudeSpan.addEvent('response-received', { tokens: 1500 });
claudeSpan.end();
generateSpan.end();

// End trace
const completedTrace = trace.end();

// Helper for cleaner code
const result = await withSpan(trace, 'process-images', async (span) => {
  span.setTag('count', '3');
  return await processImages();
});

// Debug output
console.log(formatTrace(completedTrace));
// Trace: newsletter-generation [req-abc123]
// Duration: 5234ms
// Spans: 4
//
// ✓ fetch-topics (234ms)
// ✓ generate-content (4500ms)
//   ✓ call-claude (4200ms)
//     └ request-sent
//     └ response-received
// ✓ process-images (500ms)
```

## Usage Examples

### Complete Request Lifecycle

```typescript
import {
  generateCorrelationId,
  createRequestLogger,
  tracer,
  metrics,
  auditTrail
} from './feedback';

async function handleGenerateNewsletter(req, res) {
  // 1. Generate correlation ID
  const correlationId = generateCorrelationId();

  // 2. Create request-scoped logger
  const log = createRequestLogger(correlationId, 'newsletter');

  // 3. Start trace
  const trace = tracer.startTrace(correlationId, 'generate-newsletter');
  trace.setContext({
    correlationId,
    source: 'api',
    request: {
      method: req.method,
      path: req.path,
      ip: req.ip
    }
  });

  // 4. Start metrics timer
  const timer = metrics.startTimer('newsletter', 'generate');

  try {
    log.info('start', 'Starting newsletter generation', {
      topics: req.body.topics
    });

    // Fetch topics
    const topics = await withSpan(trace, 'fetch-topics', async (span) => {
      span.setTag('count', req.body.topics.length);
      return await fetchTopics(req.body.topics);
    });

    // Generate content
    const content = await withSpan(trace, 'generate-content', async (span) => {
      span.setTag('model', 'claude-3-opus');
      return await log.timed('claude-api', 'Generating content', async () => {
        return await claudeApi.generate(topics);
      });
    });

    // Generate images
    const images = await withSpan(trace, 'generate-images', async (span) => {
      span.setTag('count', content.sections.length);
      return await generateImages(content.sections);
    });

    // Audit the creation
    await auditTrail.logCreate({
      correlationId,
      resourceType: 'newsletter',
      resourceId: content.id,
      userEmail: req.user?.email
    });

    // Success
    timer.success();
    trace.end();

    log.info('complete', 'Newsletter generated successfully', {
      id: content.id,
      sections: content.sections.length
    });

    res.json({ success: true, data: content });

  } catch (error) {
    timer.failure();
    trace.end();

    log.error('failed', 'Newsletter generation failed', error);

    res.status(500).json({
      success: false,
      error: { code: 'GENERATION_FAILED', message: error.message }
    });
  }
}
```

### Express Middleware Integration

```typescript
import { generateCorrelationId, createRequestLogger, tracer, metrics } from './feedback';

// Correlation ID middleware
export function correlationIdMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

// Request logging middleware
export function requestLoggingMiddleware(req, res, next) {
  const log = createRequestLogger(req.correlationId, 'http');
  req.log = log;

  log.info('request', `${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.on('finish', () => {
    log.info('response', `${req.method} ${req.path} ${res.statusCode}`, {
      statusCode: res.statusCode
    });
  });

  next();
}

// Request tracing middleware
export function tracingMiddleware(req, res, next) {
  const trace = tracer.startTrace(req.correlationId, `${req.method} ${req.path}`);
  trace.setContext({
    correlationId: req.correlationId,
    source: 'api',
    request: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }
  });

  req.trace = trace;

  res.on('finish', () => {
    trace.end();
  });

  next();
}

// Metrics middleware
export function metricsMiddleware(req, res, next) {
  const timer = metrics.startTimer('http', `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`);

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      timer.failure();
    } else {
      timer.success();
    }
  });

  next();
}
```

## Error Handling

### Errors Thrown

| Error | When | Recovery |
|-------|------|----------|
| None | Module never throws | N/A |

The Feedback module is designed to never throw errors - it should not break request processing. All internal errors are logged and suppressed.

### Error Recovery

```typescript
// Safe by design - these never throw
logger.error('module', 'action', 'message'); // Always succeeds
await auditTrail.log({ ... }); // Logs error internally if DB fails
metrics.record('module', 'op', 100); // Always succeeds
```

## Testing Instructions

### Running Tests

```bash
# Run unit tests for feedback module
npm test -- --grep "feedback"
```

### Mocking Dependencies

```typescript
import { configureLogger, clearLogBuffer } from './feedback';

describe('MyService', () => {
  let capturedLogs: LogEntry[] = [];

  beforeEach(() => {
    clearLogBuffer();
    configureLogger({
      outputHandler: (entry) => capturedLogs.push(entry)
    });
  });

  afterEach(() => {
    capturedLogs = [];
    resetLoggerConfig();
  });

  it('should log on error', async () => {
    await myService.doSomething();

    const errorLogs = capturedLogs.filter(l => l.level === 'error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toContain('expected error');
  });
});
```

### Test Scenarios

1. **Logger Tests**
   - Log at each level
   - Correlation ID propagation
   - Metadata sanitization (sensitive keys)
   - Timed operations

2. **Audit Trail Tests**
   - All audit action types
   - Database persistence (with mock)
   - Buffer overflow handling

3. **Metrics Tests**
   - Timer start/success/failure
   - Percentile calculation
   - Rate limiting
   - Summary generation

4. **Tracing Tests**
   - Span creation and nesting
   - Error propagation
   - Trace completion
   - Format output

## Configuration

### Logger Configuration

```typescript
import { configureLogger } from './feedback';

configureLogger({
  minLevel: 'info',           // 'debug' | 'info' | 'warn' | 'error'
  includeStacks: false,       // Include stack traces in production?
  maxMetadataSize: 10000,     // Max metadata JSON size
  jsonOutput: true,           // JSON format (production) or formatted (dev)
});
```

### Audit Configuration

```typescript
import { configureAuditTrail } from './feedback';

configureAuditTrail({
  enabled: true,
  persistToDb: true,
  persistCallback: async (entry) => {
    await db.insert('audit_log', entry);
  }
});
```

### Metrics Configuration

```typescript
import { configureMetrics, startMetricsSummaryLogging } from './feedback';

configureMetrics({
  enabled: true,
  summaryInterval: 60000,         // Log summary every 60s
  logSlowOperations: true,
  slowOperationThreshold: 5000,   // 5s threshold
});

startMetricsSummaryLogging();
```

### Tracing Configuration

```typescript
import { configureTracing } from './feedback';

configureTracing({
  enabled: true,
  maxSpansPerTrace: 100,
  maxEventsPerSpan: 50,
  logSummaries: true,
  minDurationToLog: 100,  // Only log traces > 100ms
});
```

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-17 | Initial implementation | Claude |
