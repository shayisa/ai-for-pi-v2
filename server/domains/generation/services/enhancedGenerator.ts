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
import type { SourceArticle } from '../../../services/sourceFetchingService';
import * as articleExtractorService from '../../../services/articleExtractorService';
import type { ExtractedArticle } from '../../../services/articleExtractorService';
import * as audienceGenerationService from '../../../services/audienceGenerationService';
import * as newsletterDbService from '../../../services/newsletterDbService';
import * as personaDbService from '../../../services/personaDbService';
import type { AudienceConfig, EnhancedNewsletter, PromptOfTheDay, WriterPersona, TopicWithAudienceId } from '../../../../types';

// Phase 14: Import helpers for tone and flavor processing
import { getToneInstructions } from '../helpers/toneHelpers';
import { getFlavorInstructions, getFlavorFormattingRules } from '../helpers/flavorHelpers';

// Phase 15: Import pre-generation pipeline for anti-hallucination
import { runPreGenerationChecks } from './preGenerationPipeline';
import type { TopicValidationResult } from '../../../services/topicValidationService';

// Phase 18: Import RAG service for Gemini File Search integration (optional)
import * as ragService from '../../../services/ragService';

// Phase 20: Import parallel generation from single audience generator
import {
  generateAudienceSectionsParallel,
  type SingleAudienceGenerationParams,
} from './singleAudienceSectionGenerator';
import type { SourceWithContent, EnhancedAudienceSection } from '../../../../types';

// =============================================================================
// Phase 20: Parallel Generation Types
// =============================================================================

/**
 * Shared newsletter elements generated after parallel section generation
 */
interface SharedElements {
  editorsNote: { message: string };
  toolOfTheDay: {
    name: string;
    url: string;
    whyNow: string;
    quickStart: string;
  };
  promptOfTheDay: {
    title: string;
    summary: string;
    examplePrompts: string[];
    promptCode: string;
  };
  conclusion: string;
  subject: string;
}

/**
 * Metrics for parallel generation performance tracking
 */
interface ParallelGenerationMetrics {
  totalTimeMs: number;
  parallelPhaseTimeMs: number;
  sharedElementsTimeMs: number;
  perAudience: Array<{ id: string; timeMs: number; success: boolean }>;
  parallelEfficiency: number; // Ratio of parallel time vs sequential estimate
}

/**
 * Enhanced newsletter generation request parameters
 * Phase 14: Added tone and flavors for quality fix
 * Phase 17: Updated topics to accept full objects with resource URLs
 */
export interface GenerateEnhancedNewsletterParams {
  /**
   * Topics can be either:
   * - string[] for backwards compatibility (legacy/manual input)
   * - TopicWithAudienceId[] for topics with pre-existing source URLs
   */
  topics: (string | TopicWithAudienceId)[];
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

PRIMARY SOURCE ENFORCEMENT - MANDATORY (Phase 19):
Some topics have a PRE-ATTACHED PRIMARY SOURCE in the user message. For these topics:
- The PRIMARY SOURCE **MUST** be cited as the main source in the article
- The article MUST reference content from the PRIMARY SOURCE URL
- Supporting sources may ONLY be cited if they DIRECTLY relate to the PRIMARY SOURCE
- Do NOT cite supporting sources that are tangentially related - they must be DIRECTLY relevant
- If the PRIMARY SOURCE is sufficient, do NOT add other sources
- Failure to cite the PRIMARY SOURCE is a CRITICAL ERROR

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
 * Phase 18: Added topic-audience routing - each topic goes ONLY to its tagged audience
 * Phase 18: Added ragContent for RAG-grounded facts (anti-hallucination)
 */
function buildUserMessage(
  audiences: AudienceConfig[],
  topics: TopicWithAudienceId[],  // Phase 18: Now accepts full topic objects
  sourceContext: string,
  topicSourceContext: string,
  personaInstructions?: string,
  allocationContext?: string,
  ragContent?: Map<string, string>  // Phase 18: RAG-retrieved content per topic
): string {
  // Phase 18: Build topic-audience mapping - each audience gets ONLY its topics
  const topicsByAudience = new Map<string, TopicWithAudienceId[]>();

  // Initialize map for all audiences
  for (const audience of audiences) {
    topicsByAudience.set(audience.id, []);
  }

  // Route each topic to its audience (or first audience if no audienceId)
  for (const topic of topics) {
    const targetAudienceId = topic.audienceId || audiences[0]?.id;
    if (topicsByAudience.has(targetAudienceId)) {
      topicsByAudience.get(targetAudienceId)!.push(topic);
    } else {
      // Topic has an audienceId not in our list - assign to first audience
      topicsByAudience.get(audiences[0]?.id)?.push(topic);
    }
  }

  // Build explicit audience list with their assigned topics
  // Phase 19: Include PRIMARY SOURCE for topics with attached resource URLs
  const audienceTopicMappings = audiences.map((a, i) => {
    const audienceTopics = topicsByAudience.get(a.id) || [];
    const topicList = audienceTopics.length > 0
      ? audienceTopics.map((t, j) => {
          const contextInfo = t.summary ? ` (${t.summary.substring(0, 100)}...)` : '';
          // Phase 19: Show PRIMARY SOURCE if topic has attached resource
          const primarySource = t.resource
            ? `\n       ⚠️ PRIMARY SOURCE (MUST CITE): ${t.resource}`
            : '';
          return `    ${j + 1}. "${t.title}"${contextInfo}${primarySource}`;
        }).join('\n')
      : '    (No specific topics assigned - generate content based on general sources)';

    const persona = a.generated?.persona || a.description;
    return `${i + 1}. AUDIENCE: "${a.name}" (ID: ${a.id})
   Description: ${persona}
   ASSIGNED TOPICS FOR THIS AUDIENCE ONLY:
${topicList}`;
  }).join('\n\n');

  // Phase 19: Build PRIMARY SOURCE reminder for topics with attached resources
  const topicsWithPrimarySources = topics.filter(t => t.resource);
  const primarySourceReminder = topicsWithPrimarySources.length > 0
    ? `
⚠️ PRIMARY SOURCE ENFORCEMENT (Phase 19):
The following topics have PRE-ATTACHED PRIMARY SOURCES that MUST be cited:
${topicsWithPrimarySources.map(t => `- Topic "${t.title}" → PRIMARY SOURCE: ${t.resource}`).join('\n')}

CRITICAL: For each topic above, the article MUST cite its PRIMARY SOURCE as the main reference.
Supporting sources are allowed ONLY if they DIRECTLY relate to the PRIMARY SOURCE.
`
    : '';

  // For subject line generation, list all topic titles
  const allTopicTitles = topics.map(t => t.title).join(', ');

  return `Generate an enhanced newsletter for these ${audiences.length} audiences:

AUDIENCE-TOPIC ASSIGNMENTS (Phase 18 - MANDATORY ROUTING):
Each audience section MUST write about ONLY its assigned topics. DO NOT include topics from other audiences.

${audienceTopicMappings}

CRITICAL ROUTING RULES:
- Each audience section MUST ONLY discuss the topics listed under "ASSIGNED TOPICS FOR THIS AUDIENCE ONLY"
- DO NOT mix topics between audiences - this is a strict isolation requirement
- If an audience has no assigned topics, create content using general sources relevant to that audience

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
${ragContent && ragContent.size > 0 ? `
RAG-RETRIEVED VERIFIED CONTENT (Phase 18 - Anti-Hallucination):
The following content was retrieved via semantic search from the indexed source articles.
Use this VERIFIED information when writing about each topic. Prefer RAG content over general knowledge.

${Array.from(ragContent.entries()).map(([topic, content]) =>
  `TOPIC: "${topic}"
VERIFIED CONTENT FROM SOURCES:
${content}
---`
).join('\n\n')}
` : ''}
Generate the newsletter JSON now. REQUIREMENTS:

AUDIENCE-SECTION REQUIREMENT (MANDATORY):
- You MUST generate EXACTLY ${audiences.length} objects in the audienceSections array
- Each object MUST have audienceId matching one of: ${audiences.map(a => `"${a.id}"`).join(', ')}
- Each object MUST have audienceName matching one of: ${audiences.map(a => `"${a.name}"`).join(', ')}
- EVERY audience above MUST have its own section - do NOT skip any audience

TOPIC ROUTING REQUIREMENT (MANDATORY - Phase 18):
- Each audience section MUST write about ONLY its assigned topics from the AUDIENCE-TOPIC ASSIGNMENTS above
- The "${audiences[0]?.name || 'first audience'}" section must ONLY discuss topics assigned to "${audiences[0]?.id || 'first'}"
- The "${audiences[1]?.name || 'second audience'}" section must ONLY discuss topics assigned to "${audiences[1]?.id || 'second'}"
- DO NOT cross-pollinate topics between audience sections

CONTENT LENGTH REQUIREMENT (MANDATORY):
- Each section content field MUST be 250+ words (4-5 full paragraphs)
- Structure: Intro paragraph → 2-3 body paragraphs → Application paragraph
- A single paragraph is ~50-80 words - you need 4-5 paragraphs per section

TOPIC-SOURCE REQUIREMENT (MANDATORY - Phase 15):
- For each topic, use ONLY the sources listed in VALIDATED TOPIC-SOURCE MAPPINGS above
- If a topic shows "Status: NO SOURCES FOUND", note "No current information available for [topic]"
- Do NOT make claims about a topic that aren't supported by its matched sources
- Cite every fact with the source URL from the matched sources
${primarySourceReminder}
SUBJECT LINE REQUIREMENT (MANDATORY):
- Must be UNIQUE to THIS newsletter - reflect the UNIFYING THEME of these specific topics
- Appeal to ALL ${audiences.length} audiences equally
- Do NOT be generic (avoid "AI Tools This Week" or "Professional Updates")
- Do NOT be narrow (avoid mentioning just one topic or field)
- Find the COMMON THREAD between these topics: ${allTopicTitles}
- Create a subject that could ONLY describe this specific newsletter

OTHER:
- Why It Matters: MINIMUM 3 sentences specific to that audience
- Editor's Note: MINIMUM 60 words
- Conclusion: MINIMUM 60 words
- Cite sources with URLs from SOURCE CONTENT
- Include promptOfTheDay with title, summary, 3 examplePrompts, and promptCode

REMEMBER: Write MUCH MORE than you think you need. 250 words is 4-5 paragraphs, not 1.`;
}

// =============================================================================
// Phase 20: Shared Elements Generator (for Parallel Generation)
// =============================================================================

/**
 * System prompt for generating shared newsletter elements
 * Used after parallel section generation to create cohesive framing elements
 */
const SHARED_ELEMENTS_SYSTEM_PROMPT = `You are an expert newsletter writer for "AI for PI".

You will receive summaries of audience sections that were already generated.
Your task is to create COHESIVE FRAMING ELEMENTS that tie these sections together.

Generate:
1. Editor's Note - Personal, conversational opening that previews ALL sections (minimum 60 words)
2. Tool of the Day - ONE standout tool from across all sections
3. Prompt of the Day - A featured prompt technique with title, summary, examples, and structured promptCode
4. Conclusion - Memorable takeaway that synthesizes insights (minimum 60 words)
5. Subject Line - UNIVERSAL subject that appeals to ALL audiences

SUBJECT LINE REQUIREMENTS:
- Find the UNIFYING THEME across all sections
- Appeal to ALL audiences equally
- NO emojis, under 60 characters
- Be SPECIFIC to these topics, not generic

Return ONLY valid JSON matching this schema:
{
  "editorsNote": { "message": "string - minimum 60 words, previews all sections" },
  "toolOfTheDay": {
    "name": "string - tool name from sections",
    "url": "string - tool URL",
    "whyNow": "string - why this tool matters now, 3+ sentences",
    "quickStart": "string - step-by-step instructions"
  },
  "promptOfTheDay": {
    "title": "string - catchy technique name",
    "summary": "string - 2-3 sentences on value",
    "examplePrompts": ["string - 3 example variations"],
    "promptCode": "string - full structured prompt with XML-like tags"
  },
  "conclusion": "string - minimum 60 words, memorable synthesis",
  "subject": "string - universal subject line under 60 chars"
}`;

/**
 * Generate shared newsletter elements after parallel section generation
 *
 * This creates the cohesive framing (editorsNote, toolOfTheDay, etc.) based on
 * the already-generated audience sections.
 *
 * @param sections - Successfully generated audience sections
 * @param allTopics - All topics across audiences
 * @param userPromptOfTheDay - Optional user-supplied prompt (overrides generated)
 * @returns SharedElements for the newsletter
 */
async function generateSharedElements(
  sections: EnhancedAudienceSection[],
  allTopics: TopicWithAudienceId[],
  userPromptOfTheDay?: PromptOfTheDay | null
): Promise<SharedElements> {
  console.log('[EnhancedNewsletter] Phase 20: Generating shared elements...');
  const startTime = Date.now();

  // Build summaries of each section for the framing prompt
  const sectionSummaries = sections.map(s => ({
    audience: s.audienceName,
    title: s.title,
    topSources: s.sources?.slice(0, 2) || [],
    keyTheme: s.content.substring(0, 200) + '...',
  }));

  const topicList = allTopics.map(t => t.title).join(', ');

  const userMessage = `Generate shared newsletter elements for these audience sections:

SECTIONS ALREADY GENERATED:
${JSON.stringify(sectionSummaries, null, 2)}

ALL TOPICS COVERED: ${topicList}

Generate the framing elements (editorsNote, toolOfTheDay, promptOfTheDay, conclusion, subject) that tie these sections together cohesively.`;

  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SHARED_ELEMENTS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in shared elements response');
  }

  // Parse JSON response
  let jsonText = textContent.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }

  const sharedElements: SharedElements = JSON.parse(jsonText);

  // Override with user-supplied promptOfTheDay if provided
  if (userPromptOfTheDay) {
    sharedElements.promptOfTheDay = userPromptOfTheDay;
    console.log('[EnhancedNewsletter] Phase 20: Using user-supplied promptOfTheDay');
  }

  const elapsed = Date.now() - startTime;
  console.log(`[EnhancedNewsletter] Phase 20: Shared elements generated in ${elapsed}ms`);

  return sharedElements;
}

/**
 * Prepare sources for parallel generation
 *
 * Converts extracted articles to SourceWithContent format and includes
 * PRIMARY SOURCES from topics that have pre-attached resource URLs.
 */
function prepareSourcesForAudience(
  topics: TopicWithAudienceId[],
  extractedArticles: ExtractedArticle[]
): SourceWithContent[] {
  const sources: SourceWithContent[] = [];

  // Add PRIMARY SOURCES from topics with attached resources
  for (const topic of topics) {
    if (topic.resource) {
      sources.push({
        url: topic.resource,
        title: topic.title,
        content: topic.summary || topic.whatItIs || '',
        snippet: topic.summary,
      });
    }
  }

  // Add extracted articles (if any)
  for (const article of extractedArticles) {
    // Avoid duplicates with PRIMARY sources
    const isDuplicate = sources.some(s =>
      s.url === article.url || s.title === article.title
    );
    if (!isDuplicate) {
      sources.push({
        url: article.url,
        title: article.title,
        content: article.content,
        snippet: article.snippet,  // ExtractedArticle inherits snippet from SourceArticle
        publication: article.source,
      });
    }
  }

  return sources;
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

    // Phase 17: Normalize topics - support both string[] and TopicWithAudienceId[]
    // This enables skipping Brave validation for topics that already have verified sources
    const normalizedTopics: TopicWithAudienceId[] = topics.map((topic) => {
      if (typeof topic === 'string') {
        // Legacy format: just a title string
        return { title: topic, audienceId: audiences[0]?.id || 'unknown' };
      }
      // Full object format: already has rich context
      return topic;
    });

    // Extract just titles for keyword collection
    const topicTitles = normalizedTopics.map((t) => t.title);

    // Log Phase 17 source bypass info
    const topicsWithSources = normalizedTopics.filter((t) => t.resource);
    const topicsWithoutSources = normalizedTopics.filter((t) => !t.resource);
    console.log(`[EnhancedNewsletter] Phase 17: ${topicsWithSources.length} topics have pre-existing sources (will skip validation)`);
    console.log(`[EnhancedNewsletter] Phase 17: ${topicsWithoutSources.length} topics need validation`);

    // Phase 19: Performance optimization - skip API fetching when ALL topics have PRIMARY sources
    const allTopicsHaveSources = topicsWithSources.length === normalizedTopics.length && topicsWithSources.length > 0;

    let sourceResult: sourceFetchingService.FetchSourcesResult = {
      articles: [],
      sources: {
        gdelt: { status: 'success', count: 0 },
        arxiv: { status: 'success', count: 0 },
        hackernews: { status: 'success', count: 0 },
        reddit: { status: 'success', count: 0 },
        github: { status: 'success', count: 0 },
        devto: { status: 'success', count: 0 },
      },
      totalCount: 0,
      fetchTimeMs: 0,
    };
    let extractionResult: { extracted: ExtractedArticle[]; successCount: number } = { extracted: [], successCount: 0 };
    let sourceContext = '';

    const newsletterId = `enl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let ragSessionActive = false;

    if (allTopicsHaveSources) {
      // Phase 19: SKIP expensive API fetching and extraction when all topics have PRIMARY sources
      console.log('[EnhancedNewsletter] Phase 19: All topics have PRIMARY sources - SKIPPING API fetch and extraction');
      console.log('[EnhancedNewsletter] Phase 19: Will use PRIMARY sources directly from preGenerationPipeline');
    } else {
      // Original path: fetch and extract sources for topics without PRIMARY sources

      // Step 1: Collect keywords and config from all audiences
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

      // Add topic titles to keywords (Phase 17: use extracted titles)
      allKeywords.push(...topicTitles);

      // Deduplicate
      const uniqueKeywords = [...new Set(allKeywords)].slice(0, 10);
      const uniqueSubreddits = [...new Set(allSubreddits)].slice(0, 5);
      const uniqueArxivCategories = [...new Set(allArxivCategories)].slice(0, 4);

      // Step 2: Fetch sources from multiple APIs
      console.log('[EnhancedNewsletter] Fetching sources...');
      sourceResult = await sourceFetchingService.fetchAllSources({
        keywords: uniqueKeywords,
        subreddits: uniqueSubreddits,
        arxivCategories: uniqueArxivCategories,
        limit: 5,
      });
      console.log(`[EnhancedNewsletter] Fetched ${sourceResult.totalCount} articles`);

      // Step 3: Extract article content
      console.log('[EnhancedNewsletter] Extracting article content...');
      extractionResult = await articleExtractorService.extractMultipleArticles(
        sourceResult.articles,
        { maxArticles: 10, maxContentLength: 3000, delayMs: 200 }
      );
      console.log(`[EnhancedNewsletter] Extracted ${extractionResult.successCount} articles`);

      // Phase 18: Optional RAG integration - index articles in Gemini File Search
      if (ragService.isRagAvailable()) {
        try {
          console.log('[EnhancedNewsletter] Phase 18: Initializing RAG session...');
          const ragSession = await ragService.createRagSession(newsletterId);

          if (ragSession) {
            const indexedCount = await ragService.uploadToRagSession(extractionResult.extracted);
            ragSessionActive = indexedCount > 0;
            console.log(`[EnhancedNewsletter] Phase 18: RAG session active with ${indexedCount} indexed documents`);
          }
        } catch (ragError) {
          console.error('[EnhancedNewsletter] Phase 18: RAG initialization failed (continuing without RAG):', ragError);
        }
      } else {
        console.log('[EnhancedNewsletter] Phase 18: RAG not available (no Google API key configured)');
      }

      // Build source context for Claude
      sourceContext = articleExtractorService.buildSourceContext(
        extractionResult.extracted,
        { maxTotalLength: 25000, maxPerArticle: 2000 }
      );
    }

    // Phase 15 + Phase 17: Pre-generation validation and topic-source matching
    // Phase 17: Pass normalizedTopics (full objects) to enable source bypass for pre-sourced topics
    console.log('[EnhancedNewsletter] Running pre-generation validation...');
    const preGenResult = await runPreGenerationChecks({
      topics: normalizedTopics,  // Phase 17: Pass full objects with resource URLs
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

    // Phase 18: Filter out fictional/invalid topics, keeping FULL OBJECTS with audienceId
    // This preserves topic-audience routing information for buildUserMessage
    const validTopics = normalizedTopics.filter((topic) => {
      const validation = preGenResult.validatedTopics.find((v) => v.topic === topic.title);
      // Keep topic if: no validation found (assume valid) OR isValid=true OR confidence is not 'none'
      return !validation || validation.isValid || validation.confidence !== 'none';
    });

    if (validTopics.length === 0) {
      // This shouldn't happen since we check in pre-gen, but safety check
      return {
        success: false,
        error: 'No valid topics remaining after filtering fictional ones',
        validationResults: preGenResult.validatedTopics,
        invalidTopics: topicTitles,
      };
    }

    console.log(`[EnhancedNewsletter] Filtered topics: ${normalizedTopics.length} -> ${validTopics.length} valid`);
    if (validTopics.length < normalizedTopics.length) {
      const filteredOut = normalizedTopics.filter((t) => !validTopics.includes(t));
      console.log(`[EnhancedNewsletter] Removed fictional topics: ${filteredOut.map(t => t.title).join(', ')}`);
    }

    // Phase 18: Log topic-audience routing
    for (const topic of validTopics) {
      console.log(`[EnhancedNewsletter] Topic "${topic.title}" -> Audience "${topic.audienceId}"`);
    }

    // Phase 19: Log PRIMARY SOURCE for topics with attached resources
    const topicsWithPrimarySources = validTopics.filter(t => t.resource);
    if (topicsWithPrimarySources.length > 0) {
      console.log(`[EnhancedNewsletter] Phase 19: ${topicsWithPrimarySources.length} topic(s) have PRIMARY SOURCES:`);
      for (const topic of topicsWithPrimarySources) {
        console.log(`[EnhancedNewsletter]   PRIMARY SOURCE: "${topic.title}" -> ${topic.resource}`);
      }
    } else {
      console.log('[EnhancedNewsletter] Phase 19: No topics have pre-attached PRIMARY SOURCES (will use fetched sources)');
    }

    // Phase 18: Warn if all topics assigned to single audience (indicates context loss)
    const audienceDistribution = validTopics.reduce((acc, t) => {
      const aid = t.audienceId || 'unknown';
      acc[aid] = (acc[aid] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const uniqueAudiences = Object.keys(audienceDistribution);
    console.log('[EnhancedNewsletter] Audience distribution:', audienceDistribution);
    if (validTopics.length > 1 && uniqueAudiences.length === 1) {
      console.warn('[EnhancedNewsletter] WARNING: All topics assigned to single audience!');
      console.warn('[EnhancedNewsletter] This may indicate topic context was lost.');
      console.warn('[EnhancedNewsletter] Check that addTopicWithContext() is being used when adding from archives.');
    }

    // Phase 18: Query RAG for topic-specific content (anti-hallucination)
    // This retrieves verified facts from indexed source articles for each topic
    let ragContent: Map<string, string> = new Map();
    if (ragSessionActive) {
      try {
        console.log('[EnhancedNewsletter] Phase 18: Querying RAG for topic content...');
        const topicTitles = validTopics.map(t => t.title);
        ragContent = await ragService.getRagContentForTopics(topicTitles);
        console.log(`[EnhancedNewsletter] Phase 18: RAG retrieved content for ${ragContent.size}/${topicTitles.length} topics`);
      } catch (ragQueryError) {
        console.error('[EnhancedNewsletter] Phase 18: RAG query failed (continuing without RAG):', ragQueryError);
      }
    }

    // Step 6: Generate enhanced newsletter with Claude
    console.log('[EnhancedNewsletter] Generating newsletter with Claude...');
    console.log(`[EnhancedNewsletter] Audiences (${audiences.length}):`, audiences.map(a => a.name));
    console.log(`[EnhancedNewsletter] Topics (${validTopics.length}):`, validTopics.map(t => t.title));

    // Phase 20: Feature flag for parallel generation (default: enabled)
    const USE_PARALLEL = process.env.ENHANCED_PARALLEL_GENERATION !== 'false';

    let newsletter: EnhancedNewsletter;

    if (USE_PARALLEL && audiences.length > 1) {
      // =====================================================================
      // Phase 20: PARALLEL GENERATION PATH
      // =====================================================================
      console.log('[EnhancedNewsletter] Phase 20: Using PARALLEL generation...');
      const parallelStartTime = Date.now();

      // Group topics by audience
      const topicsByAudience = new Map<string, TopicWithAudienceId[]>();
      for (const audience of audiences) {
        topicsByAudience.set(audience.id, []);
      }
      for (const topic of validTopics) {
        const targetId = topic.audienceId || audiences[0]?.id;
        if (topicsByAudience.has(targetId)) {
          topicsByAudience.get(targetId)!.push(topic);
        }
      }

      // Build params for parallel generation
      const parallelParams: SingleAudienceGenerationParams[] = audiences.map(audience => {
        const audienceTopics = topicsByAudience.get(audience.id) || [];
        const audienceSources = prepareSourcesForAudience(audienceTopics, extractionResult.extracted);

        console.log(`[EnhancedNewsletter] Phase 20: ${audience.name}: ${audienceTopics.length} topics, ${audienceSources.length} sources`);

        return {
          audience,
          topics: audienceTopics,
          sources: audienceSources,
          tone,
          flavors,
          personaId,
        };
      });

      // Generate all audience sections in parallel
      const sectionResults = await generateAudienceSectionsParallel(parallelParams);
      const parallelPhaseTimeMs = Date.now() - parallelStartTime;
      console.log(`[EnhancedNewsletter] Phase 20: Parallel generation completed in ${parallelPhaseTimeMs}ms`);

      // Check for failures
      const successfulSections = sectionResults.map(r => r.section);
      if (successfulSections.length === 0) {
        throw new Error('All audience sections failed to generate');
      }
      if (successfulSections.length < audiences.length) {
        console.warn(`[EnhancedNewsletter] Phase 20: Only ${successfulSections.length}/${audiences.length} sections generated`);
      }

      // Generate shared elements (editorsNote, toolOfTheDay, etc.)
      const sharedElements = await generateSharedElements(
        successfulSections,
        validTopics,
        userPromptOfTheDay
      );

      // Merge into final newsletter
      newsletter = {
        id: newsletterId,
        editorsNote: sharedElements.editorsNote,
        toolOfTheDay: sharedElements.toolOfTheDay,
        audienceSections: successfulSections,
        promptOfTheDay: sharedElements.promptOfTheDay,
        conclusion: sharedElements.conclusion,
        subject: sharedElements.subject,
      };

      const totalParallelTime = Date.now() - parallelStartTime;
      console.log(`[EnhancedNewsletter] Phase 20: Total parallel path time: ${totalParallelTime}ms`);

    } else {
      // =====================================================================
      // SEQUENTIAL GENERATION PATH (original code, for rollback/single audience)
      // =====================================================================
      console.log('[EnhancedNewsletter] Using SEQUENTIAL generation...');

      // Phase 18: Pass full topic objects for topic-audience routing
      // Phase 15: Include topicSourceContext for anti-hallucination
      // Phase 15.1: Include allocationContext for source diversity enforcement
      // Phase 18: Pass ragContent for RAG-grounded facts
      const userMessage = buildUserMessage(
        audiences,
        validTopics,  // Phase 18: Pass full topic objects with audienceId for routing
        sourceContext,
        preGenResult.topicSourceContext,
        personaInstructions,
        preGenResult.allocationContext,  // Phase 15.1: Source diversity allocations
        ragContent  // Phase 18: RAG-retrieved content per topic
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

      newsletter = JSON.parse(jsonText);

      // If user supplied a promptOfTheDay, use it instead of the LLM-generated one
      // EXACT logic from server.ts lines 1221-1225
      if (userPromptOfTheDay) {
        newsletter.promptOfTheDay = userPromptOfTheDay;
        console.log('[EnhancedNewsletter] Using user-supplied promptOfTheDay:', userPromptOfTheDay.title);
      }
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
    // Phase 17: Use topicTitles (string[]) for database storage
    // Phase 18: newsletterId is now declared earlier for RAG session
    try {
      newsletterDbService.saveEnhancedNewsletter(
        { ...newsletter, id: newsletterId },
        topicTitles,  // Phase 17: Use extracted titles for storage
        { audience: audiences.map(a => a.id), imageStyle }
      );
      console.log(`[EnhancedNewsletter] Saved to SQLite: ${newsletterId}`);
      newsletter.id = newsletterId;
    } catch (saveError) {
      console.error('[EnhancedNewsletter] Failed to save:', saveError);
      // Continue even if save fails - newsletter was still generated
    }

    // Phase 18: Cleanup RAG session
    if (ragSessionActive) {
      try {
        console.log('[EnhancedNewsletter] Phase 18: Cleaning up RAG session...');
        await ragService.closeRagSession();
        console.log('[EnhancedNewsletter] Phase 18: RAG session closed');
      } catch (ragCleanupError) {
        console.error('[EnhancedNewsletter] Phase 18: RAG cleanup failed:', ragCleanupError);
      }
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

    // Phase 18: Cleanup RAG session on error
    if (ragService.getActiveSession()) {
      try {
        console.log('[EnhancedNewsletter] Phase 18: Cleaning up RAG session after error...');
        await ragService.closeRagSession();
      } catch (ragCleanupError) {
        console.error('[EnhancedNewsletter] Phase 18: RAG cleanup failed:', ragCleanupError);
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
