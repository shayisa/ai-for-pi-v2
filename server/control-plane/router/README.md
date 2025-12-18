# Router Module

> **Purpose**: Route registration, matching, and middleware composition for the Control Plane.

## Overview

The Router module provides:

| Component | Purpose | File |
|-----------|---------|------|
| **Route Registry** | Register and query routes | `routeRegistry.ts` |
| **Middleware Chain** | Compose middleware pipelines | `middlewareChain.ts` |

## Dependencies

### Internal Modules
- `../types` - Control Plane type definitions
- `../feedback` - Logging
- `../invocation` - Context management, response building

### NPM Packages
- `zod` - Schema validation (types only)

## Public API

### Route Registration

```typescript
import {
  registerRoute,
  getRoute,
  getAllRoutes,
  matchRoute,
  routeRegistry,
} from './router';

// Register a route
registerRoute(
  {
    method: 'POST',
    path: '/api/newsletters',
    description: 'Create a new newsletter',
    category: 'newsletter',
    authType: 'none',
    rateLimitTier: 'medium',
    inputSchema: CreateNewsletterSchema,
  },
  async (req, res) => {
    // Handler implementation
  }
);

// Get a specific route
const route = getRoute('POST', '/api/newsletters');

// Match a request to a route (with path params)
const match = matchRoute('GET', '/api/newsletters/123');
// { route: {...}, params: { id: '123' } }

// Get all routes
const routes = getAllRoutes();
```

### Route Categories

| Category | Description |
|----------|-------------|
| `newsletter` | Newsletter CRUD operations |
| `generation` | AI content generation |
| `topics` | Topic suggestions |
| `subscribers` | Subscriber management |
| `personas` | Writer personas |
| `templates` | Newsletter templates |
| `drafts` | Draft management |
| `calendar` | Content calendar |
| `auth` | OAuth and API keys |
| `health` | Health checks |
| `logs` | System logs |

### Middleware Chain

```typescript
import {
  MiddlewareChain,
  createMiddleware,
  corsMiddleware,
  timeoutMiddleware,
  createApiChain,
} from './router';

// Create a middleware chain
const chain = new MiddlewareChain()
  .use(corsMiddleware({ origin: 'http://localhost:3000' }))
  .use(timeoutMiddleware(30000))
  .use(customMiddleware);

// Conditional middleware
chain.useWhen(
  (req) => req.intent?.authRequired === true,
  authMiddleware
);

// Path-specific middleware
chain.usePath('/api/admin/*', adminAuthMiddleware);

// Use with Express
app.use(chain.handler());

// Pre-built chains
const apiChain = createApiChain(); // logging + error handling
```

## Route Definition Structure

```typescript
interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;                    // Express-style with :params
  description?: string;            // For documentation
  category: RouteCategory;         // For organization
  authType: 'api_key' | 'oauth' | 'none';
  rateLimitTier?: 'low' | 'medium' | 'high' | 'unlimited';
  inputSchema?: ZodSchema;         // Request validation
  outputSchema?: ZodSchema;        // Response validation
  tags?: string[];                 // Additional tags
  deprecated?: boolean;            // Mark as deprecated
  deprecationMessage?: string;
  timeout?: number;                // Custom timeout (ms)
}
```

## Usage Examples

### Registering Routes by Category

```typescript
import { registerRoutes } from '../control-plane/router';
import { newsletterRoutes } from './routes/newsletter';
import { generationRoutes } from './routes/generation';

// Bulk register routes
registerRoutes([
  ...newsletterRoutes,
  ...generationRoutes,
]);
```

### Route Definition File

```typescript
// routes/newsletter.ts
import { BulkRouteDefinition } from '../control-plane/router';
import { CreateNewsletterSchema, UpdateNewsletterSchema } from '../control-plane/validators';
import { newsletterHandler } from '../handlers/newsletter';

export const newsletterRoutes: BulkRouteDefinition[] = [
  {
    method: 'GET',
    path: '/api/newsletters',
    description: 'List all newsletters',
    category: 'newsletter',
    authType: 'none',
    rateLimitTier: 'low',
    handler: newsletterHandler.list,
  },
  {
    method: 'POST',
    path: '/api/newsletters',
    description: 'Create newsletter',
    category: 'newsletter',
    authType: 'none',
    inputSchema: CreateNewsletterSchema,
    handler: newsletterHandler.create,
  },
  {
    method: 'GET',
    path: '/api/newsletters/:id',
    description: 'Get newsletter by ID',
    category: 'newsletter',
    authType: 'none',
    handler: newsletterHandler.getById,
  },
  {
    method: 'PUT',
    path: '/api/newsletters/:id',
    description: 'Update newsletter',
    category: 'newsletter',
    authType: 'none',
    inputSchema: UpdateNewsletterSchema,
    handler: newsletterHandler.update,
  },
  {
    method: 'DELETE',
    path: '/api/newsletters/:id',
    description: 'Delete newsletter',
    category: 'newsletter',
    authType: 'none',
    handler: newsletterHandler.delete,
  },
];
```

### Custom Middleware

```typescript
import { createMiddleware, Middleware } from '../control-plane/router';

// Named middleware with logging
const myMiddleware = createMiddleware(
  async (req, res, next) => {
    // Middleware logic
    req.customData = 'value';
    next();
  },
  { name: 'myMiddleware' }
);

// Conditional middleware
const authMiddleware = createMiddleware(
  async (req, res, next) => {
    // Auth logic
    next();
  },
  {
    name: 'auth',
    when: (req) => req.intent?.authRequired === true,
  }
);
```

### Building Express App with Router

```typescript
import express from 'express';
import {
  registerRoutes,
  matchRoute,
  createCorsChain,
  MiddlewareChain,
} from '../control-plane/router';
import { contextMiddleware } from '../control-plane/invocation';

const app = express();
app.use(express.json());

// Setup middleware chain
const chain = createCorsChain({ origin: process.env.CORS_ORIGIN })
  .use(contextMiddleware());

app.use(chain.handler());

// Register all routes
registerRoutes(allRoutes);

// Dynamic route handler
app.use('/api', (req, res, next) => {
  const match = matchRoute(req.method as HttpMethod, req.path);

  if (!match) {
    return res.status(404).json({ error: 'Route not found' });
  }

  // Attach params from path
  req.params = match.params;

  // Execute handler
  match.route.handler(req, res, next);
});
```

### Generating API Documentation

```typescript
import {
  generateRouteDocumentation,
  generateOpenApiPaths,
  getRouteStats,
} from '../control-plane/router';

// Get route statistics
const stats = getRouteStats();
// {
//   total: 45,
//   byCategory: { newsletter: 5, generation: 8, ... },
//   byAuthType: { none: 30, api_key: 10, oauth: 5 },
//   byMethod: { GET: 20, POST: 15, PUT: 5, DELETE: 5 },
//   deprecated: 2
// }

// Generate documentation
const docs = generateRouteDocumentation();
// [{ method: 'GET', path: '/api/newsletters', description: '...', ... }]

// Generate OpenAPI paths
const openApiPaths = generateOpenApiPaths();
// { '/api/newsletters': { get: {...}, post: {...} }, ... }
```

## Middleware Chain Features

### Sequential Execution

```typescript
const chain = new MiddlewareChain()
  .use(middleware1)  // Runs first
  .use(middleware2)  // Runs second
  .use(middleware3); // Runs third
```

### Conditional Execution

```typescript
chain.useWhen(
  (req) => req.headers['x-admin'] === 'true',
  adminOnlyMiddleware
);
```

### Path-Specific Middleware

```typescript
chain.usePath('/api/admin', adminMiddleware);
chain.usePath(/^\/api\/v2\//, v2Middleware);
```

### Method-Specific Middleware

```typescript
chain.useMethod(['POST', 'PUT', 'PATCH'], bodyParserMiddleware);
```

### Error Handling

```typescript
chain.onError((error, req, res, next) => {
  console.error('Middleware error:', error);
  res.status(500).json({ error: error.message });
});
```

### Chain Composition

```typescript
const baseChain = createApiChain();
const authChain = new MiddlewareChain().use(authMiddleware);
const adminChain = new MiddlewareChain().use(adminMiddleware);

// Merge chains
const fullChain = baseChain
  .merge(authChain)
  .merge(adminChain);
```

## Error Handling

### Route Not Found

```typescript
import { matchRoute, ErrorCodes, sendError } from '../control-plane';

app.use((req, res) => {
  const match = matchRoute(req.method, req.path);

  if (!match) {
    sendError(res, 'Route not found', ErrorCodes.ROUTE_NOT_FOUND);
    return;
  }

  // Handle matched route
});
```

### Middleware Errors

The middleware chain automatically catches errors and passes them to the error handler:

```typescript
const chain = new MiddlewareChain()
  .use(async (req, res, next) => {
    throw new Error('Something went wrong');
  })
  .onError((error, req, res, next) => {
    // Error is caught here
    res.status(500).json({ error: error.message });
  });
```

## Testing Instructions

### Running Tests

```bash
npm test -- --grep "router"
```

### Mocking Routes

```typescript
import { registerRoute, clearRoutes, matchRoute } from '../control-plane/router';

describe('Route Matching', () => {
  beforeEach(() => {
    clearRoutes();
  });

  it('should match route with params', () => {
    registerRoute(
      {
        method: 'GET',
        path: '/api/items/:id',
        category: 'other',
        authType: 'none',
      },
      async (req, res) => {}
    );

    const match = matchRoute('GET', '/api/items/123');
    expect(match).not.toBeNull();
    expect(match!.params.id).toBe('123');
  });
});
```

### Testing Middleware Chain

```typescript
import { MiddlewareChain } from '../control-plane/router';

describe('Middleware Chain', () => {
  it('should execute middlewares in order', async () => {
    const order: number[] = [];

    const chain = new MiddlewareChain()
      .use((req, res, next) => { order.push(1); next(); })
      .use((req, res, next) => { order.push(2); next(); })
      .use((req, res, next) => { order.push(3); next(); });

    const req = {};
    const res = { headersSent: false };

    await chain.execute(req, res);
    expect(order).toEqual([1, 2, 3]);
  });
});
```

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-17 | Initial implementation | Claude |
