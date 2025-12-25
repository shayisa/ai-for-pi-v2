/**
 * Topic Client Service
 * Frontend API client for managing saved topics via SQLite backend
 *
 * Phase: Topic/Source Persistence
 */

import { apiRequest } from './apiHelper.ts';

// ======================
// TYPES
// ======================

export interface SavedTopic {
  id: string;
  title: string;
  description: string | null;
  category: 'suggested' | 'trending' | 'manual';
  sourceUrl: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicInput {
  title: string;
  description?: string;
  category?: 'suggested' | 'trending' | 'manual';
  sourceUrl?: string;
}

export interface TopicsResponse {
  topics: SavedTopic[];
}

// ======================
// TOPIC API
// ======================

/**
 * Get all saved topics
 * @param limit - Maximum number of topics to return (default 100)
 */
export const getAllTopics = async (limit?: number): Promise<TopicsResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<TopicsResponse>(`/api/topics${params}`);
};

/**
 * Get a topic by ID
 */
export const getTopicById = async (id: string): Promise<SavedTopic> => {
  return apiRequest<SavedTopic>(`/api/topics/${encodeURIComponent(id)}`);
};

/**
 * Search topics by title
 */
export const searchTopics = async (query: string, limit?: number): Promise<TopicsResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<TopicsResponse>(`/api/topics/search/${encodeURIComponent(query)}${params}`);
};

/**
 * Get topics by category
 */
export const getTopicsByCategory = async (
  category: 'suggested' | 'trending' | 'manual',
  limit?: number
): Promise<TopicsResponse> => {
  const params = limit ? `?limit=${limit}` : '';
  return apiRequest<TopicsResponse>(`/api/topics/category/${encodeURIComponent(category)}${params}`);
};

/**
 * Get topic count
 */
export const getTopicCount = async (): Promise<{ count: number }> => {
  return apiRequest<{ count: number }>('/api/topics/count');
};

/**
 * Create a new saved topic
 */
export const createTopic = async (topic: CreateTopicInput): Promise<SavedTopic> => {
  return apiRequest<SavedTopic>('/api/topics', {
    method: 'POST',
    body: JSON.stringify(topic),
  });
};

/**
 * Update an existing topic
 */
export const updateTopic = async (
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    category: 'suggested' | 'trending' | 'manual';
    sourceUrl: string;
  }>
): Promise<SavedTopic> => {
  return apiRequest<SavedTopic>(`/api/topics/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Delete a topic
 */
export const deleteTopic = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/topics/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};

/**
 * Toggle topic favorite status
 */
export const toggleTopicFavorite = async (id: string): Promise<SavedTopic> => {
  return apiRequest<SavedTopic>(`/api/topics/${encodeURIComponent(id)}/favorite`, {
    method: 'POST',
  });
};

/**
 * Phase 15.5: Batch create topics
 * Used for auto-saving suggested topics
 * Skips duplicates by title (case-insensitive)
 */
export interface CreateTopicsBatchInput {
  title: string;
  category: 'suggested' | 'trending' | 'manual';
  sourceUrl?: string;
  description?: string;
}

export interface CreateTopicsBatchResult {
  created: SavedTopic[];
  duplicateCount: number;
}

export const createTopicsBatch = async (
  topics: CreateTopicsBatchInput[]
): Promise<CreateTopicsBatchResult> => {
  return apiRequest<CreateTopicsBatchResult>('/api/topics/batch', {
    method: 'POST',
    body: JSON.stringify({ topics }),
  });
};
