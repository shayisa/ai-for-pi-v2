/**
 * Audience Client Service
 * Frontend API client for managing custom audiences via SQLite backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const response = await fetch(`${API_BASE}/api/audiences`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch audiences');
  }

  return response.json();
};

/**
 * Get audience by ID
 */
export const getAudienceById = async (id: string): Promise<CustomAudience> => {
  const response = await fetch(`${API_BASE}/api/audiences/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch audience');
  }

  return response.json();
};

/**
 * Create a new custom audience
 */
export const createAudience = async (
  name: string,
  description: string,
  generated?: AudienceGenerated
): Promise<CustomAudience> => {
  const response = await fetch(`${API_BASE}/api/audiences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, generated }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create audience');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/audiences/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audience),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save audience');
  }

  return response.json();
};

/**
 * Delete a custom audience
 */
export const deleteAudience = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/audiences/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete audience');
  }

  return response.json();
};
