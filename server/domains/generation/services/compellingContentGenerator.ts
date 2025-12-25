/**
 * Compelling Trending Content Generator Service
 *
 * Extracts actionable insights and tools from trending sources.
 *
 * @module domains/generation/services/compellingContentGenerator
 *
 * ## Original Location
 * - server.ts lines 684-800
 *
 * ## PRESERVATION NOTE - CRITICAL
 * ALL prompts, configurations, and logic in this file are EXACT copies from server.ts.
 * Do NOT modify any prompt text, model configurations, or data flow logic.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../../../external/claude';
import { getAudienceDescription, getBalancedDomainExamples, getSpecializationsFromIds } from '../helpers/audienceHelpers';
import { getDateRangeDescription } from '../helpers/dateHelpers';
import { scoreSourceForPracticality } from '../helpers/scoringHelpers';
import { fetchAllTrendingSources } from '../sources/aggregator';
import type { TrendingSource } from '../sources/types';

/**
 * Compelling content generation request parameters
 */
export interface GenerateCompellingContentParams {
  audience: string[];
  sources?: string;
}

/**
 * Compelling content generation result
 */
export interface GenerateCompellingContentResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * EXACT System Prompt from server.ts line 772
 * DO NOT MODIFY
 */
const SYSTEM_PROMPT = `You are a seasoned consultant and technology strategist who speaks plainly and authentically. Your gift is translating complex AI developments into practical guidance that feels like advice from a trusted colleague, not a textbook. You extract specific, immediately actionable insights, tools, and implementation steps. You write with clarity, personality, and genuine helpfulness—always focusing on what professionals can actually DO TODAY. Always return valid JSON with human-centered guidance.`;

/**
 * Build user message for compelling content generation
 *
 * Phase 15.2: Updated to use dynamic domain examples based on audience selection.
 * Previously hardcoded all domains regardless of which audiences were selected.
 *
 * Phase 15.6: Added audience count for balanced tool distribution.
 * Now explicitly requests equal representation per audience.
 *
 * @param audienceDescription - Formatted audience description string
 * @param dateRange - Date range object for recency filtering
 * @param sourceSummary - Formatted source summary string
 * @param domainExamples - Dynamic domain examples based on selected audiences
 * @param audienceCount - Number of distinct audiences selected
 */
function buildUserMessage(
  audienceDescription: string,
  dateRange: { startDate: string; endDate: string; range: string },
  sourceSummary: string,
  domainExamples: string,
  audienceCount: number = 1
): string {
  // Phase 15.6: Calculate balanced tool count per audience
  // Minimum 2 tools per audience, max 8 total tools
  const toolsPerAudience = Math.max(2, Math.floor(8 / audienceCount));
  const totalTools = toolsPerAudience * audienceCount;

  // Build explicit balance instruction when multiple audiences
  const balanceInstruction = audienceCount > 1
    ? `CRITICAL BALANCE REQUIREMENT: You MUST include exactly ${toolsPerAudience} tools for EACH audience domain. Do NOT favor one audience over another. Distribute tools equally across all ${audienceCount} audience domains.`
    : '';

  return `
    You are an expert in making AI capabilities accessible and practical for professionals.

    Your task: Extract the MOST COMPELLING and ACTIONABLE insights from these trending sources.

    RECENCY REQUIREMENT: Focus ONLY on insights and tools released or significantly updated between ${dateRange.range}. All recommendations must be from the last 60 days. Ignore any older content or frameworks unless they've been updated recently.

    ${sourceSummary ? `Here are today's top trending developments:\n${sourceSummary}` : ""}

    Create a response with TWO sections:

    **SECTION 1: ACTIONABLE AI CAPABILITIES** (3-4 items)
    For each item, provide:
    - What It Is: One sentence explanation
    - New Capability: What AI can NOW do that wasn't possible before
    - Who Should Care: Why THIS audience needs this
    - How to Get Started: Specific, immediate first step (code snippet, tool name, or action)
    - Expected Impact: Concrete benefit (time saved, accuracy improved, cost reduced, etc.)
    - Resource: GitHub repo, paper link, or tool name

    **SECTION 2: ESSENTIAL TOOLS & RESOURCES** (${totalTools} items total)
    ${balanceInstruction}
    For each:
    - Tool/Paper Name
    - One-line what it does
    - Why it matters NOW
    - Direct link

    Focus on:
    - SPECIFIC tools and capabilities (not vague concepts)
    - IMMEDIATELY IMPLEMENTABLE (not theoretical)
    - AUDIENCE-TAILORED for: ${audienceDescription}
    - NOVEL capabilities they may not have considered
    - PRACTICAL examples they can use this week

    When suggesting tools and capabilities, prioritize those with direct applications to:
    ${domainExamples}

    Format as valid JSON with this structure:
    {
      "actionableCapabilities": [
        {
          "title": "...",
          "whatItIs": "...",
          "newCapability": "...",
          "whoShouldCare": "...",
          "howToGetStarted": "...",
          "expectedImpact": "...",
          "resource": "..."
        }
      ],
      "essentialTools": [
        {
          "name": "...",
          "description": "...",
          "whyNow": "...",
          "link": "..."
        }
      ]
    }
    `;
}

/**
 * Generate compelling trending content
 *
 * EXACT logic from server.ts lines 684-800
 * DO NOT MODIFY the source scoring or data flow logic
 */
export async function generateCompellingTrendingContent(
  params: GenerateCompellingContentParams
): Promise<GenerateCompellingContentResult> {
  try {
    const { audience, sources: rawSources } = params;
    const audienceDescription = getAudienceDescription(audience);
    const dateRange = getDateRangeDescription();

    // Parse sources if they're provided - EXACT logic from server.ts lines 691-701
    let topSources: TrendingSource[] = [];
    if (rawSources && typeof rawSources === "string") {
      // Sources provided as formatted string, fetch and score fresh sources
      const allSources = await fetchAllTrendingSources();
      const scoredSources = allSources
        .map(s => ({ source: s, score: scoreSourceForPracticality(s) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.source);
      topSources = scoredSources;
    }

    // Build source summary - EXACT format from server.ts lines 704-706
    const sourceSummary = topSources.length > 0
      ? topSources.map(s => `- "${s.title}" from ${s.publication} (${s.category}, ${s.date}): ${s.url}\n  ${s.summary || ""}`).join('\n')
      : "";

    // Phase 15.3: Get BALANCED domain examples with shuffled order
    const domainExamples = getBalancedDomainExamples(audience);

    // Phase 15.6: Calculate audience count for balanced tool distribution
    const resolvedAudiences = getSpecializationsFromIds(audience);
    const audienceCount = resolvedAudiences.length || 1;

    const userMessage = buildUserMessage(audienceDescription, dateRange, sourceSummary, domainExamples, audienceCount);

    // Use Haiku for this summarization task (token optimization) - MUST match server.ts line 779-780
    const response = await (await getAnthropicClient()).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    return {
      success: true,
      text: textBlock.text,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating compelling trending content:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
