/**
 * Newsletter Generator Service
 *
 * Core newsletter generation with web search capability and agentic loop.
 *
 * @module domains/generation/services/newsletterGenerator
 *
 * ## Original Location
 * - server.ts lines 802-1057
 *
 * ## PRESERVATION NOTE - CRITICAL
 * ALL prompts, configurations, and logic in this file are EXACT copies from server.ts.
 * Do NOT modify any prompt text, model configurations, or agentic loop logic.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, webSearchTool, searchGuidance } from '../../../external/claude';
import { processToolCall } from '../../../external/brave';
import { getAudienceDescription } from '../helpers/audienceHelpers';
import { getFlavorInstructions } from '../helpers/flavorHelpers';
import { getToneInstructions } from '../helpers/toneHelpers';
import { getDateRangeDescription } from '../helpers/dateHelpers';
import { sanitizeNewsletter } from '../helpers/sanitizers';
import * as newsletterDbService from '../../../services/newsletterDbService';
import * as personaDbService from '../../../services/personaDbService';
import type { WriterPersona } from '../../../../types';

// Token optimization constant - MUST match server.ts
const MAX_SEARCH_ITERATIONS = 2;

/**
 * Newsletter generation request parameters
 */
export interface GenerateNewsletterParams {
  topics: string[];
  audience: string[];
  tone: string;
  flavors: string[];
  imageStyle: string;
  personaId?: string;
}

/**
 * Newsletter generation result
 */
export interface GenerateNewsletterResult {
  success: boolean;
  newsletter?: any;
  text?: string;
  error?: string;
}

/**
 * Image style map - EXACT copy from server.ts lines 811-821
 */
const imageStyleMap: Record<string, string> = {
  photorealistic: "photorealistic",
  vector: "vector illustration",
  watercolor: "watercolor painting",
  pixel: "pixel art",
  minimalist: "minimalist line art",
  oilPainting: "oil painting",
  cyberpunk: "cyberpunk neon-lit futuristic",
  abstract: "abstract non-representational art",
  isometric: "isometric 3D perspective",
};

/**
 * EXACT System Prompt from server.ts lines 901-905
 * DO NOT MODIFY
 */
const SYSTEM_PROMPT = `You are an expert professional newsletter writer and technology journalist with years of experience crafting engaging, authentic content for diverse audiences. Your strength is transforming complex topics into compelling narratives that feel human, genuine, and insightful—never robotic or formulaic.

Your task: Create a newsletter that reads like it was written by a seasoned, knowledgeable professional who genuinely cares about helping your readers. Focus on clarity, authenticity, and real value.

You have access to web search to find the latest, most relevant information. The final output MUST be a single, valid JSON object. Do not include any text outside of the JSON object.`;

/**
 * Build persona instructions for newsletter generation
 *
 * Phase 12.0: Integrates writer persona voice into newsletter generation
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
  parts.push('Your writing should authentically reflect this persona\'s voice throughout the entire newsletter.');

  return '\n' + parts.join('\n');
}

/**
 * Build user message - EXACT copy from server.ts lines 824-899
 * DO NOT MODIFY any text in this function
 * Phase 12.0: Added personaInstructions parameter (appended after flavorInstructions)
 * Phase 13.1: Added toneInstructions parameter for research-backed tone execution rules
 */
function buildUserMessage(
  topics: string[],
  audienceDescription: string,
  tone: string,
  flavorInstructions: string,
  dateRange: { startDate: string; endDate: string; range: string },
  styleDescription: string,
  personaInstructions?: string,
  toneInstructions?: string
): string {
  return `
    You are an award-winning professional newsletter writer with a background in technology journalism and expert storytelling. Your task is to research and write compelling, human-centric newsletter content about: "${topics.join(
      ", "
    )}".

    Your newsletter reaches this specific and discerning audience:
    ${audienceDescription}

    CRITICAL: Your writing must feel written by a knowledgeable, engaging human—NOT an AI. Avoid:
    - Predictable structures or lists that feel formulaic
    - Overuse of phrases like "importantly," "it's worth noting," or "as we can see"
    - Overly formal or robotic language
    - Excessive hedging or disclaimers
    - Repetitive explanations of concepts

    Instead, embrace:
    - Conversational, authentic voice with personality
    - Natural transitions between ideas
    - Genuine insights and context that add real value
    - Occasional casual language that feels appropriate to the audience
    - Direct, unfiltered perspective

    Your content should demonstrate understanding of these domain-specific applications:
    - For forensic anthropologists: AI tools for skeletal morphology analysis, automated age/sex estimation, trauma analysis, mass disaster identification workflows, 3D bone modeling
    - For digital archaeologists: LiDAR processing workflows, automated artifact classification, 3D site reconstruction from drone imagery, geospatial pattern recognition, cultural heritage digitization
    - For business administrators: Workflow automation platforms (n8n, Zapier, Make), document intelligence, meeting summarization, calendar orchestration, email automation, approval routing
    - For business analysts: Supply chain predictive models, inventory optimization, route planning algorithms, warehouse robotics, demand forecasting, logistics dashboards

    You MUST tailor the content, examples, and language to be relevant and valuable to this specific audience. Think like a newsletter editor writing for people you know.

    The primary tone MUST be ${tone}. Reflect this authentically throughout the subject, introduction, sections, and conclusion—not as an overlay but as the natural voice.
    ${toneInstructions || ''}
    ${flavorInstructions}
    ${personaInstructions || ''}

    RECENCY REQUIREMENT: Focus ONLY on tools, tutorials, developments, and advancements published or significantly updated between ${dateRange.range}. Do NOT suggest tools that haven't been meaningfully updated since 2023. Do NOT reference older solutions unless they received major recent improvements.

    ACTIONABILITY REQUIREMENTS (MANDATORY for every tool/technique mentioned):
    Every section MUST include actionability information so readers can immediately implement what they learn:
    1. Implementation Time: State how long to get started (e.g., "15 minutes to first result")
    2. Skill Level: Specify required expertise (beginner/intermediate/advanced)
    3. Prerequisites: List required tools/accounts (e.g., "Requires Python 3.9+ and pip")
    4. Concrete Steps: Provide 3-5 numbered steps to get started
    5. Expected Outcome: What user will achieve (e.g., "You'll have a working classifier")

    SOURCE REQUIREMENTS:
    - Every tool mentioned MUST include a direct link to its documentation or GitHub
    - Include at least 2 sources per section with verifiable URLs
    - Do NOT invent or guess URLs - only include URLs you found via web search

    When you find relevant web pages, you MUST embed hyperlinks directly within the text of the 'content' field for each section using HTML \`<a>\` tags. For example: \`<a href='URL' target="_blank" rel="noopener noreferrer">this new tool</a>\`.

    The final output MUST be a valid JSON object. Do not include any text outside of the JSON object, including markdown backticks.
    IMPORTANT: Do NOT use emojis, icons, or special symbols in the subject line or section titles.
    The JSON object should have the following structure:
    {
      "subject": "A catchy, compelling email subject line that appeals to ALL selected audiences (not just one specific field). Focus on the universal AI/technology theme that connects all readers. NO emojis or symbols.",
      "introduction": "A warm, engaging introduction that hooks the reader immediately. This must be plain text, without any HTML tags. It should feel like a friendly note from a knowledgeable colleague.",
      "sections": [
        {
          "title": "Title for this section (e.g., a specific tool or how-to)",
          "content": "Conversational, detailed explanation written in a natural voice. Explain what it does and how to use it. Share genuine insights and context. This content MUST include inline HTML \`<a>\` tags linking to the original sources or examples. The text should be formatted with HTML paragraph tags \`<p>\` for readability.",
          "imagePrompt": "A simple, descriptive prompt for an AI image generator to create a relevant image for this section. The image MUST be in a ${styleDescription} style.",
          "actionability": {
            "implementationTime": "e.g., '15 minutes' or '1 hour'",
            "skillLevel": "beginner | intermediate | advanced",
            "prerequisites": ["Required tool 1", "Required account/API key"],
            "steps": ["Step 1: Do this", "Step 2: Then this", "Step 3: Finally this"],
            "expectedOutcome": "What the reader will have achieved"
          },
          "sources": [
            {"url": "https://actual-url.com", "title": "Source title"}
          ]
        }
      ],
      "conclusion": "A thoughtful, conversational closing paragraph. This must be plain text, without any HTML tags. End with something genuine and memorable."
    }
  ` + searchGuidance;
}

/**
 * Generate newsletter with agentic loop
 *
 * EXACT logic from server.ts lines 907-1057
 * DO NOT MODIFY the agentic loop pattern or force final response logic
 */
export async function generateNewsletter(
  params: GenerateNewsletterParams
): Promise<GenerateNewsletterResult> {
  try {
    const { topics, audience, tone, flavors, imageStyle, personaId } = params;

    // Phase 12.0: Look up persona if provided
    let persona: WriterPersona | null = null;
    if (personaId) {
      persona = personaDbService.getPersonaById(personaId);
      console.log(`[Newsletter] Using persona: ${persona?.name || 'not found (id: ' + personaId + ')'}`);
    }

    const audienceDescription = getAudienceDescription(audience);
    const flavorInstructions = getFlavorInstructions(flavors);
    const toneInstructions = getToneInstructions(tone);  // Phase 13.1: Research-backed tone execution rules
    const dateRange = getDateRangeDescription();
    const styleDescription = imageStyleMap[imageStyle] || "photorealistic";
    const personaInstructions = buildPersonaInstructions(persona);

    const userMessage = buildUserMessage(
      topics,
      audienceDescription,
      tone,
      flavorInstructions,
      dateRange,
      styleDescription,
      personaInstructions,
      toneInstructions
    );

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Agentic loop for tool use - EXACT pattern from server.ts
    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < MAX_SEARCH_ITERATIONS) {
      iterations++;
      console.log(`[Newsletter] Agentic loop iteration ${iterations}/${MAX_SEARCH_ITERATIONS}`);

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
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    // EXACT pattern from server.ts lines 966-1008
    if (iterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[Newsletter] Reached max iterations (${MAX_SEARCH_ITERATIONS}), forcing final response`);

      // Extract tool_use blocks from response
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );

      // Add the assistant message with tool_use
      messages.push({
        role: "assistant",
        content: response.content,
      });

      // Add tool_result blocks for each tool_use (required by API)
      // Include an explicit instruction after the tool results
      const toolResultContent: (Anthropic.Messages.ToolResultBlockParam | Anthropic.Messages.TextBlockParam)[] = [
        ...toolUseBlocks.map(block => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: "[Max iterations reached - proceeding with gathered information]",
        })),
        {
          type: "text" as const,
          text: "Now please generate the newsletter based on the search results you gathered. Return only the JSON response.",
        }
      ];

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      // Final call WITHOUT tools to force text output
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: messages,
      });
      console.log('[Newsletter] Final response stop_reason:', response.stop_reason);
      console.log('[Newsletter] Final response content types:', response.content.map(b => b.type));
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response and sanitize emojis - EXACT logic from server.ts
    try {
      const newsletter = JSON.parse(textBlock.text);
      const sanitized = sanitizeNewsletter(newsletter);

      // Auto-save newsletter to SQLite
      const newsletterId = `nl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      try {
        newsletterDbService.saveNewsletter(
          {
            id: newsletterId,
            subject: sanitized.subject || 'Untitled Newsletter',
            introduction: sanitized.introduction || '',
            sections: sanitized.sections || [],
            conclusion: sanitized.conclusion || '',
            promptOfTheDay: sanitized.promptOfTheDay,
          },
          topics,
          { audience, tone, imageStyle }
        );
        console.log(`[Newsletter] Auto-saved to SQLite: ${newsletterId}`);
        // Include the ID in the response so frontend knows the saved ID
        sanitized.id = newsletterId;
      } catch (saveError) {
        console.error('[Newsletter] Failed to auto-save:', saveError);
        // Continue even if save fails - newsletter was still generated
      }

      return {
        success: true,
        newsletter: sanitized,
        text: JSON.stringify(sanitized),
      };
    } catch {
      // If JSON parsing fails, return the text as-is
      return {
        success: true,
        text: textBlock.text,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating newsletter:", errorMessage);
    console.error("Full error:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
