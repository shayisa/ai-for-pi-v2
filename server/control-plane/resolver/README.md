# Resolver Module

> **Purpose**: Classify request intents and resolve authentication requirements.

## Overview

The Resolver module provides:

| Component | Purpose | File |
|-----------|---------|------|
| **Intent Classifier** | Route → Intent → Tools mapping | `intentClassifier.ts` |
| **Auth Resolver** | Authentication validation | `authResolver.ts` |

## Dependencies

### Internal Modules
- `../types` - Control Plane type definitions
- `../feedback` - Logging, audit trail

### NPM Packages
- None

## Public API

### Intent Classification

```typescript
import { classifyIntent, resolveTools, requiresAuth, getAuthType } from './resolver';

// Classify a request
const intent = classifyIntent('POST', '/api/generateNewsletter');
// {
//   action: 'generate',
//   resource: 'newsletter',
//   tools: ['claude', 'stability', 'db-newsletter'],
//   authRequired: true,
//   executionPlan: [...]
// }

// Get tools for intent
const tools = resolveTools(intent);
// ['claude', 'stability', 'db-newsletter']

// Check auth requirement
const needsAuth = requiresAuth(intent);
// true

// Get auth type for a route
const authType = getAuthType('POST', '/api/generateNewsletter');
// 'api_key'
```

### Authentication Resolution

```typescript
import { resolveAuth, validateApiKey, validateOAuthToken } from './resolver';

// Resolve auth from headers
const auth = await resolveAuth(
  req.headers,
  'api_key',
  {
    correlationId: req.correlationId,
    service: 'claude',
    ipAddress: req.ip,
  }
);

if (!auth.valid) {
  return res.status(401).json({ error: auth.error });
}

// auth.userEmail, auth.service available

// Direct API key validation
const apiKeyResult = await validateApiKey('sk-...', 'claude');

// Direct OAuth validation
const oauthResult = await validateOAuthToken('ya29...');
```

## Intent Structure

```typescript
interface ResolvedIntent {
  action: string;       // 'generate', 'create', 'read', 'update', 'delete', etc.
  resource: string;     // 'newsletter', 'subscriber', 'persona', etc.
  subAction?: string;   // 'enhanced', 'sections', 'from-newsletter', etc.
  tools: string[];      // Tool IDs needed for this intent
  authRequired: boolean;
  executionPlan: ExecutionStep[];
}

interface ExecutionStep {
  order: number;
  toolId: string;
  parallel: boolean;
  dependsOn: number[];
  timeout?: number;
}
```

## Route Patterns

The intent classifier recognizes 60+ route patterns. Key patterns:

### Newsletter Generation

| Route | Intent | Tools | Auth |
|-------|--------|-------|------|
| `POST /api/generateNewsletter` | newsletter.generate | claude, stability, db-newsletter | API Key |
| `POST /api/generateEnhancedNewsletter` | newsletter.generate.enhanced | claude, stability, db-newsletter | API Key |
| `POST /api/generateImage` | image.generate | stability | API Key |
| `POST /api/generateTopicSuggestions` | topics.generate | claude | API Key |

### CRUD Operations

| Route | Intent | Tools | Auth |
|-------|--------|-------|------|
| `GET /api/newsletters` | newsletter.list | db-newsletter | None |
| `POST /api/newsletters` | newsletter.create | db-newsletter | None |
| `PUT /api/newsletters/:id` | newsletter.update | db-newsletter | None |
| `DELETE /api/newsletters/:id` | newsletter.delete | db-newsletter | None |

### Google Integration

| Route | Intent | Tools | Auth |
|-------|--------|-------|------|
| `POST /api/saveToDrive` | drive.save | google-drive | OAuth |
| `POST /api/sendEmail` | email.send | google-gmail, db-subscriber | OAuth |
| `POST /api/oauth/google/url` | oauth.initiate | google-oauth | None |

## Usage Examples

### Express Middleware for Intent Resolution

```typescript
import { classifyIntent, resolveAuth, getAuthType } from '../control-plane/resolver';
import { createRequestLogger } from '../control-plane/feedback';

export function intentResolutionMiddleware(req, res, next) {
  const log = createRequestLogger(req.correlationId, 'resolver');

  // Classify intent
  const intent = classifyIntent(req.method, req.path);
  if (!intent) {
    log.warn('unmatched', `No intent match for ${req.method} ${req.path}`);
    return res.status(404).json({ error: 'Not found' });
  }

  req.intent = intent;
  log.info('classified', `Intent: ${intent.resource}.${intent.action}`, {
    tools: intent.tools,
    authRequired: intent.authRequired,
  });

  next();
}

export function authMiddleware(req, res, next) {
  if (!req.intent.authRequired) {
    return next();
  }

  const authType = getAuthType(req.method, req.path);
  resolveAuth(req.headers, authType, {
    correlationId: req.correlationId,
    ipAddress: req.ip,
  }).then((auth) => {
    if (!auth.valid) {
      return res.status(401).json({
        success: false,
        error: auth.error,
      });
    }
    req.auth = auth;
    next();
  }).catch(next);
}
```

### Complete Request Flow

```typescript
import {
  classifyIntent,
  resolveAuth,
  getAuthType,
} from '../control-plane/resolver';
import { getTool } from '../control-plane/registration';
import { createRequestLogger, tracer } from '../control-plane/feedback';

async function handleRequest(req, res) {
  const log = createRequestLogger(req.correlationId, 'handler');
  const trace = tracer.startTrace(req.correlationId, `${req.method} ${req.path}`);

  try {
    // 1. Classify intent
    const intent = classifyIntent(req.method, req.path);
    if (!intent) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 2. Resolve authentication
    if (intent.authRequired) {
      const authType = getAuthType(req.method, req.path);
      const auth = await resolveAuth(req.headers, authType, {
        correlationId: req.correlationId,
        ipAddress: req.ip,
      });

      if (!auth.valid) {
        return res.status(401).json({ error: auth.error });
      }
    }

    // 3. Execute tools in order
    let result;
    for (const step of intent.executionPlan) {
      const tool = getTool(step.toolId);
      if (!tool || !tool.enabled) {
        throw new Error(`Tool ${step.toolId} not available`);
      }

      const span = trace.startSpan(`tool:${step.toolId}`);
      try {
        result = await tool.handler(req.body, {
          correlationId: req.correlationId,
          previousResult: result,
        });
        span.end();
      } catch (error) {
        span.error(error);
        throw error;
      }
    }

    trace.end();
    res.json({ success: true, data: result });

  } catch (error) {
    log.error('failed', 'Request failed', error);
    trace.end();
    res.status(500).json({ error: error.message });
  }
}
```

## Configuration

### Auth Resolver Configuration

```typescript
import { configureAuthResolver } from './resolver';

configureAuthResolver({
  apiKeyHeader: 'x-api-key',
  oauthHeader: 'authorization',

  // Custom API key validator
  apiKeyValidator: async (key, service) => {
    // Validate against database
    const result = await db.validateApiKey(key, service);
    return {
      valid: result.valid,
      service,
      userEmail: result.userEmail,
      error: result.error,
    };
  },

  // Custom OAuth validator
  oauthValidator: async (token) => {
    // Validate with Google
    const result = await googleAuth.validateToken(token);
    return {
      valid: result.valid,
      accessToken: token,
      userEmail: result.email,
      scopes: result.scopes,
      error: result.error,
    };
  },
});
```

## Error Handling

### Auth Errors

| Error Code | HTTP Status | Meaning |
|------------|-------------|---------|
| `MISSING_API_KEY` | 401 | API key header not provided |
| `INVALID_API_KEY` | 401 | API key validation failed |
| `MISSING_OAUTH_TOKEN` | 401 | OAuth token not provided |
| `INVALID_OAUTH_TOKEN` | 401 | OAuth token invalid/expired |

### Recovery

```typescript
const auth = await resolveAuth(headers, 'api_key');
if (!auth.valid) {
  switch (auth.error?.code) {
    case 'MISSING_API_KEY':
      // Prompt user to add API key
      break;
    case 'INVALID_API_KEY':
      // Prompt user to update API key
      break;
    case 'INVALID_OAUTH_TOKEN':
      // Redirect to re-authenticate
      break;
  }
}
```

## Testing Instructions

### Running Tests

```bash
npm test -- --grep "resolver"
```

### Mocking Auth

```typescript
import { configureAuthResolver, resetAuthResolverConfig } from './resolver';

describe('Protected Endpoint', () => {
  beforeEach(() => {
    configureAuthResolver({
      apiKeyValidator: async () => ({
        valid: true,
        service: 'claude',
        userEmail: 'test@example.com',
      }),
    });
  });

  afterEach(() => {
    resetAuthResolverConfig();
  });

  it('should allow authenticated requests', async () => {
    // Test with mock auth
  });
});
```

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-17 | Initial implementation | Claude |
