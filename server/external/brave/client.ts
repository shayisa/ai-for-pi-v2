/**
 * Brave Search API Client
 *
 * Provides web search functionality via Brave Search API.
 * Includes caching, timeout handling, and graceful degradation.
 *
 * @module external/brave/client
 *
 * ## Original Location
 * - server.ts lines 463-591
 *
 * ## PRESERVATION NOTE
 * This code was extracted EXACTLY from server.ts without modification.
 * Do NOT change the API endpoints, timeout values, or error handling logic.
 */
import * as apiKeyDbService from '../../services/apiKeyDbService';
import { searchCache } from '../../cache/searchCache';

/**
 * Format Brave Search API results for Claude consumption
 *
 * Transforms raw API response into markdown-formatted text
 * that Claude can use in its responses.
 *
 * @param results - Raw Brave Search API response
 * @returns Formatted markdown string
 *
 * @example
 * const formatted = formatBraveSearchResults(apiResponse);
 * // Returns: "## Web Search Results\n\n### Web Results:\n1. **Title** (url)..."
 */
export const formatBraveSearchResults = (results: any): string => {
  if (!results || (!results.web && !results.news)) {
    return "No search results found.";
  }

  let formatted = "## Web Search Results\n\n";

  // Format web results
  if (results.web && results.web.results && results.web.results.length > 0) {
    formatted += "### Web Results:\n";
    results.web.results.slice(0, 10).forEach((result: any, index: number) => {
      formatted += `\n${index + 1}. **${result.title}** (${result.url})\n`;
      if (result.description) {
        formatted += `   ${result.description}\n`;
      }
    });
  }

  // Format news results if available
  if (results.news && results.news.results && results.news.results.length > 0) {
    formatted += "\n### News Results:\n";
    results.news.results.slice(0, 5).forEach((result: any, index: number) => {
      formatted += `\n${index + 1}. **${result.title}** (${result.url})\n`;
      if (result.description) {
        formatted += `   ${result.description}\n`;
      }
      if (result.date) {
        formatted += `   Published: ${result.date}\n`;
      }
    });
  }

  return formatted;
};

/**
 * Fetch results from Brave Search API with timeout
 *
 * NO mock fallback - returns graceful degradation message if unavailable.
 *
 * @param query - Search query string
 * @returns Formatted search results or fallback message
 *
 * Configuration:
 * - Timeout: 10 seconds
 * - Freshness: "pm" (past month)
 * - Result count: 10
 *
 * API Key Resolution:
 * 1. SQLite database (adminEmail's 'brave' key)
 * 2. VITE_BRAVE_SEARCH_API_KEY environment variable
 */
export const fetchBraveSearchResults = async (query: string): Promise<string> => {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first, then env var
  let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'brave') : null;
  if (!apiKey) {
    apiKey = process.env.VITE_BRAVE_SEARCH_API_KEY || null;
  }

  // IMPORTANT: These messages are checked by topicValidationService to determine
  // whether a topic is fictional. Rate limit messages should NOT cause topics
  // to be marked as fictional - only truly empty results should.
  const NO_RESULTS_MESSAGE = `No current web search results available for "${query}". Please use your training knowledge to provide accurate, helpful information about this topic.`;
  const RATE_LIMITED_MESSAGE = `[RATE_LIMITED] Search temporarily rate limited for "${query}". Unable to validate topic.`;
  const API_ERROR_MESSAGE = `[API_ERROR] Search temporarily unavailable for "${query}". Unable to validate topic.`;

  if (!apiKey) {
    console.warn("[BraveSearch] API key not configured - using training knowledge");
    return API_ERROR_MESSAGE;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pm`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[BraveSearch] Rate limit exceeded");
        return RATE_LIMITED_MESSAGE; // Return distinct message for rate limits
      } else if (response.status === 401 || response.status === 403) {
        console.warn("[BraveSearch] Authentication failed - check API key");
        return API_ERROR_MESSAGE;
      } else {
        console.warn(`[BraveSearch] API error: ${response.status}`);
        return API_ERROR_MESSAGE;
      }
    }

    const data = await response.json();

    if (!data || (!data.web && !data.news)) {
      console.log("[BraveSearch] Empty results received");
      return NO_RESULTS_MESSAGE;
    }

    return formatBraveSearchResults(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[BraveSearch] Request timeout");
    } else {
      console.warn("[BraveSearch] Error:", error);
    }
    return NO_RESULTS_MESSAGE;
  }
};

/**
 * Web search function with caching
 *
 * Uses searchCache (15-minute TTL) to reduce API calls.
 *
 * @param query - Search query string
 * @returns Cached or fresh search results
 */
export const performWebSearch = async (query: string): Promise<string> => {
  // Check cache first
  const cached = searchCache.get(query);
  if (cached) {
    return cached;
  }

  console.log(`[WebSearch] Fetching: ${query}`);
  try {
    const result = await fetchBraveSearchResults(query);
    searchCache.set(query, result);
    return result;
  } catch (error) {
    console.error("performWebSearch error:", error);
    // Return empty results instead of fake mock data (quality improvement)
    return "Web search temporarily unavailable. Please use your training knowledge for this query.";
  }
};

/**
 * Process tool calls from Claude agentic loops
 *
 * Currently only supports web_search tool.
 *
 * @param toolName - Name of the tool to invoke
 * @param toolInput - Tool input parameters
 * @returns Tool execution result
 * @throws {Error} If tool is unknown
 */
export const processToolCall = async (
  toolName: string,
  toolInput: Record<string, string>
): Promise<string> => {
  if (toolName === "web_search") {
    return performWebSearch(toolInput.query);
  }
  throw new Error(`Unknown tool: ${toolName}`);
};
