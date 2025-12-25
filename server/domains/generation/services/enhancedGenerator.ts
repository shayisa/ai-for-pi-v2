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
 * ## Phase 15: Anti-Hallucination Update
 * Added pre-generation validation and topic-source matching to prevent
 * content hallucination. Topics are validated via web search, and the
 * prompt includes explicit topic-source mappings.
 *
 * ## Preserved Functionality
 * - Multi-source fetching (6 APIs)
 * - Article extraction
 * - Phase 12.0 persona support
 * - Phase 14 tone/flavor integration
 * - 250+ word requirements
 * - Auto-save to SQLite
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../../../external/claude';
import * as sourceFetchingService from '../../../services/sourceFetchingService';
import * as articleExtractorService from '../../../services/articleExtractorService';
import * as audienceGenerationService from '../../../services/audienceGenerationService';
import * as newsletterDbService from '../../../services/newsletterDbService';
import * as personaDbService from '../../../services/personaDbService';
import type { AudienceConfig, EnhancedNewsletter, PromptOfTheDay, WriterPersona } from '../../../../types';

// Phase 14: Import helpers for tone and flavor processing
import { getToneInstructions } from '../helpers/toneHelpers';
import { getFlavorInstructions, getFlavorFormattingRules } from '../helpers/flavorHelpers';

// Phase 15: Import pre-generation pipeline for anti-hallucination
import { runPreGenerationChecks } from './preGenerationPipeline';
import type { TopicValidationResult } from '../../../services/topicValidationService';

/**
 * Enhanced newsletter generation request parameters
 * Phase 14: Added tone and flavors for quality fix
 */
export interface GenerateEnhancedNewsletterParams {
  topics: string[];
  audiences: AudienceConfig[];
  imageStyle?: string;
  promptOfTheDay?: PromptOfTheDay | null;
  personaId?: string;
  tone?: string;      // Phase 14: User-selected tone
  flavors?: string[]; // Phase 14: User-selected flavors
}

/**
 * Enhanced newsletter generation result
 * Phase 15: Added validation fields for anti-hallucination feedback
 */
export interface GenerateEnhancedNewsletterResult {
  success: boolean;
  newsletter?: EnhancedNewsletter;
  sources?: sourceFetchingService.FetchSourcesResult['sources'];
  error?: string;
  /** Phase 15: Topic validation results (when generation blocked) */
  validationResults?: TopicValidationResult[];
  /** Phase 15: Topics that failed validation or have no sources */
  invalidTopics?: string[];
  /** Phase 15: Suggested alternative topics */
  suggestions?: string[];
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
 * Build dynamic system prompt for enhanced newsletter
 *
 * Phase 14: Replaces static ENHANCED_SYSTEM_PROMPT with dynamic version that
 * includes tone instructions, flavor formatting rules, and content depth requirements.
 *
 * @param tone - Selected tone (e.g., 'confident', 'warm', 'witty')
 * @param toneInstructions - Research-backed tone execution rules
 * @param flavorInstructions - Style instructions (humor, jargon, etc.)
 * @param flavorFormattingRules - How to format content based on flavors
 * @returns Complete system prompt string
 */
function buildEnhancedSystemPrompt(
  tone: string,
  toneInstructions: string,
  flavorInstructions: string,
  flavorFormattingRules: string
): string {
  return `You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools in their work.

Your task is to generate a newsletter in the ENHANCED FORMAT with:
1. Editor's Note - Personal, conversational opening that sets the tone (3-4 sentences minimum)
2. Tool of the Day - One standout tool featured prominently from the sources
3. Audience Sections - ONE section per audience with SUBSTANTIVE content
4. Practical Prompts - Ready-to-use AI prompts for each section
5. CTAs - Clear calls to action
6. Source Citations - Every claim cites its source URL
7. Prompt of the Day - A featured prompt technique with title, summary, example variations, and full structured promptCode with XML-like tags

TONE REQUIREMENTS - CRITICAL:
The primary tone for this newsletter is "${tone}". Your writing MUST authentically reflect this tone.
${toneInstructions}
${flavorInstructions}

CONTENT LENGTH REQUIREMENTS - STRICTLY ENFORCED:

CRITICAL: 250 words is approximately 4-5 substantial paragraphs. A single paragraph of 3-4 sentences is only ~50-80 words. You MUST write MUCH more content than you think.

For reference, THIS calibration text is exactly 50 words: "The quick brown fox jumps over the lazy dog. This sentence demonstrates typical paragraph length. Professional newsletters require substantive depth that goes beyond surface-level summaries. Each section must provide real analysis, concrete examples, practical applications, and actionable takeaways for the reader."

SECTION CONTENT REQUIREMENTS (each audienceSection.content field):
- MINIMUM 250 words (approximately 4-5 full paragraphs)
- Structure: Introduction paragraph + 2-3 body paragraphs with details + conclusion/application paragraph
- Include: What it is, why it matters NOW, how it works, specific use cases, practical next steps
- A single short paragraph is UNACCEPTABLE - you must write multiple substantive paragraphs
- Count your paragraphs: if you only have 1-2 paragraphs, you have NOT met the requirement

OTHER LENGTH REQUIREMENTS:
- Editor's Note: Minimum 60 words (about 4-5 sentences)
- Why It Matters: Minimum 3 full sentences explaining SPECIFIC relevance to that audience's daily work
- Tool of the Day whyNow: Minimum 3 full sentences on timeliness
- Conclusion: Minimum 60 words with memorable takeaway

FAILURE TO MEET THESE MINIMUMS WILL RESULT IN REJECTION. When in doubt, write MORE.

${flavorFormattingRules}

SUBJECT LINE REQUIREMENTS - CRITICAL:
The subject line MUST be UNIQUE and reflect THIS newsletter's specific topics.

HOW TO CREATE A GOOD SUBJECT LINE:
1. Look at the TOPICS provided - identify a UNIFYING THEME across them
2. Express that theme in a way that appeals to ALL audiences
3. Be CREATIVE and SPECIFIC to this issue - never generic

BAD (too narrow - only one field):
- "Video Generation for 3D Reconstruction" ❌
- "Forensic Authentication Tools" ❌

BAD (too generic - could be any newsletter):
- "AI Tools This Week" ❌
- "Professional Workflows Update" ❌

GOOD (thematic + universal):
If topics are about detection, automation, and analysis → "Detection, Automation, Analysis: AI's Triple Threat"
If topics are about archaeology, forensics, and business → "Where Science Meets Business: AI Bridges the Gap"
If topics involve new model releases → "Claude, Gemini, and Beyond: This Week's AI Powerhouses"

RULES:
- Find the UNIFYING THEME of the selected topics
- Create a UNIQUE subject that could ONLY describe THIS newsletter
- Appeal to ALL audiences equally
- NO emojis, under 60 characters

SOURCE GROUNDING - CRITICAL:
You have been provided VALIDATED topic-source mappings in the user message.
- Each topic lists ONLY its relevant, verified sources
- Use ONLY those sources for information about that topic
- Do NOT add information not found in the sources
- If sources don't cover an aspect of a topic, acknowledge the gap
- For topics marked "NO SOURCES FOUND", note "No current information available"

SOURCE DIVERSITY - CRITICAL (Phase 15.1):
If "SOURCE ALLOCATION PER AUDIENCE" is provided in the user message:
- You MUST use ONLY the sources explicitly assigned to each audience
- DO NOT cite sources from the general source context unless assigned
- Each audience section MUST cite at least one of its assigned sources
- This is MANDATORY for verification - unauthorized sources will be flagged

When multiple sources are available for a topic:
- Each audience section MUST cite DIFFERENT sources when possible
- Do NOT use the same source URL for all audience sections
- Distribute sources across audiences to show different perspectives
- If only one source matches, you may cite it, but frame the content differently for each audience

RULES:
- Every factual claim MUST cite its source URL from the provided sources
- Each audience section MUST have a "Why It Matters" explanation specific to that audience
- Practical prompts should be immediately usable - copy-paste ready with [VARIABLE] placeholders
- Do NOT use emojis in titles or section headers
- Each section must provide REAL VALUE - not just surface-level descriptions

AUDIENCE-SECTION MAPPING - CRITICAL:
You will receive a list of AUDIENCES in the user message. You MUST create EXACTLY ONE section in audienceSections for EACH audience provided. If 4 audiences are listed, you MUST generate 4 audienceSections. If 3 audiences, then 3 sections. NO exceptions.

Each audienceSection MUST:
- Use the EXACT audienceId and audienceName from the provided audience list
- Cover the selected TOPICS in a way that is specifically relevant to THAT audience
- Have completely different content tailored to that specific audience's needs
- Cite DIFFERENT sources than other audience sections when multiple sources are available

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "editorsNote": { "message": "string - minimum 60 words" },
  "toolOfTheDay": { "name": "string", "url": "string", "whyNow": "string - minimum 3 sentences", "quickStart": "string - step-by-step instructions" },
  "audienceSections": [
    {
      "audienceId": "MUST match an audience ID from the provided list",
      "audienceName": "MUST match the audience name from the provided list",
      "title": "string - compelling title specific to this audience's perspective",
      "whyItMatters": "string - minimum 3 sentences explaining relevance to THIS SPECIFIC audience's daily work",
      "content": "string - MINIMUM 250 WORDS (4-5 paragraphs) with substantive analysis tailored to THIS audience (can include <a href='url'>text</a> links)",
      "practicalPrompt": { "scenario": "string - use case specific to this audience", "prompt": "string - copy-paste ready with [VARIABLE] placeholders", "isToolSpecific": boolean },
      "cta": { "text": "string", "action": "copy_prompt" },
      "sources": [{ "url": "string", "title": "string" }],
      "imagePrompt": "string - A descriptive prompt for AI image generation showing this concept for this audience"
    }
    // REPEAT for EACH audience - if 4 audiences provided, this array MUST have 4 objects
  ],
  "promptOfTheDay": {
    "title": "string - A catchy title for the featured prompt technique",
    "summary": "string - 2-3 sentences explaining what this prompt technique does and why it's valuable",
    "examplePrompts": ["string - 3 example variations of how to use this prompt technique"],
    "promptCode": "string - The full structured prompt with XML-like tags (e.g., <role>...</role><context>...</context><task>...</task>)"
  },
  "conclusion": "string - minimum 60 words with memorable takeaway",
  "subject": "string - UNIVERSAL subject line (e.g., 'AI Tools Reshaping Professional Workflows'). Do NOT mention specific topics like '3D reconstruction' or 'forensics'. Must appeal to ALL audiences equally."
}`
}

/**
 * Build user message for enhanced newsletter generation
 *
 * Phase 14: Updated with explicit audience-section mapping, topic coverage, and content depth.
 * Phase 12.0: Added personaInstructions parameter
 * Phase 15: Added topicSourceContext for anti-hallucination
 * Phase 15.1: Added allocationContext for source diversity enforcement
 */
function buildUserMessage(
  audiences: AudienceConfig[],
  topics: string[],
  sourceContext: string,
  topicSourceContext: string,
  personaInstructions?: string,
  allocationContext?: string
): string {
  // Number topics for explicit coverage tracking
  const numberedTopics = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');

  // Build explicit audience list with IDs
  const audienceList = audiences.map((a, i) => {
    const persona = a.generated?.persona || a.description;
    return `${i + 1}. ID: "${a.id}" | Name: "${a.name}" | Description: ${persona}`;
  }).join('\n');

  return `Generate an enhanced newsletter for these ${audiences.length} audiences:

AUDIENCES (you MUST create exactly ${audiences.length} audienceSections - one for EACH audience below):
${audienceList}

TOPICS TO COVER:
${numberedTopics}

CRITICAL: You MUST create EXACTLY ${audiences.length} audienceSections in your response. Each section MUST use the exact audienceId and audienceName from the list above.

VALIDATED TOPIC-SOURCE MAPPINGS (Phase 15 Anti-Hallucination):
The following shows which sources to use for each topic. ONLY write about topics using their matched sources.
${topicSourceContext}
${allocationContext ? `
SOURCE ALLOCATION PER AUDIENCE (Phase 15.1 - SOURCE DIVERSITY ENFORCEMENT):
${allocationContext}
` : ''}
ALL AVAILABLE SOURCE CONTENT (for reference and citations):
${sourceContext}
${personaInstructions || ''}

Generate the newsletter JSON now. REQUIREMENTS:

AUDIENCE-SECTION REQUIREMENT (MANDATORY):
- You MUST generate EXACTLY ${audiences.length} objects in the audienceSections array
- Each object MUST have audienceId matching one of: ${audiences.map(a => `"${a.id}"`).join(', ')}
- Each object MUST have audienceName matching one of: ${audiences.map(a => `"${a.name}"`).join(', ')}
- EVERY audience above MUST have its own section - do NOT skip any audience

CONTENT LENGTH REQUIREMENT (MANDATORY):
- Each section content field MUST be 250+ words (4-5 full paragraphs)
- Structure: Intro paragraph → 2-3 body paragraphs → Application paragraph
- A single paragraph is ~50-80 words - you need 4-5 paragraphs per section

TOPIC-SOURCE REQUIREMENT (MANDATORY - Phase 15):
- For each topic, use ONLY the sources listed in VALIDATED TOPIC-SOURCE MAPPINGS above
- If a topic shows "Status: NO SOURCES FOUND", note "No current information available for [topic]"
- Do NOT make claims about a topic that aren't supported by its matched sources
- Cite every fact with the source URL from the matched sources

SUBJECT LINE REQUIREMENT (MANDATORY):
- Must be UNIQUE to THIS newsletter - reflect the UNIFYING THEME of these specific topics
- Appeal to ALL ${audiences.length} audiences equally
- Do NOT be generic (avoid "AI Tools This Week" or "Professional Updates")
- Do NOT be narrow (avoid mentioning just one topic or field)
- Find the COMMON THREAD between these topics: ${topics.join(', ')}
- Create a subject that could ONLY describe this specific newsletter

OTHER:
- Why It Matters: MINIMUM 3 sentences specific to that audience
- Editor's Note: MINIMUM 60 words
- Conclusion: MINIMUM 60 words
- Cite sources with URLs from SOURCE CONTENT
- Include promptOfTheDay with title, summary, 3 examplePrompts, and promptCode

REMEMBER: Write MUCH MORE than you think you need. 250 words is 4-5 paragraphs, not 1.`;
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
    // Phase 14: Extract tone and flavors with defaults
    const {
      topics,
      audiences,
      imageStyle,
      promptOfTheDay: userPromptOfTheDay,
      personaId,
      tone = 'confident',  // Default tone
      flavors = []         // Default empty flavors
    } = params;

    console.log('[EnhancedNewsletter] Starting generation for audiences:', audiences.map(a => a.name));
    console.log(`[EnhancedNewsletter] Tone: ${tone}, Flavors: ${flavors.join(', ') || 'none'}`);
    if (userPromptOfTheDay) {
      console.log('[EnhancedNewsletter] User-supplied promptOfTheDay:', userPromptOfTheDay.title);
    }

    // Phase 12.0: Look up persona if provided
    let persona: WriterPersona | null = null;
    if (personaId) {
      persona = personaDbService.getPersonaById(personaId);
      console.log(`[EnhancedNewsletter] Using persona: ${persona?.name || 'not found (id: ' + personaId + ')'}`);
    }

    // Phase 14: Generate tone and flavor instructions
    const toneInstructions = getToneInstructions(tone);
    const flavorInstructions = getFlavorInstructions(flavors);
    const flavorFormattingRules = getFlavorFormattingRules(flavors);

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

    // Phase 15: Pre-generation validation and topic-source matching
    console.log('[EnhancedNewsletter] Running pre-generation validation...');
    const preGenResult = await runPreGenerationChecks({
      topics,
      audiences,
      existingSources: sourceResult.articles,
      skipValidation: false,
      skipEnrichment: false,
    });

    if (!preGenResult.canProceed) {
      console.log(`[EnhancedNewsletter] Pre-generation blocked: ${preGenResult.blockReason}`);
      return {
        success: false,
        error: preGenResult.blockReason,
        validationResults: preGenResult.validatedTopics,
        invalidTopics: preGenResult.invalidTopics,
        suggestions: preGenResult.suggestions,
      };
    }

    console.log(`[EnhancedNewsletter] Pre-generation passed in ${preGenResult.pipelineTimeMs}ms`);
    if (preGenResult.invalidTopics && preGenResult.invalidTopics.length > 0) {
      console.log(`[EnhancedNewsletter] Warning: Some topics have no sources: ${preGenResult.invalidTopics.join(', ')}`);
    }

    // Step 5: Build persona instructions (Phase 12.0)
    const personaInstructions = buildPersonaInstructions(persona);

    // Phase 15: Filter out fictional/invalid topics before passing to Claude
    // Only pass topics that were validated as real (isValid=true OR not confidence='none')
    const validTopics = topics.filter((topic) => {
      const validation = preGenResult.validatedTopics.find((v) => v.topic === topic);
      // Keep topic if: no validation found (assume valid) OR isValid=true OR confidence is not 'none'
      return !validation || validation.isValid || validation.confidence !== 'none';
    });

    if (validTopics.length === 0) {
      // This shouldn't happen since we check in pre-gen, but safety check
      return {
        success: false,
        error: 'No valid topics remaining after filtering fictional ones',
        validationResults: preGenResult.validatedTopics,
        invalidTopics: topics,
      };
    }

    console.log(`[EnhancedNewsletter] Filtered topics: ${topics.length} -> ${validTopics.length} valid`);
    if (validTopics.length < topics.length) {
      const filteredOut = topics.filter((t) => !validTopics.includes(t));
      console.log(`[EnhancedNewsletter] Removed fictional topics: ${filteredOut.join(', ')}`);
    }

    // Step 6: Generate enhanced newsletter with Claude
    console.log('[EnhancedNewsletter] Generating newsletter with Claude...');
    console.log(`[EnhancedNewsletter] Audiences (${audiences.length}):`, audiences.map(a => a.name));
    console.log(`[EnhancedNewsletter] Topics (${validTopics.length}):`, validTopics);

    // Phase 14: Pass full audiences array for explicit ID/name mapping
    // Phase 15: Include topicSourceContext for anti-hallucination, use FILTERED topics
    // Phase 15.1: Include allocationContext for source diversity enforcement
    const userMessage = buildUserMessage(
      audiences,
      validTopics,  // Use filtered valid topics only
      sourceContext,
      preGenResult.topicSourceContext,
      personaInstructions,
      preGenResult.allocationContext  // Phase 15.1: Source diversity allocations
    );

    // Phase 14: Build dynamic system prompt with tone/flavor integration
    const systemPrompt = buildEnhancedSystemPrompt(
      tone,
      toneInstructions,
      flavorInstructions,
      flavorFormattingRules
    );

    const response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,  // Phase 14: Increased for longer, more substantive content
      system: systemPrompt,
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

    // Phase 14: Only use fallback if subject is missing - respect LLM-generated subject
    // The prompt now emphasizes balanced subject lines for ALL audiences
    if (!newsletter.subject || newsletter.subject.trim() === '') {
      // Fallback includes all audience names for balance
      const audienceNames = audiences.map(a => a.name).join(' & ');
      newsletter.subject = `AI Tools for ${audienceNames}: ${newsletter.toolOfTheDay?.name || 'This Week\'s Highlights'}`;
      console.log('[EnhancedNewsletter] Using fallback subject line');
    }

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
