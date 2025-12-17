# API Contracts

> **Purpose**: Define request/response schemas for all API endpoints to prevent breaking changes

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
