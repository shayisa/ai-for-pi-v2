/**
 * Trending Topics Generator Service
 *
 * Generates trending topic suggestions with and without real sources.
 *
 * @module domains/generation/services/trendingGenerator
 *
 * ## Original Location
 * - generateTrendingTopics: server.ts lines 1501-1660
 * - generateTrendingTopicsWithSources: server.ts lines 1662-1798
 *
 * ## PRESERVATION NOTE - CRITICAL
 * ALL prompts, configurations, and logic in this file are EXACT copies from server.ts.
 * Do NOT modify any prompt text, model configurations, or agentic loop logic.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, webSearchTool, searchGuidance } from '../../../external/claude';
import { processToolCall } from '../../../external/brave';
import { getAudienceDescription } from '../helpers/audienceHelpers';
import { getDateRangeDescription } from '../helpers/dateHelpers';

// Token optimization constant - MUST match server.ts
const MAX_SEARCH_ITERATIONS = 2;

/**
 * Trending topics generation request parameters
 */
export interface GenerateTrendingTopicsParams {
  audience: string[];
}

/**
 * Trending topics with sources generation request parameters
 */
export interface GenerateTrendingTopicsWithSourcesParams {
  audience: string[];
  sources: string;
}

/**
 * Trending topics generation result
 */
export interface GenerateTrendingTopicsResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * EXACT System Prompt for generateTrendingTopics from server.ts line 1560
 * DO NOT MODIFY
 */
const TRENDING_SYSTEM_PROMPT = `You are a seasoned technical implementation consultant who translates new AI developments into actionable how-to guides. Your gift is identifying what's newly possible and explaining exactly how to implement it, step-by-step. You never write passive news summaries—you write implementation guides with specific tools, clear steps, and measurable outcomes. Think like someone who writes for Hacker News "Show HN" posts or technical tutorial blogs—every insight must be immediately actionable.`;

/**
 * EXACT System Prompt for generateTrendingTopicsWithSources from server.ts line 1699
 * DO NOT MODIFY
 */
const TRENDING_WITH_SOURCES_SYSTEM_PROMPT = `You are an AI news analyst specializing in identifying trending AI developments from real sources. Your task is to analyze provided trending sources and summarize the most relevant developments for specific audiences. The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object.`;

/**
 * Build user message for generateTrendingTopics - EXACT copy from server.ts lines 1508-1558
 * DO NOT MODIFY any text in this function
 */
function buildTrendingUserMessage(
  audienceDescription: string,
  dateRange: { startDate: string; endDate: string; range: string }
): string {
  return `
    You are an AI implementation strategist. Your task is to identify 2-3 of the most actionable, tutorial-worthy AI developments from the last 60 days that readers can immediately implement.

    Your analysis MUST be tailored for this specific audience:
    ${audienceDescription}

    CRITICAL FORMAT REQUIREMENTS:
    - Every title MUST be phrased as a "How-To" tutorial or implementation guide
    - Every title MUST start with action verbs: "How to Build", "How to Deploy", "How to Implement", "How to Automate", "How to Configure", etc.
    - Every summary MUST focus on IMPLEMENTATION STEPS, not just descriptions
    - Every summary MUST include specific tools/technologies by name

    Focus on developments that have clear, implementable applications to:
    - Forensic anthropology: skeletal analysis automation, trauma pattern classification, victim identification workflows, morphometric measurements, taphonomy modeling
    - Digital/computational archaeology: LiDAR data processing, 3D reconstruction pipelines, artifact classification systems, site discovery automation, geospatial analysis tools
    - Business administration: workflow orchestration, document automation systems, meeting intelligence tools, task automation frameworks, process mining implementations
    - Business analytics/logistics: supply chain optimization models, demand forecasting systems, inventory management automation, route planning algorithms, predictive maintenance tools

    RECENCY REQUIREMENT: Focus ONLY on tools, libraries, models, or APIs announced or significantly updated between ${dateRange.range}. Ignore all developments from before ${dateRange.startDate}. This must be CURRENT and IMPLEMENTABLE content only.

    For each development, provide:
    1. A HOW-TO formatted title (e.g., "How to Build...", "How to Deploy...", "How to Automate...")
    2. An implementation-focused summary that includes:
       - Specific tools/libraries/models to use
       - Key implementation steps or approach
       - Expected outcome or capability gained
       - Why this is relevant NOW for the audience

    The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object, including markdown backticks.
    Each object in the array should have the following structure:
    {
      "title": "How to [Action Verb]...",
      "summary": "Brief summary including specific tools, implementation steps, expected outcome, and why it matters NOW."
    }

    Example format (REQUIRED STRUCTURE):
    [
        {
            "title": "How to Build a Skeletal Analysis Pipeline Using Claude Vision API and Python",
            "summary": "Claude 3.5's new vision capabilities (released October 2024) enable forensic anthropologists to automate skeletal element identification and trauma documentation. Implementation: Use Claude API with base64-encoded bone images, prompt for morphometric measurements, integrate with existing case management systems. Expected outcome: 60% reduction in initial documentation time with standardized measurement protocols."
        },
        {
            "title": "How to Deploy Automated LiDAR Site Discovery with Open3D and PyTorch",
            "summary": "Recent updates to Open3D (v0.18, September 2024) combined with PyTorch's improved point cloud processing enable archaeologists to automate site anomaly detection from drone LiDAR scans. Implementation: Process raw .las files with Open3D, train anomaly detection model using labeled examples, export georeferenced site predictions. Expected outcome: Identify potential archaeological features 10x faster than manual scan review."
        },
        {
            "title": "How to Automate Business Workflows Using n8n Cloud and Claude Integration",
            "summary": "n8n's new Claude node (November 2024) enables business administrators to build no-code AI workflows for document processing, email triage, and meeting follow-ups. Implementation: Connect n8n to Gmail/Slack, configure Claude prompts for task extraction, route actions to project management tools. Expected outcome: Automate 80% of routine administrative decisions without code."
        }
    ]
  ` + searchGuidance;
}

/**
 * Build user message for generateTrendingTopicsWithSources - EXACT copy from server.ts lines 1668-1697
 * DO NOT MODIFY any text in this function
 */
function buildTrendingWithSourcesUserMessage(
  audienceDescription: string,
  sources: string
): string {
  return `
    You are an AI news analyst. Your task is to identify and summarize 2-3 of the most compelling developments from real, trending sources.

    Here are the current trending sources from various AI communities:
    ${sources}

    Your analysis MUST be tailored for a specific audience:
    ${audienceDescription}

    Based on these real sources, identify the most relevant and important trends. For each development, provide a concise title and a brief, easy-to-understand summary explaining what it is and why it's important for this audience.

    The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object, including markdown backticks.
    Each object in the array should have the following structure:
    {
      "title": "A concise title for the trending topic",
      "summary": "A brief summary of the topic and its relevance to the audience."
    }

    Example format:
    [
        {
            "title": "Latest AI Research Breakthrough",
            "summary": "Recent developments in AI are enabling new capabilities relevant to your field."
        },
        {
            "title": "Emerging AI Tools for Professionals",
            "summary": "New tools are emerging that can help professionals in your area stay ahead."
        }
    ]
  ` + searchGuidance;
}

/**
 * Generate trending topics with agentic loop
 *
 * EXACT logic from server.ts lines 1501-1660
 * DO NOT MODIFY the agentic loop pattern
 */
export async function generateTrendingTopics(
  params: GenerateTrendingTopicsParams
): Promise<GenerateTrendingTopicsResult> {
  try {
    const { audience } = params;
    const audienceDescription = getAudienceDescription(audience);
    const dateRange = getDateRangeDescription();

    const userMessage = buildTrendingUserMessage(audienceDescription, dateRange);

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: TRENDING_SYSTEM_PROMPT,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let trendingIterations = 0;
    while (response.stop_reason === "tool_use" && trendingIterations < MAX_SEARCH_ITERATIONS) {
      trendingIterations++;
      console.log(`[TrendingTopics] Agentic loop iteration ${trendingIterations}/${MAX_SEARCH_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      messages.push({
        role: "assistant",
        content: response.content,
      });

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

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: TRENDING_SYSTEM_PROMPT,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    // EXACT pattern from server.ts lines 1619-1643
    if (trendingIterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[TrendingTopics] Reached max iterations, forcing final response`);
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          ...toolUseBlocks.map(block => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "[Max iterations reached]",
          })),
          { type: "text" as const, text: "Now please generate the trending topics based on the search results." }
        ],
      });
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: TRENDING_SYSTEM_PROMPT,
        messages: messages,
      });
    }

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
    console.error("Error generating trending topics:", errorMessage);
    console.error("Full error:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate trending topics with real sources and agentic loop
 *
 * EXACT logic from server.ts lines 1662-1798
 * DO NOT MODIFY the agentic loop pattern
 */
export async function generateTrendingTopicsWithSources(
  params: GenerateTrendingTopicsWithSourcesParams
): Promise<GenerateTrendingTopicsResult> {
  try {
    const { audience, sources } = params;
    const audienceDescription = getAudienceDescription(audience);

    const userMessage = buildTrendingWithSourcesUserMessage(audienceDescription, sources);

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Note: Uses Haiku model - MUST match server.ts line 1706
    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: TRENDING_WITH_SOURCES_SYSTEM_PROMPT,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let srcIterations = 0;
    while (response.stop_reason === "tool_use" && srcIterations < MAX_SEARCH_ITERATIONS) {
      srcIterations++;
      console.log(`[TrendingWithSources] Agentic loop iteration ${srcIterations}/${MAX_SEARCH_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      messages.push({
        role: "assistant",
        content: response.content,
      });

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

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      // Note: Uses Haiku model - MUST match server.ts line 1749
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: TRENDING_WITH_SOURCES_SYSTEM_PROMPT,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    // EXACT pattern from server.ts lines 1758-1782
    if (srcIterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[TrendingWithSources] Reached max iterations, forcing final response`);
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          ...toolUseBlocks.map(block => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "[Max iterations reached]",
          })),
          { type: "text" as const, text: "Now please generate the trending topics with sources based on the search results." }
        ],
      });
      // Note: Uses Haiku model - MUST match server.ts line 1776
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: TRENDING_WITH_SOURCES_SYSTEM_PROMPT,
        messages: messages,
      });
    }

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
    console.error("Error generating trending topics with sources:", errorMessage);
    console.error("Full error:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
