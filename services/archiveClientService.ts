/**
 * Archive Client Service
 * Frontend API client for managing trending data archives
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types matching backend
export interface ArchiveContent {
  trendingTopics?: Array<{ title: string; summary: string }>;
  compellingContent?: {
    actionableCapabilities?: Array<{
      title: string;
      description: string;
      implementationGuide?: string;
      relevantTools?: string[];
    }>;
    essentialTools?: Array<{
      name: string;
      purpose: string;
      url: string;
    }>;
  };
  trendingSources?: Array<{
    id: string;
    title: string;
    url: string;
    author?: string;
    publication?: string;
    date?: string;
    category: string;
    summary?: string;
  }>;
  metadata?: {
    sourceCount: number;
    generatedAt: string;
  };
}

export interface Archive {
  id: string;
  createdAt: string;
  name: string;
  audience: string[];
  content: ArchiveContent;
}

export interface ArchiveListResponse {
  archives: Archive[];
  count: number;
}

/**
 * Save a new archive
 */
export const saveArchive = async (
  content: ArchiveContent,
  audience: string[],
  name?: string
): Promise<Archive> => {
  const response = await fetch(`${API_BASE}/api/archives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, audience, name })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save archive');
  }

  return response.json();
};

/**
 * Get all archives (newest first)
 */
export const getArchives = async (limit = 50): Promise<ArchiveListResponse> => {
  const response = await fetch(`${API_BASE}/api/archives?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch archives');
  }

  return response.json();
};

/**
 * Get a single archive by ID
 */
export const getArchiveById = async (id: string): Promise<Archive> => {
  const response = await fetch(`${API_BASE}/api/archives/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch archive');
  }

  return response.json();
};

/**
 * Delete an archive by ID
 */
export const deleteArchive = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/archives/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete archive');
  }

  return response.json();
};

/**
 * Search archives by name
 */
export const searchArchives = async (query: string, limit = 20): Promise<ArchiveListResponse> => {
  const response = await fetch(`${API_BASE}/api/archives/search/${encodeURIComponent(query)}?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search archives');
  }

  return response.json();
};
