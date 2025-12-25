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
const MAX_SEARCH_ITERATIONS = 2;

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
Each object MUST have:
- "title": The actionable how-to topic title
- "resource": The URL to documentation, tutorial, GitHub repo, or official page you found during search

The final output MUST be a valid JSON array. Do not include any text outside of the JSON.

Example format:
[
  {
    "title": "Build an AI-Powered Document Classifier Using Claude API and Python",
    "resource": "https://docs.anthropic.com/claude/docs"
  },
  {
    "title": "Deploy a Local LLM for Private Data Analysis with Ollama and LangChain",
    "resource": "https://github.com/ollama/ollama"
  }
]
` + searchGuidance;
}

/**
 * Parsed topic from Claude response
 * Phase 15.5: Now includes resource field
 */
interface ParsedTopic {
  title: string;
  resource?: string;
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
    if (Array.isArray(parsed)) {
      // Handle both string[] (backward compat) and object[] formats
      return parsed.map((item): ParsedTopic => {
        if (typeof item === 'string') {
          return { title: item };
        }
        if (typeof item === 'object' && item !== null) {
          return {
            title: item.title || String(item),
            resource: item.resource,
          };
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
          const obj = item as Record<string, unknown>;
          return {
            title: String(obj.title || obj),
            resource: typeof obj.resource === 'string' ? obj.resource : undefined,
          };
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
    model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514',
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

    // Convert to SuggestedTopic format with audienceId and resource
    // Phase 15.5: Now includes resource field from Claude response
    const topics: SuggestedTopic[] = parsedTopics.map((parsed) => ({
      title: parsed.title,
      audienceId: params.audienceId,
      resource: parsed.resource,
    }));

    const durationMs = Date.now() - startTime;
    console.log(`[${agentLabel}] Generated ${topics.length} suggestions in ${durationMs}ms`);

    // DEBUG: Log generated topics with resources
    console.log(`[${agentLabel}] Generated topics:`, topics.map(t => ({
      title: t.title,
      resource: t.resource || '(no resource)',
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
