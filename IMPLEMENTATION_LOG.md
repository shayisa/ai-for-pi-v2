# Implementation Log: Image Style Thumbnails, Newsletter Templates & Draft Auto-Save

This document provides comprehensive documentation of the implementation of three features that were partially built but missing API endpoints and UI integrations. Created as a reference for future replication and understanding of the system architecture.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Summary](#feature-summary)
3. [Files Modified](#files-modified)
4. [API Endpoint Reference](#api-endpoint-reference)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Type Definitions](#type-definitions)
7. [Implementation Details](#implementation-details)
8. [Replication Instructions](#replication-instructions)
9. [Testing Checklist](#testing-checklist)

---

## Overview

### Problem Statement

Three features were partially implemented with:
- Database tables (SQLite)
- Database services (CRUD operations)
- Client services (API call wrappers)
- React hooks (state management)

**But missing:**
- API endpoints in `server.ts`
- Full UI integration in `App.tsx`

### Solution

Added the missing API endpoints to `server.ts` and integrated the features into `App.tsx` with proper state management, auto-save functionality, and recovery logic.

---

## Feature Summary

| Feature | Purpose | Key Files |
|---------|---------|-----------|
| **Image Style Thumbnails** | Generate and cache preview images for each image style option | `thumbnailDbService.ts`, `thumbnailClientService.ts`, `useStyleThumbnails.ts` |
| **Newsletter Templates** | Save and reuse newsletter structures with default settings | `templateDbService.ts`, `templateClientService.ts`, `useTemplates.ts` |
| **Draft Auto-Save** | Automatically save work-in-progress and recover on login | `draftDbService.ts`, `draftClientService.ts` |

---

## Files Modified

### Server-Side

| File | Changes |
|------|---------|
| `server.ts` | Added 3 service imports, fixed image style mappings, added ~350 lines of API endpoints |

### Client-Side

| File | Changes |
|------|---------|
| `App.tsx` | Added imports, hooks, state, handlers for templates and drafts |
| `components/ConfigurationPanel.tsx` | Added template selector UI with save modal |
| `pages/GenerateNewsletterPage.tsx` | Added template props pass-through |

### Database (Pre-existing)

| File | Tables |
|------|--------|
| `server/db/init.ts` | `image_style_thumbnails`, `newsletter_templates`, `newsletter_drafts` |

---

## API Endpoint Reference

### Thumbnail Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/thumbnails` | List all thumbnails | - | `{ thumbnails: StyleThumbnail[] }` |
| `GET` | `/api/thumbnails/status` | Get generation status | - | `{ total: 9, generated: number, missing: string[] }` |
| `POST` | `/api/thumbnails/:styleName/generate` | Generate thumbnail for style | - | `{ thumbnail: StyleThumbnail, cached: boolean }` |
| `DELETE` | `/api/thumbnails/:styleName` | Delete a thumbnail | - | `{ success: true, message: string }` |

**Supported Styles:**
- `photorealistic`, `vector`, `watercolor`, `pixel`, `minimalist`
- `oilPainting`, `cyberpunk`, `abstract`, `isometric`

### Template Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/templates` | List templates | `?limit=50` (query) | `{ templates: NewsletterTemplate[], count: number }` |
| `GET` | `/api/templates/:id` | Get template by ID | - | `NewsletterTemplate` |
| `POST` | `/api/templates` | Create template | `{ name, description?, structure, defaultSettings? }` | `NewsletterTemplate` (201) |
| `POST` | `/api/templates/from-newsletter` | Create from newsletter | `{ name, description?, newsletter, settings? }` | `NewsletterTemplate` (201) |
| `PUT` | `/api/templates/:id` | Update template | Partial fields | `NewsletterTemplate` |
| `DELETE` | `/api/templates/:id` | Delete template | - | `{ success: true, message: string }` |

### Draft Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `GET` | `/api/drafts/:userEmail` | Get user's draft | - | `NewsletterDraft` or 404 |
| `GET` | `/api/drafts/:userEmail/exists` | Check if draft exists | - | `{ exists: boolean }` |
| `POST` | `/api/drafts` | Save/update draft | `{ userEmail, content, topics, settings }` | `NewsletterDraft` |
| `DELETE` | `/api/drafts/:userEmail` | Delete draft | - | `{ success: true, message: string }` |

---

## Data Flow Diagrams

### Thumbnail Generation Flow

```
ToneAndVisualsPage
  ↓ (displays thumbnails)
useStyleThumbnails hook
  ↓ (fetches/generates)
thumbnailClientService.getThumbnails()
  ↓
GET /api/thumbnails
  ↓
thumbnailDbService.getAllThumbnails()
  ↓
SQLite: image_style_thumbnails table

[If missing styles detected]
thumbnailClientService.generateThumbnail(styleName)
  ↓
POST /api/thumbnails/:styleName/generate
  ↓
Stability AI API (image generation)
  ↓
thumbnailDbService.saveThumbnail(styleName, base64, prompt)
  ↓
Response → Update React state → Display in UI
```

### Template Selection Flow

```
User selects template in ConfigurationPanel
  ↓
onSelectTemplate(templateId)
  ↓
handleSelectTemplate (in App.tsx)
  ↓
Find template in templates array
  ↓
Apply defaultSettings:
  - setSelectedTone()
  - setSelectedImageStyle()
  - setSelectedAudience()
```

### Template Creation Flow

```
User clicks "Save as Template"
  ↓
Modal opens (name + description input)
  ↓
handleSaveAsTemplate(name, description)
  ↓
createTemplateFromNewsletter() from useTemplates hook
  ↓
POST /api/templates/from-newsletter
  ↓
templateDbService.createTemplateFromNewsletter()
  ↓
SQLite: newsletter_templates table
```

### Draft Auto-Save Flow

```
User edits newsletter (any change)
  ↓
React state updates:
  - newsletter/enhancedNewsletter
  - selectedTopics
  - selectedTone, selectedImageStyle, etc.
  ↓
useEffect triggers (2-second debounce)
  ↓
Build DraftContent object:
  {
    formatVersion: 'v1' | 'v2',
    newsletter?: { subject, introduction, sections, conclusion },
    enhancedNewsletter?: EnhancedNewsletter
  }
  ↓
Build DraftSettings object:
  {
    selectedTone, selectedImageStyle,
    selectedAudiences, personaId, promptOfTheDay
  }
  ↓
draftApi.saveDraft(email, content, topics, settings)
  ↓
POST /api/drafts
  ↓
draftDbService.saveDraft() (INSERT OR REPLACE)
  ↓
SQLite: newsletter_drafts table
```

### Draft Recovery Flow

```
User logs in (authData.access_token received)
  ↓
useEffect triggers in App.tsx
  ↓
Check activePage === 'authentication'
  ↓
draftApi.getDraft(email)
  ↓
GET /api/drafts/:email
  ↓
If draft exists:
  ↓
window.confirm("Found unsaved draft from {timestamp}...")
  ↓
[User accepts]
  - Restore newsletter or enhancedNewsletter (based on formatVersion)
  - Restore topics
  - Restore settings (tone, imageStyle, audiences, promptOfTheDay)
  - Navigate to 'generateNewsletter'
  ↓
[User declines]
  - draftApi.deleteDraft(email)
  - Navigate to 'discoverTopics'
```

### Draft Clear on Generation

```
Newsletter generated successfully
  ↓
handleAddToHistory() called
  ↓
Save to history (SQLite)
  ↓
If authData?.email:
  draftApi.deleteDraft(email)
  ↓
DELETE /api/drafts/:email
  ↓
Draft removed from SQLite
```

---

## Type Definitions

### Thumbnail Types

```typescript
// From types.ts
export interface StyleThumbnail {
  id: string;
  styleName: string;
  imageBase64: string;
  prompt: string;
  createdAt: string;
}

export type ThumbnailStatus = 'pending' | 'generating' | 'completed' | 'failed';
```

### Template Types

```typescript
// From services/templateClientService.ts
export interface TemplateStructure {
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

export interface TemplateSettings {
  tone?: string;
  imageStyle?: string;
  audiences?: string[];
  personaId?: string;
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  description: string;
  structure: TemplateStructure;
  defaultSettings?: TemplateSettings;
  createdAt: string;
  updatedAt: string;
}
```

### Draft Types

```typescript
// From services/draftClientService.ts
export interface DraftContent {
  newsletter?: {
    subject?: string;
    introduction?: string;
    sections?: Array<{ title: string; content: string; imagePrompt?: string }>;
    conclusion?: string;
  };
  enhancedNewsletter?: unknown;
  formatVersion: 'v1' | 'v2';
}

export interface DraftSettings {
  selectedTone?: string;
  selectedImageStyle?: string;
  selectedAudiences?: string[];
  personaId?: string | null;
  promptOfTheDay?: unknown;
}

export interface NewsletterDraft {
  id: string;
  userEmail: string;
  content: DraftContent;
  topics: string[];
  settings: DraftSettings;
  lastSavedAt: string;
}
```

---

## Implementation Details

### server.ts Changes

#### 1. Service Imports (Top of file)

```typescript
import * as thumbnailDbService from './server/services/thumbnailDbService.ts';
import * as templateDbService from './server/services/templateDbService.ts';
import * as draftDbService from './server/services/draftDbService.ts';
```

#### 2. Image Style Mappings Fix

Added 3 missing styles to `imageStyleMap` (appears in 2 locations):

```typescript
const imageStyleMap: Record<string, string> = {
  photorealistic: "photorealistic",
  vector: "vector illustration",
  watercolor: "watercolor painting",
  pixel: "pixel art",
  minimalist: "minimalist line art",
  oilPainting: "oil painting",
  // Added:
  cyberpunk: "cyberpunk neon-lit futuristic",
  abstract: "abstract non-representational art",
  isometric: "isometric 3D perspective",
};
```

#### 3. API Endpoints

All endpoints added after the personas endpoints section (~line 3476). Each endpoint follows the same pattern:
- Express route handler
- Request body/params validation
- Database service call
- JSON response with appropriate status code
- Error handling with 500 responses

### App.tsx Changes

#### 1. Imports Added

```typescript
import { useTemplates } from './hooks/useTemplates';
import * as draftApi from './services/draftClientService';
```

#### 2. Template State and Handlers

```typescript
// Hook usage
const {
    templates,
    isLoading: isTemplatesLoading,
    createFromNewsletter: createTemplateFromNewsletter,
} = useTemplates();

// State
const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

// Handlers
const handleSelectTemplate = (templateId: string | null) => { ... };
const handleSaveAsTemplate = async (name: string, description: string) => { ... };
```

#### 3. Draft Auto-Save Effect

```typescript
// Watches: newsletter, enhancedNewsletter, topics, settings
// Debounce: 2000ms
// Conditions: has content, not loading, has auth email
useEffect(() => {
    const hasContent = newsletter || enhancedNewsletter;
    if (!hasContent || loading || !authData?.email) return;

    const saveTimer = setTimeout(async () => {
        // Build DraftContent and DraftSettings
        // Call draftApi.saveDraft()
    }, 2000);

    return () => clearTimeout(saveTimer);
}, [/* dependencies */]);
```

#### 4. Draft Recovery on Login

Modified the auth state change effect to check for drafts and prompt recovery:

```typescript
useEffect(() => {
    const handleAuthAndDraftRecovery = async () => {
        if (!authData?.access_token || !authData?.email) return;
        if (activePage === 'authentication') {
            const draft = await draftApi.getDraft(authData.email);
            if (draft) {
                // Prompt user and restore if accepted
            }
        }
    };
    handleAuthAndDraftRecovery();
}, [authData?.access_token, authData?.email]);
```

#### 5. Clear Draft After Generation

Added to `handleAddToHistory`:

```typescript
// After saving to history
if (authData?.email) {
    await draftApi.deleteDraft(authData.email);
}
```

### ConfigurationPanel.tsx Changes

Added a complete Template section with:
- Dropdown selector for templates
- "Save as Template" button
- Modal for entering name/description
- Template description display when selected

```typescript
// New props
templates?: NewsletterTemplate[];
selectedTemplateId?: string | null;
onSelectTemplate?: (templateId: string | null) => void;
onSaveAsTemplate?: (name: string, description: string) => Promise<void>;
isTemplatesLoading?: boolean;
hasNewsletterContent?: boolean;
```

---

## Replication Instructions

To replicate this implementation pattern in another project:

### Step 1: Database Layer

Create SQLite table in `server/db/init.ts`:

```sql
CREATE TABLE IF NOT EXISTS your_feature (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  data TEXT NOT NULL, -- JSON blob
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_your_feature_user ON your_feature(user_id);
```

### Step 2: Database Service

Create `server/services/yourFeatureDbService.ts`:

```typescript
import { getDb } from '../db/init';

export interface YourFeature {
  id: string;
  userId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const getAll = (userId: string): YourFeature[] => {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM your_feature WHERE user_id = ?');
  const rows = stmt.all(userId);
  return rows.map(row => ({
    ...row,
    data: JSON.parse(row.data),
  }));
};

export const create = (userId: string, data: Record<string, unknown>): YourFeature => {
  const db = getDb();
  const id = `yf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO your_feature (id, user_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, JSON.stringify(data), now, now);

  return { id, userId, data, createdAt: now, updatedAt: now };
};

// Add update, delete, getById as needed
```

### Step 3: Client Service

Create `services/yourFeatureClientService.ts`:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface YourFeature { /* same as above */ }

export const getAll = async (userId: string): Promise<YourFeature[]> => {
  const response = await fetch(`${API_BASE}/api/your-feature/${userId}`);
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
  return data.items;
};

export const create = async (userId: string, data: Record<string, unknown>): Promise<YourFeature> => {
  const response = await fetch(`${API_BASE}/api/your-feature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, data }),
  });
  if (!response.ok) throw new Error('Failed to create');
  return response.json();
};
```

### Step 4: React Hook

Create `hooks/useYourFeature.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as yourFeatureApi from '../services/yourFeatureClientService';

export const useYourFeature = (userId: string | null) => {
  const [items, setItems] = useState<yourFeatureApi.YourFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await yourFeatureApi.getAll(userId);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (data: Record<string, unknown>) => {
    if (!userId) throw new Error('No user');
    const item = await yourFeatureApi.create(userId, data);
    setItems(prev => [...prev, item]);
    return item;
  };

  return { items, isLoading, error, create, refresh };
};
```

### Step 5: API Endpoints

Add to `server.ts`:

```typescript
import * as yourFeatureDbService from './server/services/yourFeatureDbService.ts';

// GET all for user
app.get('/api/your-feature/:userId', (req, res) => {
  try {
    const items = yourFeatureDbService.getAll(req.params.userId);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// POST create
app.post('/api/your-feature', (req, res) => {
  const { userId, data } = req.body;
  if (!userId || !data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const item = yourFeatureDbService.create(userId, data);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create' });
  }
});
```

### Step 6: UI Integration

In `App.tsx`:

```typescript
import { useYourFeature } from './hooks/useYourFeature';

// In component
const { items, create, isLoading } = useYourFeature(authData?.email || null);

// Pass to child components as props
```

---

## Testing Checklist

### Thumbnails

- [ ] `GET /api/thumbnails` returns empty array initially
- [ ] `GET /api/thumbnails/status` shows 9 missing styles
- [ ] `POST /api/thumbnails/photorealistic/generate` creates thumbnail
- [ ] Thumbnails appear in ToneAndVisualsPage style selector
- [ ] Already-generated thumbnails return cached (no API call)

### Templates

- [ ] `GET /api/templates` returns empty array initially
- [ ] Template dropdown appears in ConfigurationPanel
- [ ] "Save as Template" button shows when newsletter exists
- [ ] Creating template saves successfully
- [ ] Selecting template applies default settings
- [ ] Templates persist across page refreshes

### Drafts

- [ ] Edit content, wait 2+ seconds - draft auto-saves (check console)
- [ ] Refresh page and login - see recovery prompt
- [ ] Accept recovery - content restored correctly
- [ ] Decline recovery - draft deleted, navigate to topics
- [ ] Generate newsletter - draft cleared (check console)
- [ ] No prompt on login when no draft exists

---

## Troubleshooting

### Common Issues

1. **Thumbnails not generating**
   - Check Stability AI API key is set (`STABILITY_API_KEY` env var or in database)
   - Check network requests in browser dev tools

2. **Templates not saving**
   - Check server logs for database errors
   - Verify `newsletter_templates` table exists

3. **Draft not auto-saving**
   - Ensure user is logged in (`authData.email` exists)
   - Check console for "Draft auto-saved" message
   - Verify `newsletter_drafts` table exists

4. **Draft recovery not prompting**
   - Must be on `authentication` page when auth completes
   - Check if draft exists: `GET /api/drafts/{email}`

### Debug Commands

```bash
# Check database tables
sqlite3 ./data/newsletter.db ".tables"

# View drafts
sqlite3 ./data/newsletter.db "SELECT * FROM newsletter_drafts;"

# View templates
sqlite3 ./data/newsletter.db "SELECT id, name FROM newsletter_templates;"

# View thumbnails
sqlite3 ./data/newsletter.db "SELECT style_name, created_at FROM image_style_thumbnails;"
```

---

## Configuration & Dependencies

- **No new npm packages required**
- **Stability AI API key** required for thumbnail generation
- **SQLite database** already configured at `./data/newsletter.db`
- **better-sqlite3** used for synchronous DB operations
- **Express.js** for API endpoints
- **React hooks** for state management
- **Framer Motion** for UI animations (pre-existing)

---

*Document created: Phase 8 implementation completion*
*Last updated: December 2024*
