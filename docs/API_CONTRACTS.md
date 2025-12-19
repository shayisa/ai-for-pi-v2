# API Contracts

> **Purpose**: Define request/response schemas for all API endpoints to prevent breaking changes
>
> **Last Updated**: December 2024 (Phase 8+ Complete)
> **Total Endpoints**: 120+ across 18 route files

## Standardized Response Format

All API endpoints return responses in a standardized wrapper format for consistent handling.

### Success Response Structure

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;                        // Generic data payload
  correlationId: string;          // Request tracking ID (uuid)
  timestamp: string;              // ISO 8601 timestamp
  meta?: {                        // Optional metadata
    duration?: number;            // Request duration in ms
    pagination?: PaginationMeta;
    rateLimit?: RateLimitMeta;
  };
}
```

### Error Response Structure

```typescript
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;                 // e.g., "VALIDATION_ERROR"
    message: string;              // Human-readable message
    details?: Record<string, unknown>;
  };
  correlationId: string;
  timestamp: string;
}
```

### Standard Error Codes

| Code | HTTP Status | Use Case |
|------|-------------|----------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `INVALID_INPUT` | 400 | Malformed request |
| `MISSING_FIELD` | 400 | Required field missing |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `MISSING_API_KEY` | 401 | API key not configured |
| `INVALID_API_KEY` | 401 | API key invalid |
| `MISSING_OAUTH_TOKEN` | 401 | OAuth token required |
| `TOKEN_EXPIRED` | 401 | OAuth token expired |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `EXTERNAL_SERVICE_ERROR` | 500 | External API failed |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Frontend Response Handling

Frontend services use `apiRequest()` from `apiHelper.ts` which automatically:
1. Unwraps the `data` field from success responses
2. Extracts error messages from error responses
3. Handles both wrapped and legacy (unwrapped) formats for backward compatibility

```typescript
import { apiRequest } from './apiHelper';

// Returns unwrapped data directly
const newsletters = await apiRequest<{ newsletters: Newsletter[] }>('/api/newsletters');
// newsletters = { newsletters: [...] }  // data field unwrapped
```

---

## Backend Endpoints

### POST /api/generateNewsletter

Generates a complete newsletter with AI content.

**Request:**
```typescript
interface GenerateNewsletterRequest {
  topics: string[];              // Required: 1-5 topics
  audience: string[];            // Required: e.g., ["business", "forensic"]
  tone: string;                  // Required: e.g., "professional", "casual"
  flavors: string[];             // Optional: e.g., ["detailed", "concise"]
  imageStyle: string;            // Required: e.g., "photorealistic"
  trendingSources?: TrendingSource[];  // Optional: pre-fetched sources
}
```

**Response:**
```typescript
interface GenerateNewsletterResponse {
  text: string;  // JSON string containing Newsletter object
  metadata?: {
    tokensUsed: number;
    searchQueries: string[];
    model: string;
  };
}

// Parsed from text:
interface Newsletter {
  subject: string;
  introduction: string;
  sections: NewsletterSection[];
  conclusion: string;
  promptOfTheDay?: PromptOfTheDay;
}

interface NewsletterSection {
  title: string;
  content: string;           // HTML content with inline links
  imagePrompt: string;
  imageUrl?: string;         // Added after image generation
  actionability?: {          // NEW in v2
    implementationTime: string;
    skillLevel: "beginner" | "intermediate" | "advanced";
    prerequisites: string[];
    steps: string[];
    expectedOutcome: string;
    estimatedCost?: string;
  };
  sources?: {                // NEW in v2
    url: string;
    title: string;
    lastVerified?: string;
  }[];
}
```

**Error Responses:**
- `400`: Invalid request (missing required fields)
- `401`: Invalid API key
- `429`: Rate limit exceeded
- `500`: Generation failed

---

### POST /api/generateImage

Generates an image using Stability AI.

**Request:**
```typescript
interface GenerateImageRequest {
  prompt: string;       // Image description
  imageStyle: string;   // Style preset
}
```

**Response:**
```typescript
interface GenerateImageResponse {
  imageUrl: string;     // Base64 data URL or hosted URL
}
```

**Error Responses:**
- `400`: Invalid prompt
- `401`: Invalid Stability AI key
- `429`: Rate limit (Stability AI)
- `500`: Generation failed

---

### GET /api/fetchTrendingSources

Fetches trending content from multiple sources.

**Request:** None (GET request)

**Response:**
```typescript
interface FetchTrendingSourcesResponse {
  sources: TrendingSource[];
  cachedAt?: string;        // NEW in v2: Cache timestamp
  ttl?: number;             // NEW in v2: Time to live in ms
}

interface TrendingSource {
  id: string;
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: "hackernews" | "arxiv" | "github" | "reddit" | "dev";
  summary?: string;
}
```

---

### POST /api/generateTopicSuggestions

Generates topic suggestions using Claude with web search.

**Request:**
```typescript
interface GenerateTopicSuggestionsRequest {
  audience: string[];
  existingTopics?: string[];
  trendingSources?: TrendingSource[];
}
```

**Response:**
```typescript
interface GenerateTopicSuggestionsResponse {
  text: string;  // JSON array of topic strings
  metadata?: {
    searchQueries: string[];
    tokensUsed: number;
  };
}
```

---

### POST /api/generateCompellingTrendingContent

Generates actionable insights from trending sources.

**Request:**
```typescript
interface GenerateCompellingContentRequest {
  audience: string[];
  trendingSources: TrendingSource[];
}
```

**Response:**
```typescript
interface GenerateCompellingContentResponse {
  text: string;  // JSON object with actionable capabilities
}

// Parsed structure:
interface CompellingContent {
  actionableCapabilities: {
    title: string;
    description: string;
    implementationGuide: string;
    relevantTools: string[];
  }[];
  essentialTools: {
    name: string;
    purpose: string;
    url: string;
  }[];
}
```

---

### POST /api/savePresets

Saves newsletter presets to Google Sheets.

**Request:**
```typescript
interface SavePresetsRequest {
  presets: Preset[];
}

interface Preset {
  id: string;
  name: string;
  topics: string[];
  audience: string[];
  tone: string;
  flavors: string[];
  imageStyle: string;
  createdAt: string;
  updatedAt: string;
}
```

**Response:**
```typescript
interface SavePresetsResponse {
  success: boolean;
  savedCount: number;
}
```

**Headers Required:**
- `Authorization: Bearer <google_access_token>`

---

### GET /api/loadPresets

Loads newsletter presets from Google Sheets.

**Request:** None (GET request)

**Headers Required:**
- `Authorization: Bearer <google_access_token>`

**Response:**
```typescript
interface LoadPresetsResponse {
  presets: Preset[];
}
```

---

---

## Phase 8 Endpoints

### Thumbnail Endpoints

#### GET /api/thumbnails

Returns all cached image style thumbnails.

**Response:**
```typescript
interface GetThumbnailsResponse {
  thumbnails: StyleThumbnail[];
}

interface StyleThumbnail {
  id: string;
  styleName: string;
  imageBase64: string;
  prompt: string;
  createdAt: string;
}
```

---

#### GET /api/thumbnails/status

Returns thumbnail generation status.

**Response:**
```typescript
interface ThumbnailStatusResponse {
  total: 9;
  generated: number;
  missing: string[];  // Style names not yet generated
}
```

---

#### POST /api/thumbnails/:styleName/generate

Generates and caches a thumbnail for the specified style.

**Response:**
```typescript
interface GenerateThumbnailResponse {
  thumbnail: StyleThumbnail;
  cached: boolean;  // true if returned from existing cache
}
```

**Error Responses:**
- `400`: Invalid style name
- `500`: Stability AI generation failed

---

#### DELETE /api/thumbnails/:styleName

Deletes a cached thumbnail.

**Response:**
```typescript
interface DeleteThumbnailResponse {
  success: true;
  message: string;
}
```

---

### Template Endpoints

#### GET /api/templates

Lists all newsletter templates.

**Query Parameters:**
- `limit` (optional): Max templates to return (default: 50)

**Response:**
```typescript
interface GetTemplatesResponse {
  templates: NewsletterTemplate[];
  count: number;
}

interface NewsletterTemplate {
  id: string;
  name: string;
  description: string;
  structure: TemplateStructure;
  defaultSettings?: TemplateSettings;
  createdAt: string;
  updatedAt: string;
}

interface TemplateStructure {
  introduction: string;
  sections: Array<{
    title: string;
    content: string;
    imagePrompt?: string;
  }>;
  conclusion: string;
  includePromptOfDay: boolean;
  promptOfTheDay?: PromptOfTheDay;
}

interface TemplateSettings {
  tone?: string;
  imageStyle?: string;
  audiences?: string[];
  personaId?: string;
}
```

---

#### GET /api/templates/:id

Get template by ID.

**Response:** `NewsletterTemplate`

**Error Responses:**
- `404`: Template not found

---

#### POST /api/templates

Create a new template.

**Request:**
```typescript
interface CreateTemplateRequest {
  name: string;           // Required
  description?: string;
  structure: TemplateStructure;  // Required
  defaultSettings?: TemplateSettings;
}
```

**Response:** 201 with created `NewsletterTemplate`

**Error Responses:**
- `400`: Missing name or structure

---

#### POST /api/templates/from-newsletter

Create template from existing newsletter content.

**Request:**
```typescript
interface CreateFromNewsletterRequest {
  name: string;           // Required
  description?: string;
  newsletter: {           // Required
    introduction?: string;
    sections: Array<{ title: string; content: string; imagePrompt?: string }>;
    conclusion?: string;
  };
  settings?: TemplateSettings;
}
```

**Response:** 201 with created `NewsletterTemplate`

**Error Responses:**
- `400`: Missing name or newsletter.sections

---

#### PUT /api/templates/:id

Update an existing template.

**Request:** Partial `NewsletterTemplate` fields

**Response:** Updated `NewsletterTemplate`

**Error Responses:**
- `404`: Template not found

---

#### DELETE /api/templates/:id

Delete a template.

**Response:**
```typescript
interface DeleteTemplateResponse {
  success: true;
  message: string;
}
```

---

### Draft Endpoints

#### GET /api/drafts/:userEmail

Get user's saved draft.

**Response:**
```typescript
interface NewsletterDraft {
  id: string;
  userEmail: string;
  content: DraftContent;
  topics: string[];
  settings: DraftSettings;
  lastSavedAt: string;
}

interface DraftContent {
  newsletter?: {
    subject?: string;
    introduction?: string;
    sections?: Array<{ title: string; content: string; imagePrompt?: string }>;
    conclusion?: string;
  };
  enhancedNewsletter?: EnhancedNewsletter;
  formatVersion: 'v1' | 'v2';
}

interface DraftSettings {
  selectedTone?: string;
  selectedImageStyle?: string;
  selectedAudiences?: string[];
  personaId?: string | null;
  promptOfTheDay?: PromptOfTheDay;
}
```

**Error Responses:**
- `404`: No draft found for user

---

#### GET /api/drafts/:userEmail/exists

Check if draft exists for user.

**Response:**
```typescript
interface DraftExistsResponse {
  exists: boolean;
}
```

---

#### POST /api/drafts

Save or update a draft.

**Request:**
```typescript
interface SaveDraftRequest {
  userEmail: string;      // Required
  content: DraftContent;  // Required
  topics?: string[];
  settings?: DraftSettings;
}
```

**Response:** Saved `NewsletterDraft`

**Error Responses:**
- `400`: Missing userEmail or content

---

#### DELETE /api/drafts/:userEmail

Delete user's draft.

**Response:**
```typescript
interface DeleteDraftResponse {
  success: true;
  message: string;
}
```

---

## Supabase Edge Functions

### POST /functions/v1/save-api-key

Stores an encrypted API key.

**Request:**
```typescript
interface SaveApiKeyRequest {
  service: "claude" | "gemini" | "stability";
  key: string;
  userEmail: string;
}
```

**Response:**
```typescript
interface SaveApiKeyResponse {
  success: boolean;
  message: string;
}
```

---

### POST /functions/v1/validate-api-key

Validates an API key by testing the service.

**Request:**
```typescript
interface ValidateApiKeyRequest {
  service: "claude" | "gemini" | "stability";
  userEmail: string;
}
```

**Response:**
```typescript
interface ValidateApiKeyResponse {
  valid: boolean;
  message: string;
  lastValidated: string;
}
```

---

### GET /functions/v1/get-api-key-statuses

Gets validation status for all keys.

**Request Query:**
- `userEmail`: string

**Response:**
```typescript
interface GetApiKeyStatusesResponse {
  statuses: {
    service: string;
    isValid: boolean;
    lastValidated: string | null;
  }[];
}
```

---

## Phase 8+ Endpoints (New)

### Writer Personas

#### GET /api/personas
Lists all writer personas.

**Response:**
```typescript
interface PersonasResponse {
  personas: WriterPersona[];
}
```

#### POST /api/personas
Creates a new writer persona.

#### PUT /api/personas/:id
Updates an existing persona.

#### DELETE /api/personas/:id
Deletes a persona.

---

### Custom Audiences

#### GET /api/audiences
Lists all custom audiences.

#### POST /api/audiences
Creates a new audience.

#### PUT /api/audiences/:id
Updates an existing audience.

#### DELETE /api/audiences/:id
Deletes an audience.

---

### Content Calendar

#### GET /api/calendar
Lists calendar entries with optional date range filtering.

**Query Params:**
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)

#### POST /api/calendar
Creates a new calendar entry.

#### PUT /api/calendar/:id
Updates a calendar entry.

#### DELETE /api/calendar/:id
Deletes a calendar entry.

---

### Multi-Source Prompt Import

#### POST /api/prompts/import/url
Imports a prompt from a URL.

**Request:**
```typescript
interface ImportFromUrlRequest {
  url: string;
  forceAiParse?: boolean;
  saveTemplate?: boolean;
  templateName?: string;
}
```

**Response:**
```typescript
interface ImportResult {
  success: boolean;
  prompt?: PromptOfTheDay;
  templateUsed?: string;
  newTemplateCreated?: boolean;
  error?: string;
}
```

#### POST /api/prompts/import/file
Imports a prompt from an uploaded file (DOCX, PDF, PPTX, TXT, MD).

**Request:** `multipart/form-data` with file upload

#### GET /api/prompts/import/templates
Lists all parsing templates.

#### POST /api/prompts/import/templates
Creates a new parsing template.

---

### System Logs

#### GET /api/logs
Lists system logs with filtering and pagination.

**Query Params:**
- `type`: Log type filter
- `level`: Log level filter
- `search`: Search term
- `limit`: Max results
- `offset`: Pagination offset

#### GET /api/logs/export
Exports logs as CSV.

---

### Scheduled Sends

#### GET /api/scheduled
Lists scheduled newsletter sends.

#### POST /api/scheduled
Schedules a newsletter for future sending.

#### DELETE /api/scheduled/:id
Cancels a scheduled send.

---

### Newsletter Templates

#### GET /api/templates
Lists newsletter templates.

#### POST /api/templates
Creates a new template.

#### PUT /api/templates/:id
Updates a template.

#### DELETE /api/templates/:id
Deletes a template.

---

### Drafts

#### GET /api/drafts
Lists saved drafts.

#### POST /api/drafts
Saves a draft.

#### PUT /api/drafts/:id
Updates a draft.

#### DELETE /api/drafts/:id
Deletes a draft.

---

### Image Style Thumbnails

#### GET /api/thumbnails
Lists image style thumbnails.

#### POST /api/thumbnails/generate
Generates a new thumbnail for a style.

---

## Contract Validation

All requests should be validated using Zod schemas defined in `src/types/apiContracts.ts`.

Example validation:
```typescript
import { GenerateNewsletterRequestSchema } from '@/types/apiContracts';

// In route handler:
const parseResult = GenerateNewsletterRequestSchema.safeParse(req.body);
if (!parseResult.success) {
  return res.status(400).json({
    error: 'Invalid request',
    details: parseResult.error.issues
  });
}
```

---

## Breaking Change Policy

1. **Additive changes are safe**: Adding new optional fields
2. **Removal requires migration**: Removing fields needs deprecation period
3. **Type changes are breaking**: Changing field types requires new endpoint version
4. **Document all changes**: Update this file with every API change
