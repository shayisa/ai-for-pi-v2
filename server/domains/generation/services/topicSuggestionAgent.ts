/**
 * Topic Suggestion Agent
 *
 * Phase 15.4: Generates topic suggestions for a single audience.
 *
 * Unlike singleAudienceAgent (which generates rich trending topics),
 * this agent generates simple topic title strings for the "Suggest Topics"
 * feature. Each topic is tagged with its audience for balanced representation.
 *
 * @module domains/generation/services/topicSuggestionAgent
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, webSearchTool, searchGuidance } from '../../../external/claude';
import { processToolCall } from '../../../external/brave';
import { getDateRangeDescription } from '../helpers/dateHelpers';
import type { SuggestedTopic } from '../../../../types';
import type { ResolvedAudience } from '../helpers/audienceHelpers';

// Token optimization - limit search iterations per agent
// Phase 17: Reduced from 2 to 1 for 30-40% speed improvement
// Rollback: Set AGENT_MAX_SEARCH_ITERATIONS=2
const MAX_SEARCH_ITERATIONS = parseInt(process.env.AGENT_MAX_SEARCH_ITERATIONS || '1', 10);

// Phase 17: Use Haiku for ~10x faster suggestion generation
// Rollback: Set AGENT_MODEL=claude-sonnet-4-20250514
const AGENT_MODEL = process.env.AGENT_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Agent parameters for single audience suggestion generation
 */
export interface TopicSuggestionAgentParams {
  audienceId: string;
  audienceName: string;
  audienceDescription: string;
  domainExamples: string;
  topicsToGenerate: number;
}

/**
 * Result from topic suggestion agent
 */
export interface TopicSuggestionResult {
  audienceId: string;
  topics: SuggestedTopic[];
  success: boolean;
  error?: string;
  durationMs: number;
}

/**
 * System prompt for topic suggestion generation
 * Focused on generating actionable how-to topics for ONE specific audience
 */
const SYSTEM_PROMPT = `You are an experienced technical writer and tutorial creator specializing in actionable, implementation-focused content. Your expertise is transforming new AI developments into step-by-step guides that readers can follow immediately. You NEVER suggest passive informational topics—every suggestion must be a hands-on tutorial or how-to guide with specific tools named. Think like someone who writes for O'Reilly, Real Python, or Towards Data Science—practical, specific, and immediately implementable.

CRITICAL: You are generating content for ONE SPECIFIC AUDIENCE. Every topic must be directly relevant to their domain and use cases. Do not generalize - be specific to their field.`;

/**
 * Build user message for topic suggestion generation
 *
 * @param audience - The resolved audience parameters
 * @param topicsToGenerate - Number of topics to generate
 * @param dateRange - Date range for recency filtering
 */
function buildUserMessage(
  audience: TopicSuggestionAgentParams,
  topicsToGenerate: number,
  dateRange: { startDate: string; endDate: string; range: string }
): string {
  return `
You are an expert technical writer creating ${topicsToGenerate} actionable HOW-TO tutorial topics for a specific audience.

===== TARGET AUDIENCE =====
Name: ${audience.audienceName}
${audience.audienceDescription}

===== DOMAIN-SPECIFIC FOCUS =====
Generate topics with DIRECT applications to:
${audience.domainExamples}

===== CRITICAL FORMAT REQUIREMENTS =====
- Every topic MUST start with an action verb (Build, Deploy, Implement, Configure, Optimize, Automate, Create, Integrate, Set Up, Analyze, Process, etc.)
- Every topic MUST be a practical tutorial or guide format
- Every topic MUST include specific tools, libraries, or technologies by name (NOT generic "AI tools")
- Every topic MUST have a clear, measurable outcome
- Every topic MUST be directly relevant to ${audience.audienceName}

===== RECENCY REQUIREMENT =====
Focus on developments, tools, and research from the last 2-3 months (${dateRange.range}).
Use web search to find the latest announcements and updates.

===== AVOID THESE FORMATS =====
- "Understanding [topic]" or "Introduction to [topic]" (too passive)
- "The State of [technology]" or "Trends in [field]" (too descriptive)
- "[Company] Announces [product]" (news, not tutorial)
- "Why [concept] Matters" (opinion, not implementation)
- Any title without a specific tool or technology named

===== OUTPUT FORMAT =====
Return a JSON array of ${topicsToGenerate} topic objects.
Each object MUST have ALL of the following fields:
- "title": The actionable how-to topic title (required)
- "resource": The URL to documentation, tutorial, GitHub repo, or official page (required)
- "summary": 1-2 sentence description of what the reader will learn/build (required)
- "whatItIs": What this tool/technique is and how it works (required)
- "newCapability": What NEW capabilities this enables that weren't possible before (required)
- "whoShouldCare": Why ${audience.audienceName} specifically should care about this (required)
- "howToGetStarted": First 2-3 concrete steps to get started (required)
- "expectedImpact": Quantifiable benefit or outcome (e.g., "40% faster processing", "reduces errors by 60%") (required)

The final output MUST be a valid JSON array. Do not include any text outside of the JSON.

Example format:
[
  {
    "title": "Build an AI-Powered Document Classifier Using Claude API and Python",
    "resource": "https://docs.anthropic.com/claude/docs",
    "summary": "Learn to build a document classifier that automatically categorizes files using Claude's structured output mode with 95% accuracy.",
    "whatItIs": "A Python script using the Claude API that analyzes document content and assigns categories based on your custom taxonomy.",
    "newCapability": "Claude's new structured output mode (released Nov 2024) ensures valid JSON responses every time, eliminating parsing errors.",
    "whoShouldCare": "Perfect for ${audience.audienceName} who need to process large document collections and organize research materials efficiently.",
    "howToGetStarted": "1. Install anthropic SDK: pip install anthropic 2. Get API key from console.anthropic.com 3. Clone the starter template from the docs",
    "expectedImpact": "Automate document classification with 95% accuracy, reducing manual sorting time by 80%."
  }
]
` + searchGuidance;
}

/**
 * Parsed topic from Claude response
 * Phase 15.5: Now includes resource field
 * Phase 16 fix: Added rich context fields for proper article generation
 */
interface ParsedTopic {
  title: string;
  resource?: string;
  summary?: string;
  whatItIs?: string;
  newCapability?: string;
  whoShouldCare?: string;
  howToGetStarted?: string;
  expectedImpact?: string;
}

/**
 * Parse JSON response from Claude
 * Phase 15.5: Updated to handle objects with resource field
 */
function parseTopicsResponse(text: string): ParsedTopic[] {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Helper to extract rich fields from object
    const extractRichFields = (obj: Record<string, unknown>): ParsedTopic => ({
      title: String(obj.title || obj),
      resource: typeof obj.resource === 'string' ? obj.resource : undefined,
      // Phase 16 fix: Extract all rich context fields
      summary: typeof obj.summary === 'string' ? obj.summary : undefined,
      whatItIs: typeof obj.whatItIs === 'string' ? obj.whatItIs : undefined,
      newCapability: typeof obj.newCapability === 'string' ? obj.newCapability : undefined,
      whoShouldCare: typeof obj.whoShouldCare === 'string' ? obj.whoShouldCare : undefined,
      howToGetStarted: typeof obj.howToGetStarted === 'string' ? obj.howToGetStarted : undefined,
      expectedImpact: typeof obj.expectedImpact === 'string' ? obj.expectedImpact : undefined,
    });

    if (Array.isArray(parsed)) {
      // Handle both string[] (backward compat) and object[] formats
      return parsed.map((item): ParsedTopic => {
        if (typeof item === 'string') {
          return { title: item };
        }
        if (typeof item === 'object' && item !== null) {
          return extractRichFields(item as Record<string, unknown>);
        }
        return { title: String(item) };
      }).filter(t => t.title && t.title.trim() !== '');
    }
    // Handle object with array property
    if (parsed.topics && Array.isArray(parsed.topics)) {
      return parsed.topics.map((item: unknown): ParsedTopic => {
        if (typeof item === 'string') {
          return { title: item };
        }
        if (typeof item === 'object' && item !== null) {
          return extractRichFields(item as Record<string, unknown>);
        }
        return { title: String(item) };
      }).filter(t => t.title && t.title.trim() !== '');
    }
    throw new Error('Response is not an array');
  } catch (e) {
    console.error('[TopicSuggestionAgent] Failed to parse response:', e);
    console.error('[TopicSuggestionAgent] Raw response:', text.substring(0, 500));
    return [];
  }
}

/**
 * Execute agentic loop for topic generation
 */
async function executeAgenticLoop(
  systemPrompt: string,
  userMessage: string,
  agentLabel: string
): Promise<string> {
  const client = await getAnthropicClient();

  let messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  let response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [webSearchTool],
    messages: messages,
  });

  // Handle tool calls with iteration cap
  let iterations = 0;
  while (response.stop_reason === 'tool_use' && iterations < MAX_SEARCH_ITERATIONS) {
    iterations++;
    console.log(`[${agentLabel}] Agentic loop iteration ${iterations}/${MAX_SEARCH_ITERATIONS}`);

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) break;

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const toolUseBlock of toolUseBlocks) {
      const toolResult = await processToolCall(
        toolUseBlock.name,
        toolUseBlock.input as Record<string, string>
      );
      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content: toolResult,
      });
    }

    messages.push({
      role: 'user',
      content: toolResultContent,
    });

    response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: [webSearchTool],
      messages: messages,
    });
  }

  // Force final response if max iterations reached
  if (iterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === 'tool_use') {
    console.log(`[${agentLabel}] Reached max iterations, forcing final response`);
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
    );
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: [
        ...toolUseBlocks.map((block) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: '[Max iterations reached]',
        })),
        {
          type: 'text' as const,
          text: 'Now please generate the topic suggestions based on the search results.',
        },
      ],
    });
    response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error(`[${agentLabel}] No text response from Claude`);
  }

  return textBlock.text;
}

/**
 * Generate topic suggestions for a single audience
 *
 * This is the core function for per-audience suggestion generation.
 * It runs independently and can be executed in parallel with other audiences.
 */
export async function generateSuggestionsForAudience(
  params: TopicSuggestionAgentParams
): Promise<TopicSuggestionResult> {
  const startTime = Date.now();
  const topicsToGenerate = params.topicsToGenerate ?? 3;
  const agentLabel = `TopicSuggestionAgent:${params.audienceId}`;

  console.log(`[${agentLabel}] Starting generation of ${topicsToGenerate} suggestions`);

  try {
    const dateRange = getDateRangeDescription();

    const userMessage = buildUserMessage(
      params,
      topicsToGenerate,
      dateRange
    );

    const responseText = await executeAgenticLoop(
      SYSTEM_PROMPT,
      userMessage,
      agentLabel
    );

    const parsedTopics = parseTopicsResponse(responseText);

    // Convert to SuggestedTopic format with audienceId and all rich fields
    // Phase 15.5: Now includes resource field from Claude response
    // Phase 16 fix: Now includes all rich context fields for proper article generation
    const topics: SuggestedTopic[] = parsedTopics.map((parsed) => ({
      title: parsed.title,
      audienceId: params.audienceId,
      resource: parsed.resource,
      // Phase 16 fix: Pass through all rich context fields
      summary: parsed.summary,
      whatItIs: parsed.whatItIs,
      newCapability: parsed.newCapability,
      whoShouldCare: parsed.whoShouldCare,
      howToGetStarted: parsed.howToGetStarted,
      expectedImpact: parsed.expectedImpact,
    }));

    const durationMs = Date.now() - startTime;
    console.log(`[${agentLabel}] Generated ${topics.length} suggestions in ${durationMs}ms`);

    // DEBUG: Log generated topics with rich context fields
    console.log(`[${agentLabel}] Generated topics:`, topics.map(t => ({
      title: t.title,
      resource: t.resource || '(no resource)',
      hasRichContext: !!(t.summary || t.whatItIs || t.newCapability),
    })));

    return {
      audienceId: params.audienceId,
      topics,
      success: true,
      durationMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${agentLabel}] Error:`, errorMessage);

    return {
      audienceId: params.audienceId,
      topics: [],
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}
