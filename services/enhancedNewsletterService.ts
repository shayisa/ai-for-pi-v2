/**
 * Enhanced Newsletter Client Service
 *
 * Client-side API calls for enhanced newsletter generation.
 *
 * Phase 15: Added validation types for anti-hallucination feedback
 */

import type { EnhancedNewsletter, AudienceConfig, PromptOfTheDay } from '../types';
import { apiRequest } from './apiHelper';

/**
 * Phase 15: Topic validation result from pre-generation checks
 */
export interface TopicValidationResult {
  topic: string;
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  suggestedAlternative?: string;
  error?: string;
}

export interface GenerateEnhancedNewsletterRequest {
  topics: string[];
  audiences: AudienceConfig[];
  imageStyle?: string;
  promptOfTheDay?: PromptOfTheDay | null;
  personaId?: string;
  tone?: string;      // Phase 14: User-selected tone
  flavors?: string[]; // Phase 14: User-selected flavors
}

export interface GenerateEnhancedNewsletterResponse {
  newsletter: EnhancedNewsletter;
  sources: {
    gdelt: { status: string; count: number };
    arxiv: { status: string; count: number };
    hackernews: { status: string; count: number };
    reddit: { status: string; count: number };
    github: { status: string; count: number };
    devto: { status: string; count: number };
  };
  /** Phase 15: Validation results (available in error responses) */
  validation?: {
    validTopics: string[];
    invalidTopics: { topic: string; reason: string }[];
    suggestions: string[];
  };
}

export interface GenerateAudienceConfigResponse {
  config: AudienceConfig;
  timeMs: number;
  tokensUsed?: number;
}

export interface FetchMultiSourcesResponse {
  articles: Array<{
    title: string;
    url: string;
    source: string;
    date?: string;
    snippet?: string;
  }>;
  totalCount: number;
  fetchTimeMs: number;
}

/**
 * Generate an enhanced newsletter
 */
export async function generateEnhancedNewsletter(
  request: GenerateEnhancedNewsletterRequest
): Promise<GenerateEnhancedNewsletterResponse> {
  return apiRequest<GenerateEnhancedNewsletterResponse>('/api/generateEnhancedNewsletter', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Generate audience configuration using AI
 */
export async function generateAudienceConfig(
  name: string,
  description: string
): Promise<GenerateAudienceConfigResponse> {
  return apiRequest<GenerateAudienceConfigResponse>('/api/generateAudienceConfig', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

/**
 * Get default audiences with their pre-configured settings
 */
export async function getDefaultAudiences(): Promise<{ audiences: AudienceConfig[] }> {
  return apiRequest<{ audiences: AudienceConfig[] }>('/api/defaultAudiences');
}

/**
 * Fetch sources from multiple APIs (for preview/debugging)
 */
export async function fetchMultiSources(options: {
  keywords?: string[];
  subreddits?: string[];
  arxivCategories?: string[];
  limit?: number;
}): Promise<FetchMultiSourcesResponse> {
  const params = new URLSearchParams();
  if (options.keywords) params.set('keywords', options.keywords.join(','));
  if (options.subreddits) params.set('subreddits', options.subreddits.join(','));
  if (options.arxivCategories) params.set('arxiv', options.arxivCategories.join(','));
  if (options.limit) params.set('limit', String(options.limit));

  return apiRequest<FetchMultiSourcesResponse>(`/api/fetchMultiSources?${params}`);
}

export default {
  generateEnhancedNewsletter,
  generateAudienceConfig,
  getDefaultAudiences,
  fetchMultiSources,
};
