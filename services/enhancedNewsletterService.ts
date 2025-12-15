/**
 * Enhanced Newsletter Client Service
 *
 * Client-side API calls for enhanced newsletter generation.
 */

import type { EnhancedNewsletter, AudienceConfig, PromptOfTheDay } from '../types';

const API_BASE = '/api';

export interface GenerateEnhancedNewsletterRequest {
  topics: string[];
  audiences: AudienceConfig[];
  imageStyle?: string;
  promptOfTheDay?: PromptOfTheDay | null;
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
}

export interface GenerateAudienceConfigResponse {
  config: AudienceConfig;
  timeMs: number;
  tokensUsed?: number;
}

/**
 * Generate an enhanced newsletter
 */
export async function generateEnhancedNewsletter(
  request: GenerateEnhancedNewsletterRequest
): Promise<GenerateEnhancedNewsletterResponse> {
  const response = await fetch(`${API_BASE}/generateEnhancedNewsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate enhanced newsletter');
  }

  return response.json();
}

/**
 * Generate audience configuration using AI
 */
export async function generateAudienceConfig(
  name: string,
  description: string
): Promise<GenerateAudienceConfigResponse> {
  const response = await fetch(`${API_BASE}/generateAudienceConfig`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate audience config');
  }

  return response.json();
}

/**
 * Get default audiences with their pre-configured settings
 */
export async function getDefaultAudiences(): Promise<{ audiences: AudienceConfig[] }> {
  const response = await fetch(`${API_BASE}/defaultAudiences`);

  if (!response.ok) {
    throw new Error('Failed to fetch default audiences');
  }

  return response.json();
}

/**
 * Fetch sources from multiple APIs (for preview/debugging)
 */
export async function fetchMultiSources(options: {
  keywords?: string[];
  subreddits?: string[];
  arxivCategories?: string[];
  limit?: number;
}): Promise<{
  articles: Array<{
    title: string;
    url: string;
    source: string;
    date?: string;
    snippet?: string;
  }>;
  totalCount: number;
  fetchTimeMs: number;
}> {
  const params = new URLSearchParams();
  if (options.keywords) params.set('keywords', options.keywords.join(','));
  if (options.subreddits) params.set('subreddits', options.subreddits.join(','));
  if (options.arxivCategories) params.set('arxiv', options.arxivCategories.join(','));
  if (options.limit) params.set('limit', String(options.limit));

  const response = await fetch(`${API_BASE}/fetchMultiSources?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch sources');
  }

  return response.json();
}

export default {
  generateEnhancedNewsletter,
  generateAudienceConfig,
  getDefaultAudiences,
  fetchMultiSources,
};
