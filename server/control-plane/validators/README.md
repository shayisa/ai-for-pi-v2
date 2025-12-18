# Validators Module

> **Purpose**: Provide type-safe request/response validation using Zod schemas.

## Overview

The Validators module provides:

| Component | Purpose | File |
|-----------|---------|------|
| **Input Validator** | Validate request bodies, query params, path params | `inputValidator.ts` |
| **Output Validator** | Validate/sanitize responses, remove sensitive data | `outputValidator.ts` |
| **Schemas** | Zod schemas for all API endpoints | `schemas/*.schema.ts` |

## Dependencies

### Internal Modules
- `../types` - Control Plane type definitions
- `../feedback` - Logging

### NPM Packages
- `zod@^4.x` - Schema validation library

## Public API

### Input Validation

```typescript
import {
  validateInput,
  validateQuery,
  validateParams,
  validateBody,
  GenerateNewsletterRequest
} from './validators';

// Direct validation
const result = validateInput(req.body, GenerateNewsletterRequest);
if (!result.success) {
  return res.status(400).json({ error: result.error });
}
const data = result.data; // Typed as GenerateNewsletterRequest

// Query parameter validation (with coercion)
const queryResult = validateQuery(req.query, GetSubscribersQuery);

// Path parameter validation
const paramsResult = validateParams(req.params, z.object({ id: z.string() }));

// Express middleware
app.post('/api/generate',
  validateBody(GenerateNewsletterRequest),
  async (req, res) => {
    // req.body is validated and typed
  }
);
```

### Output Validation

```typescript
import {
  validateOutput,
  sanitizeResponse,
  buildSuccessResponse,
  buildErrorResponse,
  buildApiResponse,
  GetNewslettersResponse
} from './validators';

// Validate output
const validated = validateOutput(data, GetNewslettersResponse, {
  correlationId: req.correlationId
});
// validated.warnings shows any schema mismatches

// Sanitize response (removes sensitive fields)
const safe = sanitizeResponse(data);

// Build standardized responses
const success = buildSuccessResponse(data, req.correlationId, duration);
const error = buildErrorResponse('NOT_FOUND', 'Newsletter not found');
const response = buildApiResponse(data, req.correlationId, startTime);
```

## Available Schemas

### Common Schemas

```typescript
import {
  NonEmptyString,    // z.string().min(1)
  Email,             // z.string().email()
  Url,               // z.string().url()
  Uuid,              // z.string().uuid()
  IsoDateString,     // ISO date string validation
  PaginationQuery,   // { limit, offset }
  SourceCategory,    // 'hackernews' | 'arxiv' | ...
  TrendingSource,    // Full trending source schema
  Newsletter,        // Full newsletter schema
  PromptOfTheDay,    // Prompt of the day schema
  ApiService,        // 'claude' | 'gemini' | 'stability' | 'brave'
} from './validators';
```

### Newsletter Schemas

```typescript
import {
  // Generation endpoints
  GenerateNewsletterRequest,
  GenerateNewsletterResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  GenerateTopicSuggestionsRequest,
  GenerateCompellingContentRequest,

  // CRUD
  SaveNewsletterRequest,
  GetNewslettersResponse,

  // Enhanced (v2)
  EnhancedNewsletter,
  GenerateEnhancedNewsletterRequest,
} from './validators';
```

### Subscriber Schemas

```typescript
import {
  Subscriber,
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
  ImportSubscribersRequest,
  GetSubscribersQuery,
  GetSubscribersResponse,
  SubscriberList,
  CreateSubscriberListRequest,
  SendEmailRequest,
  SendEmailResponse,
} from './validators';
```

### Template & Draft Schemas

```typescript
import {
  NewsletterTemplate,
  CreateTemplateRequest,
  CreateFromNewsletterRequest,
  UpdateTemplateRequest,
  GetTemplatesResponse,
  NewsletterDraft,
  SaveDraftRequest,
} from './validators';
```

### Persona Schemas

```typescript
import {
  WriterPersona,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  GetPersonasResponse,
} from './validators';
```

### Calendar Schemas

```typescript
import {
  CalendarEntry,
  CreateCalendarEntryRequest,
  UpdateCalendarEntryRequest,
  GetCalendarEntriesResponse,
  ScheduledSend,
  EmailStats,
} from './validators';
```

## Usage Examples

### Complete Endpoint with Validation

```typescript
import {
  validateBody,
  validateOutput,
  buildApiResponse,
  buildErrorResponse,
  GenerateNewsletterRequest,
  GenerateNewsletterResponse,
} from '../control-plane/validators';
import { createRequestLogger } from '../control-plane/feedback';

app.post('/api/generateNewsletter',
  validateBody(GenerateNewsletterRequest),
  async (req, res) => {
    const startTime = Date.now();
    const log = createRequestLogger(req.correlationId, 'newsletter');

    try {
      log.info('generate', 'Starting newsletter generation', {
        topics: req.body.topics.length
      });

      const result = await generateNewsletter(req.body);

      // Validate output (logs warnings if schema mismatch)
      const validated = validateOutput(result, GenerateNewsletterResponse, {
        correlationId: req.correlationId
      });

      res.json(buildApiResponse(validated.data, req.correlationId, startTime));

    } catch (error) {
      log.error('generate', 'Newsletter generation failed', error);
      res.status(500).json(
        buildErrorResponse('GENERATION_FAILED', error.message)
      );
    }
  }
);
```

### Custom Schema Creation

```typescript
import { z } from 'zod';
import { NonEmptyString, Email, IsoDateString } from './validators';

// Create custom schema using common primitives
export const MyCustomRequest = z.object({
  name: NonEmptyString,
  email: Email,
  date: IsoDateString,
  tags: z.array(z.string()).min(1).max(10),
  metadata: z.record(z.unknown()).optional(),
});
export type MyCustomRequest = z.infer<typeof MyCustomRequest>;
```

### Express Router with Validation

```typescript
import { Router } from 'express';
import {
  validateBody,
  validateQueryMiddleware,
  GetSubscribersQuery,
  CreateSubscriberRequest,
} from '../control-plane/validators';

const router = Router();

router.get('/',
  validateQueryMiddleware(GetSubscribersQuery),
  async (req, res) => {
    // req.query is validated with proper types
    const { limit, offset, status } = req.query;
    // ...
  }
);

router.post('/',
  validateBody(CreateSubscriberRequest),
  async (req, res) => {
    // req.body is validated
    const { email, name, lists } = req.body;
    // ...
  }
);

export default router;
```

## Error Handling

### Validation Error Format

```typescript
// Input validation returns structured errors
const result = validateInput(badData, Schema);
if (!result.success) {
  console.log(result.error);
  // {
  //   message: "topics: At least 1 topic required",
  //   errors: [
  //     {
  //       field: "topics",
  //       message: "At least 1 topic required",
  //       code: "too_small",
  //       expected: "1",
  //       received: "0"
  //     }
  //   ]
  // }
}
```

### Middleware Error Response

```typescript
// validateBody middleware returns 400 with this format:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "topics: At least 1 topic required",
    "details": [
      {
        "field": "topics",
        "message": "At least 1 topic required",
        "code": "too_small"
      }
    ]
  }
}
```

## Configuration

### Input Validator Configuration

```typescript
import { configureInputValidator } from './validators';

configureInputValidator({
  stripUnknown: true,        // Remove unknown fields
  sanitizeStrings: true,     // HTML-escape strings
  maxStringLength: 100000,   // Max string length
  logErrors: true,           // Log validation errors
});
```

### Output Validator Configuration

```typescript
import { configureOutputValidator, addSensitiveFields } from './validators';

configureOutputValidator({
  enabled: true,             // Enable validation
  logErrors: true,           // Log validation warnings
  stripUnknown: false,       // Keep unknown fields
});

// Add custom sensitive fields to redact
addSensitiveFields(['customSecret', 'internalId']);
```

## Testing Instructions

### Running Tests

```bash
npm test -- --grep "validators"
```

### Mocking Validators

```typescript
import { validateInput, configureInputValidator, resetInputValidatorConfig } from './validators';

describe('MyService', () => {
  beforeEach(() => {
    configureInputValidator({ logErrors: false });
  });

  afterEach(() => {
    resetInputValidatorConfig();
  });

  it('should validate input', () => {
    const result = validateInput(
      { topics: ['AI'], audience: ['business'], tone: 'pro', imageStyle: 'photo' },
      GenerateNewsletterRequest
    );
    expect(result.success).toBe(true);
  });

  it('should reject invalid input', () => {
    const result = validateInput(
      { topics: [] }, // Missing required fields
      GenerateNewsletterRequest
    );
    expect(result.success).toBe(false);
    expect(result.error.errors.length).toBeGreaterThan(0);
  });
});
```

## Schema File Organization

```
schemas/
├── common.schema.ts      # Shared primitives and types
├── newsletter.schema.ts  # Newsletter generation/CRUD
├── subscriber.schema.ts  # Subscriber/list management
├── template.schema.ts    # Templates and drafts
├── persona.schema.ts     # Writer personas
└── calendar.schema.ts    # Calendar and scheduling
```

## Best Practices

### Do's

- Use `NonEmptyString` instead of `z.string()` for required strings
- Use `IsoDateString` for date fields
- Create reusable schema fragments for common patterns
- Validate both input and output for critical endpoints
- Use middleware for consistent validation across routes

### Don'ts

- Don't create duplicate schemas for the same data structure
- Don't skip output validation for sensitive data
- Don't use loose types (`z.any()`, `z.unknown()`) unless necessary
- Don't forget to export new schemas from `index.ts`

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-17 | Initial implementation | Claude |
