/**
 * Source Client Service
 * Frontend API client for managing saved inspiration sources via SQLite backend
 *
 * Phase: Topic/Source Persistence
 */

import { apiRequest } from './apiHelper.ts';

// ======================
// TYPES
// ======================

export interface SavedSource {
  id: string;
  title: string;
  url: string;
  author: string | null;
  publication: string | null;
  date: string | null;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
  summary: string | null;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSourceInput {
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
  summary?: string;
}

export interface SourcesResponse {
  sources: SavedSource[];
}

// ======================
// SOURCE API
// ======================

/**
 * Get all saved sources
 * @param limit - Maximum number of sources to return (default 100)
 */
export const getAllSources = async (limit?: number): Promise<SourcesResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<SourcesResponse>(`/api/sources${params}`);
};

/**
 * Get a source by ID
 */
export const getSourceById = async (id: string): Promise<SavedSource> => {
  return apiRequest<SavedSource>(`/api/sources/${encodeURIComponent(id)}`);
};

/**
 * Search sources by title
 */
export const searchSources = async (query: string, limit?: number): Promise<SourcesResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<SourcesResponse>(`/api/sources/search/${encodeURIComponent(query)}${params}`);
};

/**
 * Get sources by category
 */
export const getSourcesByCategory = async (
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev',
  limit?: number
): Promise<SourcesResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<SourcesResponse>(`/api/sources/category/${encodeURIComponent(category)}${params}`);
};

/**
 * Get favorite sources
 */
export const getFavoriteSources = async (limit?: number): Promise<SourcesResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<SourcesResponse>(`/api/sources/favorites${params}`);
};

/**
 * Get source count
 */
export const getSourceCount = async (): Promise<{ count: number }> => {
  return apiRequest<{ count: number }>('/api/sources/count');
};

/**
 * Create a new saved source
 */
export const createSource = async (source: CreateSourceInput): Promise<SavedSource> => {
  return apiRequest<SavedSource>('/api/sources', {
    method: 'POST',
    body: JSON.stringify(source),
  });
};

/**
 * Update an existing source
 */
export const updateSource = async (
  id: string,
  updates: Partial<{
    title: string;
    url: string;
    author: string;
    publication: string;
    date: string;
    category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
    summary: string;
  }>
): Promise<SavedSource> => {
  return apiRequest<SavedSource>(`/api/sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Delete a source
 */
export const deleteSource = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};

/**
 * Toggle source favorite status
 */
export const toggleSourceFavorite = async (id: string): Promise<SavedSource> => {
  return apiRequest<SavedSource>(`/api/sources/${encodeURIComponent(id)}/favorite`, {
    method: 'POST',
  });
};

/**
 * Increment usage count for a source
 * Call this when a source is used in newsletter generation
 */
export const incrementSourceUsage = async (id: string): Promise<SavedSource> => {
  return apiRequest<SavedSource>(`/api/sources/${encodeURIComponent(id)}/use`, {
    method: 'POST',
  });
};

/**
 * Phase 15.6: Batch create sources
 * Used for auto-saving trending sources
 * Skips duplicates by URL (case-insensitive)
 */
export interface CreateSourcesBatchInput {
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
  summary?: string;
}

export interface CreateSourcesBatchResult {
  created: SavedSource[];
  duplicateCount: number;
}

export const createSourcesBatch = async (
  sources: CreateSourcesBatchInput[]
): Promise<CreateSourcesBatchResult> => {
  return apiRequest<CreateSourcesBatchResult>('/api/sources/batch', {
    method: 'POST',
    body: JSON.stringify({ sources }),
  });
};
