/**
 * Enhanced Newsletter Generator Service
 *
 * V2 newsletter format with multi-source fetching and audience sections.
 *
 * @module domains/generation/services/enhancedGenerator
 *
 * ## Original Location
 * - server.ts lines 1063-1253
 *
 * ## PRESERVATION NOTE - CRITICAL
 * ALL prompts, configurations, and logic in this file are EXACT copies from server.ts.
 * Do NOT modify any prompt text, model configurations, or data flow logic.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../../../external/claude';
import * as sourceFetchingService from '../../../services/sourceFetchingService';
import * as articleExtractorService from '../../../services/articleExtractorService';
import * as audienceGenerationService from '../../../services/audienceGenerationService';
import * as newsletterDbService from '../../../services/newsletterDbService';
import * as personaDbService from '../../../services/personaDbService';
import type { AudienceConfig, EnhancedNewsletter, PromptOfTheDay, WriterPersona } from '../../../../types';

/**
 * Enhanced newsletter generation request parameters
 */
export interface GenerateEnhancedNewsletterParams {
  topics: string[];
  audiences: AudienceConfig[];
  imageStyle?: string;
  promptOfTheDay?: PromptOfTheDay | null;
  personaId?: string;
}

/**
 * Enhanced newsletter generation result
 */
export interface GenerateEnhancedNewsletterResult {
  success: boolean;
  newsletter?: EnhancedNewsletter;
  sources?: sourceFetchingService.FetchSourcesResult['sources'];
  error?: string;
}

/**
 * Build persona instructions for enhanced newsletter generation
 *
 * Phase 12.0: Integrates writer persona voice into enhanced newsletter generation
 */
function buildPersonaInstructions(persona: WriterPersona | null): string {
  if (!persona) return '';

  const parts: string[] = [
    `WRITER PERSONA - CRITICAL:`,
    `Adopt the voice and style of "${persona.name}".`,
  ];

  if (persona.tagline) {
    parts.push(`Core identity: "${persona.tagline}"`);
  }
  if (persona.expertise) {
    parts.push(`Areas of expertise: ${persona.expertise}`);
  }
  if (persona.values) {
    parts.push(`Core values: ${persona.values}`);
  }
  if (persona.writingStyle) {
    parts.push(`Writing style: ${persona.writingStyle}`);
  }
  if (persona.signatureElements && persona.signatureElements.length > 0) {
    parts.push(`Signature phrases to use naturally: ${persona.signatureElements.join(', ')}`);
  }

  parts.push('');
  parts.push('Your writing should authentically reflect this persona\'s voice throughout the entire newsletter, including the editor\'s note, section content, and conclusion.');

  return '\n' + parts.join('\n');
}

/**
 * EXACT System Prompt from server.ts lines 1134-1176
 * DO NOT MODIFY
 */
const ENHANCED_SYSTEM_PROMPT = `You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools in their work.

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
{
  "editorsNote": { "message": "string" },
  "toolOfTheDay": { "name": "string", "url": "string", "whyNow": "string", "quickStart": "string" },
  "audienceSections": [{
    "audienceId": "string",
    "audienceName": "string",
    "title": "string",
    "whyItMatters": "string",
    "content": "string (can include <a href='url'>text</a> links)",
    "practicalPrompt": { "scenario": "string", "prompt": "string", "isToolSpecific": boolean },
    "cta": { "text": "string", "action": "copy_prompt" },
    "sources": [{ "url": "string", "title": "string" }],
    "imagePrompt": "string - A descriptive prompt for AI image generation showing this concept visually"
  }],
  "promptOfTheDay": {
    "title": "string - A catchy title for the featured prompt technique",
    "summary": "string - 2-3 sentences explaining what this prompt technique does and why it's valuable",
    "examplePrompts": ["string - 3 example variations of how to use this prompt technique"],
    "promptCode": "string - The full structured prompt with XML-like tags (e.g., <role>...</role><context>...</context><task>...</task>)"
  },
  "conclusion": "string",
  "subject": "string - A compelling email subject line that appeals to ALL audiences, not biased toward any single field. NO emojis or symbols."
}`;

/**
 * Build user message - EXACT copy from server.ts lines 1178-1196
 * DO NOT MODIFY any text in this function
 * Phase 12.0: Added personaInstructions parameter (appended after main instructions)
 */
function buildUserMessage(
  audienceDescriptions: string,
  topics: string[],
  sourceContext: string,
  audienceCount: number,
  personaInstructions?: string
): string {
  return `Generate an enhanced newsletter for these audiences:

AUDIENCES:
${audienceDescriptions}

TOPICS TO COVER:
${topics.join(', ')}

SOURCE CONTENT (use these for citations):
${sourceContext}
${personaInstructions || ''}

Generate the newsletter JSON now. Remember:
- ONE section per audience (${audienceCount} sections total)
- Cite sources with URLs from the SOURCE CONTENT above
- Include practical, ready-to-use prompts that readers can copy directly
- Make "Why It Matters" specific and compelling for each audience
- Include an imagePrompt for each section - a descriptive prompt for AI image generation
- Include a compelling subject line for the email
- Include promptOfTheDay with a useful prompt technique - include title, summary, 3 examplePrompts variations, and full promptCode with XML-style tags like <role>, <context>, <task>, etc.`;
}

/**
 * Generate enhanced newsletter with multi-source fetching
 *
 * EXACT logic from server.ts lines 1063-1253
 * DO NOT MODIFY the data flow or source fetching pattern
 */
export async function generateEnhancedNewsletter(
  params: GenerateEnhancedNewsletterParams
): Promise<GenerateEnhancedNewsletterResult> {
  try {
    const { topics, audiences, imageStyle, promptOfTheDay: userPromptOfTheDay, personaId } = params;

    console.log('[EnhancedNewsletter] Starting generation for audiences:', audiences.map(a => a.name));
    if (userPromptOfTheDay) {
      console.log('[EnhancedNewsletter] User-supplied promptOfTheDay:', userPromptOfTheDay.title);
    }

    // Phase 12.0: Look up persona if provided
    let persona: WriterPersona | null = null;
    if (personaId) {
      persona = personaDbService.getPersonaById(personaId);
      console.log(`[EnhancedNewsletter] Using persona: ${persona?.name || 'not found (id: ' + personaId + ')'}`);
    }

    // Step 1: Collect keywords and config from all audiences - EXACT logic from server.ts
    const allKeywords: string[] = [];
    const allSubreddits: string[] = [];
    const allArxivCategories: string[] = [];

    for (const audience of audiences) {
      if (audience.generated) {
        allKeywords.push(...(audience.generated.relevance_keywords || []));
        allSubreddits.push(...(audience.generated.subreddits || []));
        allArxivCategories.push(...(audience.generated.arxiv_categories || []));
      }
    }

    // Add topics to keywords
    allKeywords.push(...topics);

    // Deduplicate - EXACT pattern from server.ts
    const uniqueKeywords = [...new Set(allKeywords)].slice(0, 10);
    const uniqueSubreddits = [...new Set(allSubreddits)].slice(0, 5);
    const uniqueArxivCategories = [...new Set(allArxivCategories)].slice(0, 4);

    // Step 2: Fetch sources from multiple APIs
    console.log('[EnhancedNewsletter] Fetching sources...');
    const sourceResult = await sourceFetchingService.fetchAllSources({
      keywords: uniqueKeywords,
      subreddits: uniqueSubreddits,
      arxivCategories: uniqueArxivCategories,
      limit: 5,
    });
    console.log(`[EnhancedNewsletter] Fetched ${sourceResult.totalCount} articles`);

    // Step 3: Extract article content
    console.log('[EnhancedNewsletter] Extracting article content...');
    const extractionResult = await articleExtractorService.extractMultipleArticles(
      sourceResult.articles,
      { maxArticles: 10, maxContentLength: 3000, delayMs: 200 }
    );
    console.log(`[EnhancedNewsletter] Extracted ${extractionResult.successCount} articles`);

    // Step 4: Build source context for Claude
    const sourceContext = articleExtractorService.buildSourceContext(
      extractionResult.extracted,
      { maxTotalLength: 25000, maxPerArticle: 2000 }
    );

    // Step 5: Build audience descriptions
    const audienceDescriptions = audienceGenerationService.getAudiencePromptDescription(audiences);

    // Step 5.5: Build persona instructions (Phase 12.0)
    const personaInstructions = buildPersonaInstructions(persona);

    // Step 6: Generate enhanced newsletter with Claude
    console.log('[EnhancedNewsletter] Generating newsletter with Claude...');

    const userMessage = buildUserMessage(
      audienceDescriptions,
      topics,
      sourceContext,
      audiences.length,
      personaInstructions
    );

    const response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: ENHANCED_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response - EXACT logic from server.ts lines 1214-1218
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const newsletter: EnhancedNewsletter = JSON.parse(jsonText);

    // If user supplied a promptOfTheDay, use it instead of the LLM-generated one
    // EXACT logic from server.ts lines 1221-1225
    if (userPromptOfTheDay) {
      newsletter.promptOfTheDay = userPromptOfTheDay;
      console.log('[EnhancedNewsletter] Using user-supplied promptOfTheDay:', userPromptOfTheDay.title);
    }

    // Generate a subject from the content - EXACT fallback logic from server.ts lines 1227-1229
    newsletter.subject = newsletter.audienceSections[0]?.title ||
      `AI Tools Update: ${newsletter.toolOfTheDay?.name || 'This Week'}`;

    // Auto-save to SQLite - EXACT pattern from server.ts lines 1231-1243
    const newsletterId = `enl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      newsletterDbService.saveEnhancedNewsletter(
        { ...newsletter, id: newsletterId },
        topics,
        { audience: audiences.map(a => a.id), imageStyle }
      );
      console.log(`[EnhancedNewsletter] Saved to SQLite: ${newsletterId}`);
      newsletter.id = newsletterId;
    } catch (saveError) {
      console.error('[EnhancedNewsletter] Failed to save:', saveError);
      // Continue even if save fails - newsletter was still generated
    }

    console.log('[EnhancedNewsletter] Generation complete');
    return {
      success: true,
      newsletter,
      sources: sourceResult.sources,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating enhanced newsletter:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
