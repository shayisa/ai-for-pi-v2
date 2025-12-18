/**
 * Prompt Client Service
 * Frontend API client for managing saved prompts via SQLite backend
 */

import { apiRequest } from './apiHelper.ts';

// Types
export interface SavedPrompt {
  id: string;
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
  createdAt: string;
}

export interface PromptsListResponse {
  prompts: SavedPrompt[];
  count: number;
}

/**
 * Get all saved prompts
 */
export const getPrompts = async (limit: number = 50): Promise<PromptsListResponse> => {
  return apiRequest<PromptsListResponse>(`/api/prompts?limit=${limit}`);
};

/**
 * Get a single prompt by ID
 */
export const getPromptById = async (id: string): Promise<SavedPrompt> => {
  return apiRequest<SavedPrompt>(`/api/prompts/${id}`);
};

/**
 * Save a new prompt to the library
 */
export const savePrompt = async (prompt: {
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
}): Promise<SavedPrompt> => {
  return apiRequest<SavedPrompt>('/api/prompts', {
    method: 'POST',
    body: JSON.stringify(prompt),
  });
};

/**
 * Delete a prompt from the library
 */
export const deletePrompt = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/prompts/${id}`, {
    method: 'DELETE',
  });
};
