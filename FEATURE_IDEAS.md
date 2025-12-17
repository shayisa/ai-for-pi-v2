# Feature Ideas for AI Newsletter Generator

> Saved: December 2024
> Status: Planning for future implementation

---

## High-Value Additions

### 1. Saved Prompt Templates
Save and reuse "Prompt of the Day" templates. Infrastructure exists - needs `saved_prompts` table and UI to browse/select.

**Effort:** Low
**Files:** `server/db/init.ts`, `server/services/promptDbService.ts`, new component

---

### 2. Persona + Tone Presets
Let users save combinations (persona + tone + flavors) as named presets like "Weekly Tech Roundup" or "Executive Summary Style".

**Effort:** Low (Preset type already supports this)
**Files:** `hooks/usePresets.ts`, `PresetsManager.tsx`

---

### 3. Custom Audience Definitions
Currently audiences are hardcoded (`academics`, `business`, `analysts`). Allow users to create custom audiences with their own descriptions, similar to personas.

**Effort:** Medium
**Files:** New `audiences` table, `audienceDbService.ts`, `AudienceEditor.tsx`, update `App.tsx`

---

### 4. A/B Persona Preview
Generate the same newsletter intro with 2-3 different personas side-by-side to help users pick the right voice.

**Effort:** Medium
**Files:** New `PersonaCompare.tsx` component, additional API call logic

---

### 5. Newsletter Templates
Save newsletter structures (number of sections, section types, image placement) as reusable templates separate from content.

**Effort:** Medium
**Files:** New `templates` table, `templateDbService.ts`, `TemplateEditor.tsx`

---

## Quality-of-Life Improvements

| Feature | Benefit | Effort |
|---------|---------|--------|
| **Tone Preview** | Show sample output for each tone before generating | Low |
| **Persona Favorites** | Pin frequently used personas to top | Low |
| **Generation History per Persona** | See past newsletters by persona | Low |
| **Bulk Image Regeneration** | Regenerate all images with a new style | Medium |
| **Draft Auto-Save** | Save in-progress newsletters | Medium |

---

## Advanced Features (More Effort)

### Scheduled Publishing
Auto-generate and send newsletters on a schedule.

**Effort:** High
**Requires:** Background job system (node-cron or similar), schedule management UI

---

### Multi-language Output
Generate newsletters in different languages.

**Effort:** Medium
**Requires:** Language selector, prompt modifications, possibly translation API

---

### Email Analytics
Track opens/clicks for sent newsletters.

**Effort:** High
**Requires:** Tracking pixel integration, click redirect system, analytics dashboard

---

### Content Calendar
Plan upcoming newsletter topics in advance.

**Effort:** Medium
**Requires:** Calendar UI component, `planned_newsletters` table

---

## Recommended Starting Point

**Custom Audience Definitions** - Natural extension of the persona pattern already implemented. Similar architecture:
- `audiences` SQLite table
- `audienceDbService.ts` for CRUD
- `audienceClientService.ts` for frontend
- `useAudiences.ts` hook
- `AudienceEditor.tsx` modal
- Update `DiscoverTopicsPage.tsx` to use custom audiences

---

## Implementation Notes

- All features should follow the existing pattern: SQLite table → backend service → client service → hook → component
- Maintain the layered prompt architecture: Persona → Tone → Flavors → Audience
- Keep UI consistent with existing design system (Framer Motion animations, card layouts)
