# AI Newsletter Generator v2 - Architecture Reference

> **Comprehensive technical documentation** for understanding, maintaining, and extending the AI Newsletter Generator application.

**Last Updated:** December 2024 (Phase 8+ Complete)
**Version:** 3.1 (Full Feature Implementation)
**Status:** Production-ready with full feature set

## What's New in v3.1 (Phase 8+ Complete)

| Improvement | Before (v3.0) | After (v3.1) |
|-------------|---------------|--------------|
| **Database** | 7 tables | 22 tables (full feature set) |
| **Routes** | 16 route files | 18 route files (120+ endpoints) |
| **Backend Services** | 12 services | 28 services |
| **Frontend Services** | 8 services | 21 services |
| **Components** | 25 components | 37 components |
| **Pages** | 7 pages | 11 pages |

### Phase 8 Features Added
| Feature | Description |
|---------|-------------|
| **Writer Personas** | Custom AI writing personas with favorites |
| **Custom Audiences** | User-defined audience configurations |
| **Newsletter Templates** | Reusable newsletter structures |
| **Content Calendar** | Plan upcoming newsletter topics |
| **Scheduled Sending** | Auto-send newsletters on schedule |
| **Email Analytics** | Track opens/clicks for sent newsletters |
| **Multi-Source Prompt Import** | Import prompts from URLs, DOCX, PDF, PPTX |
| **System Logs** | Unified activity logging with search/export |
| **Draft Auto-Save** | Automatic saving of in-progress work |
| **Image Style Thumbnails** | Preview images for style selection |

### Previous Improvements (retained)
| Improvement | Before | After |
|-------------|--------|-------|
| **Token Cost** | ~12,000 tokens/newsletter | <5,000 tokens (65% reduction) |
| **Testing** | None | 24 unit tests with Vitest |
| **Error Handling** | Ad-hoc | Error boundaries + typed errors |
| **Backend** | Monolithic server.ts | Modular Control Plane (255 lines entry) |
| **State Mgmt** | Props drilling (68 useState) | 6 React Contexts + hooks |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [File Dependency Graph](#2-file-dependency-graph)
3. [API Endpoint Reference](#3-api-endpoint-reference)
4. [Service Layer Documentation](#4-service-layer-documentation)
5. [Component Hierarchy](#5-component-hierarchy)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [External API Dependencies](#7-external-api-dependencies)
8. [Database Schema](#8-database-schema)
9. [Configuration Reference](#9-configuration-reference)
10. [Type Definitions Reference](#10-type-definitions-reference)

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER (Browser)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                              │
│                            Port 5173                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  contexts/ ──► App.tsx ──► Pages ──► Components                             │
│      │                                                                       │
│      ├── AuthContext, UIContext, NewsletterContext (6 total)                │
│      ├── services/*ClientService.ts ──────────────┐                         │
│      ├── services/googleApiService.ts ────────────┼──► Google APIs          │
│      └── services/trendingDataService.ts ─────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   BACKEND (Express.js + Control Plane)                       │
│                              Port 3001                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  server.ts (255 lines - entry point only)                                   │
│      │                                                                       │
│      └── /api/* ──► server/routes/ (18 route files, 120+ endpoints)         │
│                         │                                                    │
│                         ├── generation.routes.ts ──► domains/generation     │
│                         ├── newsletter.routes.ts ──► services/*DbSvc        │
│                         ├── subscriber.routes.ts ──► services/*DbSvc        │
│                         ├── calendar.routes.ts   ──► services/*DbSvc        │
│                         ├── persona.routes.ts    ──► services/*DbSvc        │
│                         ├── promptImport.routes.ts ──► services/*DbSvc      │
│                         └── (12 more route files...)                        │
│                                                                              │
│  server/control-plane/                                                       │
│      ├── invocation/contextManager.ts (correlation IDs)                     │
│      ├── feedback/logger.ts (structured logging)                            │
│      └── validators/schemas/*.ts (Zod validation)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────────┐   ┌─────────────────────────────────────┐
│        EXTERNAL APIs              │   │         SQLite DATABASE             │
├───────────────────────────────────┤   │        (Local, self-contained)      │
│  • Anthropic Claude API           │   ├─────────────────────────────────────┤
│  • Stability AI API               │   │  Tables (22):                       │
│  • Brave Search API               │   │    • newsletters, archives          │
│  • Google Workspace APIs          │   │    • subscribers, subscriber_lists  │
│    - Drive, Sheets, Gmail         │   │    • api_keys, api_key_audit_log    │
│  • Trending Sources (free):       │   │    • writer_personas, custom_aud.   │
│    - HackerNews, ArXiv, GitHub    │   │    • newsletter_templates, drafts   │
│    - Reddit, Dev.to               │   │    • calendar, scheduled_sends      │
│                                   │   │    • email_tracking, email_stats    │
│                                   │   │    • system_logs, saved_prompts     │
│                                   │   │    • prompt_import_templates/logs   │
│                                   │   │    • image_style_thumbnails, etc.   │
│                                   │   │  Features: WAL mode, proper indexes │
└───────────────────────────────────┘   └─────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, TailwindCSS, Framer Motion |
| **State Mgmt** | 6 React Contexts (Auth, UI, Newsletter, Topics, Presets, Settings) |
| **Backend** | Node.js, Express 5, TypeScript, Control Plane Architecture |
| **Database** | SQLite with better-sqlite3 (local, self-contained) |
| **AI Services** | Anthropic Claude Sonnet 4, Stability AI |
| **Search** | Brave Search API |
| **Cloud** | Google Drive, Sheets, Gmail APIs |
| **Auth** | Google OAuth 2.0 (backend-managed tokens) |

### 1.3 Application Purpose

The AI Newsletter Generator automates the creation and distribution of AI-powered newsletters:

1. **Content Generation** - Claude generates structured newsletter content with web search grounding
2. **Image Generation** - Stability AI creates custom images for each section
3. **Email Formatting** - Converts newsletters to responsive HTML with syntax highlighting
4. **Cloud Storage** - Auto-saves newsletters to Google Drive as self-contained HTML
5. **Distribution** - Sends newsletters via Gmail to subscriber lists (BCC)
6. **Activity Tracking** - Logs all newsletters to Google Sheets with unique IDs
7. **History & Reuse** - Load and resend previous newsletters

---

## 2. File Dependency Graph

### 2.1 Project Structure (v3 Control Plane)

```
/
├── App.tsx                          # Main React app (provider wrapper)
├── server.ts                        # Express entry point (255 lines)
├── types.ts                         # TypeScript interfaces
├── .env.local                       # Environment variables (not committed)
│
├── contexts/                        # React Contexts (v3 NEW)
│   ├── AuthContext.tsx              # Google OAuth state
│   ├── UIContext.tsx                # UI state (modals, navigation)
│   ├── NewsletterContext.tsx        # Newsletter generation state
│   ├── TopicsContext.tsx            # Topic selection state
│   ├── PresetsContext.tsx           # Preset management
│   ├── SettingsContext.tsx          # App settings
│   └── AppProviders.tsx             # Provider composition
│
├── hooks/                           # Custom React hooks (17 files)
│   ├── useNewsletterGeneration.ts   # Newsletter generation logic
│   ├── useSystemLogs.ts             # Log viewer state
│   ├── usePersonas.ts               # Writer personas
│   ├── useTemplates.ts              # Newsletter templates
│   ├── useAudiences.ts              # Custom audiences
│   ├── useCalendar.ts               # Content calendar
│   ├── usePrompts.ts                # Saved prompts
│   ├── usePromptImport.ts           # Multi-source prompt import
│   ├── useDrafts.ts                 # Draft auto-save
│   ├── useThumbnails.ts             # Image style thumbnails
│   └── __tests__/                   # Hook unit tests
│
├── pages/                           # Page components (11 files)
│   ├── GenerateNewsletterPage.tsx   # Main generation workflow
│   ├── DiscoverTopicsPage.tsx       # Topic selection & trending
│   ├── ToneAndVisualsPage.tsx       # Tone, flavor, image style
│   ├── HistoryContentPage.tsx       # History & archives
│   ├── SubscriberManagementPage.tsx # Subscribers & lists
│   ├── ContentCalendarPage.tsx      # Content calendar
│   ├── LogsPage.tsx                 # System logs
│   ├── ImageStylePage.tsx           # Image style selection
│   ├── SettingsAndIntegrationsPage.tsx # Settings & integrations
│   ├── DefineTonePage.tsx           # Tone definition
│   └── AuthenticationPage.tsx       # OAuth authentication
│
├── services/                        # Frontend API clients (21 files)
│   ├── apiHelper.ts                 # Canonical API request helper
│   ├── claudeService.ts             # Generation API client
│   ├── googleApiService.ts          # Google Workspace
│   ├── personaClientService.ts      # Writer personas
│   ├── audienceClientService.ts     # Custom audiences
│   ├── templateClientService.ts     # Newsletter templates
│   ├── calendarClientService.ts     # Content calendar
│   ├── promptClientService.ts       # Saved prompts
│   ├── promptImportClientService.ts # Multi-source prompt import
│   ├── draftClientService.ts        # Draft auto-save
│   ├── thumbnailClientService.ts    # Image style thumbnails
│   ├── logClientService.ts          # System logs
│   └── trendingDataService.ts       # External trending sources
│
├── server/                          # Backend (Control Plane)
│   ├── routes/                      # 18 route files (120+ endpoints)
│   │   ├── index.ts                 # Route aggregator
│   │   ├── generation.routes.ts     # AI generation endpoints
│   │   ├── newsletter.routes.ts     # Newsletter CRUD
│   │   ├── subscriber.routes.ts     # Subscriber management
│   │   ├── calendar.routes.ts       # Content calendar
│   │   ├── persona.routes.ts        # Writer personas
│   │   ├── template.routes.ts       # Newsletter templates
│   │   ├── promptImport.routes.ts   # Multi-source import (URLs, files)
│   │   ├── log.routes.ts            # System logs
│   │   ├── thumbnail.routes.ts      # Image style thumbnails
│   │   ├── draft.routes.ts          # Draft auto-save
│   │   └── (7 more route files...)
│   │
│   ├── domains/                     # Domain services
│   │   └── generation/
│   │       ├── services/            # 5 generation services
│   │       ├── helpers/             # Audience, flavor, tone, sanitizers
│   │       └── sources/             # 5 trending source fetchers
│   │
│   ├── services/                    # Database services (28 files)
│   │   ├── newsletterDbService.ts   # Newsletter CRUD
│   │   ├── personaDbService.ts      # Writer personas
│   │   ├── audienceDbService.ts     # Custom audiences
│   │   ├── templateDbService.ts     # Newsletter templates
│   │   ├── calendarDbService.ts     # Content calendar
│   │   ├── schedulerDbService.ts    # Scheduled sending
│   │   ├── promptDbService.ts       # Saved prompts
│   │   ├── promptImportDbService.ts # Prompt import templates/logs
│   │   ├── promptParserService.ts   # AI prompt parsing
│   │   ├── fileExtractorService.ts  # DOCX/PDF/PPTX extraction
│   │   ├── draftDbService.ts        # Draft auto-save
│   │   ├── thumbnailDbService.ts    # Image style thumbnails
│   │   ├── systemLogDbService.ts    # System activity logs
│   │   ├── logCleanupService.ts     # Auto-cleanup scheduler
│   │   └── (14 more service files...)
│   │
│   ├── external/                    # External API clients
│   │   ├── claude/client.ts         # Anthropic Claude
│   │   ├── stability/client.ts      # Stability AI
│   │   └── brave/client.ts          # Brave Search
│   │
│   ├── control-plane/               # Control Plane modules
│   │   ├── invocation/              # Request context, correlation IDs
│   │   ├── feedback/                # Structured logging
│   │   └── validators/schemas/      # Zod validation schemas
│   │
│   ├── cache/                       # Caching
│   │   ├── trendingCache.ts         # 1-hour TTL
│   │   └── searchCache.ts           # 15-minute TTL
│   │
│   └── db/
│       └── init.ts                  # SQLite initialization
│
├── docs/                            # Documentation
│   ├── API_CONTRACTS.md             # Request/response schemas
│   ├── architecture/                # Architecture docs
│   └── STATE_DEPENDENCIES.md        # State dependency graph
│
└── data/
    └── newsletter.db                # SQLite database (7 tables)
```

### 2.2 Import Dependency Map

#### App.tsx Imports
```
App.tsx
├── React (useState, useCallback, useEffect)
├── types.ts
│   └── Newsletter, NewsletterSection, TrendingTopic, GoogleSettings,
│       GapiAuthData, Preset, HistoryItem, PromptOfTheDay, Subscriber, SubscriberList
├── components/
│   ├── Header.tsx
│   ├── NewsletterPreview.tsx
│   ├── ImageEditorModal.tsx
│   ├── Spinner.tsx
│   ├── SettingsModal.tsx
│   ├── PresetsManager.tsx
│   ├── HistoryPanel.tsx
│   ├── PromptOfTheDayEditor.tsx
│   ├── SideNavigation.tsx
│   └── IconComponents.tsx (SparklesIcon, SearchIcon, etc.)
├── pages/
│   ├── AuthenticationPage.tsx
│   ├── DiscoverTopicsPage.tsx
│   ├── DefineTonePage.tsx
│   ├── ImageStylePage.tsx
│   ├── GenerateNewsletterPage.tsx
│   ├── HistoryContentPage.tsx
│   └── SubscriberManagementPage.tsx
├── services/
│   ├── claudeService.ts
│   ├── trendingDataService.ts
│   └── googleApiService.ts
├── utils/
│   ├── fileUtils.ts
│   └── stringUtils.ts
└── lib/
    └── supabase.ts
```

#### server.ts Imports
```
server.ts
├── express
├── cors
├── dotenv/config
├── @anthropic-ai/sdk (Anthropic)
└── node:fetch (for external API calls)
```

#### Service Dependencies
```
claudeService.ts
├── utils/retry.ts (withRetry)
└── Calls: Backend /api/* endpoints

googleApiService.ts
├── types.ts
├── utils/emailGenerator.ts
└── Calls: Google APIs directly (GIS + gapi)

apiKeyService.ts
├── lib/supabase.ts
└── Calls: Supabase Edge Functions

trendingDataService.ts
└── Calls: Backend /api/fetchTrendingSources
```

### 2.3 Component Hierarchy

```
App.tsx
├── Header
│   └── Profile dropdown, Settings button
├── SideNavigation
│   └── 6 navigation items
├── [Conditional Page Rendering]
│   ├── AuthenticationPage (if not authenticated)
│   ├── DiscoverTopicsPage
│   │   ├── InspirationSources
│   │   ├── InspirationSourcesPanel
│   │   └── Spinner
│   ├── DefineTonePage
│   ├── ImageStylePage
│   ├── GenerateNewsletterPage
│   │   ├── PresetsManager
│   │   ├── PromptOfTheDayEditor
│   │   ├── ProgressGauge
│   │   └── NewsletterPreview
│   │       └── EditableText (multiple)
│   ├── HistoryContentPage
│   │   └── HistoryPanel
│   └── SubscriberManagementPage
├── SettingsModal (overlay)
│   └── LoadFromDriveModal (nested)
└── ImageEditorModal (overlay)
```

---

## 3. API Endpoint Reference

### 3.1 Backend Endpoints (server.ts)

**Base URL:** `http://localhost:3001`

#### POST /api/generateNewsletter

Generates a complete newsletter with Claude API and web search grounding.

**Request:**
```typescript
{
  topics: string[],           // e.g., ["AI image generation", "LLM fine-tuning"]
  audience: string[],         // e.g., ["academics", "business"]
  tone: string,               // "professional" | "casual" | "witty" | "enthusiastic" | "informative"
  flavors: string[],          // ["includeHumor", "useSlang", "useJargon", "useAnalogies", "citeData"]
  imageStyle: string          // "photorealistic" | "vector" | "watercolor" | etc.
}
```

**Response:**
```typescript
{
  text: string  // JSON string of Newsletter object
}
```

**Newsletter JSON Structure:**
```typescript
{
  id: string,                 // "nl_1731527834000_a3x9k7m2"
  subject: string,
  introduction: string,
  sections: [
    {
      title: string,
      content: string,        // HTML with inline links
      imagePrompt: string,
      imageUrl?: string       // Populated after image generation
    }
  ],
  conclusion: string,
  promptOfTheDay?: {
    title: string,
    summary: string,
    examplePrompts: string[],
    promptCode: string
  }
}
```

**Internal Flow:**
1. Build audience description via `getAudienceDescription()`
2. Apply flavor instructions via `getFlavorInstructions()`
3. Call Claude API with `web_search` tool definition
4. Handle tool use in agentic loop (Claude requests → web search → Claude continues)
5. Parse JSON response and sanitize emojis
6. Return newsletter object

**Claude Model:** `claude-sonnet-4-20250514`
**Max Tokens:** 4096

---

#### POST /api/generateImage

Generates an image using Stability AI.

**Request:**
```typescript
{
  prompt: string,             // Image description
  imageStyle?: string         // Style modifier
}
```

**Response:**
```typescript
{
  image: string               // Base64-encoded PNG
}
```

**Style Mappings:**
| Input | Prompt Suffix |
|-------|---------------|
| `photorealistic` | "photorealistic, high detail, professional photography" |
| `vector` | "vector illustration, flat design, clean lines" |
| `watercolor` | "watercolor painting, soft edges, artistic" |
| `pixel` | "pixel art, retro gaming style, 8-bit" |
| `minimalist` | "minimalist line art, simple, elegant" |
| `oilPainting` | "oil painting, classical art style, rich textures" |
| `cyberpunk` | "cyberpunk style, neon colors, futuristic" |
| `abstract` | "abstract art, geometric shapes, modern" |
| `isometric` | "isometric 3D illustration, technical diagram" |

**External API:** Stability AI v2beta (`stable-image/generate/core`)

---

#### POST /api/generateTopicSuggestions

Generates 10 HOW-TO tutorial topic suggestions.

**Request:**
```typescript
{
  audience: string[],
  sources?: string            // Optional formatted source list
}
```

**Response:**
```typescript
{
  text: string                // JSON array of 10 topic strings
}
```

**Example Output:**
```json
[
  "How to Build a RAG Pipeline with LangChain and Pinecone",
  "How to Fine-tune Stable Diffusion for Custom Styles",
  ...
]
```

---

#### POST /api/generateTrendingTopics

Generates 2-3 trending topics as implementation guides.

**Request:**
```typescript
{
  audience: string[]
}
```

**Response:**
```typescript
{
  text: string                // JSON array of {title, summary} objects
}
```

---

#### POST /api/generateTrendingTopicsWithSources

Analyzes real trending sources to identify relevant topics.

**Request:**
```typescript
{
  audience: string[],
  sources: string             // Formatted source list from trending fetch
}
```

**Response:**
```typescript
{
  text: string                // JSON array of {title, summary} objects
}
```

**Claude Model:** `claude-haiku-4-5-20251001` (lightweight)

---

#### POST /api/generateCompellingTrendingContent

Extracts actionable insights from trending sources.

**Request:**
```typescript
{
  audience: string[],
  sources: string             // Formatted trending sources
}
```

**Response:**
```typescript
{
  text: string                // JSON with actionableCapabilities and essentialTools
}
```

**Output Structure:**
```typescript
{
  actionableCapabilities: [
    {
      title: string,
      description: string,
      implementation: string,
      tools: string[]
    }
  ],
  essentialTools: [
    {
      name: string,
      purpose: string,
      integration: string
    }
  ]
}
```

---

#### GET /api/fetchTrendingSources

Fetches trending data from 6 external sources.

**Response:**
```typescript
{
  sources: TrendingSource[]
}
```

**TrendingSource Structure:**
```typescript
{
  id: string,
  title: string,
  url: string,
  author?: string,
  publication?: string,
  date?: string,
  category: "hackernews" | "arxiv" | "github" | "reddit" | "dev" | "producthunt",
  summary?: string,
  score?: number              // Calculated relevance score
}
```

**Sources Fetched:**
| Source | Endpoint | Filter/Limit |
|--------|----------|--------------|
| HackerNews | Firebase API | Top 50, AI keywords, return 12 |
| ArXiv | API query | AI/ML/CV papers, 60 days, return 15 |
| GitHub | Search API | Python, 1000+ stars, return 15 |
| Reddit | JSON API | 12 subreddits, top posts |
| Dev.to | Public API | AI tag, return 8 |

**Note:** Product Hunt mock data was removed in v2. All sources now use real data only.

---

#### POST /api/savePresets

Saves presets to Google Sheets.

**Request:**
```typescript
{
  presets: Preset[],
  accessToken: string         // Google OAuth token
}
```

**Response:**
```typescript
{
  message: string
}
```

---

#### GET /api/loadPresets

Loads presets from Google Sheets.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```typescript
{
  presets: Preset[]
}
```

---

#### GET /api/health

Health check endpoint.

**Response:**
```typescript
{
  status: "ok"
}
```

---

#### Thumbnail Endpoints (Phase 8)

Manage cached preview images for image style selection.

##### GET /api/thumbnails

Returns all cached style thumbnails.

**Response:**
```typescript
{
  thumbnails: StyleThumbnail[]
}

interface StyleThumbnail {
  id: string;
  styleName: string;
  imageBase64: string;
  prompt: string;
  createdAt: string;
}
```

##### GET /api/thumbnails/status

Returns thumbnail generation status.

**Response:**
```typescript
{
  total: 9,              // Total style count
  generated: number,     // Cached thumbnails
  missing: string[]      // Styles needing generation
}
```

**Supported Styles:** `photorealistic`, `vector`, `watercolor`, `pixel`, `minimalist`, `oilPainting`, `cyberpunk`, `abstract`, `isometric`

##### POST /api/thumbnails/:styleName/generate

Generates and caches thumbnail for a style.

**Response:**
```typescript
{
  thumbnail: StyleThumbnail,
  cached: boolean         // true if returned from cache
}
```

##### DELETE /api/thumbnails/:styleName

Deletes a cached thumbnail.

**Response:**
```typescript
{
  success: true,
  message: string
}
```

---

#### Template Endpoints (Phase 8)

Manage reusable newsletter templates.

##### GET /api/templates

List all templates.

**Query:** `?limit=50`

**Response:**
```typescript
{
  templates: NewsletterTemplate[],
  count: number
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
```

##### GET /api/templates/:id

Get template by ID.

**Response:** `NewsletterTemplate` or 404

##### POST /api/templates

Create new template.

**Request:**
```typescript
{
  name: string,           // Required
  description?: string,
  structure: TemplateStructure,  // Required
  defaultSettings?: TemplateSettings
}
```

**Response:** 201 with created template

##### POST /api/templates/from-newsletter

Create template from existing newsletter content.

**Request:**
```typescript
{
  name: string,           // Required
  description?: string,
  newsletter: {           // Required
    introduction?: string,
    sections: Array<{ title, content, imagePrompt? }>,
    conclusion?: string
  },
  settings?: TemplateSettings
}
```

**Response:** 201 with created template

##### PUT /api/templates/:id

Update template.

**Request:** Partial template fields

**Response:** Updated template or 404

##### DELETE /api/templates/:id

Delete template.

**Response:**
```typescript
{
  success: true,
  message: string
}
```

---

#### Draft Endpoints (Phase 8)

Auto-save and recover work-in-progress newsletters.

##### GET /api/drafts/:userEmail

Get user's saved draft.

**Response:** `NewsletterDraft` or 404

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
  newsletter?: { subject, introduction, sections, conclusion };
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

##### GET /api/drafts/:userEmail/exists

Check if draft exists.

**Response:**
```typescript
{
  exists: boolean
}
```

##### POST /api/drafts

Save or update draft.

**Request:**
```typescript
{
  userEmail: string,      // Required
  content: DraftContent,  // Required
  topics: string[],
  settings: DraftSettings
}
```

**Response:** Saved draft

##### DELETE /api/drafts/:userEmail

Delete user's draft.

**Response:**
```typescript
{
  success: true,
  message: string
}
```

---

### 3.2 Supabase Edge Functions

**Base URL:** `https://{project}.supabase.co/functions/v1/`

#### POST /save-api-key

Securely saves encrypted API key to database.

**Request:**
```typescript
{
  service: "claude" | "gemini" | "stability",
  key: string,
  userEmail: string
}
```

**Response:**
```typescript
{
  success: boolean,
  message?: string
}
```

**Process:**
1. Validate input (service, key, userEmail)
2. Check if key exists for user+service
3. Insert new or update existing (upsert)
4. Log to `api_key_audit_log`

---

#### POST /validate-api-key

Tests if stored API key is valid with the service.

**Request:**
```typescript
{
  service: "claude" | "gemini" | "stability",
  userEmail: string
}
```

**Response:**
```typescript
{
  isValid: boolean,
  validationError?: string,
  lastValidated: string       // ISO timestamp
}
```

**Validation Endpoints:**
| Service | Test Endpoint |
|---------|---------------|
| Claude | `GET https://api.anthropic.com/v1/models` |
| Gemini | `GET https://generativelanguage.googleapis.com/v1/models` |
| Stability | `GET https://api.stability.ai/v1/engines/list` |

---

#### POST /get-api-key-statuses

Lists all API key statuses for a user (without exposing keys).

**Request:**
```typescript
{
  userEmail: string
}
```

**Response:**
```typescript
{
  statuses: [
    {
      service: string,
      isValid: boolean,
      lastValidated: string | null
    }
  ]
}
```

---

#### POST /setup-supabase-auth

Creates/confirms Supabase user from Google-verified email.

**Request:**
```typescript
{
  email: string,
  name?: string               // Defaults to "Google User"
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  user?: {
    id: string,
    email: string
  }
}
```

---

#### ANY /claude-api/*

Proxies requests to Claude API using stored encrypted key.

**Query Params or Headers:**
- `userEmail` (query) or `x-user-email` (header)

**Process:**
1. Extract userEmail from request
2. Retrieve encrypted key from database
3. Decrypt key
4. Forward request to `https://api.anthropic.com/*`
5. Return response
6. Log to audit table

---

#### ANY /gemini-api/*

Proxies requests to Gemini API using stored encrypted key.

Same pattern as `/claude-api/*`.

---

### 3.3 SQLite API Endpoints (Local)

**Base URL:** `http://localhost:3001`

These endpoints provide CRUD operations for locally-stored data in SQLite.

#### Newsletter Endpoints

##### GET /api/newsletters

Lists all stored newsletters, newest first.

**Query Params:**
```
limit?: number    // Max items to return (default: 50)
```

**Response:**
```typescript
{
  newsletters: Newsletter[];
  count: number;
}
```

---

##### GET /api/newsletters/:id

Gets a single newsletter by ID.

**Response:**
```typescript
Newsletter   // Full newsletter object
```

---

##### POST /api/newsletters

Saves a newsletter to SQLite.

**Request:**
```typescript
{
  newsletter: {
    id: string;
    subject: string;
    introduction: string;
    sections: NewsletterSection[];
    conclusion: string;
    promptOfTheDay?: PromptOfTheDay;
  };
  topics: string[];
  settings?: {
    audience?: string[];
    tone?: string;
    imageStyle?: string;
  };
}
```

**Response:**
```typescript
Newsletter   // Saved newsletter with createdAt
```

---

##### DELETE /api/newsletters/:id

Deletes a newsletter by ID.

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

##### POST /api/newsletters/:id/log

Logs an action for a newsletter.

**Request:**
```typescript
{
  action: 'created' | 'saved_to_drive' | 'sent_email';
  details?: {
    sent_to_lists?: string[];
    recipient_count?: number;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

##### GET /api/newsletters/:id/logs

Gets all logs for a newsletter.

**Response:**
```typescript
{
  logs: Array<{
    id: number;
    newsletterId: string;
    action: string;
    actionAt: string;
    details?: object;
  }>;
}
```

---

#### Subscriber Endpoints

##### GET /api/subscribers

Lists all subscribers with optional filters.

**Query Params:**
```
status?: 'active' | 'inactive'
listId?: string
```

**Response:**
```typescript
{
  subscribers: Subscriber[];
  count: number;
}
```

---

##### GET /api/subscribers/:email

Gets a single subscriber by email.

**Response:**
```typescript
Subscriber
```

---

##### POST /api/subscribers

Adds a new subscriber.

**Request:**
```typescript
{
  email: string;
  name?: string;
  listId?: string;    // Optional list to add to
  source?: string;    // 'manual' | 'import'
}
```

**Response:**
```typescript
Subscriber   // Created subscriber with id and dateAdded
```

---

##### PUT /api/subscribers/:email

Updates subscriber details.

**Request:**
```typescript
{
  name?: string;
  status?: 'active' | 'inactive';
  lists?: string;    // Comma-separated list IDs
}
```

**Response:**
```typescript
Subscriber   // Updated subscriber
```

---

##### DELETE /api/subscribers/:email

Soft deletes a subscriber (sets status to 'inactive').

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

##### POST /api/subscribers/import

Bulk imports subscribers.

**Request:**
```typescript
{
  subscribers: Array<{
    email: string;
    name?: string;
    listId?: string;
  }>;
}
```

**Response:**
```typescript
{
  added: number;
  skipped: number;   // Duplicates skipped
}
```

---

#### List Endpoints

##### GET /api/lists

Lists all subscriber lists.

**Response:**
```typescript
{
  lists: SubscriberList[];
  count: number;
}
```

---

##### GET /api/lists/:id

Gets a single list by ID.

**Response:**
```typescript
SubscriberList
```

---

##### POST /api/lists

Creates a new subscriber list.

**Request:**
```typescript
{
  name: string;
  description?: string;
}
```

**Response:**
```typescript
SubscriberList   // Created list with auto-generated 5-char ID
```

---

##### PUT /api/lists/:id

Updates list details.

**Request:**
```typescript
{
  name?: string;
  description?: string;
}
```

**Response:**
```typescript
SubscriberList
```

---

##### DELETE /api/lists/:id

Deletes a list (removes from all subscribers).

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

##### POST /api/lists/:id/subscribers

Adds a subscriber to a list.

**Request:**
```typescript
{
  email: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

##### DELETE /api/lists/:id/subscribers/:email

Removes a subscriber from a list.

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

##### GET /api/lists/:id/subscribers

Gets all subscribers in a list.

**Response:**
```typescript
{
  subscribers: Subscriber[];
  count: number;
}
```

---

#### Archive Endpoints

##### GET /api/archives

Lists trending data archives.

**Query Params:**
```
limit?: number
audience?: string    // JSON-encoded string[]
```

**Response:**
```typescript
{
  archives: Archive[];
  count: number;
}
```

---

##### POST /api/archives

Saves a trending data archive.

**Request:**
```typescript
{
  content: object;     // Trending data
  audience?: string[]; // Target audience
}
```

**Response:**
```typescript
Archive
```

---

## 3.5 Custom Hooks (v2 NEW)

The v2 refactor extracts state management from App.tsx into focused custom hooks in `/hooks/`.

### useNewsletterGeneration

**Purpose:** Manages newsletter generation state and actions.

**File:** `hooks/useNewsletterGeneration.ts`

**Returns:**
```typescript
{
  // State
  newsletter: Newsletter | null;
  loading: string | null;        // Current loading message
  progress: number;              // 0-100
  error: ErrorState | null;
  editingImage: EditingImage | null;

  // Actions
  generate: (params: GenerateParams) => Promise<Newsletter | null>;
  reset: () => void;
  setNewsletter: Dispatch<SetStateAction<Newsletter | null>>;
  setEditingImage: Dispatch<SetStateAction<EditingImage | null>>;
  clearError: () => void;

  // Newsletter editing
  updateNewsletter: (field, value, sectionIndex?) => void;
  reorderSections: (newSections) => void;
  saveImageEdit: (newImageUrl) => void;
}
```

**Usage:**
```typescript
const { newsletter, loading, progress, generate, reset } = useNewsletterGeneration();

await generate({
  topics: ['AI tools'],
  audience: ['business'],
  tone: 'professional',
  flavors: [],
  imageStyle: 'photorealistic'
});
```

---

### useTopicSelection

**Purpose:** Manages topic selection, AI suggestions, and trending content.

**File:** `hooks/useTopicSelection.ts`

**Returns:**
```typescript
{
  // State
  selectedTopics: string[];
  customTopic: string;
  suggestedTopics: string[];
  trendingContent: TrendingTopic[] | null;
  compellingContent: any;
  trendingSources: TrendingSource[];
  isGeneratingTopics: boolean;
  isFetchingTrending: boolean;
  error: ErrorState | null;

  // Actions
  setCustomTopic: (topic) => void;
  addTopic: () => void;
  removeTopic: (index) => void;
  selectSuggestedTopic: (topic) => void;
  addTrendingTopic: (topic) => void;

  // Async actions
  generateSuggestions: (audience) => Promise<void>;
  fetchTrendingContent: (audience) => Promise<void>;
  clearError: () => void;
}
```

---

### useGoogleWorkspace

**Purpose:** Manages Google OAuth authentication and workspace operations.

**File:** `hooks/useGoogleWorkspace.ts`

**Returns:**
```typescript
{
  // Auth state
  authData: GapiAuthData | null;
  isGoogleApiInitialized: boolean;
  isAuthenticated: boolean;

  // Settings
  googleSettings: GoogleSettings | null;
  setGoogleSettings: Dispatch<SetStateAction<GoogleSettings | null>>;
  saveSettings: (settings) => void;

  // Workflow
  workflowStatus: WorkflowStatus | null;
  workflowActions: WorkflowActions;

  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  executeWorkflowAction: (action, newsletter, topics, lists?) => Promise<void>;
  saveToDrive: (newsletter, topics) => Promise<string>;
  loadFromDrive: (fileId) => Promise<{ newsletter, topics }>;
}
```

---

### usePresets

**Purpose:** Manages preset save/load/delete with local storage and cloud sync.

**File:** `hooks/usePresets.ts`

**Returns:**
```typescript
{
  presets: Preset[];
  savePreset: (name, settings) => void;
  loadPreset: (preset) => Preset['settings'];
  deletePreset: (name) => void;
  syncToCloud: (accessToken) => Promise<void>;
  loadFromCloud: (accessToken) => Promise<void>;
}
```

---

### useHistory

**Purpose:** Manages newsletter generation history using SQLite backend.

**File:** `hooks/useHistory.ts`

**Returns:**
```typescript
{
  // State
  history: HistoryItem[];
  isLoading: boolean;              // True while loading from SQLite
  error: string | null;            // Error message if load/save fails

  // Actions
  addToHistory: (newsletter, topics) => Promise<void>;  // Async - saves to SQLite
  loadFromHistory: (item) => { newsletter, topics };
  deleteFromHistory: (id: string) => Promise<void>;     // Soft delete from SQLite
  refreshHistory: () => Promise<void>;                  // Re-fetch from SQLite
}
```

**Usage:**
```typescript
const { history, isLoading, error, addToHistory, deleteFromHistory } = useHistory();

// History loads automatically on mount
if (isLoading) return <Spinner />;
if (error) return <Error message={error} />;

// Add to history (auto-saved to SQLite)
await addToHistory(newsletter, selectedTopics);

// Delete from history
await deleteFromHistory('nl_123');
```

**Note:** History is limited to 50 items. Data persists in SQLite at `./data/archives.db`.

---

## 4. Service Layer Documentation

### 4.1 claudeService.ts

**Purpose:** Frontend API client that calls backend endpoints.

**Exported Functions:**

```typescript
// Generate newsletter content
generateNewsletterContent(
  topics: string[],
  audience: string[],
  tone: string,
  flavors: string[],
  imageStyle: string
): Promise<{ text: string }>

// Generate topic suggestions
generateTopicSuggestions(
  audience: string[],
  sources?: string
): Promise<{ text: string }>

// Generate trending topics
generateTrendingTopics(
  audience: string[]
): Promise<{ text: string }>

// Generate trending with real sources
generateTrendingTopicsWithSources(
  audience: string[],
  trendingSources: TrendingSource[]
): Promise<{ text: string, sources: TrendingSource[] }>

// Generate compelling content from trending
generateCompellingTrendingContent(
  audience: string[]
): Promise<{ text: string }>

// Generate image
generateImage(
  prompt: string,
  imageStyle?: string
): Promise<string>  // Returns base64

// Edit image (placeholder - returns original)
editImage(
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string>

// Save presets to Google Sheets
savePresetsToCloud(
  presets: Preset[],
  accessToken: string
): Promise<{ message: string }>

// Load presets from Google Sheets
loadPresetsFromCloud(
  accessToken: string
): Promise<{ presets: Preset[] }>
```

**Internal Helpers:**
- `getAudienceDescription(audience)` - Maps audience to detailed descriptions
- `getFlavorInstructions(flavors)` - Maps flavors to prompt instructions

**All async functions wrapped with `withRetry()` from utils/retry.ts**

---

### 4.2 apiKeyService.ts

**Purpose:** Secure API key management using Supabase Edge Functions.

**Exported Functions:**

```typescript
// Save API key to Supabase
saveApiKey(
  credentials: { service: string, key: string },
  userEmail: string
): Promise<boolean>

// Get API key (from database, not recommended for frontend)
getApiKey(
  service: string,
  userEmail: string
): Promise<string | null>

// Check if API key exists
hasApiKey(
  service: string,
  userEmail: string
): Promise<boolean>

// Delete API key
deleteApiKey(
  service: string,
  userEmail: string
): Promise<boolean>

// Get single key status
getApiKeyStatus(
  service: string,
  userEmail: string
): Promise<StoredApiKey | null>

// List all key statuses
listApiKeyStatuses(
  userEmail: string
): Promise<StoredApiKey[]>

// Validate API key with service
validateApiKey(
  service: string,
  userEmail: string
): Promise<boolean>
```

**Types:**
```typescript
interface ApiKeyCredentials {
  service: "claude" | "gemini" | "stability";
  key: string;
}

interface StoredApiKey {
  service: string;
  isValid: boolean;
  lastValidated: string | null;
}
```

---

### 4.3 googleApiService.ts

**Purpose:** Google Workspace integration (Drive, Sheets, Gmail, Docs).

**Key Exports:**

```typescript
// Authentication
initClient(callback, onInitComplete): void
signIn(): Promise<void>
signOut(): void
getIdToken(): string | null
isAuthenticated(): boolean

// Google Drive
saveToDrive(newsletter, topics, settings): Promise<string>  // Returns file ID
loadFromDrive(fileId): Promise<Newsletter>
listNewslettersFromDrive(settings): Promise<DriveFile[]>

// Google Sheets
logToSheet(newsletter, topics, settings, flags): Promise<void>
readAllSubscribers(settings): Promise<Subscriber[]>
readAllLists(settings): Promise<SubscriberList[]>
saveSubscriber(subscriber, settings): Promise<void>
deleteSubscriber(email, settings): Promise<void>
migrateSubscriberSheet(settings): Promise<void>

// Gmail
sendEmail(newsletter, topics, subscribers, settings): Promise<void>

// User Profile
getUserProfile(): Promise<{ email, name, picture }>
```

**Scopes Used:**
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

---

### 4.4 trendingDataService.ts

**Purpose:** Fetch and filter trending sources.

**Exported Functions:**

```typescript
// Fetch all trending sources from backend
fetchAllTrendingSources(): Promise<TrendingSource[]>

// Filter sources by audience
filterSourcesByAudience(
  sources: TrendingSource[],
  audience: string[]
): TrendingSource[]
```

**Audience to Category Mapping:**
| Audience | Categories |
|----------|------------|
| academics | arxiv, github, dev |
| business | hackernews, reddit, dev |
| analysts | hackernews, reddit, github, dev |

---

### 4.5 supabaseAuthHelper.ts

**Purpose:** Authenticate Supabase using Google-verified email.

**Exported Function:**

```typescript
authenticateSupabaseWithGoogleEmail(
  email: string,
  name?: string
): Promise<{ success: boolean, error?: string }>
```

**Process:**
1. Check if already authenticated with Supabase
2. Call `setup-supabase-auth` Edge Function
3. Create/confirm user with email
4. Attempt session refresh
5. Return success status

---

### 4.6 geminiService.ts (Legacy)

**Purpose:** Google Gemini API integration (deprecated, replaced by Claude).

**Models:**
- `gemini-2.5-flash` - Text generation
- `gemini-2.5-flash-image` - Image generation

**Note:** Present in codebase but not actively used.

---

### 4.7 newsletterDbService.ts (Backend)

**Location:** `server/services/newsletterDbService.ts`

**Purpose:** SQLite CRUD operations for newsletters and action logs.

**Exported Functions:**

```typescript
// Save newsletter to SQLite
saveNewsletter(
  newsletter: { id, subject, introduction, sections, conclusion, promptOfTheDay? },
  topics: string[],
  settings?: { audience?, tone?, imageStyle? }
): Newsletter

// Get all newsletters (newest first)
getNewsletters(limit?: number): Newsletter[]

// Get single newsletter by ID
getNewsletterById(id: string): Newsletter | null

// Delete newsletter
deleteNewsletter(id: string): boolean

// Log action (created, saved_to_drive, sent_email)
logAction(
  newsletterId: string,
  action: 'created' | 'saved_to_drive' | 'sent_email',
  details?: Record<string, unknown>
): void

// Get logs for a newsletter
getNewsletterLogs(newsletterId: string): NewsletterLog[]
```

---

### 4.8 subscriberDbService.ts (Backend)

**Location:** `server/services/subscriberDbService.ts`

**Purpose:** SQLite CRUD operations for subscribers and lists.

**Exported Functions - Subscribers:**

```typescript
// Add subscriber
addSubscriber(subscriber: Omit<Subscriber, 'id' | 'dateAdded'>): Subscriber

// Update subscriber
updateSubscriber(email: string, updates: Partial<Subscriber>): Subscriber | null

// Soft delete (set status to inactive)
deleteSubscriber(email: string): boolean

// Get all subscribers with optional filters
getSubscribers(filters?: { status?, listId? }): Subscriber[]

// Get single subscriber by email
getSubscriberByEmail(email: string): Subscriber | null

// Bulk import subscribers
importSubscribers(subscribers: Array<{ email, name?, listId? }>): { added, skipped }
```

**Exported Functions - Lists:**

```typescript
// Create list (auto-generates 5-char ID)
createList(name: string, description?: string): SubscriberList

// Update list
updateList(id: string, updates: Partial<SubscriberList>): SubscriberList | null

// Delete list (removes from all subscribers)
deleteList(id: string): boolean

// Get all lists
getLists(): SubscriberList[]

// Add/remove subscriber from list
addSubscriberToList(email: string, listId: string): boolean
removeSubscriberFromList(email: string, listId: string): boolean

// Get subscribers in a list
getSubscribersByList(listId: string): Subscriber[]

// Sync list subscriber count
syncListCount(listId: string): number
```

---

### 4.9 newsletterClientService.ts (Frontend)

**Location:** `services/newsletterClientService.ts`

**Purpose:** Frontend API client for newsletter SQLite operations.

**Exported Functions:**

```typescript
// Save newsletter
saveNewsletter(newsletter, topics, settings?): Promise<Newsletter>

// Get all newsletters
getNewsletters(limit?): Promise<{ newsletters, count }>

// Get by ID
getNewsletterById(id): Promise<Newsletter>

// Delete
deleteNewsletter(id): Promise<{ success, message }>

// Log action
logAction(newsletterId, action, details?): Promise<{ success, message }>

// Get logs
getNewsletterLogs(newsletterId): Promise<{ logs }>
```

---

### 4.10 subscriberClientService.ts (Frontend)

**Location:** `services/subscriberClientService.ts`

**Purpose:** Frontend API client for subscriber/list SQLite operations.

**Exported Functions - Subscribers:**

```typescript
getSubscribers(filters?): Promise<{ subscribers, count }>
getSubscriberByEmail(email): Promise<Subscriber>
addSubscriber(subscriber): Promise<Subscriber>
updateSubscriber(email, updates): Promise<Subscriber>
deleteSubscriber(email): Promise<{ success, message }>
importSubscribers(subscribers): Promise<{ added, skipped }>
```

**Exported Functions - Lists:**

```typescript
getLists(): Promise<{ lists, count }>
getListById(id): Promise<SubscriberList>
createList(name, description?): Promise<SubscriberList>
updateList(id, updates): Promise<SubscriberList>
deleteList(id): Promise<{ success, message }>
addSubscriberToList(email, listId): Promise<{ success, message }>
removeSubscriberFromList(email, listId): Promise<{ success, message }>
getSubscribersByList(listId): Promise<{ subscribers, count }>
```

---

### 4.11 archiveClientService.ts (Frontend)

**Location:** `services/archiveClientService.ts`

**Purpose:** Frontend API client for trending data archive operations.

**Exported Functions:**

```typescript
// Save archive
saveArchive(content, audience?): Promise<Archive>

// Get archives
getArchives(limit?, audience?): Promise<{ archives, count }>

// Get latest archive
getLatestArchive(audience?): Promise<Archive | null>

// Delete archive
deleteArchive(id): Promise<{ success, message }>
```

---

## 5. Component Hierarchy

### 5.1 Page Components

#### AuthenticationPage.tsx

**Purpose:** Google OAuth login interface

**Props:**
```typescript
{
  onSignIn: () => void;
  isGoogleApiInitialized: boolean;
  isLoading?: boolean;
}
```

**Features:**
- Auto-triggers sign-in when Google API ready
- Displays feature list (Cloud Sync, Auto-Save, etc.)
- Single "Sign in with Google" button

---

#### DiscoverTopicsPage.tsx

**Purpose:** Topic selection with AI suggestions and trending data

**Props:**
```typescript
{
  selectedAudience: Record<string, boolean>;
  handleAudienceChange: (audience: string) => void;
  selectedTopics: string[];
  customTopic: string;
  setCustomTopic: (topic: string) => void;
  handleAddTopic: (topic: string) => void;
  handleRemoveTopic: (topic: string) => void;
  suggestedTopics: string[];
  handleSelectSuggestedTopic: (topic: string) => void;
  handleGenerateSuggestions: () => void;
  isGeneratingTopics: boolean;
  trendingContent: TrendingTopic[];
  compellingContent: CompellingContent | null;
  isFetchingTrending: boolean;
  handleAddTrendingTopic: (title: string) => void;
  fetchTrendingContent: () => void;
  trendingSources: TrendingSource[];
  hasSelectedAudience: boolean;
  loading: string | null;
  error: Error | null;
  audienceOptions: AudienceOption[];
}
```

**Child Components:** InspirationSources, InspirationSourcesPanel, Spinner

---

#### DefineTonePage.tsx

**Purpose:** Tone and flavor selection

**Props:**
```typescript
{
  selectedTone: string;
  setSelectedTone: (tone: string) => void;
  toneOptions: ToneOption[];
  selectedFlavors: Record<string, boolean>;
  handleFlavorChange: (flavor: string) => void;
  flavorOptions: FlavorOption[];
}
```

**Tone Options:** professional, casual, witty, enthusiastic, informative

**Flavor Options:** humor, slang, jargon, analogies, data citation

---

#### ImageStylePage.tsx

**Purpose:** Image style selection

**Props:**
```typescript
{
  selectedImageStyle: string;
  setSelectedImageStyle: (style: string) => void;
  imageStyleOptions: ImageStyleOption[];
}
```

**Style Options:** photorealistic, vector, watercolor, pixel, minimalist, cyberpunk, abstract, oilPainting, isometric

---

#### GenerateNewsletterPage.tsx

**Purpose:** Main newsletter generation workflow

**Props:**
```typescript
{
  selectedAudience: Record<string, boolean>;
  selectedTone: string;
  selectedFlavors: Record<string, boolean>;
  selectedImageStyle: string;
  selectedTopics: string[];
  newsletter: Newsletter | null;
  onEditImage: (index, src, mimeType, prompt) => void;
  onImageUpload: (sectionIndex, file) => void;
  onReorderSections: (sections) => void;
  onUpdate: (field, value, sectionIndex?) => void;
  handleGenerateNewsletter: () => void;
  loading: string | null;
  progress: number;
  error: Error | null;
  presets: Preset[];
  onSavePreset: (name) => void;
  onLoadPreset: (preset) => void;
  onDeletePreset: (name) => void;
  onSyncToCloud: () => void;
  onLoadFromCloud: () => void;
  promptOfTheDay: PromptOfTheDay | null;
  onSavePromptOfTheDay: (prompt) => void;
}
```

**Child Components:** PresetsManager, PromptOfTheDayEditor, ProgressGauge, NewsletterPreview

---

#### HistoryContentPage.tsx

**Purpose:** Browse generated newsletter history

**Props:**
```typescript
{
  history: HistoryItem[];
  onLoad: (item: HistoryItem) => void;
  onClear: () => void;
}
```

**Child Component:** HistoryPanel

---

#### SubscriberManagementPage.tsx

**Purpose:** Subscriber and list management

**Props:**
```typescript
{
  subscribers: Subscriber[];
  subscriberLists: SubscriberList[];
  googleSettings: GoogleSettings;
  authData: GapiAuthData | null;
  onListsChanged: () => void;
}
```

**Features:**
- Subscriber CRUD operations
- List management
- Bulk import/export
- Google Sheets integration

---

### 5.2 UI Components

#### NewsletterPreview.tsx

Displays and enables editing of generated newsletter.

**Props:**
```typescript
{
  newsletter: Newsletter | null;
  topics: string[];
  onEditImage: (index, src, mimeType, prompt) => void;
  onImageUpload: (sectionIndex, file) => void;
  onReorderSections: (sections) => void;
  onUpdate: (field, value, sectionIndex?) => void;
  isLoading: boolean;
}
```

**Features:**
- Drag-and-drop section reordering
- Inline text editing (EditableText)
- Image upload per section
- Image edit button per section

---

#### SettingsModal.tsx

Settings and API key management modal.

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings) => void;
  initialSettings: GoogleSettings;
  authData: GapiAuthData | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isGoogleApiInitialized: boolean;
  newsletter: Newsletter | null;
  onWorkflowAction: (action) => void;
  onLoadFromDrive: () => void;
  workflowStatus: string | null;
}
```

**Tabs:**
- Google Workspace settings (Drive folder, Sheet names)
- API Key Management (Claude, Gemini, Stability)
- Workflow Actions (Save, Log, Send, Load)

---

#### ImageEditorModal.tsx

Image editing and regeneration modal.

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  imageMimeType: string;
  originalPrompt: string;
  onSave: (newImageBase64) => void;
}
```

**Features:**
- Preview current image
- Edit prompt input
- Quick edit presets (Retro, B&W, Brighter, Add Text)
- Regenerate button
- Download button

---

#### PresetsManager.tsx

Preset save/load/delete and cloud sync.

**Props:**
```typescript
{
  presets: Preset[];
  onSave: (name) => void;
  onLoad: (preset) => void;
  onDelete: (name) => void;
  onSyncToCloud: () => void;
  onLoadFromCloud: () => void;
  isAuthenticated: boolean;
}
```

---

#### PromptOfTheDayEditor.tsx

Edit optional daily prompt section.

**Props:**
```typescript
{
  initialPrompt: PromptOfTheDay | null;
  onSave: (prompt: PromptOfTheDay | null) => void;
}
```

**Fields:** title, summary, examplePrompts[], promptCode

---

## 6. Data Flow Diagrams

### 6.1 Newsletter Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER SELECTS OPTIONS                                 │
│  Topics: ["AI image gen", "LLM fine-tuning"]                                │
│  Audience: ["academics", "business"]                                         │
│  Tone: "professional"                                                        │
│  Flavors: ["useJargon", "citeData"]                                         │
│  Image Style: "vector"                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    App.tsx: handleGenerateNewsletter()                       │
│  1. setLoading("Generating newsletter content...")                          │
│  2. setProgress(10)                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                claudeService.generateNewsletterContent()                     │
│  POST /api/generateNewsletter                                               │
│  Body: { topics, audience, tone, flavors, imageStyle }                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         server.ts: Backend                                   │
│  1. Build system prompt with audience descriptions                          │
│  2. Apply flavor instructions                                               │
│  3. Call Claude API with web_search tool                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLAUDE API (Agentic Loop)                                │
│                                                                              │
│  Claude: "I need to search for current AI tools..."                         │
│  → Returns: tool_use { name: "web_search", query: "..." }                   │
│                                                                              │
│  Backend: processToolCall("web_search", { query })                          │
│  → Calls Brave Search API                                                   │
│  → Returns: formatted search results                                         │
│                                                                              │
│  Claude: Continues with search context                                       │
│  → Returns: Newsletter JSON                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Backend: Post-Processing                                │
│  1. Parse JSON response                                                      │
│  2. sanitizeNewsletter() - remove emojis                                    │
│  3. Generate unique ID: "nl_1731527834000_a3x9k7m2"                         │
│  4. Return { text: JSON.stringify(newsletter) }                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    App.tsx: Process Newsletter                              │
│  1. Parse JSON response                                                      │
│  2. setProgress(35)                                                          │
│  3. setLoading("Generating images...")                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              claudeService.generateImage() × N sections                     │
│  (Parallel requests)                                                         │
│                                                                              │
│  For each section:                                                           │
│    POST /api/generateImage                                                  │
│    Body: { prompt: section.imagePrompt, imageStyle }                        │
│    → Stability AI API                                                       │
│    → Returns: { image: base64 }                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    App.tsx: Finalize Newsletter                             │
│  1. Attach images to sections (imageUrl = base64)                           │
│  2. setProgress(75)                                                          │
│  3. addToHistory(newsletter)                                                │
│  4. Auto-save to Google Drive                                               │
│  5. Auto-log to Google Sheets                                               │
│  6. setProgress(90)                                                          │
│  7. setNewsletter(newsletter)                                               │
│  8. setLoading(null)                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NewsletterPreview: Display                             │
│  • Subject line                                                              │
│  • Introduction                                                              │
│  • Sections with images                                                      │
│  • Conclusion                                                                │
│  • Prompt of the Day (if present)                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER: Click "Sign in with Google"                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                googleApiService.signIn()                                    │
│  1. Initialize Google Identity Services (GIS)                               │
│  2. Request access token with scopes                                        │
│  3. Open Google OAuth popup                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GOOGLE OAUTH SERVER                                    │
│  1. User enters credentials                                                 │
│  2. User grants permissions                                                 │
│  3. Returns access_token to callback                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              googleApiService.handleAuthResponse()                          │
│  1. Store access_token                                                      │
│  2. Fetch user profile (email, name, picture)                               │
│  3. Return authData to App.tsx                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 App.tsx: setAuthData(authData)                              │
│  authData = { access_token, email, name }                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│           supabaseAuthHelper.authenticateSupabaseWithGoogleEmail()          │
│  POST /functions/v1/setup-supabase-auth                                     │
│  Body: { email, name }                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION: setup-supabase-auth                    │
│  1. Create user with Supabase Admin API                                     │
│  2. Auto-confirm email (no verification needed)                             │
│  3. Return { success: true, user: { id, email } }                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      App.tsx: Post-Authentication                           │
│  1. Navigate to 'discoverTopics' page                                       │
│  2. Load subscriber lists from Google Sheets                                │
│  3. Load presets from cloud (if any)                                        │
│  4. Load history from localStorage                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 API Key Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               USER: Settings → API Key Management → Claude                   │
│               Enters API key: "sk-ant-api03-..."                            │
│               Clicks "Save"                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  apiKeyService.saveApiKey()                                 │
│  POST /functions/v1/save-api-key                                            │
│  Body: { service: "claude", key: "sk-ant-...", userEmail: "user@..." }     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION: save-api-key                           │
│  1. Validate input (service, key, userEmail)                                │
│  2. Create Supabase admin client                                            │
│  3. Check if key exists for user+service                                    │
│  4. INSERT or UPDATE api_keys table                                         │
│     - encrypted_key stored with pgcrypto                                    │
│  5. INSERT into api_key_audit_log                                           │
│  6. Return { success: true }                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               SettingsModal: Show success, trigger validation               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  apiKeyService.validateApiKey()                             │
│  POST /functions/v1/validate-api-key                                        │
│  Body: { service: "claude", userEmail: "user@..." }                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION: validate-api-key                       │
│  1. Retrieve encrypted key from database                                    │
│  2. Decrypt key                                                              │
│  3. Test with Claude API:                                                   │
│     GET https://api.anthropic.com/v1/models                                │
│     Headers: x-api-key: {decrypted_key}                                    │
│  4. UPDATE api_keys: key_valid = true, last_validated_at = NOW()           │
│  5. INSERT audit log entry                                                  │
│  6. Return { isValid: true, lastValidated: "2024-..." }                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             SettingsModal: Display ✓ Valid indicator                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Google Workspace Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             AUTO-SAVE TO DRIVE (after newsletter generation)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               googleApiService.saveToDrive()                                │
│  1. Check if folder exists (by name from settings)                          │
│  2. If not, create folder via Drive API                                     │
│  3. Generate HTML with embedded JSON:                                       │
│     <script type="application/json" id="newsletter-data">                  │
│       { newsletter, topics }                                                │
│     </script>                                                                │
│  4. Upload file to folder                                                   │
│  5. Return file ID                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               googleApiService.logToSheet()                                 │
│  1. Find or create log sheet                                                │
│  2. Check if newsletter ID exists (upsert logic)                            │
│  3. If exists: UPDATE row                                                   │
│  4. If not: APPEND new row                                                  │
│  Columns: ID | Date | Subject | Topics | Saved | Sent | Intro | Conclusion │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEND EMAIL (user clicks Send)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               googleApiService.sendEmail()                                  │
│  1. Read subscribers from Sheet (active only)                               │
│  2. Generate HTML email via emailGenerator.ts                               │
│  3. Build email message:                                                    │
│     From: authenticated user email                                          │
│     To: authenticated user email                                            │
│     Bcc: all subscribers (privacy)                                          │
│  4. Base64 encode (standard, not URL-safe)                                 │
│  5. Send via Gmail API                                                      │
│  6. Update tracking state                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               Auto-log to Sheet with Sent: Yes                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                 LOAD FROM DRIVE (user clicks Load)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               googleApiService.listNewslettersFromDrive()                   │
│  1. Search Drive for HTML files in folder                                   │
│  2. Sort by modified date (newest first)                                    │
│  3. Return list with { id, name, modifiedTime }                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               LoadFromDriveModal: User selects file                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               googleApiService.loadFromDrive(fileId)                        │
│  1. Download file content                                                   │
│  2. Parse embedded JSON from <script> tag                                   │
│  3. Reconstruct Newsletter + topics                                         │
│  4. Return to App.tsx                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Trending Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│            USER: DiscoverTopicsPage → Click "Fetch Trending"                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              trendingDataService.fetchAllTrendingSources()                  │
│  GET /api/fetchTrendingSources                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    server.ts: fetchAllTrendingSources()                     │
│  (Parallel fetches)                                                         │
│                                                                              │
│  ├── fetchHackerNewsTopics()                                               │
│  │   GET https://hacker-news.firebaseio.com/v0/topstories.json            │
│  │   → Filter for AI keywords → Return top 12                              │
│  │                                                                          │
│  ├── fetchArxivTopics()                                                    │
│  │   GET https://export.arxiv.org/api/query?search_query=...              │
│  │   → AI/ML/CV papers, last 60 days → Return 15                          │
│  │                                                                          │
│  ├── fetchGitHubTopics()                                                   │
│  │   GET https://api.github.com/search/repositories?q=...                 │
│  │   → Python, 1000+ stars → Return 15                                    │
│  │                                                                          │
│  ├── fetchRedditTopics()                                                   │
│  │   GET https://www.reddit.com/r/{sub}/top.json                          │
│  │   → 12 subreddits → Return top posts                                   │
│  │                                                                          │
│  ├── fetchDevToTopics()                                                    │
│  │   GET https://dev.to/api/articles?tag=ai                               │
│  │   → Return 8 articles                                                   │
│  │                                                                          │
│  └── fetchProductHuntTopics()                                              │
│      → Return mock data (10 products)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              server.ts: scoreSourceForPracticality()                        │
│  For each source, calculate score:                                          │
│  • Recency: 0-30 pts (today=30, week=10)                                   │
│  • Engagement: 0-25 pts (stars, upvotes)                                   │
│  • Practicality keywords: 5 pts each                                        │
│  • Domain keywords: 8 pts each (60 keywords)                               │
│  • Source type bonus: +15 (ArXiv, GitHub)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              trendingDataService.filterSourcesByAudience()                  │
│  Map audience → preferred categories                                        │
│  Shuffle and limit to 12 sources                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   DiscoverTopicsPage: Display sources                       │
│  • InspirationSourcesPanel shows source list                               │
│  • User can click to add topics                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│           claudeService.generateCompellingTrendingContent()                 │
│  POST /api/generateCompellingTrendingContent                                │
│  → Claude analyzes sources                                                  │
│  → Returns actionableCapabilities + essentialTools                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. External API Dependencies

### 7.1 AI & Search APIs

| API | Purpose | Auth Method | Rate Limits | Files Using |
|-----|---------|-------------|-------------|-------------|
| **Anthropic Claude** | Newsletter generation, topic suggestions | API Key (`x-api-key` header) | Per account | `server.ts` |
| **Stability AI** | Image generation | API Key (Bearer token) | Per account | `server.ts` |
| **Brave Search** | Web search for grounding | API Key (`X-Subscription-Token`) | 10 req/sec | `server.ts` |

### 7.2 Google Workspace APIs

| API | Purpose | Auth Method | Scopes | Files Using |
|-----|---------|-------------|--------|-------------|
| **Google Drive v3** | Save/load newsletters | OAuth 2.0 | `drive.file` | `googleApiService.ts` |
| **Google Sheets v4** | Logging, subscribers, presets | OAuth 2.0 | `spreadsheets` | `googleApiService.ts`, `server.ts` |
| **Gmail v1** | Send newsletters | OAuth 2.0 | `gmail.send` | `googleApiService.ts` |
| **Google Docs v1** | Document creation | OAuth 2.0 | `documents` | `googleApiService.ts` |
| **Google OAuth2** | User profile | OAuth 2.0 | `userinfo.email`, `userinfo.profile` | `googleApiService.ts` |

### 7.3 Trending Data Sources (Free, No Auth)

| Source | Endpoint | Data Retrieved |
|--------|----------|----------------|
| **HackerNews** | `hacker-news.firebaseio.com/v0/` | Top stories, filtered for AI |
| **ArXiv** | `export.arxiv.org/api/query` | AI/ML/CV papers |
| **GitHub** | `api.github.com/search/repositories` | Trending AI repos |
| **Reddit** | `reddit.com/r/{sub}/top.json` | Posts from 12 subreddits |
| **Dev.to** | `dev.to/api/articles` | AI-tagged articles |
| **Product Hunt** | (mocked) | Sample products |

### 7.4 Supabase

| Service | Purpose | Auth Method | Files Using |
|---------|---------|-------------|-------------|
| **Database** | API key storage | Service Role Key | Edge Functions |
| **Edge Functions** | Serverless logic | Anon Key | `apiKeyService.ts` |
| **Auth** | User management | Admin API | `supabaseAuthHelper.ts` |

---

## 8. Database Schema

> **Note (v3):** Supabase has been replaced with a local SQLite database for self-contained deployment.
> All data is stored in `./data/newsletter.db` using better-sqlite3 with WAL mode.

### 8.1 SQLite Database (Primary)

Local SQLite database for all application data.

**Location:** `./data/newsletter.db`
**Tables:** 7 core tables + optional Phase 8 tables
**Features:** WAL mode, proper indexes, automatic cleanup

#### newsletters

Stores full newsletter content with metadata.

```sql
CREATE TABLE IF NOT EXISTS newsletters (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  subject TEXT NOT NULL,
  introduction TEXT,
  conclusion TEXT,
  sections TEXT NOT NULL,           -- JSON: NewsletterSection[]
  prompt_of_day TEXT,               -- JSON: PromptOfTheDay (optional)
  topics TEXT NOT NULL DEFAULT '[]', -- JSON: string[]
  audience TEXT DEFAULT '[]',        -- JSON: string[]
  tone TEXT,
  image_style TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletters_created ON newsletters(created_at DESC);
```

#### newsletter_logs

Action audit trail for newsletter operations.

```sql
CREATE TABLE IF NOT EXISTS newsletter_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  newsletter_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- 'created', 'saved_to_drive', 'sent_email'
  action_at TEXT NOT NULL DEFAULT (datetime('now')),
  details TEXT,                      -- JSON: { sent_to_lists: [], recipient_count: n }
  FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
);

CREATE INDEX IF NOT EXISTS idx_logs_newsletter ON newsletter_logs(newsletter_id);
```

#### subscribers

Email subscriber list with status and list membership.

```sql
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive'
  lists TEXT NOT NULL DEFAULT '',          -- Comma-separated list IDs
  date_added TEXT NOT NULL DEFAULT (datetime('now')),
  date_removed TEXT,
  source TEXT DEFAULT 'manual'             -- 'manual' | 'import' | 'sheets_import'
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
```

#### subscriber_lists

Named subscriber lists for targeted newsletters.

```sql
CREATE TABLE IF NOT EXISTS subscriber_lists (
  id TEXT PRIMARY KEY,              -- 5-char ID (e.g., "ABC12")
  name TEXT NOT NULL,
  description TEXT,
  date_created TEXT NOT NULL DEFAULT (datetime('now')),
  subscriber_count INTEGER DEFAULT 0
);
```

#### archives

Trending data archives (existing).

```sql
CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  content TEXT NOT NULL,            -- JSON: full archive data
  audience TEXT                     -- JSON: string[]
);

CREATE INDEX IF NOT EXISTS idx_archives_created ON archives(created_at DESC);
```

#### image_style_thumbnails (Phase 8)

Cached preview thumbnails for image style selection.

```sql
CREATE TABLE IF NOT EXISTS image_style_thumbnails (
  id TEXT PRIMARY KEY,
  style_name TEXT UNIQUE NOT NULL,   -- 'photorealistic', 'vector', etc.
  image_base64 TEXT NOT NULL,        -- Base64-encoded PNG
  prompt TEXT NOT NULL,              -- Prompt used to generate
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_thumbnails_style ON image_style_thumbnails(style_name);
```

#### newsletter_templates (Phase 8)

Reusable newsletter structures with default settings.

```sql
CREATE TABLE IF NOT EXISTS newsletter_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  structure TEXT NOT NULL,           -- JSON: TemplateStructure
  default_settings TEXT,             -- JSON: TemplateSettings (optional)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_templates_name ON newsletter_templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_created ON newsletter_templates(created_at DESC);
```

#### newsletter_drafts (Phase 8)

Auto-saved work-in-progress newsletters per user.

```sql
CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id TEXT PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,   -- One draft per user
  content TEXT NOT NULL,             -- JSON: DraftContent
  topics TEXT NOT NULL DEFAULT '[]', -- JSON: string[]
  settings TEXT,                     -- JSON: DraftSettings
  last_saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON newsletter_drafts(user_email);
```

#### writer_personas (Phase 8)

Custom writer personas for newsletter generation.

```sql
CREATE TABLE IF NOT EXISTS writer_personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  writing_style TEXT,                -- JSON: style preferences
  expertise_areas TEXT,              -- JSON: string[]
  sample_writing TEXT,               -- Example output
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### calendar_entries (Phase 8)

Content planning calendar entries.

```sql
CREATE TABLE IF NOT EXISTS calendar_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                -- YYYY-MM-DD
  title TEXT NOT NULL,
  description TEXT,
  topics TEXT NOT NULL DEFAULT '[]', -- JSON: string[]
  settings TEXT,                     -- JSON: saved generation settings
  newsletter_id TEXT,                -- Link to generated newsletter
  status TEXT DEFAULT 'planned',     -- 'planned' | 'generated' | 'sent'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_entries(date);
CREATE INDEX IF NOT EXISTS idx_calendar_status ON calendar_entries(status);
```

### 8.3 Row-Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- api_keys: Service role only
CREATE POLICY "Service role access" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');

-- api_key_audit_log: Insert only for authenticated
CREATE POLICY "Insert audit logs" ON api_key_audit_log
  FOR INSERT WITH CHECK (true);
```

### 8.4 Encryption

API keys are encrypted at rest using PostgreSQL's pgcrypto extension:

```sql
-- Encryption (in Edge Function)
SELECT pgp_sym_encrypt(api_key, encryption_secret);

-- Decryption (in Edge Function)
SELECT pgp_sym_decrypt(encrypted_key::bytea, encryption_secret);
```

---

## 9. Configuration Reference

### 9.1 Environment Variables

#### Required (.env.local)

| Variable | Purpose | Used By |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | `lib/supabase.ts` |

#### Backend (server.ts)

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Express server port | 3001 |
| `VITE_ANTHROPIC_API_KEY` | Claude API key | - |
| `VITE_STABILITY_API_KEY` | Stability AI key | - |
| `VITE_BRAVE_SEARCH_API_KEY` | Brave Search key | - |

#### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_URL` | Backend URL for frontend | `http://localhost:3001` |

### 9.2 Google Configuration (config.js)

```javascript
const GOOGLE_CONFIG = {
  API_KEY: 'your-google-api-key',
  CLIENT_ID: 'your-oauth-client-id.apps.googleusercontent.com',
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
};

export default GOOGLE_CONFIG;
```

**Note:** This file must be created manually and added to `.gitignore`.

### 9.3 NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start frontend dev server (port 5173) |
| `dev:server` | `ts-node server.ts` | Start backend server (port 3001) |
| `dev:all` | `concurrently "npm run dev" "npm run dev:server"` | Start both |
| `build` | `tsc && vite build` | Production build |
| `lint` | `eslint . --ext ts,tsx --max-warnings 0` | Lint code |
| `preview` | `vite preview` | Preview production build |
| `test` | `vitest` | Run tests in watch mode (v2 NEW) |
| `test:unit` | `vitest run` | Run tests once (v2 NEW) |
| `test:watch` | `vitest watch` | Run tests in watch mode (v2 NEW) |
| `test:coverage` | `vitest run --coverage` | Run tests with coverage (v2 NEW) |

### 9.4 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist", "supabase/functions"]
}
```

---

## 10. Type Definitions Reference

### 10.1 Core Business Types (types.ts)

#### Newsletter

```typescript
interface Newsletter {
  id?: string;                        // "nl_1731527834000_a3x9k7m2"
  subject: string;                    // Email subject line
  introduction: string;               // Opening paragraph
  sections: NewsletterSection[];      // Content sections
  conclusion: string;                 // Closing paragraph
  promptOfTheDay?: PromptOfTheDay;    // Optional daily prompt
}
```

**Used in:** `App.tsx`, `NewsletterPreview.tsx`, `GenerateNewsletterPage.tsx`, `emailGenerator.ts`, `googleApiService.ts`

#### NewsletterSection

```typescript
interface NewsletterSection {
  title: string;                      // Section heading
  content: string;                    // HTML content with links
  imagePrompt: string;                // Prompt used to generate image
  imageUrl?: string;                  // Base64 data URI
}
```

**Used in:** `NewsletterPreview.tsx`, `claudeService.ts`

#### PromptOfTheDay

```typescript
interface PromptOfTheDay {
  title: string;                      // "Advanced RAG Pipeline"
  summary: string;                    // Brief description
  examplePrompts: string[];           // 3 example uses
  promptCode: string;                 // Full XML prompt code
}
```

**Used in:** `PromptOfTheDayEditor.tsx`, `emailGenerator.ts`

#### TrendingTopic

```typescript
interface TrendingTopic {
  title: string;
  summary: string;
}
```

**Used in:** `DiscoverTopicsPage.tsx`, `claudeService.ts`

#### Subscriber

```typescript
interface Subscriber {
  email: string;                      // Primary key
  name?: string;
  status: 'active' | 'inactive';
  lists: string;                      // Comma-separated list IDs
  dateAdded: string;                  // ISO timestamp
  dateRemoved?: string;
  source?: string;                    // How they subscribed
}
```

**Used in:** `SubscriberManagementPage.tsx`, `googleApiService.ts`

#### SubscriberList

```typescript
interface SubscriberList {
  id: string;                         // 5-char unique ID
  name: string;
  description?: string;
  dateCreated: string;
  subscriberCount: number;
}
```

**Used in:** `SubscriberManagementPage.tsx`

#### GoogleSettings

```typescript
interface GoogleSettings {
  driveFolderName: string;            // "AI for PI Newsletters"
  logSheetName: string;               // "AI for PI Newsletter Log"
  subscribersSheetName: string;       // "Newsletter Subscribers"
  groupListSheetName?: string;        // "Subscriber Lists"
}
```

**Used in:** `SettingsModal.tsx`, `googleApiService.ts`

#### Preset

```typescript
interface Preset {
  name: string;
  settings: {
    selectedAudience: Record<string, boolean>;
    selectedTone: string;
    selectedFlavors: Record<string, boolean>;
    selectedImageStyle: string;
    selectedTopics: string[];
  };
}
```

**Used in:** `PresetsManager.tsx`, `App.tsx`

#### HistoryItem

```typescript
interface HistoryItem {
  id: string;
  date: string;                       // ISO timestamp
  subject: string;
  newsletter: Newsletter;
  topics: string[];
}
```

**Used in:** `HistoryPanel.tsx`, `HistoryContentPage.tsx`

#### GapiAuthData

```typescript
interface GapiAuthData {
  access_token: string;
  email: string;
  name: string;
}
```

**Used in:** `App.tsx`, `googleApiService.ts`

### 10.2 Service Types

#### TrendingSource (trendingDataService.ts)

```typescript
interface TrendingSource {
  id: string;
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';  // v2: removed 'producthunt'
  summary?: string;
  score?: number;
}
```

#### ApiKeyCredentials (apiKeyService.ts)

```typescript
interface ApiKeyCredentials {
  service: 'claude' | 'gemini' | 'stability';
  key: string;
}
```

#### StoredApiKey (apiKeyService.ts)

```typescript
interface StoredApiKey {
  service: string;
  isValid: boolean;
  lastValidated: string | null;
}
```

### 10.3 Database Types (lib/supabase.ts)

#### ApiKey

```typescript
interface ApiKey {
  id: number;
  user_id?: string;
  user_email: string;
  service: 'claude' | 'gemini';
  encrypted_key: string;
  key_valid: boolean;
  last_validated_at?: string;
  created_at: string;
  updated_at: string;
}
```

#### ApiKeyAuditLog

```typescript
interface ApiKeyAuditLog {
  id: number;
  user_id?: string;
  user_email: string;
  action: string;
  service?: string;
  ip_address?: string;
  created_at: string;
}
```

---

## 11. Testing (v2 NEW)

### 11.1 Test Infrastructure

**Framework:** Vitest with React Testing Library

**Configuration:** `vite.config.ts`
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
})
```

### 11.2 Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `useNewsletterGeneration.test.ts` | 10 | Validation, generation, errors, reset |
| `usePresets.test.ts` | 7 | Save, load, delete, ordering |
| `useHistory.test.ts` | 7 | Add, load, clear, limit management |

### 11.3 Mock Services

**File:** `__mocks__/services.ts`

Provides pre-defined responses for:
- `generateNewsletterContent` - Returns mock newsletter JSON
- `generateImage` - Returns base64 placeholder
- `generateTopicSuggestions` - Returns mock topic array
- `generateCompellingTrendingContent` - Returns mock actionable content
- `savePresetsToCloud` / `loadPresetsFromCloud` - Mock cloud operations

### 11.4 Running Tests

```bash
# Interactive watch mode
npm test

# Single run (CI/CD)
npm run test:unit

# With coverage report
npm run test:coverage
```

### 11.5 Test Setup

**File:** `src/test/setup.ts`

- Mocks `localStorage` with vitest spies
- Suppresses console.log/warn in tests
- Resets mocks between tests via `beforeEach`

---

## Quick Reference

### Common Operations

| Task | Function | File |
|------|----------|------|
| Generate newsletter | `generateNewsletterContent()` | `claudeService.ts` |
| Generate image | `generateImage()` | `claudeService.ts` |
| Save to Drive | `saveToDrive()` | `googleApiService.ts` |
| Send email | `sendEmail()` | `googleApiService.ts` |
| Save API key | `saveApiKey()` | `apiKeyService.ts` |
| Fetch trending | `fetchAllTrendingSources()` | `trendingDataService.ts` |

### Ports

| Service | Port |
|---------|------|
| Frontend (Vite) | 5173 |
| Backend (Express) | 3001 |

### Key Files for Each Feature

| Feature | Primary Files |
|---------|---------------|
| Newsletter Gen | `server.ts`, `claudeService.ts`, `GenerateNewsletterPage.tsx` |
| Images | `server.ts` (Stability AI), `ImageEditorModal.tsx` |
| Google Drive | `googleApiService.ts`, `SettingsModal.tsx` |
| Email | `googleApiService.ts`, `emailGenerator.ts` |
| API Keys | `apiKeyService.ts`, Edge Functions |
| Trending | `server.ts`, `trendingDataService.ts`, `DiscoverTopicsPage.tsx` |

---

## Appendix: Documentation Files

### Recommended Documentation Structure

| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Quick start, project overview | Keep (simplify) |
| `ARCHITECTURE.md` | This file - comprehensive reference | New |
| `GETTING_STARTED.md` | Setup instructions | Keep |
| `SUPABASE_SETUP.md` | Database setup | Keep |
| `CHECKPOINT.md` | Feature status | **Delete** (absorbed here) |
| `CLAUDE.md` | Migration guide | **Delete** (obsolete) |
