/**
 * Claude (Anthropic) API Client
 *
 * Provides Anthropic client with API key management.
 * Keys are loaded from SQLite first, then environment variables.
 *
 * @module external/claude/client
 *
 * ## Original Location
 * - server.ts lines 48-77
 *
 * ## PRESERVATION NOTE
 * This code was extracted EXACTLY from server.ts without modification.
 * Do NOT change the API key resolution logic or caching behavior.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as apiKeyDbService from '../../services/apiKeyDbService';

// Cache for Anthropic client (recreated if API key changes)
let cachedAnthropicClient: Anthropic | null = null;
let cachedApiKey: string | null = null;

/**
 * Get Anthropic client with API key from SQLite or env
 *
 * Resolution order:
 * 1. SQLite database (adminEmail's 'claude' key)
 * 2. VITE_ANTHROPIC_API_KEY environment variable
 *
 * @returns {Promise<Anthropic>} Configured Anthropic client
 * @throws {Error} If no API key is configured
 *
 * @example
 * const client = await getAnthropicClient();
 * const response = await client.messages.create({...});
 */
export const getAnthropicClient = async (): Promise<Anthropic> => {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first
  let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'claude') : null;

  // Fall back to environment variable
  if (!apiKey) {
    apiKey = process.env.VITE_ANTHROPIC_API_KEY || null;
  }

  if (!apiKey) {
    throw new Error('Claude API key not configured. Please add it in Settings.');
  }

  // Reuse cached client if API key hasn't changed
  if (cachedAnthropicClient && cachedApiKey === apiKey) {
    return cachedAnthropicClient;
  }

  // Create new client with updated API key
  cachedAnthropicClient = new Anthropic({ apiKey });
  cachedApiKey = apiKey;
  return cachedAnthropicClient;
};

/**
 * Tool definitions for Claude agentic loops
 *
 * @constant webSearchTool
 */
export const webSearchTool = {
  name: "web_search",
  description:
    "Search the web for current information about AI tools, trends, and how-to guides",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant web information",
      },
    },
    required: ["query"],
  },
};

/**
 * Search guidance prompt for web search tool usage
 *
 * @constant searchGuidance
 */
export const searchGuidance = `\nWhen conducting your web search using the web_search tool, you MUST prioritize information from reputable, high-quality sources. Your search should focus on major tech news sites (like TechCrunch AI), official AI research blogs (like OpenAI, Google DeepMind), academic publications, and domain-specific resources for forensics and archaeology. The goal is to find the most relevant, accurate, and current information to fulfill the user's request.`;
