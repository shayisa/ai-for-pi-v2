/**
 * Single Audience Section Generator
 *
 * Generates ONE newsletter section for ONE audience with a single Claude call.
 * Part of the Phase 16 per-audience newsletter generation pipeline.
 *
 * @module domains/generation/services/singleAudienceSectionGenerator
 *
 * ## Benefits over Multi-Audience Generation
 *
 * 1. Complete topic isolation - each audience gets unique topics
 * 2. Better prompt focus - Claude only thinks about one audience
 * 3. Parallel execution - all audience sections generated simultaneously
 * 4. Easier debugging - can trace issues to specific audience
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../../../external/claude';
import * as personaDbService from '../../../services/personaDbService';
import type {
  AudienceConfig,
  EnhancedAudienceSection,
  TopicWithAudienceId,
  SourceCitation,
  AudienceSectionResult,
  WriterPersona,
  SourceWithContent,
} from '../../../../types';

// Import helpers
import { getToneInstructions } from '../helpers/toneHelpers';
import { getFlavorInstructions, getFlavorFormattingRules } from '../helpers/flavorHelpers';
import { SPECIALIZATIONS } from '../helpers/audienceHelpers';

// =============================================================================
// Types
// =============================================================================

export interface SingleAudienceGenerationParams {
  audience: AudienceConfig;
  topics: TopicWithAudienceId[];
  sources: SourceWithContent[];
  tone: string;
  flavors: string[];
  personaId?: string;
}

interface GeneratedSection {
  title: string;
  whyItMatters: string;
  content: string;
  practicalPrompt: {
    scenario: string;
    prompt: string;
    isToolSpecific: boolean;
  };
  cta: {
    text: string;
    action: 'copy_prompt' | 'visit_url';
  };
  sources: SourceCitation[];
  imagePrompt: string;
}

// =============================================================================
// Prompt Building
// =============================================================================

/**
 * Build persona instructions if a persona is selected
 */
function buildPersonaInstructions(persona: WriterPersona | null): string {
  if (!persona) return '';

  const parts: string[] = [
    `\nWRITER PERSONA - CRITICAL:`,
    `Adopt the voice and style of "${persona.name}".`,
  ];

  if (persona.tagline) parts.push(`Core identity: "${persona.tagline}"`);
  if (persona.expertise) parts.push(`Areas of expertise: ${persona.expertise}`);
  if (persona.values) parts.push(`Core values: ${persona.values}`);
  if (persona.writingStyle) parts.push(`Writing style: ${persona.writingStyle}`);
  if (persona.signatureElements?.length) {
    parts.push(`Signature phrases to use naturally: ${persona.signatureElements.join(', ')}`);
  }

  parts.push('Your writing should authentically reflect this persona\'s voice throughout.');
  return parts.join('\n');
}

/**
 * Build system prompt for single audience section generation
 */
function buildSystemPrompt(
  audience: AudienceConfig,
  tone: string,
  flavors: string[]
): string {
  const toneInstructions = getToneInstructions(tone);
  const flavorInstructions = getFlavorInstructions(flavors);
  const flavorFormattingRules = getFlavorFormattingRules(flavors);

  // Get specialization details for richer context
  const spec = SPECIALIZATIONS[audience.id];
  const domainContext = spec?.domainExamples || audience.description;

  return `You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools in their work.

Your task is to generate ONE newsletter section for a SINGLE audience: "${audience.name}"

AUDIENCE PROFILE:
- ID: ${audience.id}
- Name: ${audience.name}
- Description: ${audience.description}
- Domain Context: ${domainContext}

TONE REQUIREMENTS:
The primary tone for this section is "${tone}". Your writing MUST authentically reflect this tone.
${toneInstructions}
${flavorInstructions}

CONTENT LENGTH REQUIREMENTS - STRICTLY ENFORCED:

CRITICAL: 250 words is approximately 4-5 substantial paragraphs.

SECTION CONTENT REQUIREMENTS:
- MINIMUM 250 words (approximately 4-5 full paragraphs)
- Structure: Introduction paragraph + 2-3 body paragraphs with details + conclusion/application paragraph
- Include: What it is, why it matters NOW, how it works, specific use cases, practical next steps
- Frame EVERYTHING for this specific audience's daily work and challenges

OTHER LENGTH REQUIREMENTS:
- Why It Matters: Minimum 3 full sentences explaining SPECIFIC relevance to THIS audience's work
- Practical Prompt: Ready-to-use with [VARIABLE] placeholders

${flavorFormattingRules}

SOURCE GROUNDING - CRITICAL:
- Use ONLY the sources provided in the user message
- Cite every factual claim with the source URL
- Do NOT add information not found in the sources
- If sources don't cover an aspect, acknowledge the gap

AUDIENCE FOCUS - CRITICAL:
- Write EXCLUSIVELY for "${audience.name}"
- Every example, use case, and explanation must be relevant to THEIR domain
- Do NOT write generic content - make it SPECIFIC to this audience
- Reference their actual work scenarios, tools, and challenges

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "title": "string - compelling title specific to this audience's perspective on the topics",
  "whyItMatters": "string - minimum 3 sentences explaining relevance to THIS SPECIFIC audience's daily work",
  "content": "string - MINIMUM 250 WORDS (4-5 paragraphs) with substantive analysis tailored to THIS audience (can include <a href='url'>text</a> links)",
  "practicalPrompt": {
    "scenario": "string - specific use case from this audience's work",
    "prompt": "string - copy-paste ready with [VARIABLE] placeholders",
    "isToolSpecific": boolean
  },
  "cta": {
    "text": "string - action-oriented call to action",
    "action": "copy_prompt"
  },
  "sources": [{ "url": "string", "title": "string" }],
  "imagePrompt": "string - A descriptive prompt for AI image generation showing this concept for this audience's context"
}`;
}

/**
 * Build user message with topics and sources
 */
function buildUserMessage(
  audience: AudienceConfig,
  topics: TopicWithAudienceId[],
  sources: SourceWithContent[],
  personaInstructions: string
): string {
  // Phase 16 fix: Include ALL rich context fields in the topic list
  // This ensures Claude has full context about each topic for proper article generation
  const topicList = topics.map((t, i) => {
    const parts = [`${i + 1}. ${t.title}`];
    if (t.summary) parts.push(`   Summary: ${t.summary}`);
    if (t.whatItIs) parts.push(`   What It Is: ${t.whatItIs}`);
    if (t.newCapability) parts.push(`   New Capability: ${t.newCapability}`);
    if (t.whoShouldCare) parts.push(`   Why ${audience.name} Should Care: ${t.whoShouldCare}`);
    if (t.howToGetStarted) parts.push(`   How To Get Started: ${t.howToGetStarted}`);
    if (t.expectedImpact) parts.push(`   Expected Impact: ${t.expectedImpact}`);
    if (t.resource) parts.push(`   Source URL: ${t.resource}`);
    return parts.join('\n');
  }).join('\n\n');

  const sourceList = sources.map((s, i) => {
    const parts = [`SOURCE ${i + 1}: "${s.title}"`];
    parts.push(`URL: ${s.url}`);
    if (s.publication) parts.push(`Publication: ${s.publication}`);
    if (s.category) parts.push(`Category: ${s.category}`);
    if (s.content) {
      // Truncate content to avoid token limits
      const truncated = s.content.length > 2000
        ? s.content.substring(0, 2000) + '...'
        : s.content;
      parts.push(`Content: ${truncated}`);
    } else if (s.snippet) {
      parts.push(`Snippet: ${s.snippet}`);
    }
    return parts.join('\n');
  }).join('\n\n---\n\n');

  return `Generate a newsletter section for "${audience.name}" covering these topics:

TOPICS FOR THIS AUDIENCE:
${topicList}

SOURCES TO USE (cite these in your content):
${sourceList}
${personaInstructions}

REQUIREMENTS:
1. Write EXCLUSIVELY for "${audience.name}" - every example must be from their domain
2. Cover ALL ${topics.length} topics listed above
3. Write MINIMUM 250 words (4-5 substantive paragraphs) in the content field
4. Cite sources with URLs from the SOURCE list above
5. The practical prompt must be specific to this audience's actual work

Generate the JSON now.`;
}

// =============================================================================
// Generation Function
// =============================================================================

/**
 * Generate a single audience section with Claude
 */
export async function generateAudienceSection(
  params: SingleAudienceGenerationParams
): Promise<AudienceSectionResult> {
  const startTime = Date.now();

  const { audience, topics, sources, tone, flavors, personaId } = params;

  console.log(`[SingleAudienceSection] generateAudienceSection START for: ${audience.name}`);
  console.log(`[SingleAudienceSection] Topics: ${topics.map(t => t.title).join(', ')}`);
  console.log(`[SingleAudienceSection] Sources: ${sources.length}`);

  // Phase 16 fix: Log rich context presence for debugging
  const topicsWithRichContext = topics.filter(t => t.summary || t.whatItIs || t.newCapability);
  console.log(`[SingleAudienceSection] Topics with rich context: ${topicsWithRichContext.length}/${topics.length}`);
  if (topicsWithRichContext.length === 0 && topics.length > 0) {
    console.warn(`[SingleAudienceSection] WARNING: No topics have rich context! Articles may lack detail.`);
    console.warn(`[SingleAudienceSection] Topic fields received:`, topics.map(t => ({
      title: t.title,
      hasSummary: !!t.summary,
      hasWhatItIs: !!t.whatItIs,
      hasNewCapability: !!t.newCapability,
      hasResource: !!t.resource,
    })));
  }

  // Look up persona if provided
  let persona: WriterPersona | null = null;
  if (personaId) {
    persona = personaDbService.getPersonaById(personaId);
    console.log(`[SingleAudienceSection] Using persona: ${persona?.name || 'not found'}`);
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(audience, tone, flavors);
  const personaInstructions = buildPersonaInstructions(persona);
  const userMessage = buildUserMessage(audience, topics, sources, personaInstructions);

  // Call Claude
  console.log(`[SingleAudienceSection] Calling Claude API...`);
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract text content
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error(`No text content in Claude response for ${audience.name}`);
  }

  console.log(`[SingleAudienceSection] Received response, parsing JSON...`);

  // Parse JSON response
  let generatedSection: GeneratedSection;
  try {
    // Try to extract JSON from potential markdown wrapper
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    generatedSection = JSON.parse(jsonText);
  } catch (parseError) {
    console.error(`[SingleAudienceSection] Failed to parse JSON for ${audience.name}:`, parseError);
    console.error('[SingleAudienceSection] Raw response:', textContent.text.substring(0, 500));
    throw new Error(`Failed to parse Claude response for ${audience.name}: ${parseError}`);
  }

  // Build the EnhancedAudienceSection
  const section: EnhancedAudienceSection = {
    audienceId: audience.id,
    audienceName: audience.name,
    title: generatedSection.title,
    whyItMatters: generatedSection.whyItMatters,
    content: generatedSection.content,
    practicalPrompt: generatedSection.practicalPrompt,
    cta: generatedSection.cta,
    sources: generatedSection.sources,
    imagePrompt: generatedSection.imagePrompt,
  };

  const generationTimeMs = Date.now() - startTime;
  console.log(`[SingleAudienceSection] generateAudienceSection END for ${audience.name} in ${generationTimeMs}ms`);

  return {
    audienceId: audience.id,
    audienceName: audience.name,
    section,
    topics,
    sources: generatedSection.sources,
    generationTimeMs,
  };
}

/**
 * Generate sections for multiple audiences in parallel
 */
export async function generateAudienceSectionsParallel(
  paramsList: SingleAudienceGenerationParams[]
): Promise<AudienceSectionResult[]> {
  console.log(`[SingleAudienceSection] generateAudienceSectionsParallel START - ${paramsList.length} sections`);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    paramsList.map((params) => generateAudienceSection(params))
  );

  const successful: AudienceSectionResult[] = [];
  const failed: { audienceId: string; error: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const audienceId = paramsList[i].audience.id;

    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({
        audienceId,
        error: result.reason?.message || 'Unknown error',
      });
      console.error(`[SingleAudienceSection] Failed for ${audienceId}:`, result.reason);
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[SingleAudienceSection] generateAudienceSectionsParallel END in ${totalTime}ms`);
  console.log(`[SingleAudienceSection] Successful: ${successful.length}, Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.error('[SingleAudienceSection] Failed audiences:', failed);
  }

  return successful;
}
