/**
 * usePrompts Hook
 *
 * Manages saved prompts library using SQLite backend:
 * - Loads prompts from SQLite on mount
 * - Saves new prompts to library
 * - Deletes prompts from library
 */

import { useState, useCallback, useEffect } from 'react';
import * as promptApi from '../services/promptClientService';
import type { SavedPrompt } from '../services/promptClientService';

interface UsePromptsReturn {
  prompts: SavedPrompt[];
  isLoading: boolean;
  error: string | null;
  savePrompt: (prompt: {
    title: string;
    summary: string;
    examplePrompts: string[];
    promptCode: string;
  }) => Promise<SavedPrompt>;
  deletePrompt: (id: string) => Promise<void>;
  refreshPrompts: () => Promise<void>;
}

const MAX_PROMPTS = 100;

export function usePrompts(): UsePromptsReturn {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load prompts from SQLite on mount
  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await promptApi.getPrompts(MAX_PROMPTS);
      setPrompts(response.prompts);
      console.log(`[Prompts] Loaded ${response.prompts.length} prompts from SQLite`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load prompts';
      console.error('[Prompts] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const savePrompt = useCallback(
    async (prompt: {
      title: string;
      summary: string;
      examplePrompts: string[];
      promptCode: string;
    }): Promise<SavedPrompt> => {
      try {
        const saved = await promptApi.savePrompt(prompt);

        // Update local state with the new prompt at the top
        setPrompts((prev) => [saved, ...prev]);

        console.log(`[Prompts] Saved prompt: ${saved.title}`);
        return saved;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save prompt';
        console.error('[Prompts] Error saving:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const deletePrompt = useCallback(async (id: string): Promise<void> => {
    try {
      await promptApi.deletePrompt(id);

      // Remove from local state
      setPrompts((prev) => prev.filter((p) => p.id !== id));

      console.log(`[Prompts] Deleted prompt: ${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete prompt';
      console.error('[Prompts] Error deleting:', e);
      throw new Error(msg);
    }
  }, []);

  const refreshPrompts = useCallback(async () => {
    await loadPrompts();
  }, [loadPrompts]);

  return {
    prompts,
    isLoading,
    error,
    savePrompt,
    deletePrompt,
    refreshPrompts,
  };
}

export default usePrompts;
