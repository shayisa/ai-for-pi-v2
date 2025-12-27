/**
 * Single Audience Agent
 *
 * Phase 15.3: Generates trending topics for a single audience or batch of audiences.
 *
 * This agent is designed to run in parallel with other instances,
 * each focused on different audiences. By generating topics per-audience,
 * we guarantee equal representation when results are merged.
 *
 * @module domains/generation/services/singleAudienceAgent
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, webSearchTool, searchGuidance } from '../../../external/claude';
import { processToolCall } from '../../../external/brave';
import { getDateRangeDescription } from '../helpers/dateHelpers';
import type { TrendingTopic, AudienceJsonExample } from '../../../../types';
import type {
  SingleAudienceAgentParams,
  BatchAgentParams,
  PerAudienceResult,
  AgentBatch,
} from '../types/parallelGeneration';
import type { ResolvedAudience } from '../helpers/audienceHelpers';
import { shuffleArray } from '../helpers/audienceHelpers';

// Token optimization - limit search iterations per agent
// Phase 17: Reduced from 2 to 1 for 30-40% speed improvement
// Rollback: Set AGENT_MAX_SEARCH_ITERATIONS=2
const MAX_SEARCH_ITERATIONS = parseInt(process.env.AGENT_MAX_SEARCH_ITERATIONS || '1', 10);

// Phase 17: Use Haiku for ~10x faster topic generation
// Rollback: Set AGENT_MODEL=claude-sonnet-4-20250514
const AGENT_MODEL = process.env.AGENT_MODEL || 'claude-haiku-4-5-20251001';

/**
 * System prompt for single audience topic generation
 * Focused on generating actionable how-to topics for ONE specific audience
 */
const SINGLE_AUDIENCE_SYSTEM_PROMPT = `You are a seasoned technical implementation consultant who translates new AI developments into actionable how-to guides. Your gift is identifying what's newly possible and explaining exactly how to implement it, step-by-step.

CRITICAL: You are generating content for ONE SPECIFIC AUDIENCE. Every topic must be directly relevant to their domain and use cases. Do not generalize - be specific to their field.

You never write passive news summaries—you write implementation guides with specific tools, clear steps, and measurable outcomes. Think like someone who writes for Hacker News "Show HN" posts or technical tutorial blogs—every insight must be immediately actionable.`;

/**
 * Build user message for single audience topic generation
 *
 * @param audience - The single resolved audience to generate topics for
 * @param topicsToGenerate - Number of topics to generate
 * @param dateRange - Date range for recency filtering
 */
function buildSingleAudienceUserMessage(
  audience: ResolvedAudience,
  topicsToGenerate: number,
  dateRange: { startDate: string; endDate: string; range: string }
): string {
  return `
You are an AI implementation strategist. Your task is to identify ${topicsToGenerate} of the most actionable, tutorial-worthy AI developments from the last 60 days that readers can immediately implement.

===== TARGET AUDIENCE =====
Name: ${audience.name}
${audience.description}

===== DOMAIN-SPECIFIC FOCUS =====
Generate topics with DIRECT applications to:
${audience.domainExamples}

===== CONTENT REQUIREMENTS =====
- Focus on ACTIONABLE insights with specific tools and technologies
- Include implementation guidance, not just descriptions
- Every topic MUST be relevant to ${audience.name}

===== RECENCY REQUIREMENT =====
Prioritize the MOST RECENT AI developments - tools, libraries, models, or APIs from the past few months.
Use web search to find the latest announcements and updates.
If you cannot verify exact dates, still include promising developments that appear recent and implementable.
Focus on CURRENT, IMPLEMENTABLE content - tools and techniques people can use TODAY.

===== OUTPUT FORMAT (ALL FIELDS REQUIRED) =====
CRITICAL: You MUST include EVERY field listed below for EACH topic. Do not skip or omit any fields.
The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON.

Each object MUST have ALL of these fields (no exceptions):
{
  "title": "Descriptive title for the topic",
  "whatItIs": "1-2 sentence explanation of what this capability/tool is",
  "newCapability": "What specifically is new or changed that makes this possible now",
  "whoShouldCare": "Why ${audience.name} professionals should pay attention",
  "howToGetStarted": "Step-by-step guide (3-5 numbered steps) to implement this",
  "expectedImpact": "Concrete outcomes, time savings, or metrics they can expect",
  "resource": "URL to documentation, GitHub repo, or official tool page"
}

Example format:
{
  "title": "AI-Powered 3D Artifact Documentation Using iPhone LiDAR",
  "whatItIs": "Apple's built-in LiDAR scanner combined with AI-powered mesh generation creates museum-quality 3D models in minutes.",
  "newCapability": "New iOS 18 APIs expose raw LiDAR point clouds, enabling custom archaeological documentation workflows.",
  "whoShouldCare": "Field archaeologists who need rapid, accurate 3D documentation without bulky equipment.",
  "howToGetStarted": "1. Use iPhone Pro with LiDAR\\n2. Install Polycam or 3D Scanner App\\n3. Scan artifact from multiple angles\\n4. Export to .glb or .usdz format\\n5. Import to GIS or 3D analysis software",
  "expectedImpact": "Reduce documentation time from hours to minutes. Create shareable 3D models for remote collaboration.",
  "resource": "https://developer.apple.com/documentation/arkit/arkit_in_ios"
}
` + searchGuidance;
}

/**
 * Build user message for batch audience topic generation
 *
 * @param audiences - Array of resolved audiences in this batch
 * @param topicsPerAudience - Topics to generate per audience
 * @param dateRange - Date range for recency filtering
 */
function buildBatchAudienceUserMessage(
  audiences: ResolvedAudience[],
  topicsPerAudience: number,
  dateRange: { startDate: string; endDate: string; range: string }
): string {
  // Shuffle audiences to avoid order bias
  const shuffledAudiences = shuffleArray([...audiences]);
  const totalTopics = audiences.length * topicsPerAudience;

  const audienceDescriptions = shuffledAudiences.map((a, i) => `
### AUDIENCE ${i + 1}: ${a.name}
${a.description}

Domain Focus:
${a.domainExamples}

Example Topic Format:
${JSON.stringify(a.jsonExamples[0], null, 2)}
`).join('\n');

  return `
You are an AI implementation strategist. Your task is to identify ${totalTopics} actionable, tutorial-worthy AI developments from the last 60 days.

===== CRITICAL BALANCE REQUIREMENT =====
You MUST generate EXACTLY ${topicsPerAudience} topics for EACH of the following ${audiences.length} audiences.
Do NOT favor any audience over another. Equal representation is mandatory.

${audienceDescriptions}

===== CONTENT REQUIREMENTS =====
- Focus on ACTIONABLE insights with specific tools and technologies
- Include implementation guidance, not just descriptions
- Include "audienceId" field to indicate which audience the topic is for

===== RECENCY REQUIREMENT =====
Prioritize the MOST RECENT AI developments - tools, libraries, models, or APIs from the past few months.
Use web search to find the latest announcements and updates.
If you cannot verify exact dates, still include promising developments that appear recent and implementable.

===== OUTPUT FORMAT (ALL FIELDS REQUIRED) =====
CRITICAL: You MUST include EVERY field listed below for EACH topic. Do not skip or omit any fields.
Return a JSON array where EACH audience has EXACTLY ${topicsPerAudience} topics.
The final output MUST be a valid JSON array. Do not include any text outside of the JSON.

Each object MUST have ALL of these fields (no exceptions):
{
  "audienceId": "audience-id-here",
  "title": "Descriptive title for the topic",
  "whatItIs": "1-2 sentence explanation of what this capability/tool is",
  "newCapability": "What specifically is new or changed that makes this possible now",
  "whoShouldCare": "Why this audience should pay attention",
  "howToGetStarted": "Step-by-step guide (3-5 numbered steps) to implement this",
  "expectedImpact": "Concrete outcomes, time savings, or metrics they can expect",
  "resource": "URL to documentation, GitHub repo, or official tool page"
}
` + searchGuidance;
}

/**
 * Parse JSON response from Claude, handling common format issues
 * Phase 15.3c: Updated to include rich format fields
 */
function parseTopicsResponse(text: string): Array<{
  audienceId?: string;
  title: string;
  summary?: string;
  whatItIs?: string;
  newCapability?: string;
  whoShouldCare?: string;
  howToGetStarted?: string;
  expectedImpact?: string;
  resource?: string;
}> {
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
    // DEBUG: Log what Claude actually returned (first topic only)
    const topicsArray = Array.isArray(parsed) ? parsed : parsed.topics;
    if (topicsArray && topicsArray.length > 0) {
      console.log('[SingleAudienceAgent] DEBUG - First parsed topic:',
        JSON.stringify(topicsArray[0], null, 2));
      console.log('[SingleAudienceAgent] DEBUG - Rich fields present:',
        {
          hasWhatItIs: !!topicsArray[0].whatItIs,
          hasNewCapability: !!topicsArray[0].newCapability,
          hasHowToGetStarted: !!topicsArray[0].howToGetStarted,
          hasExpectedImpact: !!topicsArray[0].expectedImpact,
          hasResource: !!topicsArray[0].resource,
        });
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    // Handle object with array property
    if (parsed.topics && Array.isArray(parsed.topics)) {
      return parsed.topics;
    }
    throw new Error('Response is not an array');
  } catch (e) {
    console.error('[SingleAudienceAgent] Failed to parse response:', e);
    console.error('[SingleAudienceAgent] Raw response:', text.substring(0, 500));
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
    max_tokens: 2048,
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
      max_tokens: 2048,
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
          text: 'Now please generate the trending topics based on the search results.',
        },
      ],
    });
    response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 2048,
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
 * Generate trending topics for a single audience
 *
 * This is the core function for per-audience topic generation.
 * It runs independently and can be executed in parallel with other audiences.
 */
export async function generateTrendingTopicsForAudience(
  params: SingleAudienceAgentParams
): Promise<PerAudienceResult> {
  const startTime = Date.now();
  const topicsToGenerate = params.topicsToGenerate ?? 3;
  const agentLabel = `SingleAudienceAgent:${params.audienceId}`;

  console.log(`[${agentLabel}] Starting generation of ${topicsToGenerate} topics`);

  try {
    const dateRange = getDateRangeDescription();

    // Build resolved audience from params
    const resolvedAudience: ResolvedAudience = {
      id: params.audienceId,
      name: params.audienceName,
      description: params.audienceDescription,
      domainExamples: params.domainExamples,
      jsonExamples: params.jsonExamples,
      topicTitles: params.topicTitles,
      sourcePreferences: [],
      isCustom: false,
    };

    const userMessage = buildSingleAudienceUserMessage(
      resolvedAudience,
      topicsToGenerate,
      dateRange
    );

    const responseText = await executeAgenticLoop(
      SINGLE_AUDIENCE_SYSTEM_PROMPT,
      userMessage,
      agentLabel
    );

    const parsedTopics = parseTopicsResponse(responseText);

    // Convert to TrendingTopic format with rich fields (Phase 15.3c)
    const topics: TrendingTopic[] = parsedTopics.map((t, i) => ({
      id: `${params.audienceId}-topic-${i}`,
      title: t.title,
      summary: t.summary || t.whatItIs || '',
      audienceId: params.audienceId,
      // Rich format fields
      whatItIs: t.whatItIs,
      newCapability: t.newCapability,
      whoShouldCare: t.whoShouldCare,
      howToGetStarted: t.howToGetStarted,
      expectedImpact: t.expectedImpact,
      resource: t.resource,
    }));

    // Build per-audience breakdown (single audience in this case)
    const topicsByAudience = new Map<string, TrendingTopic[]>();
    topicsByAudience.set(params.audienceId, topics);

    const durationMs = Date.now() - startTime;
    console.log(`[${agentLabel}] Generated ${topics.length} topics in ${durationMs}ms`);

    return {
      batchId: params.audienceId,
      audienceIds: [params.audienceId],
      topics,
      topicsByAudience,
      success: true,
      durationMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${agentLabel}] Error:`, errorMessage);

    return {
      batchId: params.audienceId,
      audienceIds: [params.audienceId],
      topics: [],
      topicsByAudience: new Map(),
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate trending topics for a batch of audiences
 *
 * Used in per-category mode where multiple related audiences
 * are processed by a single agent to reduce API calls.
 */
export async function generateTrendingTopicsForBatch(
  params: BatchAgentParams
): Promise<PerAudienceResult> {
  const startTime = Date.now();
  const { batch, topicsToGenerate } = params;
  const agentLabel = `BatchAgent:${batch.batchId}`;

  // If batch has only one audience, delegate to single audience agent
  if (batch.audiences.length === 1) {
    const audience = batch.audiences[0];
    return generateTrendingTopicsForAudience({
      audienceId: audience.id,
      audienceName: audience.name,
      audienceDescription: audience.description,
      domainExamples: audience.domainExamples,
      jsonExamples: audience.jsonExamples,
      topicTitles: audience.topicTitles,
      topicsToGenerate,
    });
  }

  const topicsPerAudience = Math.ceil(topicsToGenerate / batch.audiences.length);
  console.log(
    `[${agentLabel}] Starting generation for ${batch.audiences.length} audiences, ${topicsPerAudience} topics each`
  );

  try {
    const dateRange = getDateRangeDescription();

    const userMessage = buildBatchAudienceUserMessage(
      batch.audiences,
      topicsPerAudience,
      dateRange
    );

    const responseText = await executeAgenticLoop(
      SINGLE_AUDIENCE_SYSTEM_PROMPT,
      userMessage,
      agentLabel
    );

    const parsedTopics = parseTopicsResponse(responseText);

    // Group topics by audience
    const topicsByAudience = new Map<string, TrendingTopic[]>();
    const allTopics: TrendingTopic[] = [];

    // Initialize empty arrays for each audience
    for (const audience of batch.audiences) {
      topicsByAudience.set(audience.id, []);
    }

    // Assign topics to their audiences
    for (let i = 0; i < parsedTopics.length; i++) {
      const parsed = parsedTopics[i];
      const audienceId = parsed.audienceId || batch.audiences[0].id;

      const topic: TrendingTopic = {
        id: `${batch.batchId}-${audienceId}-topic-${i}`,
        title: parsed.title,
        summary: parsed.summary || parsed.whatItIs || '',
        audienceId,
        // Rich format fields (Phase 15.3c)
        whatItIs: parsed.whatItIs,
        newCapability: parsed.newCapability,
        whoShouldCare: parsed.whoShouldCare,
        howToGetStarted: parsed.howToGetStarted,
        expectedImpact: parsed.expectedImpact,
        resource: parsed.resource,
      };

      allTopics.push(topic);

      const existing = topicsByAudience.get(audienceId) || [];
      existing.push(topic);
      topicsByAudience.set(audienceId, existing);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[${agentLabel}] Generated ${allTopics.length} total topics in ${durationMs}ms`);

    // Log per-audience breakdown
    for (const [audienceId, topics] of topicsByAudience) {
      console.log(`[${agentLabel}]   - ${audienceId}: ${topics.length} topics`);
    }

    return {
      batchId: batch.batchId,
      audienceIds: batch.audiences.map((a) => a.id),
      topics: allTopics,
      topicsByAudience,
      success: true,
      durationMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${agentLabel}] Error:`, errorMessage);

    return {
      batchId: batch.batchId,
      audienceIds: batch.audiences.map((a) => a.id),
      topics: [],
      topicsByAudience: new Map(),
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}
