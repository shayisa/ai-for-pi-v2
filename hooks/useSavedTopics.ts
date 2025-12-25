/**
 * useSavedTopics Hook
 *
 * Manages saved topics using SQLite backend:
 * - Loads all saved topics on mount
 * - Creates, updates, and deletes topics
 * - Toggles favorite status
 * - Searches topics by title
 *
 * Phase: Topic/Source Persistence
 */

import { useState, useCallback, useEffect } from 'react';
import * as topicApi from '../services/topicClientService';
import type { SavedTopic, CreateTopicInput, CreateTopicsBatchInput, CreateTopicsBatchResult } from '../services/topicClientService';

interface UseSavedTopicsReturn {
  topics: SavedTopic[];
  isLoading: boolean;
  error: string | null;
  saveTopic: (topic: CreateTopicInput) => Promise<SavedTopic>;
  saveTopicsBatch: (topics: CreateTopicsBatchInput[]) => Promise<CreateTopicsBatchResult>; // Phase 15.5
  updateTopic: (id: string, updates: Partial<{
    title: string;
    description: string;
    category: 'suggested' | 'trending' | 'manual';
    sourceUrl: string;
  }>) => Promise<SavedTopic>;
  deleteTopic: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  refreshTopics: () => Promise<void>;
  searchTopics: (query: string) => Promise<SavedTopic[]>;
  getTopicCount: () => number;
}

export function useSavedTopics(): UseSavedTopicsReturn {
  const [topics, setTopics] = useState<SavedTopic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all topics from SQLite on mount
  const loadTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await topicApi.getAllTopics();
      setTopics(response.topics);
      console.log(`[SavedTopics] Loaded ${response.topics.length} topics`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load topics';
      console.error('[SavedTopics] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const saveTopic = useCallback(
    async (topic: CreateTopicInput): Promise<SavedTopic> => {
      try {
        const created = await topicApi.createTopic(topic);

        // Add to local state and re-sort (favorites first, then by createdAt)
        setTopics((prev) => {
          const updated = [created, ...prev];
          return updated.sort((a, b) => {
            if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        });

        console.log(`[SavedTopics] Created: ${created.title} (${created.id})`);
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save topic';
        console.error('[SavedTopics] Error creating:', e);
        throw new Error(msg);
      }
    },
    []
  );

  /**
   * Phase 15.5: Batch save topics
   * Used for auto-saving suggested topics
   */
  const saveTopicsBatch = useCallback(
    async (topicsToSave: CreateTopicsBatchInput[]): Promise<CreateTopicsBatchResult> => {
      try {
        const result = await topicApi.createTopicsBatch(topicsToSave);

        if (result.created.length > 0) {
          // Add new topics to local state and re-sort
          setTopics((prev) => {
            const updated = [...result.created, ...prev];
            return updated.sort((a, b) => {
              if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          });
        }

        console.log(`[SavedTopics] Batch saved ${result.created.length} topics, ${result.duplicateCount} duplicates skipped`);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to batch save topics';
        console.error('[SavedTopics] Error batch saving:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const updateTopic = useCallback(
    async (
      id: string,
      updates: Partial<{
        title: string;
        description: string;
        category: 'suggested' | 'trending' | 'manual';
        sourceUrl: string;
      }>
    ): Promise<SavedTopic> => {
      try {
        const updated = await topicApi.updateTopic(id, updates);

        // Update local state
        setTopics((prev) => prev.map((t) => (t.id === id ? updated : t)));

        console.log(`[SavedTopics] Updated: ${updated.title} (${updated.id})`);
        return updated;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to update topic';
        console.error('[SavedTopics] Error updating:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const deleteTopic = useCallback(async (id: string): Promise<void> => {
    try {
      await topicApi.deleteTopic(id);

      // Remove from local state
      setTopics((prev) => prev.filter((t) => t.id !== id));

      console.log(`[SavedTopics] Deleted: ${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete topic';
      console.error('[SavedTopics] Error deleting:', e);
      throw new Error(msg);
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await topicApi.toggleTopicFavorite(id);

      // Update local state with the updated topic and re-sort (favorites first)
      setTopics((prev) => {
        const updatedList = prev.map((t) => (t.id === id ? updated : t));
        // Re-sort: favorites first, then by createdAt
        return updatedList.sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });

      console.log(`[SavedTopics] Toggled favorite: ${id} -> ${updated.isFavorite}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to toggle favorite';
      console.error('[SavedTopics] Error toggling favorite:', e);
      throw new Error(msg);
    }
  }, []);

  const refreshTopics = useCallback(async () => {
    await loadTopics();
  }, [loadTopics]);

  const searchTopics = useCallback(async (query: string): Promise<SavedTopic[]> => {
    try {
      const response = await topicApi.searchTopics(query);
      return response.topics;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to search topics';
      console.error('[SavedTopics] Error searching:', e);
      throw new Error(msg);
    }
  }, []);

  const getTopicCount = useCallback((): number => {
    return topics.length;
  }, [topics]);

  return {
    topics,
    isLoading,
    error,
    saveTopic,
    saveTopicsBatch, // Phase 15.5
    updateTopic,
    deleteTopic,
    toggleFavorite,
    refreshTopics,
    searchTopics,
    getTopicCount,
  };
}

export default useSavedTopics;
