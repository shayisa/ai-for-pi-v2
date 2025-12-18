/**
 * Topic Suggestions Generator Service
 *
 * Generates 10 HOW-TO tutorial topic suggestions with web search capability.
 *
 * @module domains/generation/services/topicGenerator
 *
 * ## Original Location
 * - server.ts lines 1328-1498
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
 * Topic suggestions generation request parameters
 */
export interface GenerateTopicSuggestionsParams {
  audience: string[];
  sources?: string;
}

/**
 * Topic suggestions generation result
 */
export interface GenerateTopicSuggestionsResult {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * EXACT System Prompt from server.ts line 1399
 * DO NOT MODIFY
 */
const SYSTEM_PROMPT = `You are an experienced technical writer and tutorial creator specializing in actionable, implementation-focused content. Your expertise is transforming new AI developments into step-by-step guides that readers can follow immediately. You NEVER suggest passive informational topics—every suggestion must be a hands-on tutorial or how-to guide with specific tools named. Think like someone who writes for O'Reilly, Real Python, or Towards Data Science—practical, specific, and immediately implementable.`;

/**
 * Build user message - EXACT copy from server.ts lines 1340-1397
 * DO NOT MODIFY any text in this function
 */
function buildUserMessage(
  audienceDescription: string,
  dateRange: { startDate: string; endDate: string; range: string },
  sources?: string
): string {
  const sourceSummary = sources
    ? `Here are current trending topics from real AI communities:\n${sources}`
    : "";

  return `
    You are an expert technical writer and tutorial creator specializing in actionable, implementation-focused content.
    Your task is to generate a list of 10 HOW-TO tutorial topic suggestions that readers can immediately implement.

    CRITICAL FORMAT REQUIREMENTS:
    - Every topic MUST start with an action verb (Build, Deploy, Implement, Configure, Optimize, Automate, Create, Integrate, Set Up, Analyze, Process, etc.)
    - Every topic MUST be a practical tutorial or guide format
    - Every topic MUST include specific tools, libraries, or technologies by name (NOT generic "AI tools")
    - Every topic MUST have a clear, measurable outcome

    RECENCY REQUIREMENT: Focus ONLY on developments, tools, and research published or updated between ${dateRange.range}. Do NOT suggest topics based on older content unless there's a recent, significant development.

    ${sourceSummary ? `Based on these real trending sources and latest developments:
    ${sourceSummary}` : "Based on the latest trends and news in AI,"}

    Generate tutorial topics that are:
    - IMPLEMENTATION-FOCUSED: Step-by-step guides, not conceptual overviews
    - TOOL-SPECIFIC: Name exact libraries, APIs, frameworks, or services (e.g., "Claude API", "LangChain", "n8n", "Llama 3.2", not just "AI tools")
    - OUTCOME-DRIVEN: Clear statement of what the reader will build/accomplish
    - IMMEDIATELY ACTIONABLE: Can be started within 1 hour of reading
    - AUDIENCE-TAILORED: Directly applicable to this specific audience:
    ${audienceDescription}

    Prioritize topics that address these domain-specific use cases:
    - Forensic anthropology applications: skeletal analysis AI, trauma pattern recognition, morphometric analysis automation, mass fatality incident response, age/sex/ancestry estimation
    - Digital/computational archaeology applications: LiDAR site discovery, photogrammetry pipelines, artifact classification, 3D reconstruction, geospatial analysis, cultural heritage preservation
    - Business automation applications: workflow orchestration, document processing automation, meeting intelligence, RPA implementation, API integration, no-code/low-code tools
    - Business analytics/logistics applications: supply chain optimization, demand forecasting models, inventory management, route optimization, warehouse automation, predictive analytics

    AVOID these non-tutorial formats:
    - "Understanding [topic]" or "Introduction to [topic]" (too passive)
    - "The State of [technology]" or "Trends in [field]" (too descriptive)
    - "[Company] Announces [product]" (news, not tutorial)
    - "Why [concept] Matters" (opinion, not implementation)
    - Any title without a specific tool or technology named

    The final output MUST be a valid JSON object. Do not include any text outside of the JSON object.
    The JSON object should be an array of 10 strings.
    Example format (REQUIRED STRUCTURE):
    [
      "Build an Automated ArXiv Research Monitor Using n8n and Claude API",
      "Deploy a Skeletal Age Estimation Model with PyTorch and Anthropic Vision",
      "Implement Real-Time LiDAR Processing Pipeline Using Open3D and Python",
      "Automate Supply Chain Forecasting with Prophet, Pandas, and Streamlit",
      "Configure Document Intelligence Workflow Using Claude 3.5 and LangChain",
      "Set Up a Multi-Agent Research Assistant with CrewAI and GPT-4",
      "Integrate Slack Notifications into Your Data Pipeline Using Webhooks",
      "Optimize Inventory Predictions Using XGBoost and Historical Sales Data",
      "Create a Custom RAG System for Archaeological Research with Pinecone",
      "Process Archaeological Photos with Photogrammetry Using Meshroom and Blender"
    ]

    QUALITY CHECK: Each topic MUST:
    1. Start with action verb (Build, Deploy, etc.)
    2. Name specific tools/technologies (NOT generic "AI tools")
    3. State clear application domain
    4. Be completable as a tutorial within 30-60 minutes of reading time
  ` + (sources ? "" : searchGuidance);
}

/**
 * Generate topic suggestions with agentic loop
 *
 * EXACT logic from server.ts lines 1328-1498
 * DO NOT MODIFY the agentic loop pattern
 */
export async function generateTopicSuggestions(
  params: GenerateTopicSuggestionsParams
): Promise<GenerateTopicSuggestionsResult> {
  try {
    const { audience, sources } = params;
    const audienceDescription = getAudienceDescription(audience);
    const dateRange = getDateRangeDescription();

    const userMessage = buildUserMessage(audienceDescription, dateRange, sources);

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let suggestIterations = 0;
    while (response.stop_reason === "tool_use" && suggestIterations < MAX_SEARCH_ITERATIONS) {
      suggestIterations++;
      console.log(`[TopicSuggestions] Agentic loop iteration ${suggestIterations}/${MAX_SEARCH_ITERATIONS}`);

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
        system: SYSTEM_PROMPT,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    // EXACT pattern from server.ts lines 1458-1482
    if (suggestIterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[TopicSuggestions] Reached max iterations, forcing final response`);
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
          { type: "text" as const, text: "Now please generate the topic suggestions based on the search results." }
        ],
      });
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
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
    console.error("Error generating topic suggestions:", errorMessage);
    console.error("Full error:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
