# Feature Plan: Multi-Source Prompt Import with Intelligent Parsing Templates

**Status**: ✅ IMPLEMENTED
**Created**: 2025-12-18
**Completed**: 2025-12-18
**Complexity Assessment**: HIGH
**Estimated Development Phases**: 7 phases (~12-18 hours total)

> **Note**: This feature has been fully implemented. See `promptImport.routes.ts`, `promptImportDbService.ts`, `promptParserService.ts`, and `fileExtractorService.ts` for the implementation.

---

## Executive Summary

This feature enables users to import prompts from **ANY source**:

| Source Type | Examples | Complexity |
|-------------|----------|------------|
| **URL** | Web pages, Substack, Notion, blogs | MEDIUM |
| **Text** | Plain text, Markdown (existing) | LOW (exists) |
| **Word Documents** | .docx, .doc | MEDIUM |
| **PowerPoint** | .pptx, .ppt | MEDIUM |
| **PDF** | .pdf documents | MEDIUM |
| **Rich Text** | .rtf files | LOW |
| **Plain Files** | .txt, .md | LOW |

### Key Innovation
The system uses **AI-powered parsing** to intelligently extract prompt structure from arbitrary content, then **learns and stores parsing templates** for each source pattern to enable consistent future imports.

### Unified Architecture
All source types flow through the same pipeline:
```
Source Input → Content Extraction → Template Matching → AI Parse (if needed) → PromptOfTheDay
```

---

## Supported Source Types (Detailed)

### 1. URL Sources
| Domain Type | Examples | Extraction Method |
|-------------|----------|-------------------|
| Substack | `*.substack.com` | article-extractor + HTML parsing |
| Notion | `*.notion.site` | article-extractor (public pages) |
| Medium | `medium.com/*` | article-extractor |
| GitHub Gists | `gist.github.com/*` | Raw content API |
| Google Docs | `docs.google.com/*` | Google API (requires auth) |
| Generic blogs | Any URL | article-extractor fallback |

### 2. Document Sources (NEW)

| Format | Extension | Library | Weekly Downloads |
|--------|-----------|---------|------------------|
| Word (new) | .docx | [officeparser](https://www.npmjs.com/package/officeparser) | 45,000+ |
| Word (legacy) | .doc | [word-extractor](https://www.npmjs.com/package/word-extractor) | 15,000+ |
| PowerPoint | .pptx | [officeparser](https://www.npmjs.com/package/officeparser) | 45,000+ |
| PDF | .pdf | [pdf-parse](https://www.npmjs.com/package/pdf-parse) | 500,000+ |
| Excel | .xlsx | [officeparser](https://www.npmjs.com/package/officeparser) | 45,000+ |
| OpenDocument | .odt, .odp | [officeparser](https://www.npmjs.com/package/officeparser) | 45,000+ |
| Rich Text | .rtf | Built-in text extraction | N/A |
| Plain Text | .txt, .md | Native fs.readFile | N/A |

### 3. Direct Input Sources (Existing)
| Type | Current Support | Enhancement |
|------|-----------------|-------------|
| Paste text | ✅ Fully supported | No changes needed |
| Paste Markdown | ✅ Fully supported | No changes needed |
| Load from Library | ✅ Phase 9a complete | No changes needed |

---

## Recommended Library: officeparser

After research, **[officeparser](https://github.com/harshankur/officeParser)** is the recommended primary library because:

1. **Multi-format support**: docx, pptx, xlsx, odt, odp, ods, pdf
2. **Actively maintained**: Last updated November 2024
3. **In-memory processing**: No temp files needed (as of v5.2)
4. **Browser compatible**: Can generate browser bundles
5. **Simple API**: Single function for all formats

```typescript
import { parseOfficeAsync } from 'officeparser';

// Works with file path, Buffer, or ArrayBuffer
const text = await parseOfficeAsync('/path/to/document.docx');
// Returns: string (all text content)
```

**Fallback Libraries**:
- [word-extractor](https://www.npmjs.com/package/word-extractor) - For legacy .doc files
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - Specialized PDF handling with more options

---

## Multi-Source Architecture

### Unified Import Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-SOURCE PROMPT IMPORT                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    URL      │  │   File      │  │   Paste     │  │   Library   │        │
│  │   Input     │  │   Upload    │  │   Text      │  │   Select    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
│         ▼                ▼                ▼                │               │
│  ┌──────────────────────────────────────────────┐          │               │
│  │           CONTENT EXTRACTOR SERVICE           │          │               │
│  │  ┌─────────────────────────────────────────┐ │          │               │
│  │  │ URL:  article-extractor + fetch        │ │          │               │
│  │  │ DOCX: officeparser                     │ │          │               │
│  │  │ PPTX: officeparser                     │ │          │               │
│  │  │ PDF:  pdf-parse                        │ │          │               │
│  │  │ DOC:  word-extractor                   │ │          │               │
│  │  │ TXT:  fs.readFile                      │ │          │               │
│  │  └─────────────────────────────────────────┘ │          │               │
│  └──────────────────────┬───────────────────────┘          │               │
│                         │                                  │               │
│                         ▼                                  │               │
│  ┌──────────────────────────────────────────────┐          │               │
│  │           RAW TEXT CONTENT                    │          │               │
│  └──────────────────────┬───────────────────────┘          │               │
│                         │                                  │               │
│                         ▼                                  │               │
│  ┌──────────────────────────────────────────────┐          │               │
│  │           TEMPLATE MATCHER                    │          │               │
│  │  • Check source type (url domain, file ext)  │          │               │
│  │  • Find matching template in database        │          │               │
│  │  • Return template or null                   │          │               │
│  └──────────────────────┬───────────────────────┘          │               │
│                         │                                  │               │
│              ┌──────────┴──────────┐                       │               │
│              │                     │                       │               │
│         Template Found        No Template                  │               │
│              │                     │                       │               │
│              ▼                     ▼                       │               │
│  ┌────────────────────┐  ┌────────────────────┐           │               │
│  │  Apply Template    │  │  Claude AI Parse   │           │               │
│  │  (regex/selector)  │  │  (intelligent)     │           │               │
│  └─────────┬──────────┘  └─────────┬──────────┘           │               │
│            │                       │                       │               │
│            │                       ▼                       │               │
│            │              ┌────────────────────┐           │               │
│            │              │ Generate Template  │           │               │
│            │              │ Suggestion         │           │               │
│            │              └─────────┬──────────┘           │               │
│            │                       │                       │               │
│            │              Save Template?                   │               │
│            │              (User confirms)                  │               │
│            │                       │                       │               │
│            └───────────┬───────────┘                       │               │
│                        │                                   │               │
│                        ▼                                   ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PromptOfTheDay OBJECT                             │   │
│  │  { title, summary, examplePrompts[], promptCode, savedPromptId? }   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    EDITOR FORM FIELDS                                │   │
│  │  Title | Summary | Example Prompts | Prompt Code                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Content Extractor Service Design

```typescript
/**
 * Unified Content Extractor Service
 * Handles all source types through a single interface
 */

export type SourceType = 'url' | 'file' | 'text';
export type FileType = 'docx' | 'doc' | 'pptx' | 'pdf' | 'xlsx' | 'odt' | 'odp' | 'txt' | 'md' | 'rtf';

export interface ExtractionRequest {
  sourceType: SourceType;

  // For URL sources
  url?: string;

  // For file sources
  file?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };

  // For text sources (passthrough)
  text?: string;
}

export interface ExtractionResult {
  success: boolean;
  content: string;           // Extracted plain text
  metadata: {
    sourceType: SourceType;
    fileType?: FileType;
    url?: string;
    filename?: string;
    title?: string;          // If extractable from document
    pageCount?: number;      // For PDFs, PPTXs
    wordCount?: number;
  };
  error?: string;
  extractionTimeMs: number;
}

export class ContentExtractor {
  /**
   * Extract content from any supported source
   */
  async extract(request: ExtractionRequest): Promise<ExtractionResult>;

  /**
   * Detect file type from extension or MIME type
   */
  detectFileType(filename: string, mimeType?: string): FileType;

  /**
   * Check if a file type is supported
   */
  isSupported(fileType: FileType): boolean;
}
```

### File Upload UI Design

```
┌────────────────────────────────────────────────────────────────┐
│  Import Prompt                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  ┌────────────┐                                          │  │
│  │  │  📁 URL    │  [🔗 From URL                       ]    │  │
│  │  └────────────┘       https://example.com/prompt         │  │
│  │                                                          │  │
│  │  ┌────────────┐  ┌────────────────────────────────────┐  │  │
│  │  │  📄 File   │  │  Drop file here or click to browse │  │  │
│  │  └────────────┘  │                                    │  │  │
│  │                  │  Supported: .docx .pptx .pdf .txt  │  │  │
│  │                  │             .md .doc .rtf          │  │  │
│  │                  └────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌────────────┐                                          │  │
│  │  │  📝 Paste  │  [existing textarea stays here]          │  │
│  │  └────────────┘                                          │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Import Options:                                               │
│  [✓] Save parsing template for future imports                  │
│  [ ] Force AI parsing (ignore existing templates)              │
│                                                                │
│  Status: ● Ready to import                                     │
│                                                                │
│                                          [Preview] [Import]    │
└────────────────────────────────────────────────────────────────┘
```

### Template Pattern Matching

Templates match sources using patterns specific to each source type:

| Source Type | Pattern Format | Example Pattern | Matches |
|-------------|----------------|-----------------|---------|
| URL | Glob-style domain match | `*.substack.com` | `ai.substack.com/p/prompt` |
| URL | Exact domain | `notion.site` | Any Notion public page |
| URL | Path pattern | `github.com/*/gist/*` | GitHub gists |
| File | Extension | `*.docx` | All Word documents |
| File | MIME type | `application/pdf` | All PDFs |
| File | Name pattern | `prompt-*.md` | Specific naming convention |

```typescript
interface TemplatePattern {
  // For URLs
  domainPattern?: string;    // e.g., "*.substack.com"
  pathPattern?: string;      // e.g., "/p/*" (post pages only)

  // For files
  extensionPattern?: string; // e.g., "docx", "pdf"
  mimeTypePattern?: string;  // e.g., "application/vnd.openxmlformats*"
  filenamePattern?: string;  // e.g., "prompt-*.md"

  // Priority (higher = checked first)
  priority: number;
}
```

---

## Current State Analysis

### Existing Infrastructure (MUST PRESERVE)

| Component | Location | Purpose | Impact if Changed |
|-----------|----------|---------|-------------------|
| `PromptOfTheDayEditor.tsx` | components/ | Manual paste + regex parsing | CRITICAL - UI foundation |
| `parseFullPrompt()` | lines 53-160 | Regex-based extraction | Must not break existing flow |
| `articleExtractorService.ts` | server/services/ | URL content extraction | Can reuse `@extractus/article-extractor` |
| `promptDbService.ts` | server/services/ | Prompt CRUD in SQLite | Must preserve schema |
| `prompt.routes.ts` | server/routes/ | API endpoints | Must extend, not replace |
| Claude client | server/external/claude/ | AI API access | Can leverage for parsing |

### Current Parsing Logic (parseFullPrompt)

```
Expected Input Format:
┌─────────────────────────────────────────────────────────────────┐
│ # **Title**                                                     │
│                                                                 │
│ Summary text describing what the prompt does...                 │
│                                                                 │
│ **Three example prompts:**                                      │
│ 1. "Example prompt one"                                         │
│ 2. "Example prompt two"                                         │
│ 3. "Example prompt three"                                       │
│                                                                 │
│ ```                                                             │
│ <role>...</role>                                                │
│ <context>...</context>                                          │
│ ```                                                             │
└─────────────────────────────────────────────────────────────────┘

Parsing Steps:
1. Title: RegExp('^#\\s*\\*\\*(.*?)\\*\\*', 'm') or '^#\\s+(.+?)(?:\\s*$|\\n)'
2. Summary: Text between title and "**Three example.*?prompts.*?:**"
3. Examples: RegExp('\\d+\\.\\s*[""](.*?)[""]', 'g')
4. Code: RegExp('```\\s*([\\s\\S]*?)```')
```

### Existing URL Fetching Patterns

**articleExtractorService.ts** provides:
```typescript
extractArticle(url: string): Promise<{
  content?: string;  // Plain text (HTML stripped)
  title?: string;
  success: boolean;
  error?: string;
  timeMs: number;
}>
```

**trendingDataService.ts** patterns:
- Direct fetch() calls to external APIs
- XML parsing for ArXiv
- JSON parsing for HackerNews, GitHub, Reddit, Dev.to

---

## Proposed Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     URL PROMPT IMPORT FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User enters URL ──► Fetch Content ──► Check for Template       │
│                           │                    │                │
│                           ▼                    ▼                │
│                   Raw HTML/Text         Template Found?         │
│                           │              ┌─────┴─────┐          │
│                           │              YES        NO          │
│                           │               │          │          │
│                           │      ┌────────▼────┐   ┌─▼──────┐   │
│                           │      │Apply Saved  │   │ Claude │   │
│                           │      │ Template    │   │ Parse  │   │
│                           │      └──────┬──────┘   └───┬────┘   │
│                           │             │              │        │
│                           │             ▼              ▼        │
│                           │        Extracted        Parsed +    │
│                           │         Prompt          Template    │
│                           │                            │        │
│                           │                   Save Template?    │
│                           │                        (YES)        │
│                           │                            │        │
│                           └───────────────────────────►│        │
│                                                        ▼        │
│                                            PromptOfTheDay Data  │
│                                                        │        │
│                                            ──► Editor Fields    │
└─────────────────────────────────────────────────────────────────┘
```

### New Database Schema

```sql
-- Parsing Templates table
CREATE TABLE IF NOT EXISTS prompt_source_templates (
  id TEXT PRIMARY KEY,                    -- tmpl_<timestamp>_<random>
  name TEXT NOT NULL,                     -- User-defined name
  source_type TEXT NOT NULL,              -- 'url', 'text', 'file'
  source_pattern TEXT NOT NULL,           -- Domain pattern or file extension
  parser_config TEXT NOT NULL,            -- JSON: parsing rules/selectors
  ai_generated INTEGER DEFAULT 0,         -- Was this template AI-generated?
  usage_count INTEGER DEFAULT 0,          -- How many times used
  last_used_at TEXT,                      -- Last usage timestamp
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_templates_source_type
  ON prompt_source_templates(source_type);
CREATE INDEX IF NOT EXISTS idx_templates_pattern
  ON prompt_source_templates(source_pattern);
CREATE INDEX IF NOT EXISTS idx_templates_usage
  ON prompt_source_templates(usage_count DESC);

-- Prompt Import History (for debugging and improvement)
CREATE TABLE IF NOT EXISTS prompt_import_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT,                        -- Original URL (if URL import)
  source_type TEXT NOT NULL,              -- 'url', 'text', 'file'
  template_id TEXT,                       -- Which template was used (if any)
  raw_content TEXT,                       -- Original fetched content
  parsed_result TEXT,                     -- JSON: parsed PromptOfTheDay
  success INTEGER NOT NULL,               -- 1 = success, 0 = failed
  error_message TEXT,                     -- Error details if failed
  duration_ms INTEGER,                    -- Total processing time
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES prompt_source_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_import_log_created
  ON prompt_import_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_log_success
  ON prompt_import_log(success);
```

### Template Parser Config Schema

```typescript
interface ParserConfig {
  // Extraction method
  method: 'regex' | 'css_selector' | 'xpath' | 'ai_structured';

  // For regex method
  regexPatterns?: {
    title?: string;         // Regex pattern for title
    summary?: string;       // Regex pattern for summary
    examples?: string;      // Regex pattern for examples (global)
    promptCode?: string;    // Regex pattern for code block
  };

  // For CSS selector method
  cssSelectors?: {
    title?: string;         // e.g., "h1.title"
    summary?: string;       // e.g., ".description p"
    examples?: string;      // e.g., "ol.examples li"
    promptCode?: string;    // e.g., "pre.code, code.prompt"
  };

  // For AI-structured method
  aiPrompt?: string;        // Custom extraction prompt for Claude

  // Content preprocessing
  preprocessing?: {
    stripHtml?: boolean;    // Remove HTML tags
    trimWhitespace?: boolean;
    normalizeQuotes?: boolean;
    removeEmojis?: boolean;
  };

  // Validation rules
  validation?: {
    requireTitle?: boolean;
    requirePromptCode?: boolean;
    minSummaryLength?: number;
    maxCodeLength?: number;
  };
}
```

---

## Implementation Phases

### Phase 11a: Database Schema & Types (~1 hour)

**Objective**: Add database tables and TypeScript types for templates and import logging.

**Files to Create/Modify**:

| File | Action | Changes |
|------|--------|---------|
| `server/db/init.ts` | MODIFY | Add `prompt_source_templates` and `prompt_import_log` tables |
| `types.ts` | MODIFY | Add `ParserConfig`, `PromptSourceTemplate` interfaces |
| `server/services/promptTemplateDbService.ts` | CREATE | CRUD for templates |
| `services/promptTemplateClientService.ts` | CREATE | Frontend API client |

**Database Migration**:
```typescript
// Add to server/db/init.ts after existing migrations

function runPromptTemplateMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_source_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_pattern TEXT NOT NULL,
      parser_config TEXT NOT NULL,
      ai_generated INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_templates_source_type
      ON prompt_source_templates(source_type);
    CREATE INDEX IF NOT EXISTS idx_templates_pattern
      ON prompt_source_templates(source_pattern);

    CREATE TABLE IF NOT EXISTS prompt_import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_url TEXT,
      source_type TEXT NOT NULL,
      template_id TEXT,
      raw_content TEXT,
      parsed_result TEXT,
      success INTEGER NOT NULL,
      error_message TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_import_log_created
      ON prompt_import_log(created_at DESC);
  `);
  console.log('[SQLite] Prompt template tables initialized');
}

runPromptTemplateMigration();
```

**TypeScript Types** (add to types.ts):
```typescript
export interface ParserConfig {
  method: 'regex' | 'css_selector' | 'xpath' | 'ai_structured';
  regexPatterns?: {
    title?: string;
    summary?: string;
    examples?: string;
    promptCode?: string;
  };
  cssSelectors?: {
    title?: string;
    summary?: string;
    examples?: string;
    promptCode?: string;
  };
  aiPrompt?: string;
  preprocessing?: {
    stripHtml?: boolean;
    trimWhitespace?: boolean;
    normalizeQuotes?: boolean;
    removeEmojis?: boolean;
  };
  validation?: {
    requireTitle?: boolean;
    requirePromptCode?: boolean;
    minSummaryLength?: number;
    maxCodeLength?: number;
  };
}

export interface PromptSourceTemplate {
  id: string;
  name: string;
  sourceType: 'url' | 'text' | 'file';
  sourcePattern: string;  // e.g., "*.substack.com", "*.notion.site"
  parserConfig: ParserConfig;
  aiGenerated: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptImportLog {
  id: number;
  sourceUrl: string | null;
  sourceType: 'url' | 'text' | 'file';
  templateId: string | null;
  rawContent: string;
  parsedResult: PromptOfTheDay | null;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
}
```

**Verification Checklist**:
- [ ] Database tables created without errors
- [ ] TypeScript compiles with new types
- [ ] No breaking changes to existing prompt functionality

---

### Phase 11b: Backend Services for URL Fetching & Parsing (~2 hours)

**Objective**: Create backend services for URL content fetching and intelligent parsing.

**Files to Create**:

| File | Purpose | Dependencies |
|------|---------|--------------|
| `server/services/promptTemplateDbService.ts` | Template CRUD operations | better-sqlite3 |
| `server/services/promptImportService.ts` | URL fetching + parsing logic | @extractus/article-extractor, Claude client |
| `server/routes/promptImport.routes.ts` | API endpoints | Express |

**promptTemplateDbService.ts** Structure:
```typescript
/**
 * Prompt Template Database Service
 * CRUD operations for parsing templates stored in SQLite
 */

// Functions to implement:
export const createTemplate = (template: Omit<PromptSourceTemplate, 'id' | 'createdAt' | 'updatedAt'>): PromptSourceTemplate
export const getTemplates = (limit?: number): PromptSourceTemplate[]
export const getTemplateById = (id: string): PromptSourceTemplate | null
export const getTemplateByPattern = (sourceType: string, pattern: string): PromptSourceTemplate | null
export const updateTemplate = (id: string, updates: Partial<PromptSourceTemplate>): PromptSourceTemplate | null
export const deleteTemplate = (id: string): boolean
export const incrementUsageCount = (id: string): void
export const findMatchingTemplate = (url: string): PromptSourceTemplate | null
```

**promptImportService.ts** Structure:
```typescript
/**
 * Prompt Import Service
 * Handles URL fetching, content extraction, and intelligent parsing
 */

import { extract } from '@extractus/article-extractor';
import { getAnthropicClient } from '../external/claude/client';
import * as templateDb from './promptTemplateDbService';

// Core functions:
export const fetchUrlContent = async (url: string): Promise<{
  content: string;
  title?: string;
  success: boolean;
  error?: string;
}>

export const parseWithTemplate = (
  content: string,
  template: PromptSourceTemplate
): PromptOfTheDay | null

export const parseWithAI = async (
  content: string,
  url: string
): Promise<{
  prompt: PromptOfTheDay;
  suggestedTemplate: ParserConfig;
}>

export const importFromUrl = async (
  url: string,
  options?: { forceAiParse?: boolean; saveTemplate?: boolean }
): Promise<{
  prompt: PromptOfTheDay;
  templateUsed: string | null;
  newTemplateCreated: boolean;
}>
```

**AI Parsing Prompt** (CRITICAL - preserve exactly):
```typescript
const AI_PARSING_PROMPT = `You are an expert at extracting structured prompt information from web content.

Given the following web content, extract the prompt information into a structured format.

Look for:
1. TITLE: The main heading or name of the prompt
2. SUMMARY: A description of what the prompt does and its purpose
3. EXAMPLE PROMPTS: Any example queries or usage examples
4. PROMPT CODE: The actual prompt template, often in XML-like tags or code blocks

Content to parse:
---
{CONTENT}
---

Source URL: {URL}

Respond with JSON in this exact format:
{
  "title": "extracted title",
  "summary": "extracted summary/description",
  "examplePrompts": ["example 1", "example 2", "example 3"],
  "promptCode": "the actual prompt template code",
  "confidence": 0.95,
  "suggestedTemplate": {
    "method": "regex",
    "regexPatterns": {
      "title": "regex for title if you can identify a pattern",
      "summary": "regex for summary if identifiable",
      "examples": "regex for examples if identifiable",
      "promptCode": "regex for code if identifiable"
    }
  }
}

If you cannot find a specific field, use an empty string or empty array.
The "confidence" field should be 0-1 indicating how confident you are in the extraction.
The "suggestedTemplate" should contain patterns that could be reused for similar pages.`;
```

**API Endpoints** (promptImport.routes.ts):
```typescript
/**
 * Prompt Import Routes
 *
 * Endpoints:
 * - POST /api/prompts/import/url      - Import from URL
 * - POST /api/prompts/import/preview  - Preview parsing without saving
 * - GET  /api/prompts/templates       - List saved templates
 * - POST /api/prompts/templates       - Create new template
 * - PUT  /api/prompts/templates/:id   - Update template
 * - DELETE /api/prompts/templates/:id - Delete template
 */
```

**Dependencies to Add** (package.json):
```json
{
  "dependencies": {
    "@extractus/article-extractor": "^8.0.0"  // Already installed
  }
}
```

**Verification Checklist**:
- [ ] URL fetching works for various domains
- [ ] Article extractor handles HTML content
- [ ] Claude parsing produces valid PromptOfTheDay structure
- [ ] Template matching works by domain pattern
- [ ] API endpoints return correct response format

---

### Phase 11c: Frontend UI Components (~2 hours)

**Objective**: Add URL input and template management to PromptOfTheDayEditor.

**Files to Modify**:

| File | Changes |
|------|---------|
| `components/PromptOfTheDayEditor.tsx` | Add URL input section, import button, status indicators |
| `services/promptClientService.ts` | Add import API functions |
| `hooks/usePromptImport.ts` | CREATE - State management for import flow |

**UI Design**:
```
┌────────────────────────────────────────────────────────────────┐
│  Prompt of the Day                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ▸ Load from Library                        [dropdown]         │
│                                                                │
│  ── OR ──────────────────────────────────────────────────────  │
│                                                                │
│  ▸ Import from URL (NEW)                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔗 https://example.com/prompt-of-the-day     [Import]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [✓] Save parsing template for this source                     │
│                                                                │
│  Status: ● Fetching content...                                 │
│          ● Parsing with AI...                                  │
│          ● Template matched: "Substack Prompts"                │
│                                                                │
│  ── OR ──────────────────────────────────────────────────────  │
│                                                                │
│  ▸ Paste Full Prompt                                           │
│  [existing textarea...]                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**New Props for PromptOfTheDayEditor**:
```typescript
interface PromptOfTheDayEditorProps {
  // Existing props (unchanged)
  initialPrompt: PromptOfTheDay | null;
  onSave: (prompt: PromptOfTheDay | null) => void;
  onSaveToLibrary?: (prompt: PromptOfTheDay) => Promise<void>;
  savedPrompts?: SavedPrompt[];
  onLoadFromLibrary?: (prompt: SavedPrompt) => void;

  // New props for URL import
  onImportFromUrl?: (url: string, options?: ImportOptions) => Promise<ImportResult>;
  templates?: PromptSourceTemplate[];
  onCreateTemplate?: (template: Partial<PromptSourceTemplate>) => Promise<void>;
}

interface ImportOptions {
  forceAiParse?: boolean;
  saveTemplate?: boolean;
  templateName?: string;
}

interface ImportResult {
  success: boolean;
  prompt?: PromptOfTheDay;
  templateUsed?: string;
  newTemplateCreated?: boolean;
  error?: string;
}
```

**usePromptImport Hook**:
```typescript
/**
 * Hook for managing prompt import state and operations
 */
export const usePromptImport = () => {
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string>('');

  const importFromUrl = async (url: string, options?: ImportOptions) => {
    setImportStatus('fetching');
    setImportProgress('Fetching content from URL...');

    try {
      // Call backend API
      const result = await promptApi.importFromUrl(url, options);

      if (result.success) {
        setImportStatus('success');
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setImportStatus('error');
      setImportError(err instanceof Error ? err.message : 'Import failed');
      throw err;
    }
  };

  const resetImport = () => {
    setImportStatus('idle');
    setImportError(null);
    setImportProgress('');
  };

  return {
    importStatus,
    importError,
    importProgress,
    importFromUrl,
    resetImport,
  };
};
```

**promptClientService.ts Additions**:
```typescript
/**
 * Import prompt from URL
 */
export const importFromUrl = async (
  url: string,
  options?: ImportOptions
): Promise<ImportResult> => {
  return apiRequest<ImportResult>('/api/prompts/import/url', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
  });
};

/**
 * Preview import without saving
 */
export const previewImport = async (url: string): Promise<ImportResult> => {
  return apiRequest<ImportResult>('/api/prompts/import/preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
};

/**
 * Get all parsing templates
 */
export const getTemplates = async (): Promise<PromptSourceTemplate[]> => {
  return apiRequest<PromptSourceTemplate[]>('/api/prompts/templates');
};

/**
 * Create a new template
 */
export const createTemplate = async (
  template: Omit<PromptSourceTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PromptSourceTemplate> => {
  return apiRequest<PromptSourceTemplate>('/api/prompts/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
};
```

**Verification Checklist**:
- [ ] URL input field renders correctly
- [ ] Import button triggers fetch
- [ ] Progress indicators show status
- [ ] Parsed content populates form fields
- [ ] Template checkbox works
- [ ] Error states display properly

---

### Phase 11d: Template Management UI (~1.5 hours)

**Objective**: Create UI for viewing, editing, and managing parsing templates.

**Files to Create**:

| File | Purpose |
|------|---------|
| `components/PromptTemplateManager.tsx` | Template list and management modal |
| `components/PromptTemplateEditor.tsx` | Edit/create template form |

**Template Manager UI**:
```
┌────────────────────────────────────────────────────────────────┐
│  Parsing Templates                                    [+ New]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ★ Substack Prompts                        Used: 12 times │  │
│  │   Pattern: *.substack.com                                │  │
│  │   Method: AI-structured                    [Edit] [Del]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Notion Pages                            Used: 5 times  │  │
│  │   Pattern: *.notion.site                                 │  │
│  │   Method: CSS Selector                     [Edit] [Del]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Custom Blog                             Used: 3 times  │  │
│  │   Pattern: blog.example.com/prompts                      │  │
│  │   Method: Regex                            [Edit] [Del]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Template Editor Modal**:
```
┌────────────────────────────────────────────────────────────────┐
│  Edit Template: "Substack Prompts"                       [X]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Name:    [Substack Prompts                              ]     │
│                                                                │
│  Source Pattern: [*.substack.com                         ]     │
│  (Use * for wildcards, e.g., *.example.com)                   │
│                                                                │
│  Parsing Method:                                               │
│  ◯ Regex Patterns                                              │
│  ◯ CSS Selectors                                               │
│  ◉ AI-Structured                                               │
│                                                                │
│  [Advanced: Custom AI Prompt]                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ (Custom extraction instructions...)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Preprocessing:                                                │
│  [✓] Strip HTML tags                                           │
│  [✓] Normalize quotes                                          │
│  [ ] Remove emojis                                             │
│                                                                │
│                                    [Cancel]  [Save Template]   │
└────────────────────────────────────────────────────────────────┘
```

**Access Point**: Add link in PromptOfTheDayEditor to open template manager.

**Verification Checklist**:
- [ ] Template list shows all saved templates
- [ ] Create new template works
- [ ] Edit existing template works
- [ ] Delete template with confirmation
- [ ] Usage count displays correctly
- [ ] Pattern matching tested with various URLs

---

### Phase 11e: Integration & Testing (~1.5 hours)

**Objective**: Wire everything together and ensure robust operation.

**Integration Points**:

| Integration | Files Affected | Verification |
|-------------|----------------|--------------|
| URL import → PromptOfTheDay | PromptOfTheDayEditor, ConfigurationPanel | Import fills all fields |
| Template auto-match | promptImportService | Correct template selected |
| AI fallback | promptImportService | Works when no template matches |
| Template save | promptTemplateDbService | Persists to SQLite |
| Error handling | All components | Graceful degradation |

**Test Cases**:

1. **URL Import - Known Domain**
   - Input: URL from substack.com (with template)
   - Expected: Template matched, fast extraction

2. **URL Import - Unknown Domain**
   - Input: URL from new domain
   - Expected: AI parsing, template suggestion offered

3. **URL Import - Failed Fetch**
   - Input: Invalid URL or timeout
   - Expected: Error message, retry option

4. **URL Import - Unparseable Content**
   - Input: URL with non-prompt content
   - Expected: Low confidence warning, manual edit option

5. **Template Creation**
   - Input: New domain pattern
   - Expected: Template saved, available for future imports

6. **Template Update**
   - Input: Modified regex pattern
   - Expected: Changes reflected in next import

**Error Scenarios to Handle**:

| Error | Detection | User Feedback |
|-------|-----------|---------------|
| Network failure | fetch throws | "Unable to reach URL. Check your connection." |
| Invalid URL | URL parse fails | "Please enter a valid URL." |
| Blocked by CORS | Response error | "This site cannot be accessed directly. Try pasting content." |
| Content extraction failed | article-extractor returns empty | "Unable to extract content. Site may be protected." |
| AI parsing failed | Claude returns invalid JSON | "AI parsing failed. Try a different URL or paste manually." |
| Rate limited | 429 response | "Too many requests. Please wait a moment." |

**Verification Checklist**:
- [ ] Happy path works end-to-end
- [ ] All error scenarios show appropriate messages
- [ ] No regressions to existing paste functionality
- [ ] Template matching is case-insensitive
- [ ] Import logs are recorded in database
- [ ] Performance is acceptable (<5s for most URLs)

---

## Dependencies Analysis

### Existing Dependencies (ALREADY INSTALLED)

| Package | Version | Usage |
|---------|---------|-------|
| `@extractus/article-extractor` | ^8.0.0 | URL content extraction |
| `@anthropic-ai/sdk` | ^0.40.0 | AI-powered parsing |
| `better-sqlite3` | ^11.3.0 | Template storage |
| `framer-motion` | ^12.0.0 | UI animations |

### New Dependencies Required

**NONE** - All required functionality can be achieved with existing packages.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CORS blocking | HIGH | MEDIUM | Proxy through backend, fallback to manual paste |
| AI parsing inconsistent | MEDIUM | LOW | Confidence scoring, manual override |
| Template regex too specific | MEDIUM | LOW | Allow regex editing, AI suggestions |
| Performance issues | LOW | MEDIUM | Caching, progress indicators |
| Claude API costs | MEDIUM | LOW | Only use AI when no template matches |

---

## Effort Estimation (Updated for Multi-Source)

| Phase | Task | Estimated Time | Complexity |
|-------|------|----------------|------------|
| 11a | Database schema & types | 1 hour | LOW |
| 11b | Backend URL fetch + AI parse services | 2 hours | HIGH |
| **11b.2** | **Backend file extraction service** | **1.5 hours** | **MEDIUM** |
| 11c | Frontend URL import UI | 2 hours | MEDIUM |
| **11c.2** | **Frontend file upload UI** | **1.5 hours** | **MEDIUM** |
| 11d | Template management UI | 1.5 hours | MEDIUM |
| 11e | Integration & testing | 2 hours | MEDIUM |
| **Total** | | **11.5 hours** | |

**Buffer for unknowns**: +3-5 hours

**Total with buffer**: **14.5-16.5 hours** (2-3 working days)

---

## New Phases for File Upload Support

### Phase 11b.2: Backend File Extraction Service (~1.5 hours)

**Objective**: Add file content extraction for documents uploaded from frontend.

**New Dependencies to Install**:
```bash
npm install officeparser pdf-parse word-extractor
# Or using pnpm:
pnpm add officeparser pdf-parse word-extractor
```

**Files to Create**:

| File | Purpose |
|------|---------|
| `server/services/contentExtractorService.ts` | Unified content extraction |
| `server/routes/promptImport.routes.ts` | Add file upload endpoint |

**contentExtractorService.ts**:
```typescript
/**
 * Content Extractor Service
 * Extracts text from various file formats and URLs
 */

import { parseOfficeAsync } from 'officeparser';
import pdf from 'pdf-parse';
import WordExtractor from 'word-extractor';
import { extract as extractArticle } from '@extractus/article-extractor';
import fs from 'fs/promises';

export type SourceType = 'url' | 'file' | 'text';
export type FileType = 'docx' | 'doc' | 'pptx' | 'pdf' | 'xlsx' | 'odt' | 'odp' | 'txt' | 'md' | 'rtf';

export interface ExtractionRequest {
  sourceType: SourceType;
  url?: string;
  file?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
  text?: string;
}

export interface ExtractionResult {
  success: boolean;
  content: string;
  metadata: {
    sourceType: SourceType;
    fileType?: FileType;
    url?: string;
    filename?: string;
    title?: string;
    pageCount?: number;
    wordCount?: number;
  };
  error?: string;
  extractionTimeMs: number;
}

/**
 * Detect file type from filename or MIME type
 */
export function detectFileType(filename: string, mimeType?: string): FileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();

  const extensionMap: Record<string, FileType> = {
    'docx': 'docx',
    'doc': 'doc',
    'pptx': 'pptx',
    'pdf': 'pdf',
    'xlsx': 'xlsx',
    'odt': 'odt',
    'odp': 'odp',
    'txt': 'txt',
    'md': 'md',
    'rtf': 'rtf',
  };

  return extensionMap[ext || ''] || null;
}

/**
 * Extract content from a file buffer
 */
export async function extractFromFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const fileType = detectFileType(filename, mimeType);

  if (!fileType) {
    return {
      success: false,
      content: '',
      metadata: { sourceType: 'file', filename },
      error: `Unsupported file type: ${filename}`,
      extractionTimeMs: Date.now() - startTime,
    };
  }

  try {
    let content = '';
    let pageCount: number | undefined;

    switch (fileType) {
      case 'docx':
      case 'pptx':
      case 'xlsx':
      case 'odt':
      case 'odp':
        // officeparser handles all Office formats
        content = await parseOfficeAsync(buffer);
        break;

      case 'doc':
        // Legacy Word format needs word-extractor
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buffer);
        content = doc.getBody();
        break;

      case 'pdf':
        // PDF needs pdf-parse
        const pdfData = await pdf(buffer);
        content = pdfData.text;
        pageCount = pdfData.numpages;
        break;

      case 'txt':
      case 'md':
      case 'rtf':
        // Plain text - just decode buffer
        content = buffer.toString('utf-8');
        break;

      default:
        return {
          success: false,
          content: '',
          metadata: { sourceType: 'file', filename, fileType },
          error: `Unsupported file type: ${fileType}`,
          extractionTimeMs: Date.now() - startTime,
        };
    }

    return {
      success: true,
      content: content.trim(),
      metadata: {
        sourceType: 'file',
        fileType,
        filename,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        pageCount,
      },
      extractionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      metadata: { sourceType: 'file', filename, fileType },
      error: error instanceof Error ? error.message : String(error),
      extractionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract content from a URL
 */
export async function extractFromUrl(url: string): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const result = await extractArticle(url);

    if (result && result.content) {
      // Strip HTML tags
      const plainText = result.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        success: true,
        content: plainText,
        metadata: {
          sourceType: 'url',
          url,
          title: result.title || undefined,
          wordCount: plainText.split(/\s+/).filter(Boolean).length,
        },
        extractionTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      content: '',
      metadata: { sourceType: 'url', url },
      error: 'No content extracted from URL',
      extractionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      metadata: { sourceType: 'url', url },
      error: error instanceof Error ? error.message : String(error),
      extractionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Unified extraction - handles any source type
 */
export async function extract(request: ExtractionRequest): Promise<ExtractionResult> {
  if (request.sourceType === 'url' && request.url) {
    return extractFromUrl(request.url);
  }

  if (request.sourceType === 'file' && request.file) {
    return extractFromFile(
      request.file.buffer,
      request.file.filename,
      request.file.mimeType
    );
  }

  if (request.sourceType === 'text' && request.text) {
    return {
      success: true,
      content: request.text,
      metadata: {
        sourceType: 'text',
        wordCount: request.text.split(/\s+/).filter(Boolean).length,
      },
      extractionTimeMs: 0,
    };
  }

  return {
    success: false,
    content: '',
    metadata: { sourceType: request.sourceType },
    error: 'Invalid extraction request',
    extractionTimeMs: 0,
  };
}

export default {
  extract,
  extractFromUrl,
  extractFromFile,
  detectFileType,
};
```

**API Endpoint for File Upload** (add to promptImport.routes.ts):
```typescript
import multer from 'multer';

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'text/plain',
      'text/markdown',
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|rtf)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

/**
 * POST /api/prompts/import/file
 * Import prompt from uploaded file
 */
router.post('/import/file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return sendError(res, 'No file uploaded', ErrorCodes.VALIDATION_ERROR);
  }

  const { forceAiParse, saveTemplate } = req.body;

  try {
    // Extract content from file
    const extractionResult = await contentExtractor.extractFromFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    if (!extractionResult.success) {
      return sendError(res, extractionResult.error || 'Extraction failed', ErrorCodes.INTERNAL_ERROR);
    }

    // Parse content (same as URL import)
    const parseResult = await promptImportService.parseContent(
      extractionResult.content,
      {
        sourceType: 'file',
        filename: req.file.originalname,
        forceAiParse: forceAiParse === 'true',
        saveTemplate: saveTemplate === 'true',
      }
    );

    sendSuccess(res, parseResult);
  } catch (error) {
    sendError(res, 'File import failed', ErrorCodes.INTERNAL_ERROR);
  }
});
```

**Verification Checklist - Phase 11b.2**:
- [ ] DOCX extraction works (test with formatted document)
- [ ] PPTX extraction works (test multi-slide presentation)
- [ ] PDF extraction works (test text-based PDF)
- [ ] Legacy DOC extraction works
- [ ] TXT/MD pass-through works
- [ ] File size limit enforced (10MB)
- [ ] Invalid file types rejected
- [ ] Large files don't crash server

---

### Phase 11c.2: Frontend File Upload UI (~1.5 hours)

**Objective**: Add drag-and-drop file upload to PromptOfTheDayEditor.

**Files to Create/Modify**:

| File | Changes |
|------|---------|
| `components/FileDropZone.tsx` | NEW - Reusable drag-and-drop component |
| `components/PromptOfTheDayEditor.tsx` | Add file upload section |
| `services/promptClientService.ts` | Add file upload API function |
| `hooks/usePromptImport.ts` | Add file upload handling |

**FileDropZone Component**:
```typescript
/**
 * FileDropZone Component
 * Drag-and-drop file upload with visual feedback
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileSelect,
  accept = ['.docx', '.pptx', '.pdf', '.txt', '.md', '.doc'],
  maxSizeMB = 10,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSelect(file);
    }
  }, [disabled]);

  const validateAndSelect = (file: File) => {
    setError(null);

    // Check file extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!accept.includes(ext)) {
      setError(`Unsupported file type. Allowed: ${accept.join(', ')}`);
      return;
    }

    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Maximum size: ${maxSizeMB}MB`);
      return;
    }

    onFileSelect(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer
        ${isDragging ? 'border-editorial-red bg-editorial-red/5' : 'border-border-subtle hover:border-slate'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={() => {
        if (disabled) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) validateAndSelect(file);
        };
        input.click();
      }}
    >
      <div className="space-y-2">
        <p className="font-sans text-ui text-slate">
          {isDragging ? 'Drop file here...' : 'Drop file here or click to browse'}
        </p>
        <p className="font-sans text-caption text-silver">
          Supported: {accept.join(', ')} (max {maxSizeMB}MB)
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 font-sans text-caption text-editorial-red"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
```

**promptClientService.ts Addition**:
```typescript
/**
 * Import prompt from uploaded file
 */
export const importFromFile = async (
  file: File,
  options?: ImportOptions
): Promise<ImportResult> => {
  const formData = new FormData();
  formData.append('file', file);

  if (options?.forceAiParse) {
    formData.append('forceAiParse', 'true');
  }
  if (options?.saveTemplate) {
    formData.append('saveTemplate', 'true');
  }

  const response = await fetch(`${API_BASE_URL}/api/prompts/import/file`, {
    method: 'POST',
    body: formData, // Note: Don't set Content-Type - browser sets it with boundary
  });

  if (!response.ok) {
    throw new Error('File upload failed');
  }

  const data = await response.json();
  return data.data;
};
```

**usePromptImport Hook Addition**:
```typescript
// Add to existing usePromptImport hook

const importFromFile = async (file: File, options?: ImportOptions) => {
  setImportStatus('uploading');
  setImportProgress(`Uploading ${file.name}...`);

  try {
    setImportProgress('Extracting content...');
    const result = await promptApi.importFromFile(file, options);

    if (result.success) {
      setImportStatus('success');
      setImportProgress('Import complete!');
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    setImportStatus('error');
    setImportError(err instanceof Error ? err.message : 'File import failed');
    throw err;
  }
};

return {
  // ... existing returns
  importFromFile,
};
```

**Verification Checklist - Phase 11c.2**:
- [ ] Drag-and-drop visual feedback works
- [ ] Click-to-browse works
- [ ] File type validation works
- [ ] File size validation works
- [ ] Upload progress shows correctly
- [ ] Extracted content populates form
- [ ] Error states display properly
- [ ] Works on mobile (click only)

---

## Future Extensions (Revised)

1. **Browser extension**
   - One-click import from any page
   - Complexity: HIGH

2. **Scheduled imports**
   - Auto-fetch daily prompt from configured URLs
   - Complexity: MEDIUM

3. **Template sharing**
   - Export/import templates between users
   - Complexity: LOW

4. **OCR for scanned PDFs**
   - Would require: tesseract.js
   - Complexity: HIGH

5. **Google Docs/Sheets integration**
   - Import from Google Workspace
   - Complexity: MEDIUM (uses existing OAuth)

---

## Existing Features to Preserve (CRITICAL)

| Feature | Location | Test After Implementation |
|---------|----------|--------------------------|
| Manual paste parsing | PromptOfTheDayEditor:53-160 | Paste prompt text, verify fields populate |
| Load from library | PromptOfTheDayEditor:227-256 | Select saved prompt, verify loads |
| Save to library | PromptOfTheDayEditor:188-211 | Create new prompt, verify appears in list |
| Prompt usage tracking | types.ts:13, newsletterDbService:473-513 | Generate with prompt, check history shows title |
| Draft auto-save | App.tsx:1408-1447 | Edit prompt, wait 2s, verify draft saves |

---

## Decision Points for User

Before implementation, please confirm:

1. **AI Parsing Frequency**
   - Option A: Always try AI first (more accurate, higher API cost)
   - Option B: Only AI when no template matches (recommended)

2. **Template Auto-Save**
   - Option A: Always save successful AI-generated templates
   - Option B: Ask user to confirm before saving (recommended)

3. **Import History Retention**
   - Option A: Keep all import logs indefinitely
   - Option B: Keep last 100 imports per user (recommended)

4. **URL Validation Strictness**
   - Option A: Only HTTPS URLs allowed
   - Option B: HTTP allowed with warning (recommended)

---

## Conclusion

This feature adds significant value by reducing the manual workflow:

### URL Import
**Before**: Copy URL → Open Notes → Convert to Markdown → Copy → Paste → Parse
**After**: Paste URL → Click Import

### File Import
**Before**: Open document → Copy text → Paste → Parse
**After**: Drag file → Drop → Done

### Workflow Reduction Summary

| Source Type | Before (steps) | After (steps) | Time Saved |
|-------------|----------------|---------------|------------|
| URL | 5-6 | 2 | ~3-5 min |
| DOCX | 3-4 | 2 | ~1-2 min |
| PPTX | 4-5 | 2 | ~2-3 min |
| PDF | 3-4 | 2 | ~1-2 min |

The templating system ensures that frequently-used sources become faster over time, and the AI fallback handles new sources intelligently.

**Recommendation**:
- **MVP (Phase 11a + 11b + 11c)**: URL import only - 5 hours
- **MVP + Files (add 11b.2 + 11c.2)**: Full multi-source - 8.5 hours
- **Complete (all phases)**: Templates + Testing - 11.5 hours

### Sources Referenced

- [officeparser](https://www.npmjs.com/package/officeparser) - Multi-format Office document parser
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - PDF text extraction
- [word-extractor](https://www.npmjs.com/package/word-extractor) - Legacy .doc support
- [@extractus/article-extractor](https://www.npmjs.com/package/@extractus/article-extractor) - Already installed, URL content extraction
