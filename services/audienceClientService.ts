/**
 * Audience Client Service
 * Frontend API client for managing custom audiences via SQLite backend
 */

import { apiRequest } from './apiHelper.ts';

// Types
export interface AudienceGenerated {
  persona: string;
  relevance_keywords: string[];
  subreddits?: string[];
  arxiv_categories?: string[];
  search_templates?: string[];
}

export interface CustomAudience {
  id: string;
  name: string;
  description: string;
  generated?: AudienceGenerated;
  isDefault: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AudienceListResponse {
  audiences: CustomAudience[];
  count: number;
}

/**
 * Get all custom audiences (non-default)
 */
export const getCustomAudiences = async (): Promise<AudienceListResponse> => {
  return apiRequest<AudienceListResponse>('/api/audiences');
};

/**
 * Get audience by ID
 */
export const getAudienceById = async (id: string): Promise<CustomAudience> => {
  return apiRequest<CustomAudience>(`/api/audiences/${encodeURIComponent(id)}`);
};

/**
 * Create a new custom audience
 */
export const createAudience = async (
  name: string,
  description: string,
  generated?: AudienceGenerated
): Promise<CustomAudience> => {
  return apiRequest<CustomAudience>('/api/audiences', {
    method: 'POST',
    body: JSON.stringify({ name, description, generated }),
  });
};

/**
 * Save/upsert an audience (for migration from localStorage)
 */
export const saveAudience = async (audience: {
  id: string;
  name: string;
  description: string;
  generated?: AudienceGenerated;
  isCustom?: boolean;
}): Promise<CustomAudience> => {
  return apiRequest<CustomAudience>('/api/audiences/save', {
    method: 'POST',
    body: JSON.stringify(audience),
  });
};

/**
 * Delete a custom audience
 */
export const deleteAudience = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/audiences/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
};
