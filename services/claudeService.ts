import { withRetry } from "../utils/retry";
import { apiRequest, unwrapResponse, extractErrorMessage, API_BASE } from "./apiHelper";

// Helper functions (kept for consistency, used by UI only)
const getAudienceDescription = (audience: string[]): string => {
  const audienceMap: Record<string, string> = {
    academics:
      "- Forensic anthropology and digital/computational archeology professors.",
    business: "- Business administrators and leaders upskilling in AI.",
    analysts:
      "- Business analytics analysts seeking new ways to extract intelligence from structured and unstructured data lakes.",
  };

  if (audience.length === 0 || audience.length === 3) {
    return `
- Forensic anthropology and digital/computational archeology professors teaching university courses.
- Business administrators and leaders looking to upskill their AI knowledge to maintain career goals and improve efficiency.
- Business analytics analysts seeking new ways to extract intelligence from structured and unstructured data lakes.
        `;
  }

  return audience.map((key) => audienceMap[key]).join("\n");
};

const getFlavorInstructions = (flavors: string[]): string => {
  if (flavors.length === 0) return "";

  const flavorMap: Record<string, string> = {
    includeHumor:
      "- You may sprinkle in one or two instances of light-hearted, clever humor where appropriate, without undermining the main tone.",
    useSlang:
      "- You may incorporate some modern, conversational slang to make the content feel more relatable and authentic.",
    useJargon:
      "- You should incorporate relevant technical jargon where it adds precision and is appropriate for the expert audience.",
    useAnalogies:
      "- You should use relatable analogies and simple metaphors to explain complex technical concepts.",
    citeData:
      "- Wherever possible, you should cite specific data points, statistics, or findings to add authority and credibility to your points.",
  };

  const instructions = flavors.map((key) => flavorMap[key]).filter(Boolean);

  if (instructions.length === 0) return "";

  return `

    Additionally, adhere to the following stylistic instructions:
    ${instructions.join("\n")}
    `;
};

// Response types
interface TextResponse {
  text: string;
}

interface ImageResponse {
  image?: string;
  error?: string;
}

// Main API functions that call the backend

const generateNewsletterContentInternal = async (
  topics: string[],
  audience: string[],
  tone: string,
  flavors: string[],
  imageStyle: string,
  personaId?: string
): Promise<{ text: string }> => {
  try {
    return await apiRequest<TextResponse>('/api/generateNewsletter', {
      method: "POST",
      body: JSON.stringify({
        topics,
        audience,
        tone,
        flavors,
        imageStyle,
        personaId,
      }),
    });
  } catch (error) {
    console.error("Error generating newsletter content:", error);
    throw error;
  }
};

const generateTopicSuggestionsInternal = async (
  audience: string[],
  sources?: string
): Promise<{ text: string }> => {
  try {
    return await apiRequest<TextResponse>('/api/generateTopicSuggestions', {
      method: "POST",
      body: JSON.stringify({
        audience,
        sources,
      }),
    });
  } catch (error) {
    console.error("Error generating topic suggestions:", error);
    throw error;
  }
};

const generateTrendingTopicsInternal = async (
  audience: string[]
): Promise<{ text: string }> => {
  try {
    return await apiRequest<TextResponse>('/api/generateTrendingTopics', {
      method: "POST",
      body: JSON.stringify({
        audience,
      }),
    });
  } catch (error) {
    console.error("Error generating trending topics:", error);
    throw error;
  }
};

// New: Generate trending topics based on REAL trending data from web sources
interface TrendingSource {
  title: string;
  url: string;
  author?: string;
  publication?: string;
  category: string;
  summary?: string;
}

export interface TrendingWithSourcesResponse {
  text: string;
  sources: TrendingSource[];
}

const generateTrendingTopicsWithSourcesInternal = async (
  audience: string[],
  trendingSources: TrendingSource[]
): Promise<TrendingWithSourcesResponse> => {
  try {
    // Format sources for Claude
    const sourceSummary = trendingSources.map(s =>
      `- "${s.title}" from ${s.publication} (${s.category}): ${s.url}`
    ).join('\n');

    const data = await apiRequest<TextResponse>('/api/generateTrendingTopicsWithSources', {
      method: "POST",
      body: JSON.stringify({
        audience,
        sources: sourceSummary,
      }),
    });

    return {
      text: data.text,
      sources: trendingSources,
    };
  } catch (error) {
    console.error("Error generating trending topics with sources:", error);
    throw error;
  }
};

/**
 * Image Generation via Backend (calls Stability AI)
 *
 * JUSTIFIED EXCEPTION for API Response Standardization (Phase 7b):
 * This function intentionally uses raw fetch instead of apiRequest because:
 * 1. Returns a placeholder image (1x1 transparent PNG) on ANY error
 * 2. Provides detailed status-code-specific error messages (401, 403, 400, 429)
 * 3. Already uses unwrapResponse() for response handling
 *
 * This prevents the app from crashing when Stability AI is unavailable or
 * quota is exceeded. Callers expect a base64 string, not an exception.
 */
const generateImageInternal = async (prompt: string, imageStyle?: string): Promise<string> => {
  try {
    console.log("Attempting image generation via backend...");
    console.log("Prompt:", prompt.substring(0, 100) + "...");
    console.log("Image Style:", imageStyle || "default (photorealistic)");

    const response = await fetch(`${API_BASE}/api/generateImage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, imageStyle }),
    });

    console.log("Backend Response Status:", response.status, response.statusText);

    if (!response.ok) {
      const errorJson = await response.json();
      const errorData = unwrapResponse<{ error?: string; details?: string }>(errorJson);
      console.error("Backend Error Response:", errorData);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Image generation error: ${response.status} - Authentication failed.`);
      }

      if (response.status === 400) {
        throw new Error(`Image generation error: 400 - ${errorData.details || "Bad request"}`);
      }

      if (response.status === 429) {
        throw new Error(`Image generation error: 429 - Rate limit exceeded. Please wait before retrying.`);
      }

      throw new Error(`Image generation error: ${response.status} - ${errorData.error || response.statusText}`);
    }

    const responseJson = await response.json();
    const data = unwrapResponse<ImageResponse>(responseJson);

    if (data.error) {
      throw new Error(`Image generation failed: ${data.error}`);
    }

    if (data.image) {
      console.log("Image generated successfully");
      return data.image;
    }

    throw new Error("No image data in response");
  } catch (error) {
    console.error("Error generating image:", error);
    // Return placeholder on error so app doesn't crash
    console.warn("Returning placeholder image due to error");
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  }
};

const editImageInternal = async (
  base64ImageData: string,
  _mimeType: string,
  _prompt: string
): Promise<string> => {
  // Image editing is not currently supported - return original image
  console.warn(
    "Image editing is not currently supported. Returning original image."
  );
  return base64ImageData;
};

export const generateNewsletterContent = withRetry(
  generateNewsletterContentInternal
);
export const generateTopicSuggestions = withRetry(
  generateTopicSuggestionsInternal
);
export const generateTrendingTopics = withRetry(
  generateTrendingTopicsInternal
);

// ===================================================================
// PHASE 15.4: PARALLEL TOPIC SUGGESTIONS V2
// ===================================================================

import type { SuggestedTopic } from '../types';

export interface TopicSuggestionsV2Response {
  success: boolean;
  topics?: SuggestedTopic[];
  perAudienceResults?: Array<{
    audienceId: string;
    topicCount: number;
    success: boolean;
    error?: string;
    durationMs: number;
  }>;
  totalDurationMs?: number;
}

/**
 * Generate topic suggestions using V2 parallel per-audience generation.
 *
 * Phase 15.4: This endpoint runs parallel agents for each audience,
 * each generating a set number of suggestions. Results are merged
 * with equal representation across all audiences.
 *
 * @param audience - Array of audience IDs
 * @param topicsPerAudience - Number of topics to generate per audience (default: 3)
 */
const generateTopicSuggestionsV2Internal = async (
  audience: string[],
  topicsPerAudience: number = 3
): Promise<TopicSuggestionsV2Response> => {
  try {
    console.log('[claudeService] generateTopicSuggestionsV2 called with:', {
      audience,
      topicsPerAudience,
    });

    const response = await apiRequest<TopicSuggestionsV2Response>('/api/generateTopicSuggestionsV2', {
      method: 'POST',
      body: JSON.stringify({
        audience,
        topicsPerAudience,
      }),
    });

    console.log('[claudeService] generateTopicSuggestionsV2 response:', {
      success: response.success,
      topicCount: response.topics?.length,
      perAudienceResults: response.perAudienceResults,
    });

    return response;
  } catch (error) {
    console.error('Error generating topic suggestions V2:', error);
    throw error;
  }
};

export const generateTopicSuggestionsV2 = withRetry(generateTopicSuggestionsV2Internal);

const generateCompellingTrendingContentInternal = async (
  audience: string[]
): Promise<{ text: string }> => {
  try {
    return await apiRequest<TextResponse>('/api/generateCompellingTrendingContent', {
      method: "POST",
      body: JSON.stringify({
        audience,
        sources: "fetch_fresh", // Signal backend to fetch and score fresh sources
      }),
    });
  } catch (error) {
    console.error("Error generating compelling trending content:", error);
    throw error;
  }
};

export const generateTrendingTopicsWithSources = withRetry(
  generateTrendingTopicsWithSourcesInternal
);
export const generateCompellingTrendingContent = withRetry(
  generateCompellingTrendingContentInternal
);
export const generateImage = withRetry(generateImageInternal);
export const editImage = withRetry(editImageInternal);

// ===================================================================
// PHASE 15.3b: PARALLEL TRENDING TOPICS V2
// ===================================================================

import type { TrendingTopic } from '../types';

export interface ParallelGenConfig {
  mode: 'per-category' | 'per-audience' | 'hybrid';
  maxParallelAgents?: number;
  topicsPerAgent: number;
}

export interface GenerationTradeoffs {
  audienceCount: number;
  audienceBreakdown: {
    defaultCount: number;
    customCount: number;
    byCategory: Record<string, number>;
  };
  mode: ParallelGenConfig['mode'];
  agentCount: number;
  estimatedTopics: number;
  estimatedTimeSeconds: number;
  estimatedApiCalls: number;
}

export interface PerAudienceResultSummary {
  batchId: string;
  audienceIds: string[];
  topicCount: number;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface TrendingTopicsV2Response {
  success: boolean;
  topics?: TrendingTopic[];
  needsConfirmation?: boolean;
  tradeoffs?: GenerationTradeoffs;
  perAudienceResults?: PerAudienceResultSummary[];
  totalDurationMs?: number;
  cacheKey?: string;
  cached?: boolean;
}

/**
 * Generate trending topics using V2 parallel per-audience generation.
 *
 * Phase 15.3b: This endpoint runs parallel agents for each audience,
 * then merges results with equal representation to eliminate bias.
 *
 * @param audience - Array of audience IDs
 * @param config - Optional parallel generation configuration
 * @param confirmed - Whether to skip trade-off confirmation and execute
 */
const generateTrendingTopicsV2Internal = async (
  audience: string[],
  config?: Partial<ParallelGenConfig>,
  confirmed: boolean = true
): Promise<TrendingTopicsV2Response> => {
  try {
    return await apiRequest<TrendingTopicsV2Response>('/api/generateTrendingTopicsV2', {
      method: 'POST',
      body: JSON.stringify({
        audience,
        config,
        confirmed,
      }),
    });
  } catch (error) {
    console.error('Error generating trending topics V2:', error);
    throw error;
  }
};

export const generateTrendingTopicsV2 = withRetry(generateTrendingTopicsV2Internal);

// ===================================================================
// PRESET MANAGEMENT ENDPOINTS
// ===================================================================

export const savePresetsToCloud = async (presets: any[], accessToken: string): Promise<{ message: string }> => {
  try {
    return await apiRequest<{ message: string }>('/api/savePresets', {
      method: "POST",
      body: JSON.stringify({
        presets,
        accessToken,
      }),
    });
  } catch (error) {
    console.error("Error saving presets to cloud:", error);
    throw error;
  }
};

/**
 * Load presets from Google Sheets via backend API
 * Uses apiRequest with custom Authorization header
 */
export const loadPresetsFromCloud = async (accessToken: string): Promise<{ presets: any[] }> => {
  try {
    return await apiRequest<{ presets: any[] }>('/api/loadPresets', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    console.error("Error loading presets from cloud:", error);
    throw error;
  }
};

// ===================================================================
// PHASE 16: PER-AUDIENCE NEWSLETTER GENERATION (V4)
// ===================================================================

import type {
  AudienceConfig,
  TopicWithAudienceId,
  MismatchResolution,
  PerAudienceGenerationParams,
  PerAudienceNewsletterResult,
  MismatchInfo,
  EnhancedNewsletter,
} from '../types';

/**
 * Topic-audience analysis result from the backend
 */
export interface TopicAudienceAnalysisResult {
  matched: Record<string, TopicWithAudienceId[]>;
  mismatched: MismatchInfo[];
  orphanedAudiences: AudienceConfig[];
}

/**
 * V4 generation response from the backend
 */
export interface V4GenerationResponse {
  success: boolean;
  newsletter?: EnhancedNewsletter;
  sectionResults: Array<{
    audienceId: string;
    audienceName: string;
    topicCount: number;
    sourceCount: number;
    generationTimeMs: number;
  }>;
  appliedOverlaps: Array<{
    originalTopic: TopicWithAudienceId;
    originalAudienceId: string;
    suggestedTopic: string;
    targetAudienceId: string;
    overlapType: string;
    confidence: number;
  }>;
  balanceResult: {
    balancedMap: Record<string, TopicWithAudienceId[]>;
    orphanedAudiences: AudienceConfig[];
    unmatchedTopics: TopicWithAudienceId[];
    reassignedTopics: TopicWithAudienceId[];
    hasMismatches: boolean;
    stats: {
      totalTopics: number;
      matchedTopics: number;
      orphanedAudienceCount: number;
      mismatchCount: number;
    };
  };
  metrics: {
    totalTimeMs: number;
    topicGenerationTimeMs: number;
    sourceAllocationTimeMs: number;
    contentGenerationTimeMs: number;
    parallelEfficiency: number;
  };
  error?: string;
}

/**
 * Analyze topic-audience matches before V4 generation.
 *
 * Phase 16: This function calls the backend to analyze which topics
 * match which audiences, identify mismatches, and find orphaned audiences.
 *
 * @param selectedTopics - Topics with audience ID tags
 * @param selectedAudiences - Selected audience configurations
 * @returns Analysis result with matched, mismatched, and orphaned info
 */
export async function analyzeTopicAudienceMatch(
  selectedTopics: TopicWithAudienceId[],
  selectedAudiences: AudienceConfig[]
): Promise<TopicAudienceAnalysisResult> {
  console.log('[ClaudeService] analyzeTopicAudienceMatch START', {
    topicCount: selectedTopics.length,
    audienceCount: selectedAudiences.length,
  });

  try {
    const response = await apiRequest<TopicAudienceAnalysisResult>('/api/analyzeTopicAudienceMatch', {
      method: 'POST',
      body: JSON.stringify({
        selectedTopics,
        selectedAudiences,
      }),
    });

    console.log('[ClaudeService] analyzeTopicAudienceMatch END', {
      matchedAudiences: Object.keys(response.matched).length,
      mismatchedCount: response.mismatched.length,
      orphanedCount: response.orphanedAudiences.length,
    });

    return response;
  } catch (error) {
    console.error('[ClaudeService] analyzeTopicAudienceMatch ERROR:', error);
    throw error;
  }
}

/**
 * Generate newsletter with per-audience topic isolation (V4).
 *
 * Phase 16: This function calls the V4 backend pipeline that:
 * - Balances topics across audiences
 * - Generates fresh topics for orphaned audiences
 * - Detects strategic platform overlaps
 * - Allocates sources per audience
 * - Generates content in parallel
 *
 * @param params - Generation parameters
 * @param mismatchResolutions - Optional user resolutions for mismatched topics
 * @returns Generation result with newsletter and metrics
 */
export async function generateNewsletterV4(
  params: PerAudienceGenerationParams,
  mismatchResolutions?: MismatchResolution[]
): Promise<V4GenerationResponse> {
  console.log('[ClaudeService] generateNewsletterV4 START', {
    audienceCount: params.audiences.length,
    topicCount: params.selectedTopics?.length || 0,
    hasResolutions: !!mismatchResolutions?.length,
  });

  try {
    const response = await apiRequest<V4GenerationResponse>('/api/generateNewsletterV4', {
      method: 'POST',
      body: JSON.stringify({
        audiences: params.audiences,
        selectedTopics: params.selectedTopics,
        topicsPerAudience: params.topicsPerAudience,
        tone: params.tone,
        flavors: params.flavors,
        imageStyle: params.imageStyle,
        personaId: params.personaId,
        promptOfTheDay: params.promptOfTheDay,
        mismatchResolutions,
      }),
    });

    console.log('[ClaudeService] generateNewsletterV4 END', {
      success: response.success,
      hasNewsletter: !!response.newsletter,
      sectionCount: response.sectionResults?.length,
      totalTimeMs: response.metrics?.totalTimeMs,
    });

    return response;
  } catch (error) {
    console.error('[ClaudeService] generateNewsletterV4 ERROR:', error);
    throw error;
  }
}
