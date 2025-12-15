/**
 * Prompt Client Service
 * Frontend API client for managing saved prompts via SQLite backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const response = await fetch(`${API_BASE}/api/prompts?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Failed to fetch prompts');
  }

  return response.json();
};

/**
 * Get a single prompt by ID
 */
export const getPromptById = async (id: string): Promise<SavedPrompt> => {
  const response = await fetch(`${API_BASE}/api/prompts/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Failed to fetch prompt');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prompt),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Failed to save prompt');
  }

  return response.json();
};

/**
 * Delete a prompt from the library
 */
export const deletePrompt = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/prompts/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Failed to delete prompt');
  }

  return response.json();
};
