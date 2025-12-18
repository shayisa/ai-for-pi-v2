# Server Migration Analysis

## Overview

This document provides comprehensive analysis of `server.ts` (3,828 lines) to support migration to the Control Plane Architecture. It documents all endpoints, services, helper functions, and dependencies that must be preserved during migration.

**Analysis Date**: 2025-12-17
**Purpose**: Enable safe, incremental migration without breaking existing functionality

---

## Table of Contents

1. [Server Structure Summary](#server-structure-summary)
2. [Endpoint Inventory](#endpoint-inventory)
3. [Helper Functions](#helper-functions)
4. [Service Dependencies](#service-dependencies)
5. [External API Integrations](#external-api-integrations)
6. [Data Flow Patterns](#data-flow-patterns)
7. [Critical Preservation Requirements](#critical-preservation-requirements)

---

## Server Structure Summary

| Metric | Count |
|--------|-------|
| Total Lines | 3,828 |
| API Endpoints | 97 |
| Service Imports | 18 |
| Helper Functions | 15+ |
| External APIs | 7 |
| Domains | 11 |

### Current Architecture Issues

1. **Monolithic**: All logic in single file
2. **No middleware abstraction**: Each endpoint handles its own error handling
3. **Inline helpers**: Functions mixed with route handlers
4. **No request correlation**: No tracing across requests
5. **Inconsistent error responses**: Mix of formats

---

## Endpoint Inventory

### Domain: Trending Sources (2 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/fetchTrendingSources` | trendingCache, fetch* | Fetch trending AI sources from 5 platforms |
| POST | `/api/generateCompellingTrendingContent` | Anthropic | Generate content from trending sources |

### Domain: Newsletter Generation (4 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| POST | `/api/generateNewsletter` | Anthropic, webSearchTool | Generate v1 newsletter with agentic search |
| POST | `/api/generateEnhancedNewsletter` | Anthropic | Generate v2 enhanced newsletter with audience sections |
| POST | `/api/generateAudienceConfig` | audienceGenerationService | Generate audience configuration |
| GET | `/api/fetchMultiSources` | fetch* | Fetch sources from multiple platforms |

### Domain: Topics (3 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/defaultAudiences` | - | Return default audience definitions |
| POST | `/api/generateTopicSuggestions` | Anthropic | AI-powered topic suggestions |
| POST | `/api/generateTrendingTopics` | Anthropic | Generate trending topic analysis |
| POST | `/api/generateTrendingTopicsWithSources` | Anthropic, sourceFetchingService | Topics with source citations |

### Domain: Image Generation (1 endpoint)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| POST | `/api/generateImage` | Stability AI | Generate section images |

### Domain: Presets (2 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| POST | `/api/savePresets` | Google Drive | Save newsletter presets to Drive |
| GET | `/api/loadPresets` | Google Drive | Load presets from Drive |

### Domain: Archives (5 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/archives` | archiveService | List all archives |
| GET | `/api/archives/:id` | archiveService | Get archive by ID |
| POST | `/api/archives` | archiveService | Create new archive |
| DELETE | `/api/archives/:id` | archiveService | Delete archive |
| GET | `/api/archives/search/:query` | archiveService | Search archives |

### Domain: Newsletters (8 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/newsletters` | newsletterDbService | List newsletters |
| GET | `/api/newsletters/:id` | newsletterDbService | Get newsletter by ID |
| GET | `/api/newsletters/:id/enhanced` | newsletterDbService | Get enhanced (v2) newsletter |
| POST | `/api/newsletters` | newsletterDbService | Create newsletter |
| DELETE | `/api/newsletters/:id` | newsletterDbService | Delete newsletter |
| PATCH | `/api/newsletters/:id/sections` | newsletterDbService | Update sections |
| POST | `/api/newsletters/:id/log` | newsletterDbService | Add newsletter log |
| GET | `/api/newsletters/:id/logs` | newsletterDbService | Get newsletter logs |

### Domain: Prompts (4 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/prompts` | promptDbService | List saved prompts |
| GET | `/api/prompts/:id` | promptDbService | Get prompt by ID |
| POST | `/api/prompts` | promptDbService | Create prompt |
| DELETE | `/api/prompts/:id` | promptDbService | Delete prompt |

### Domain: Subscribers (11 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/subscribers` | subscriberDbService | List subscribers |
| GET | `/api/subscribers/:email` | subscriberDbService | Get subscriber by email |
| POST | `/api/subscribers` | subscriberDbService | Create subscriber |
| PUT | `/api/subscribers/:email` | subscriberDbService | Update subscriber |
| DELETE | `/api/subscribers/:email` | subscriberDbService | Delete subscriber |
| POST | `/api/subscribers/import` | subscriberDbService | Bulk import (CSV) |
| GET | `/api/lists` | subscriberDbService | List mailing lists |
| GET | `/api/lists/:id` | subscriberDbService | Get list by ID |
| POST | `/api/lists` | subscriberDbService | Create list |
| PUT | `/api/lists/:id` | subscriberDbService | Update list |
| DELETE | `/api/lists/:id` | subscriberDbService | Delete list |
| POST | `/api/lists/:id/subscribers` | subscriberDbService | Add subscriber to list |
| DELETE | `/api/lists/:id/subscribers/:email` | subscriberDbService | Remove from list |
| GET | `/api/lists/:id/subscribers` | subscriberDbService | List subscribers in list |

### Domain: API Keys (5 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/keys` | apiKeyDbService | List configured keys |
| POST | `/api/keys` | apiKeyDbService | Add/update API key |
| DELETE | `/api/keys/:service` | apiKeyDbService | Delete API key |
| POST | `/api/keys/:service/validate` | Various | Validate API key |
| GET | `/api/keys/google/credentials` | - | Get Google OAuth config |

### Domain: OAuth/Google (10 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/oauth/google/url` | googleOAuthService | Get OAuth consent URL |
| GET | `/api/oauth/google/callback` | googleOAuthService | Handle OAuth callback |
| GET | `/api/oauth/google/status` | googleOAuthService | Check OAuth status |
| POST | `/api/oauth/google/revoke` | googleOAuthService | Revoke OAuth tokens |
| POST | `/api/drive/save` | googleDriveService | Save to Drive |
| GET | `/api/drive/load/:fileId` | googleDriveService | Load from Drive |
| GET | `/api/drive/list` | googleDriveService | List Drive files |
| DELETE | `/api/drive/delete/:fileId` | googleDriveService | Delete from Drive |
| POST | `/api/gmail/send` | googleGmailService | Send email |
| POST | `/api/gmail/send-bulk` | googleGmailService | Send bulk emails |
| GET | `/api/gmail/profile` | googleGmailService | Get Gmail profile |

### Domain: Logs (3 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/logs` | logDbService | List logs with filtering |
| GET | `/api/logs/export` | logDbService | Export logs as CSV |
| GET | `/api/logs/stats` | logDbService | Get log statistics |

### Domain: Calendar (10 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/calendar` | calendarDbService | List calendar entries |
| GET | `/api/calendar/month/:year/:month` | calendarDbService | Get month view |
| GET | `/api/calendar/upcoming` | calendarDbService | Get upcoming entries |
| GET | `/api/calendar/:id` | calendarDbService | Get entry by ID |
| POST | `/api/calendar` | calendarDbService | Create entry |
| PUT | `/api/calendar/:id` | calendarDbService | Update entry |
| POST | `/api/calendar/:id/link` | calendarDbService | Link to newsletter |
| POST | `/api/calendar/:id/unlink` | calendarDbService | Unlink from newsletter |
| DELETE | `/api/calendar/:id` | calendarDbService | Delete entry |

### Domain: Personas (9 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/personas` | personaDbService | List personas |
| GET | `/api/personas/active` | personaDbService | Get active persona |
| GET | `/api/personas/stats` | personaDbService | Get persona statistics |
| GET | `/api/personas/:id` | personaDbService | Get persona by ID |
| POST | `/api/personas` | personaDbService | Create persona |
| PUT | `/api/personas/:id` | personaDbService | Update persona |
| DELETE | `/api/personas/:id` | personaDbService | Delete persona |
| POST | `/api/personas/:id/activate` | personaDbService | Set as active |
| POST | `/api/personas/:id/favorite` | personaDbService | Toggle favorite |

### Domain: Thumbnails (4 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/thumbnails` | thumbnailDbService | List thumbnails |
| GET | `/api/thumbnails/status` | thumbnailDbService | Get generation status |
| POST | `/api/thumbnails/:styleName/generate` | Stability AI, thumbnailDbService | Generate thumbnail |
| DELETE | `/api/thumbnails/:styleName` | thumbnailDbService | Delete thumbnail |

### Domain: Templates (7 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/templates` | templateDbService | List templates |
| GET | `/api/templates/search` | templateDbService | Search templates |
| GET | `/api/templates/:id` | templateDbService | Get template by ID |
| POST | `/api/templates` | templateDbService | Create template |
| POST | `/api/templates/from-newsletter` | templateDbService | Create from newsletter |
| PUT | `/api/templates/:id` | templateDbService | Update template |
| DELETE | `/api/templates/:id` | templateDbService | Delete template |

### Domain: Drafts (4 endpoints)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/drafts/:userEmail` | draftDbService | Get user draft |
| GET | `/api/drafts/:userEmail/exists` | draftDbService | Check draft exists |
| POST | `/api/drafts` | draftDbService | Save draft |
| DELETE | `/api/drafts/:userEmail` | draftDbService | Delete draft |

### Domain: Health (1 endpoint)
| Method | Path | Service | Purpose |
|--------|------|---------|---------|
| GET | `/api/health` | - | Health check |

---

## Helper Functions

### Must Preserve (Used by Multiple Endpoints)

| Function | Location | Used By | Purpose |
|----------|----------|---------|---------|
| `getAnthropicClient()` | Lines 44-68 | All Claude endpoints | Cached Anthropic client with API key from SQLite/env |
| `getAudienceDescription(audience)` | Lines 71-90 | Newsletter generation | Maps audience keys to detailed descriptions |
| `removeEmojis(text)` | Lines 93-103 | Newsletter sanitization | Removes emoji characters from text |
| `sanitizeNewsletter(newsletter)` | Lines 106-118 | Newsletter generation | Sanitizes newsletter object |
| `getDateRangeDescription()` | Lines 121-133 | Trending sources | Gets 60-day date range |
| `getFlavorInstructions(flavors)` | Lines 408-433 | Newsletter generation | Maps flavor keys to instructions |
| `scoreSourceForPracticality(source)` | Lines 587-643 | Trending content | Scores sources by relevance |
| `formatBraveSearchResults(results)` | Lines 455-488 | Web search | Formats Brave API results |
| `fetchBraveSearchResults(query)` | Lines 493-550 | Web search | Fetches from Brave API |
| `performWebSearch(query)` | Lines 554-570 | Agentic generation | Cached web search |
| `processToolCall(toolName, toolInput)` | Lines 574-582 | Agentic generation | Processes Claude tool calls |

### Source Fetching Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| `fetchHackerNewsTopics()` | 147-187 | HackerNews AI articles |
| `fetchArxivTopics()` | 189-240 | ArXiv AI/ML papers |
| `fetchGitHubTopics()` | 242-282 | GitHub AI repos |
| `fetchRedditTopics()` | 284-342 | Reddit AI discussions |
| `fetchDevToTopics()` | 344-369 | Dev.to AI articles |
| `fetchAllTrendingSources()` | 374-405 | Aggregates all sources |

---

## Service Dependencies

### Database Services (13 services)
```
server/services/
├── archiveService.ts        # Archive CRUD
├── newsletterDbService.ts   # Newsletter CRUD + logs
├── promptDbService.ts       # Saved prompts CRUD
├── subscriberDbService.ts   # Subscribers + lists CRUD
├── apiKeyDbService.ts       # API key storage
├── logDbService.ts          # System logs + audit trail
├── calendarDbService.ts     # Calendar entries CRUD
├── personaDbService.ts      # Writer personas CRUD
├── thumbnailDbService.ts    # Style thumbnails CRUD
├── templateDbService.ts     # Newsletter templates CRUD
├── draftDbService.ts        # Draft auto-save
├── audienceDbService.ts     # Custom audiences
└── schedulerDbService.ts    # Scheduled sends
```

### Google Services (3 services)
```
server/services/
├── googleOAuthService.ts    # OAuth token management
├── googleDriveService.ts    # Drive file operations
└── googleGmailService.ts    # Email sending
```

### Processing Services (7 services)
```
server/services/
├── sourceFetchingService.ts        # External source aggregation
├── articleExtractorService.ts      # Article content extraction
├── audienceGenerationService.ts    # AI audience config generation
├── newsletterFormatService.ts      # Newsletter formatting
├── schedulerService.ts             # Send scheduling
├── trackingService.ts              # Email tracking
└── credentialLoader.ts             # Credential management
```

### Caching (2 modules)
```
server/cache/
├── trendingCache.ts         # 1-hour cache for trending sources
└── searchCache.ts           # Cache for web search results
```

---

## External API Integrations

### AI APIs

| API | Client | Key Source | Endpoints Used |
|-----|--------|------------|----------------|
| Claude/Anthropic | `@anthropic-ai/sdk` | SQLite `api_keys` or `VITE_ANTHROPIC_API_KEY` | Newsletter generation, topic suggestions |
| Stability AI | REST API | SQLite `api_keys` or `VITE_STABILITY_API_KEY` | Image generation |
| Brave Search | REST API | SQLite `api_keys` or `VITE_BRAVE_SEARCH_API_KEY` | Agentic web search |

### Content Sources

| Source | API | Rate Limits | Data Retrieved |
|--------|-----|-------------|----------------|
| HackerNews | Firebase REST | Generous | Top 50 stories → filter AI |
| ArXiv | Export API | 3 req/sec | Last 60 days AI papers |
| GitHub | Search API | 30 req/min (unauth) | AI repos updated in 60 days |
| Reddit | JSON API | Rate limited | Multiple subreddits |
| Dev.to | REST API | Generous | AI-tagged articles |

### Google APIs

| Service | Auth Method | Scopes |
|---------|-------------|--------|
| OAuth | OAuth 2.0 | profile, email |
| Drive | OAuth tokens | drive.file |
| Gmail | OAuth tokens | gmail.send, gmail.readonly |

---

## Data Flow Patterns

### Newsletter Generation Flow (v1)
```
1. Client POST /api/generateNewsletter
2. getAnthropicClient() → cached Anthropic instance
3. Build prompt with:
   - getAudienceDescription(audience)
   - getFlavorInstructions(flavors)
   - getDateRangeDescription()
4. Claude call with webSearchTool
5. Loop: processToolCall() → performWebSearch() → cache
6. Max 2 iterations (MAX_SEARCH_ITERATIONS)
7. sanitizeNewsletter() → removeEmojis()
8. Return JSON response
```

### Newsletter Generation Flow (v2 Enhanced)
```
1. Client POST /api/generateEnhancedNewsletter
2. getAnthropicClient() → cached Anthropic instance
3. Build enhanced prompt with audience-specific sections
4. Claude call (no agentic search)
5. Parse EnhancedNewsletter format
6. Return with audienceVersions map
```

### OAuth Flow
```
1. GET /api/oauth/google/url → Generate consent URL
2. User redirects to Google
3. GET /api/oauth/google/callback → Exchange code for tokens
4. Store tokens in SQLite via googleOAuthService
5. Subsequent API calls use stored tokens
```

### Draft Auto-Save Flow
```
1. Client debounced POST /api/drafts
2. draftDbService.saveDraft(userEmail, content, topics, settings)
3. SQLite upsert on user_email
4. On page load: GET /api/drafts/:userEmail
```

---

## Critical Preservation Requirements

### 1. API Key Resolution Order
```typescript
// MUST preserve this priority:
1. SQLite api_keys table (by adminEmail + service)
2. Environment variable fallback
3. Error if neither found
```

### 2. Token Optimization
```typescript
const MAX_SEARCH_ITERATIONS = 2; // Prevents runaway token usage
// MUST preserve this cap on agentic loops
```

### 3. Newsletter Format Compatibility
- **v1 Format**: Basic sections with imagePrompt
- **v2 Format**: Enhanced with audienceVersions map
- Both formats must continue to work

### 4. Cache TTL Values
- Trending sources: 1 hour
- Search results: Per-query caching

### 5. Error Response Patterns
Current patterns (inconsistent, to be standardized):
```typescript
// Pattern 1: Simple error
res.status(500).json({ error: "message" });

// Pattern 2: With details
res.status(500).json({ error: "message", details: errorMessage });

// Pattern 3: Success false
res.json({ success: false, error: "message" });
```

### 6. CORS Configuration
```typescript
app.use(cors()); // Currently allows all origins
```

### 7. Request Body Limit
```typescript
app.use(express.json({ limit: '50mb' })); // Large for newsletter content
```

---

## Migration Risk Assessment

### High Risk (Complex Logic)
1. **Newsletter Generation** - Complex Claude interactions, agentic loops
2. **OAuth Flow** - Token management, callback handling
3. **Bulk Email** - Rate limiting, error handling per recipient

### Medium Risk (Multiple Dependencies)
1. **Trending Sources** - 5 external APIs, caching
2. **Image Generation** - Stability AI, thumbnail storage
3. **Presets** - Google Drive integration

### Low Risk (Simple CRUD)
1. **Archives** - Basic CRUD
2. **Prompts** - Basic CRUD
3. **Health Check** - No dependencies

---

## Migration Order Recommendation

Based on dependency analysis and risk assessment:

1. **Phase 1: Health** - Validate migration pattern
2. **Phase 2: Archives** - Simple CRUD, low risk
3. **Phase 3: Prompts** - Simple CRUD
4. **Phase 4: Subscribers/Lists** - Related CRUD operations
5. **Phase 5: Calendar** - Medium complexity
6. **Phase 6: Personas** - Medium complexity
7. **Phase 7: Templates/Drafts** - Related features
8. **Phase 8: Thumbnails** - External API (Stability)
9. **Phase 9: Newsletters** - Core feature, depends on helpers
10. **Phase 10: API Keys** - Security-sensitive
11. **Phase 11: Logs** - Monitoring
12. **Phase 12: OAuth/Google** - Most complex
13. **Phase 13: Generation Endpoints** - Most complex, depends on all helpers

---

## Files Referenced

| File | Lines | Purpose |
|------|-------|---------|
| `server.ts` | 3,828 | Main server file |
| `server/services/*.ts` | 23 files | Database and external services |
| `server/cache/*.ts` | 2 files | Caching modules |
| `types.ts` | 317 | Type definitions |

---

*This document should be updated as migration progresses.*
