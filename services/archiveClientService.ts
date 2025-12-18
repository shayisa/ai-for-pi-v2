/**
 * Archive Client Service
 * Frontend API client for managing trending data archives
 */

import { apiRequest } from './apiHelper.ts';

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
  return apiRequest<Archive>('/api/archives', {
    method: 'POST',
    body: JSON.stringify({ content, audience, name })
  });
};

/**
 * Get all archives (newest first)
 */
export const getArchives = async (limit = 50): Promise<ArchiveListResponse> => {
  return apiRequest<ArchiveListResponse>(`/api/archives?limit=${limit}`);
};

/**
 * Get a single archive by ID
 */
export const getArchiveById = async (id: string): Promise<Archive> => {
  return apiRequest<Archive>(`/api/archives/${id}`);
};

/**
 * Delete an archive by ID
 */
export const deleteArchive = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/archives/${id}`, {
    method: 'DELETE'
  });
};

/**
 * Search archives by name
 */
export const searchArchives = async (query: string, limit = 20): Promise<ArchiveListResponse> => {
  return apiRequest<ArchiveListResponse>(
    `/api/archives/search/${encodeURIComponent(query)}?limit=${limit}`
  );
};
