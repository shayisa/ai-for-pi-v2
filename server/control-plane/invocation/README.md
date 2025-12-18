# Invocation Module

> **Purpose**: Central request processing engine for the Control Plane.

## Overview

The Invocation module provides:

| Component | Purpose | File |
|-----------|---------|------|
| **Context Manager** | Request context & correlation IDs | `contextManager.ts` |
| **Response Builder** | Standardized API responses | `responseBuilder.ts` |
| **Request Processor** | Full request pipeline execution | `requestProcessor.ts` |

## Dependencies

### Internal Modules
- `../types` - Control Plane type definitions
- `../feedback` - Logging, tracing, metrics
- `../resolver` - Intent classification, auth resolution
- `../registration` - Tool registry
- `../validators` - Input validation

### NPM Packages
- `async_hooks` - Node.js AsyncLocalStorage (built-in)
- `uuid` - Correlation ID generation

## Public API

### Context Management

```typescript
import {
  createContext,
  createContextFromRequest,
  getContext,
  requireContext,
  withContext,
  getCorrelationId,
  contextMiddleware,
} from './invocation';

// Create context for a request
const ctx = createContextFromRequest(req);
// {
//   correlationId: 'req-abc123-def456',
//   startTime: 1702824000000,
//   userId: undefined,
//   metadata: { method: 'POST', path: '/api/newsletters' }
// }

// Access context anywhere in async call stack
const currentCtx = getContext();

// Execute code with specific context
await withContext(ctx, async () => {
  // context available via getContext() here
  console.log(getCorrelationId()); // 'req-abc123-def456'
});

// Express middleware
app.use(contextMiddleware());
```

### Response Building

```typescript
import {
  successResponse,
  errorResponse,
  ResponseBuilder,
  ErrorCodes,
  sendSuccess,
  sendError,
} from './invocation';

// Simple success response
res.json(successResponse(data, correlationId));
// {
//   success: true,
//   data: {...},
//   correlationId: 'req-abc123',
//   timestamp: '2024-12-17T...'
// }

// Error response
res.status(400).json(errorResponse(
  'Validation failed',
  ErrorCodes.VALIDATION_ERROR,
  correlationId,
  { field: 'email' }
));

// Builder pattern for complex responses
const response = new ResponseBuilder(ctx)
  .data(items)
  .pagination(1, 20, 100)
  .build();

// Express helpers
sendSuccess(res, data, correlationId);
sendError(res, 'Not found', ErrorCodes.NOT_FOUND, correlationId);
```

### Request Processing

```typescript
import {
  processRequest,
  createRequestHandler,
  invokeTool,
} from './invocation';

// Process request through full pipeline
const result = await processRequest(req);
// Performs: intent classification → auth → validation → tool execution

// Create Express handler
app.post('/api/newsletters', createRequestHandler('newsletter.create'));

// Direct tool invocation (bypass routing)
const result = await invokeTool('claude', { prompt: '...' }, {
  correlationId: 'req-123',
  userEmail: 'user@example.com',
});
```

## Request Processing Pipeline

The `processRequest` function executes this pipeline:

```
1. Context Creation
   └─ Generate correlation ID
   └─ Extract user info from headers

2. Intent Classification
   └─ Match route to intent
   └─ Determine required tools

3. Authentication (if required)
   └─ Extract credentials from headers
   └─ Validate API key or OAuth token
   └─ Update context with auth info

4. Input Validation (if schema provided)
   └─ Validate request body
   └─ Return 400 if invalid

5. Rate Limiting
   └─ Check tool rate limits
   └─ Return 429 if exceeded

6. Tool Execution
   └─ Execute tools per execution plan
   └─ Handle sequential/parallel execution
   └─ Aggregate results

7. Response Building
   └─ Format success/error response
   └─ Include correlation ID and timing
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_INPUT` | 400 | Invalid input format |
| `UNAUTHORIZED` | 401 | Authentication required |
| `MISSING_API_KEY` | 401 | API key not provided |
| `INVALID_API_KEY` | 401 | API key invalid |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |
| `TOOL_EXECUTION_ERROR` | 500 | Tool failed |
| `SERVICE_UNAVAILABLE` | 503 | Service down |

## Usage Examples

### Express Integration

```typescript
import express from 'express';
import {
  contextMiddleware,
  createRequestHandler,
  sendSuccess,
  sendError,
  getContext,
  ErrorCodes,
} from '../control-plane/invocation';
import { CreateNewsletterSchema } from '../control-plane/validators';

const app = express();

// Add context to all requests
app.use(contextMiddleware());

// Route with automatic processing
app.post('/api/newsletters', createRequestHandler('newsletter.create', {
  inputSchema: CreateNewsletterSchema,
}));

// Custom handler with context
app.get('/api/health', (req, res) => {
  const ctx = getContext();
  sendSuccess(res, { status: 'healthy' }, ctx?.correlationId);
});
```

### Custom Request Handler

```typescript
import {
  withRequestContext,
  processRequest,
  ResponseBuilder,
  ErrorCodes,
} from '../control-plane/invocation';

app.post('/api/custom', withRequestContext(async (req, res, ctx) => {
  // ctx is automatically available

  // Custom processing
  const result = await processRequest(req, {
    inputSchema: CustomSchema,
    authType: 'api_key',
  });

  if (!result.success) {
    return new ResponseBuilder(ctx)
      .error(result.error.message, result.error.code)
      .build();
  }

  return new ResponseBuilder(ctx)
    .data(result.data)
    .meta({ custom: 'value' })
    .build();
}));
```

### Paginated Response

```typescript
import { wrapList } from '../control-plane/invocation';

app.get('/api/newsletters', async (req, res) => {
  const ctx = getContext()!;
  const page = parseInt(req.query.page) || 1;
  const pageSize = 20;

  const { items, total } = await newsletterService.list(page, pageSize);

  res.json(wrapList(items, page, pageSize, total, ctx));
  // {
  //   success: true,
  //   data: [...],
  //   meta: {
  //     pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5, ... }
  //   },
  //   correlationId: '...',
  //   timestamp: '...'
  // }
});
```

## Error Handling

### Handling Different Error Types

```typescript
import { ErrorCodes, errorCodeToStatus } from '../control-plane/invocation';

try {
  const result = await processRequest(req);
  if (!result.success) {
    const status = errorCodeToStatus(result.error.code);
    return res.status(status).json({
      success: false,
      error: result.error,
      correlationId: result.correlationId,
    });
  }
} catch (error) {
  // Unexpected errors
  return res.status(500).json({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
    },
    correlationId: getCorrelationId(),
  });
}
```

### Error Recovery Strategies

| Error Type | Recovery |
|------------|----------|
| Validation | Return detailed field errors |
| Auth | Prompt re-authentication |
| Rate Limit | Include retry-after header |
| Tool Error | Log and return generic error |
| Timeout | Suggest retry |

## Testing Instructions

### Running Tests

```bash
npm test -- --grep "invocation"
```

### Mocking Context

```typescript
import { createContext, withContext } from '../control-plane/invocation';

describe('MyService', () => {
  it('should use context', async () => {
    const ctx = createContext({
      correlationId: 'test-123',
      userId: 'user-1',
    });

    await withContext(ctx, async () => {
      // Test code runs with context
      const result = await myService.doSomething();
      expect(result.correlationId).toBe('test-123');
    });
  });
});
```

### Mocking Tools

```typescript
import { registerTool, clearRegistry } from '../control-plane/registration';
import { processRequest } from '../control-plane/invocation';

describe('Request Processing', () => {
  beforeEach(() => {
    clearRegistry();
    registerTool(
      { id: 'mock-claude', name: 'Mock Claude', /* ... */ },
      async () => ({ content: 'mocked response' })
    );
  });

  it('should process request', async () => {
    const req = {
      method: 'POST',
      path: '/api/generate',
      body: { prompt: 'test' },
      headers: { 'x-api-key': 'test-key' },
    };

    const result = await processRequest(req);
    expect(result.success).toBe(true);
  });
});
```

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-17 | Initial implementation | Claude |
