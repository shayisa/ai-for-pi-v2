# Generation Endpoints Research Document

## Purpose
This document captures comprehensive research on all 9 generation endpoints in server.ts.
It serves as the single source of truth for the preservation-focused migration.

**CRITICAL**: All prompts, configurations, and logic in this document MUST be preserved EXACTLY.

---

## Table of Contents
1. [Endpoint Inventory](#endpoint-inventory)
2. [Endpoint Details](#endpoint-details)
3. [Service Dependencies](#service-dependencies)
4. [Agentic Loop Logic](#agentic-loop-logic)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Preservation Checklist](#preservation-checklist)

---

## Endpoint Inventory

| # | Endpoint | Method | Lines | Model | Max Tokens | Has Agentic Loop |
|---|----------|--------|-------|-------|------------|------------------|
| 1 | `/api/fetchTrendingSources` | GET | 656-681 | N/A | N/A | No |
| 2 | `/api/generateCompellingTrendingContent` | POST | 684-800 | claude-haiku-4-5-20251001 | 3000 | No |
| 3 | `/api/generateNewsletter` | POST | 802-1057 | claude-sonnet-4-20250514 | 4096 | Yes (max 2) |
| 4 | `/api/generateEnhancedNewsletter` | POST | 1063-1253 | claude-sonnet-4-20250514 | 4096 | No |
| 5 | `/api/generateAudienceConfig` | POST | 1255-1296 | Delegated to service | - | No |
| 6 | `/api/fetchMultiSources` | GET | 1298-1320 | N/A | N/A | No |
| 7 | `/api/generateTopicSuggestions` | POST | 1328-1498 | claude-sonnet-4-20250514 | 2048 | Yes (max 2) |
| 8 | `/api/generateTrendingTopics` | POST | 1500-1660 | claude-sonnet-4-20250514 | 2048 | Yes (max 2) |
| 9 | `/api/generateTrendingTopicsWithSources` | POST | 1662-1798 | claude-haiku-4-5-20251001 | 2048 | Yes (max 2) |
| 10 | `/api/generateImage` | POST | 1801-1885 | Stability AI | N/A | No |

---

## Endpoint Details

### 1. `/api/fetchTrendingSources` (GET)

**Purpose**: Aggregates trending content from 5 real sources with caching.

**Dependencies**:
- `trendingCache` (1 hour TTL)
- `fetchAllTrendingSources()` helper

**Request**: None (GET)

**Response**:
```json
{
  "sources": TrendingSource[],
  "cachedAt": string,
  "ttl": number
}
```

**Logic**:
1. Check trendingCache first
2. If cache hit, return cached data with metadata
3. If cache miss, call `fetchAllTrendingSources()`
4. Store in cache, return fresh data

---

### 2. `/api/generateCompellingTrendingContent` (POST)

**Purpose**: Extract actionable insights from trending sources.

**Dependencies**:
- `getAnthropicClient()`
- `getAudienceDescription()`
- `getDateRangeDescription()`
- `fetchAllTrendingSources()`
- `scoreSourceForPracticality()`

**Request Body**:
```typescript
{
  audience: string[];
  sources?: string;
}
```

**Model Configuration**:
- Model: `claude-haiku-4-5-20251001`
- Max tokens: 3000
- No tools (no agentic loop)

**EXACT System Prompt** (PRESERVE):
```
You are a seasoned consultant and technology strategist who speaks plainly and authentically. Your gift is translating complex AI developments into practical guidance that feels like advice from a trusted colleague, not a textbook. You extract specific, immediately actionable insights, tools, and implementation steps. You write with clarity, personality, and genuine helpfulness—always focusing on what professionals can actually DO TODAY. Always return valid JSON with human-centered guidance.
```

**EXACT User Message Structure** (PRESERVE):
- Task introduction
- RECENCY REQUIREMENT with date range
- Source summary (if provided)
- TWO sections request:
  - SECTION 1: ACTIONABLE AI CAPABILITIES (3-4 items)
  - SECTION 2: ESSENTIAL TOOLS & RESOURCES (5-7 items)
- Audience-tailored focus
- Domain-specific priorities (forensic anthropology, archaeology, business automation, analytics)
- JSON output structure

---

### 3. `/api/generateNewsletter` (POST)

**Purpose**: Core newsletter generation with web search capability.

**Dependencies**:
- `getAnthropicClient()`
- `getAudienceDescription()`
- `getFlavorInstructions()`
- `getDateRangeDescription()`
- `webSearchTool`
- `processToolCall()`
- `sanitizeNewsletter()`
- `newsletterDbService.saveNewsletter()`

**Request Body**:
```typescript
{
  topics: string[];
  audience: string[];
  tone: string;
  flavors: string[];
  imageStyle: string;
}
```

**Model Configuration**:
- Model: `claude-sonnet-4-20250514`
- Max tokens: 4096
- Tools: [webSearchTool]
- Max iterations: 2 (MAX_SEARCH_ITERATIONS)

**EXACT System Prompt** (PRESERVE):
```
You are an expert professional newsletter writer and technology journalist with years of experience crafting engaging, authentic content for diverse audiences. Your strength is transforming complex topics into compelling narratives that feel human, genuine, and insightful—never robotic or formulaic.

Your task: Create a newsletter that reads like it was written by a seasoned, knowledgeable professional who genuinely cares about helping your readers. Focus on clarity, authenticity, and real value.

You have access to web search to find the latest, most relevant information. The final output MUST be a single, valid JSON object. Do not include any text outside of the JSON object.
```

**CRITICAL User Message Elements** (ALL MUST BE PRESERVED):
1. Award-winning writer persona
2. Audience description injection
3. **ANTI-AI Writing Instructions**:
   - Avoid predictable structures/lists
   - Avoid "importantly," "it's worth noting," "as we can see"
   - Avoid overly formal/robotic language
   - Avoid excessive hedging
   - Avoid repetitive explanations
4. **Embrace Instructions**:
   - Conversational, authentic voice
   - Natural transitions
   - Genuine insights
   - Occasional casual language
   - Direct, unfiltered perspective
5. Domain-specific applications (4 domains)
6. Tone and flavor injection
7. RECENCY REQUIREMENT (60-day window)
8. **ACTIONABILITY REQUIREMENTS** (MANDATORY):
   - Implementation Time
   - Skill Level
   - Prerequisites
   - Concrete Steps
   - Expected Outcome
9. **SOURCE REQUIREMENTS**:
   - Direct links mandatory
   - 2+ sources per section
   - No invented URLs
10. HTML `<a>` tag embedding instructions
11. JSON output structure with imagePrompt per section
12. searchGuidance appended

**Post-Processing**:
1. Parse JSON response
2. `sanitizeNewsletter()` - remove emojis
3. Auto-save to SQLite via `newsletterDbService.saveNewsletter()`
4. Include generated ID in response

---

### 4. `/api/generateEnhancedNewsletter` (POST)

**Purpose**: V2 newsletter format with multi-source fetching and audience sections.

**Dependencies**:
- `getAnthropicClient()`
- `sourceFetchingService.fetchAllSources()`
- `articleExtractorService.extractMultipleArticles()`
- `articleExtractorService.buildSourceContext()`
- `audienceGenerationService.getAudiencePromptDescription()`
- `newsletterDbService.saveEnhancedNewsletter()`

**Request Body**:
```typescript
{
  topics: string[];
  audiences: AudienceConfig[];
  imageStyle?: string;
  promptOfTheDay?: {
    title: string;
    summary: string;
    examplePrompts: string[];
    promptCode: string;
  } | null;
}
```

**Model Configuration**:
- Model: `claude-sonnet-4-20250514`
- Max tokens: 4096
- No tools (no agentic loop)

**Data Flow**:
1. Collect keywords, subreddits, arxiv categories from all audiences
2. Call `sourceFetchingService.fetchAllSources()` (6 sources in parallel)
3. Call `articleExtractorService.extractMultipleArticles()` (max 10 articles)
4. Call `articleExtractorService.buildSourceContext()` (max 25000 chars)
5. Call `audienceGenerationService.getAudiencePromptDescription()`
6. Send to Claude with source context
7. Parse JSON, optionally override promptOfTheDay
8. Save to SQLite

**EXACT System Prompt** (PRESERVE):
```
You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools in their work.

Your task is to generate a newsletter in the ENHANCED FORMAT with:
1. Editor's Note - Personal, conversational opening that sets the tone (2-3 sentences)
2. Tool of the Day - One standout tool featured prominently from the sources
3. Audience Sections - ONE section per audience with specific relevance
4. Practical Prompts - Ready-to-use AI prompts for each section
5. CTAs - Clear calls to action
6. Source Citations - Every claim cites its source URL
7. Prompt of the Day - A featured prompt technique with title, summary, example variations, and full structured promptCode with XML-like tags

RULES:
- Every factual claim MUST cite its source URL from the provided sources
- Each audience section MUST have a "Why It Matters" explanation specific to that audience
- Practical prompts should be immediately usable - copy-paste ready
- Keep the tone authoritative but accessible
- NO hallucinated tools or statistics - use ONLY what's in the provided sources
- Do NOT use emojis in titles or section headers

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{...}
```

---

### 5. `/api/generateAudienceConfig` (POST)

**Purpose**: Generate audience configuration using AI.

**Dependencies**:
- `apiKeyDbService.getApiKey()`
- `audienceGenerationService.generateAudienceConfig()`

**Request Body**:
```typescript
{
  name: string;
  description: string;
}
```

**Logic**: Delegates entirely to `audienceGenerationService.generateAudienceConfig()`

---

### 6. `/api/fetchMultiSources` (GET)

**Purpose**: Fetch sources from multiple APIs for enhanced newsletter.

**Dependencies**:
- `sourceFetchingService.fetchAllSources()`

**Query Parameters**:
- `keywords`: comma-separated (default: 'artificial intelligence')
- `subreddits`: comma-separated (default: 'MachineLearning')
- `arxiv`: comma-separated (default: 'cs.AI')
- `limit`: number (default: 5)

---

### 7. `/api/generateTopicSuggestions` (POST)

**Purpose**: Generate 10 HOW-TO tutorial topic suggestions.

**Dependencies**:
- `getAnthropicClient()`
- `getAudienceDescription()`
- `getDateRangeDescription()`
- `webSearchTool`
- `processToolCall()`

**Model Configuration**:
- Model: `claude-sonnet-4-20250514`
- Max tokens: 2048
- Tools: [webSearchTool]
- Max iterations: 2

**CRITICAL Format Requirements** (PRESERVE):
- Every topic MUST start with action verb
- Every topic MUST be practical tutorial format
- Every topic MUST include specific tools by name
- Every topic MUST have clear, measurable outcome

**EXACT System Prompt** (PRESERVE):
```
You are an experienced technical writer and tutorial creator specializing in actionable, implementation-focused content. Your expertise is transforming new AI developments into step-by-step guides that readers can follow immediately. You NEVER suggest passive informational topics—every suggestion must be a hands-on tutorial or how-to guide with specific tools named. Think like someone who writes for O'Reilly, Real Python, or Towards Data Science—practical, specific, and immediately implementable.
```

**AVOID formats** (explicitly listed in prompt):
- "Understanding [topic]" or "Introduction to [topic]"
- "The State of [technology]" or "Trends in [field]"
- "[Company] Announces [product]"
- "Why [concept] Matters"
- Any title without specific tool named

---

### 8. `/api/generateTrendingTopics` (POST)

**Purpose**: Identify 2-3 most actionable AI developments.

**Dependencies**:
- `getAnthropicClient()`
- `getAudienceDescription()`
- `getDateRangeDescription()`
- `webSearchTool`
- `processToolCall()`

**Model Configuration**:
- Model: `claude-sonnet-4-20250514`
- Max tokens: 2048
- Tools: [webSearchTool]
- Max iterations: 2

**EXACT System Prompt** (PRESERVE):
```
You are a seasoned technical implementation consultant who translates new AI developments into actionable how-to guides. Your gift is identifying what's newly possible and explaining exactly how to implement it, step-by-step. You never write passive news summaries—you write implementation guides with specific tools, clear steps, and measurable outcomes. Think like someone who writes for Hacker News "Show HN" posts or technical tutorial blogs—every insight must be immediately actionable.
```

**Format Requirements**:
- How-To formatted titles required
- Implementation-focused summaries with:
  - Specific tools/libraries/models
  - Key implementation steps
  - Expected outcome
  - Why relevant NOW

---

### 9. `/api/generateTrendingTopicsWithSources` (POST)

**Purpose**: Identify trends from provided real sources.

**Dependencies**:
- `getAnthropicClient()`
- `getAudienceDescription()`
- `webSearchTool`
- `processToolCall()`

**Model Configuration**:
- Model: `claude-haiku-4-5-20251001`
- Max tokens: 2048
- Tools: [webSearchTool]
- Max iterations: 2

**EXACT System Prompt** (PRESERVE):
```
You are an AI news analyst specializing in identifying trending AI developments from real sources. Your task is to analyze provided trending sources and summarize the most relevant developments for specific audiences. The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object.
```

---

### 10. `/api/generateImage` (POST)

**Purpose**: Generate images via Stability AI.

**Dependencies**:
- `apiKeyDbService.getApiKey()`
- Stability AI API

**Request Body**:
```typescript
{
  prompt: string;
  imageStyle?: string;
}
```

**API Configuration**:
- Endpoint: `https://api.stability.ai/v2beta/stable-image/generate/core`
- Output format: PNG
- Aspect ratio: 1:1

**Image Style Map** (PRESERVE EXACTLY):
```typescript
{
  photorealistic: "photorealistic",
  vector: "vector illustration",
  watercolor: "watercolor painting",
  pixel: "pixel art",
  minimalist: "minimalist line art",
  oilPainting: "oil painting",
  cyberpunk: "cyberpunk neon-lit futuristic",
  abstract: "abstract non-representational art",
  isometric: "isometric 3D perspective",
}
```

---

## Service Dependencies

### sourceFetchingService.ts
- Fetches from 6 sources in parallel: GDELT, ArXiv, HackerNews, Reddit, GitHub, Dev.to
- Used by: `generateEnhancedNewsletter`, `fetchMultiSources`
- Must NOT be modified during migration

### articleExtractorService.ts
- Uses `@extractus/article-extractor`
- Functions: `extractMultipleArticles()`, `buildSourceContext()`
- Used by: `generateEnhancedNewsletter`
- Must NOT be modified during migration

### audienceGenerationService.ts
- Uses Claude Haiku for config generation
- Functions: `generateAudienceConfig()`, `getDefaultAudiences()`, `getAudiencePromptDescription()`
- Used by: `generateAudienceConfig`, `generateEnhancedNewsletter`
- Must NOT be modified during migration

### newsletterDbService.ts
- SQLite persistence
- Functions: `saveNewsletter()`, `saveEnhancedNewsletter()`
- Used by: `generateNewsletter`, `generateEnhancedNewsletter`
- Must NOT be modified during migration

---

## Agentic Loop Logic

**Constant**: `MAX_SEARCH_ITERATIONS = 2`

**Loop Pattern** (used in 4 endpoints):
```typescript
// Handle tool calls with iteration cap
let iterations = 0;
while (response.stop_reason === "tool_use" && iterations < MAX_SEARCH_ITERATIONS) {
  iterations++;
  console.log(`[Endpoint] Agentic loop iteration ${iterations}/${MAX_SEARCH_ITERATIONS}`);

  const toolUseBlocks = response.content.filter(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUseBlocks.length === 0) break;

  // Add assistant message
  messages.push({ role: "assistant", content: response.content });

  // Process all tool calls
  const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];
  for (const toolUseBlock of toolUseBlocks) {
    const toolResult = await processToolCall(
      toolUseBlock.name,
      toolUseBlock.input as Record<string, string>
    );
    toolResultContent.push({
      type: "tool_result",
      tool_use_id: toolUseBlock.id,
      content: toolResult,
    });
  }

  // Add user message with tool results
  messages.push({ role: "user", content: toolResultContent });

  // Continue conversation
  response = await client.messages.create({...});
}
```

**Force Final Response Pattern** (when max iterations reached):
```typescript
if (iterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
  console.log(`[Endpoint] Reached max iterations, forcing final response`);

  const toolUseBlocks = response.content.filter(...);
  messages.push({ role: "assistant", content: response.content });

  // Add tool_result for each tool_use (required by API)
  // Plus text instruction to generate final response
  messages.push({
    role: "user",
    content: [
      ...toolUseBlocks.map(block => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: "[Max iterations reached]",
      })),
      { type: "text" as const, text: "Now please generate the [output] based on the search results." }
    ],
  });

  // Final call WITHOUT tools to force text output
  response = await client.messages.create({
    ...config,
    // NO tools parameter
  });
}
```

---

## Data Flow Diagrams

### generateNewsletter Flow
```
Request → Parse params
       → getAudienceDescription()
       → getFlavorInstructions()
       → getDateRangeDescription()
       → Build userMessage with all injections
       → Claude API call (with webSearchTool)
       → Agentic loop (max 2 iterations)
           → processToolCall() → performWebSearch() → Brave API
       → Force final response if needed
       → Parse JSON
       → sanitizeNewsletter()
       → newsletterDbService.saveNewsletter()
       → Response with text and ID
```

### generateEnhancedNewsletter Flow
```
Request → Parse params
       → Collect keywords/subreddits/arxiv from audiences
       → sourceFetchingService.fetchAllSources()
           → GDELT, ArXiv, HN, Reddit, GitHub, Dev.to (parallel)
       → articleExtractorService.extractMultipleArticles()
       → articleExtractorService.buildSourceContext()
       → audienceGenerationService.getAudiencePromptDescription()
       → Claude API call (no tools)
       → Parse JSON
       → Override promptOfTheDay if provided
       → newsletterDbService.saveEnhancedNewsletter()
       → Response with newsletter and sources
```

---

## Preservation Checklist

### System Prompts (EXACT TEXT - NO CHANGES)
- [ ] generateCompellingTrendingContent system prompt
- [ ] generateNewsletter system prompt
- [ ] generateEnhancedNewsletter system prompt
- [ ] generateTopicSuggestions system prompt
- [ ] generateTrendingTopics system prompt
- [ ] generateTrendingTopicsWithSources system prompt

### User Message Templates (ALL SECTIONS - NO CHANGES)
- [ ] Anti-AI writing instructions
- [ ] Embrace instructions
- [ ] Domain-specific applications (4 domains)
- [ ] RECENCY REQUIREMENT (60-day window)
- [ ] ACTIONABILITY REQUIREMENTS (5 items)
- [ ] SOURCE REQUIREMENTS
- [ ] HTML `<a>` tag instructions
- [ ] JSON output structures
- [ ] searchGuidance constant

### Model Configurations (EXACT VALUES)
- [ ] claude-haiku-4-5-20251001 for: generateCompellingTrendingContent, generateTrendingTopicsWithSources
- [ ] claude-sonnet-4-20250514 for: generateNewsletter, generateEnhancedNewsletter, generateTopicSuggestions, generateTrendingTopics
- [ ] Max tokens: 3000, 4096, 2048 as specified
- [ ] MAX_SEARCH_ITERATIONS = 2

### Agentic Loop Logic (EXACT PATTERN)
- [ ] Iteration cap check
- [ ] Tool use block extraction
- [ ] Message history management
- [ ] Tool result formatting
- [ ] Force final response pattern

### Post-Processing (EXACT LOGIC)
- [ ] sanitizeNewsletter() for emojis
- [ ] Auto-save to SQLite
- [ ] ID generation pattern
- [ ] JSON parsing with fallback

### Image Style Map (EXACT STRINGS)
- [ ] All 9 style mappings preserved
