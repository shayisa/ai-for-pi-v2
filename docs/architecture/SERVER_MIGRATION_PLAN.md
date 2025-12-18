# Server Migration Plan

## Overview

This document provides a detailed, step-by-step migration plan for decomposing `server.ts` (3,828 lines) into the Control Plane Architecture. Each step includes verification checkpoints, rollback procedures, and testing requirements.

**Plan Version**: 1.0
**Created**: 2025-12-17
**Status**: Ready for execution

---

## Prerequisites

Before starting migration:

1. **Control Plane Infrastructure** (COMPLETED)
   - [x] feedback/ module (logger, tracing, audit, metrics)
   - [x] validators/ module (Zod schemas, input/output validation)
   - [x] registration/ module (tool registry, definitions)
   - [x] resolver/ module (intent classifier, auth resolver)
   - [x] invocation/ module (context, request processor, response builder)
   - [x] router/ module (route registry, middleware chain)

2. **Documentation** (COMPLETED)
   - [x] LOGGING_GUIDE.md
   - [x] SERVER_MIGRATION_ANALYSIS.md

3. **Backup Strategy**
   - Create git branch: `migration/control-plane`
   - Tag current state: `pre-migration-v1`

---

## Migration Architecture

### Target Directory Structure

```
server/
├── index.ts                    # Entry point (~150 lines)
├── control-plane/              # EXISTING - infrastructure
│   ├── feedback/
│   ├── validators/
│   ├── registration/
│   ├── resolver/
│   ├── invocation/
│   └── router/
├── routes/                     # NEW - thin route handlers
│   ├── index.ts               # Route aggregator
│   ├── health.routes.ts
│   ├── archive.routes.ts
│   ├── newsletter.routes.ts
│   ├── prompt.routes.ts
│   ├── subscriber.routes.ts
│   ├── calendar.routes.ts
│   ├── persona.routes.ts
│   ├── template.routes.ts
│   ├── draft.routes.ts
│   ├── thumbnail.routes.ts
│   ├── apiKey.routes.ts
│   ├── log.routes.ts
│   ├── oauth.routes.ts
│   ├── drive.routes.ts
│   ├── gmail.routes.ts
│   ├── trending.routes.ts
│   └── generation.routes.ts
├── domains/                    # NEW - business logic
│   ├── newsletter/
│   │   ├── newsletterService.ts
│   │   └── README.md
│   ├── generation/
│   │   ├── contentGenerator.ts
│   │   ├── imageGenerator.ts
│   │   ├── sourceAggregator.ts
│   │   └── README.md
│   └── [other domains]/
├── services/                   # EXISTING - to reorganize
├── cache/                      # EXISTING - keep as-is
└── db/                         # EXISTING - keep as-is
```

---

## Migration Phases

### Phase 1: Setup & Health Check Migration

**Duration**: Initial setup
**Risk Level**: Very Low
**Dependencies**: None

#### Step 1.1: Create Migration Branch

```bash
git checkout -b migration/control-plane
git tag pre-migration-v1
```

#### Step 1.2: Create Route Directory Structure

Create files:
- `server/routes/index.ts`
- `server/routes/health.routes.ts`

#### Step 1.3: Implement Health Routes

**File**: `server/routes/health.routes.ts`

```typescript
/**
 * Health Check Routes
 *
 * Simple health check endpoint for load balancer/monitoring.
 * First route migrated to validate the pattern.
 */
import { Router } from 'express';
import { logger } from '../control-plane/feedback';
import { sendSuccess } from '../control-plane/invocation/responseBuilder';

const router = Router();

// GET /api/health
router.get('/', (req, res) => {
  logger.info('health', 'health_check', 'Health check requested');
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
```

#### Step 1.4: Create Routes Index

**File**: `server/routes/index.ts`

```typescript
/**
 * Route Aggregator
 *
 * Centralizes all route modules for clean mounting in server.ts
 */
import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

// Mount route modules
router.use('/health', healthRoutes);

export default router;
```

#### Step 1.5: Update server.ts (Incremental)

Add at top of server.ts (after imports):
```typescript
import apiRoutes from './server/routes';
```

Replace old health endpoint with mount:
```typescript
// OLD: Remove this
// app.get("/api/health", (req, res) => { ... });

// NEW: Add after middleware
app.use('/api', apiRoutes);
```

#### Verification Checkpoint 1.1

```bash
# Start server
npm run dev:server

# Test health endpoint
curl http://localhost:3001/api/health
# Expected: {"success":true,"data":{"status":"ok","timestamp":"..."}}

# Verify other endpoints still work
curl http://localhost:3001/api/newsletters
```

#### Rollback Procedure 1.1

```bash
# If anything fails:
git checkout server.ts
# Or: git reset --hard pre-migration-v1
```

---

### Phase 2: Archive Routes Migration

**Duration**: Low complexity
**Risk Level**: Low
**Dependencies**: archiveService

#### Step 2.1: Create Archive Routes

**File**: `server/routes/archive.routes.ts`

```typescript
/**
 * Archive Routes
 *
 * CRUD operations for newsletter archives.
 *
 * Endpoints:
 * - GET    /api/archives          - List all archives
 * - GET    /api/archives/:id      - Get archive by ID
 * - POST   /api/archives          - Create archive
 * - DELETE /api/archives/:id      - Delete archive
 * - GET    /api/archives/search/:query - Search archives
 */
import { Router } from 'express';
import * as archiveService from '../services/archiveService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';

const router = Router();

// GET /api/archives
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const archives = archiveService.listArchives(limit);
    logger.info('archives', 'list', `Listed ${archives.length} archives`);
    sendSuccess(res, { archives, count: archives.length });
  } catch (error) {
    logger.error('archives', 'list_error', 'Failed to list archives', error as Error);
    sendError(res, 'Failed to fetch archives', ErrorCodes.INTERNAL_ERROR);
  }
});

// GET /api/archives/:id
router.get('/:id', (req, res) => {
  try {
    const archive = archiveService.getArchiveById(req.params.id);
    if (!archive) {
      return sendError(res, 'Archive not found', ErrorCodes.NOT_FOUND);
    }
    sendSuccess(res, archive);
  } catch (error) {
    logger.error('archives', 'get_error', 'Failed to get archive', error as Error);
    sendError(res, 'Failed to fetch archive', ErrorCodes.INTERNAL_ERROR);
  }
});

// POST /api/archives
router.post('/', (req, res) => {
  try {
    const { newsletter, topics, generatedAt, imageStyle } = req.body;
    const archive = archiveService.saveArchive(newsletter, topics, generatedAt, imageStyle);
    logger.info('archives', 'create', `Created archive: ${archive.id}`);
    sendSuccess(res, archive, 201);
  } catch (error) {
    logger.error('archives', 'create_error', 'Failed to create archive', error as Error);
    sendError(res, 'Failed to save archive', ErrorCodes.INTERNAL_ERROR);
  }
});

// DELETE /api/archives/:id
router.delete('/:id', (req, res) => {
  try {
    const success = archiveService.deleteArchive(req.params.id);
    if (!success) {
      return sendError(res, 'Archive not found', ErrorCodes.NOT_FOUND);
    }
    logger.info('archives', 'delete', `Deleted archive: ${req.params.id}`);
    sendSuccess(res, { message: 'Archive deleted' });
  } catch (error) {
    logger.error('archives', 'delete_error', 'Failed to delete archive', error as Error);
    sendError(res, 'Failed to delete archive', ErrorCodes.INTERNAL_ERROR);
  }
});

// GET /api/archives/search/:query
router.get('/search/:query', (req, res) => {
  try {
    const results = archiveService.searchArchives(req.params.query);
    logger.info('archives', 'search', `Search returned ${results.length} results`);
    sendSuccess(res, { archives: results, count: results.length });
  } catch (error) {
    logger.error('archives', 'search_error', 'Failed to search archives', error as Error);
    sendError(res, 'Failed to search archives', ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
```

#### Step 2.2: Register Archive Routes

Update `server/routes/index.ts`:
```typescript
import archiveRoutes from './archive.routes';

router.use('/archives', archiveRoutes);
```

#### Step 2.3: Remove Old Archive Endpoints from server.ts

Comment out (don't delete yet):
```typescript
// MIGRATED TO server/routes/archive.routes.ts
// app.get("/api/archives", ...);
// app.get("/api/archives/:id", ...);
// app.post("/api/archives", ...);
// app.delete("/api/archives/:id", ...);
// app.get("/api/archives/search/:query", ...);
```

#### Verification Checkpoint 2.1

```bash
# Test all archive endpoints
curl http://localhost:3001/api/archives
curl http://localhost:3001/api/archives/test-id
curl -X POST http://localhost:3001/api/archives \
  -H "Content-Type: application/json" \
  -d '{"newsletter":{"subject":"Test"},"topics":["AI"]}'
curl http://localhost:3001/api/archives/search/test
```

#### Rollback Procedure 2.1

```bash
# Uncomment old endpoints in server.ts
# Remove import from routes/index.ts
```

---

### Phase 3: Newsletter CRUD Routes Migration

**Duration**: Medium complexity
**Risk Level**: Medium
**Dependencies**: newsletterDbService

#### Step 3.1: Create Newsletter Routes

**File**: `server/routes/newsletter.routes.ts`

Key considerations:
- Preserve v1/v2 format handling
- Preserve PATCH sections endpoint
- Preserve logging endpoints

```typescript
/**
 * Newsletter Routes
 *
 * CRUD operations for saved newsletters.
 * Supports both v1 (basic) and v2 (enhanced) formats.
 *
 * Endpoints:
 * - GET    /api/newsletters              - List newsletters
 * - GET    /api/newsletters/:id          - Get by ID
 * - GET    /api/newsletters/:id/enhanced - Get enhanced version
 * - POST   /api/newsletters              - Create
 * - DELETE /api/newsletters/:id          - Delete
 * - PATCH  /api/newsletters/:id/sections - Update sections
 * - POST   /api/newsletters/:id/log      - Add log entry
 * - GET    /api/newsletters/:id/logs     - Get log entries
 */
```

(Full implementation follows same pattern as archives)

#### Verification Checkpoint 3.1

Test all newsletter endpoints including edge cases:
- v1 format newsletters
- v2 enhanced newsletters
- Section updates
- Logging

---

### Phase 4-12: Remaining Domains

Follow the same pattern for each domain:

| Phase | Domain | Endpoints | Risk |
|-------|--------|-----------|------|
| 4 | Prompts | 4 | Low |
| 5 | Subscribers/Lists | 14 | Medium |
| 6 | Calendar | 10 | Medium |
| 7 | Personas | 9 | Medium |
| 8 | Templates | 7 | Low |
| 9 | Drafts | 4 | Low |
| 10 | Thumbnails | 4 | Medium |
| 11 | API Keys | 5 | High |
| 12 | Logs | 3 | Low |

---

### Phase 13: OAuth/Google Routes Migration

**Duration**: High complexity
**Risk Level**: High
**Dependencies**: googleOAuthService, googleDriveService, googleGmailService

This phase requires special care due to:
- OAuth callback handling
- Token refresh logic
- Multi-step authentication flows

#### Step 13.1: Create OAuth Routes

**File**: `server/routes/oauth.routes.ts`

Critical requirements:
- Preserve callback redirect URL handling
- Preserve token storage in SQLite
- Preserve error redirect with query params

#### Step 13.2: Create Drive Routes

**File**: `server/routes/drive.routes.ts`

#### Step 13.3: Create Gmail Routes

**File**: `server/routes/gmail.routes.ts`

#### Verification Checkpoint 13.1

Full OAuth flow test:
1. Generate consent URL
2. Complete OAuth in browser
3. Verify tokens stored
4. Test Drive operations
5. Test Gmail send

---

### Phase 14: Helper Function Extraction

**Duration**: Medium complexity
**Risk Level**: Medium

#### Step 14.1: Create Utils Module

**File**: `server/utils/audienceUtils.ts`
- `getAudienceDescription(audience: string[]): string`

**File**: `server/utils/textUtils.ts`
- `removeEmojis(text: string): string`
- `sanitizeNewsletter(newsletter: any): any`

**File**: `server/utils/dateUtils.ts`
- `getDateRangeDescription(): { startDate, endDate, range }`

**File**: `server/utils/flavorUtils.ts`
- `getFlavorInstructions(flavors: string[]): string`

#### Step 14.2: Create Source Aggregator

**File**: `server/domains/generation/sourceAggregator.ts`
- `fetchHackerNewsTopics()`
- `fetchArxivTopics()`
- `fetchGitHubTopics()`
- `fetchRedditTopics()`
- `fetchDevToTopics()`
- `fetchAllTrendingSources()`
- `scoreSourceForPracticality(source)`

---

### Phase 15: Generation Endpoints Migration

**Duration**: High complexity
**Risk Level**: High
**Dependencies**: All helpers, Anthropic client, web search

This is the most complex phase due to:
- Agentic loop logic
- Claude tool calling
- Multiple helper dependencies
- Cache integration

#### Step 15.1: Create Content Generator

**File**: `server/domains/generation/contentGenerator.ts`

```typescript
/**
 * Content Generator
 *
 * Orchestrates newsletter generation using Claude API.
 * Handles both v1 (with agentic search) and v2 (enhanced) formats.
 *
 * CRITICAL: Preserves MAX_SEARCH_ITERATIONS = 2 to prevent token runaway
 */
```

#### Step 15.2: Create Generation Routes

**File**: `server/routes/generation.routes.ts`

Endpoints:
- POST /api/generateNewsletter
- POST /api/generateEnhancedNewsletter
- POST /api/generateCompellingTrendingContent
- POST /api/generateTopicSuggestions
- POST /api/generateTrendingTopics
- POST /api/generateTrendingTopicsWithSources
- POST /api/generateAudienceConfig

---

### Phase 16: Final Cleanup

#### Step 16.1: Create New server/index.ts

Replace server.ts with minimal entry point (~150 lines):

```typescript
/**
 * Server Entry Point
 *
 * Minimal configuration and route mounting.
 * All business logic moved to domains/ and routes/.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes';
import { logger } from './control-plane/feedback';
import { contextMiddleware } from './control-plane/invocation/contextManager';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(contextMiddleware);

// Mount all API routes
app.use('/api', apiRoutes);

// Start server
app.listen(PORT, () => {
  logger.info('server', 'startup', `Server running on http://localhost:${PORT}`);
});
```

#### Step 16.2: Remove Old server.ts

```bash
git mv server.ts server.ts.backup
git mv server/index.ts server.ts
# Or create new entry point structure
```

#### Step 16.3: Update package.json

Ensure start scripts point to correct entry point.

---

## Testing Strategy

### Unit Tests (Per Route Module)

```typescript
// Example: archive.routes.test.ts
describe('Archive Routes', () => {
  describe('GET /api/archives', () => {
    it('returns list of archives');
    it('respects limit parameter');
    it('handles service errors gracefully');
  });
  // ... etc
});
```

### Integration Tests

```typescript
// Full request lifecycle
describe('Archive API Integration', () => {
  it('creates, retrieves, and deletes archive');
  it('search returns matching archives');
});
```

### Smoke Tests (Post-Migration)

```bash
#!/bin/bash
# smoke-test.sh

echo "Testing Health..."
curl -s http://localhost:3001/api/health | jq .

echo "Testing Archives..."
curl -s http://localhost:3001/api/archives | jq .

echo "Testing Newsletters..."
curl -s http://localhost:3001/api/newsletters | jq .

# ... etc for all endpoints
```

---

## Rollback Strategy

### Per-Phase Rollback

Each phase can be rolled back independently:

1. Remove route import from `routes/index.ts`
2. Uncomment original endpoints in server.ts
3. Restart server
4. Verify endpoints work

### Full Rollback

```bash
git checkout pre-migration-v1
npm run dev:server
```

### Data Preservation

- SQLite database unchanged during migration
- No data migration required
- All existing data accessible

---

## Success Criteria

| Metric | Target |
|--------|--------|
| server.ts lines | < 200 |
| Route modules | 17 files |
| All endpoints working | 97/97 |
| Test coverage | > 80% |
| No breaking changes | 0 |

---

## Progress Tracking

| Phase | Status | Verified | Notes |
|-------|--------|----------|-------|
| 1. Health | Pending | | |
| 2. Archives | Pending | | |
| 3. Newsletters | Pending | | |
| 4. Prompts | Pending | | |
| 5. Subscribers | Pending | | |
| 6. Calendar | Pending | | |
| 7. Personas | Pending | | |
| 8. Templates | Pending | | |
| 9. Drafts | Pending | | |
| 10. Thumbnails | Pending | | |
| 11. API Keys | Pending | | |
| 12. Logs | Pending | | |
| 13. OAuth/Google | Pending | | |
| 14. Helpers | Pending | | |
| 15. Generation | Pending | | |
| 16. Cleanup | Pending | | |

---

*This plan should be updated as each phase is completed.*
