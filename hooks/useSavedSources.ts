/**
 * useSavedSources Hook
 *
 * Manages saved inspiration sources using SQLite backend:
 * - Loads all saved sources on mount
 * - Creates, updates, and deletes sources
 * - Toggles favorite status
 * - Tracks which source URLs are already saved (for duplicate detection)
 *
 * Phase: Topic/Source Persistence
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import * as sourceApi from '../services/sourceClientService';
import type { SavedSource, CreateSourceInput, CreateSourcesBatchInput, CreateSourcesBatchResult } from '../services/sourceClientService';

interface UseSavedSourcesReturn {
  sources: SavedSource[];
  savedUrls: Set<string>;
  isLoading: boolean;
  error: string | null;
  saveSource: (source: CreateSourceInput) => Promise<SavedSource>;
  saveSourcesBatch: (sources: CreateSourcesBatchInput[]) => Promise<CreateSourcesBatchResult>; // Phase 15.6
  updateSource: (id: string, updates: Partial<{
    title: string;
    url: string;
    author: string;
    publication: string;
    date: string;
    category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
    summary: string;
  }>) => Promise<SavedSource>;
  deleteSource: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  incrementUsage: (id: string) => Promise<void>;
  refreshSources: () => Promise<void>;
  searchSources: (query: string) => Promise<SavedSource[]>;
  getSourcesByCategory: (category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev') => Promise<SavedSource[]>;
  getSourceCount: () => number;
  isSourceSaved: (url: string) => boolean;
}

export function useSavedSources(): UseSavedSourcesReturn {
  const [sources, setSources] = useState<SavedSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoized set of saved URLs for quick duplicate detection
  const savedUrls = useMemo(() => new Set(sources.map((s) => s.url)), [sources]);

  // Load all sources from SQLite on mount
  const loadSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sourceApi.getAllSources();
      setSources(response.sources);
      console.log(`[SavedSources] Loaded ${response.sources.length} sources`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load sources';
      console.error('[SavedSources] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const saveSource = useCallback(
    async (source: CreateSourceInput): Promise<SavedSource> => {
      // Check for duplicate URL locally first
      if (savedUrls.has(source.url)) {
        throw new Error('Source with this URL already exists');
      }

      try {
        const created = await sourceApi.createSource(source);

        // Add to local state and re-sort (favorites first, then by createdAt)
        setSources((prev) => {
          const updated = [created, ...prev];
          return updated.sort((a, b) => {
            if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        });

        console.log(`[SavedSources] Created: ${created.title} (${created.id})`);
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save source';
        console.error('[SavedSources] Error creating:', e);
        throw new Error(msg);
      }
    },
    [savedUrls]
  );

  /**
   * Phase 15.6: Batch save sources
   * Used for auto-saving trending sources
   */
  const saveSourcesBatch = useCallback(
    async (sourcesToSave: CreateSourcesBatchInput[]): Promise<CreateSourcesBatchResult> => {
      try {
        const result = await sourceApi.createSourcesBatch(sourcesToSave);

        if (result.created.length > 0) {
          // Add new sources to local state and re-sort
          setSources((prev) => {
            const updated = [...result.created, ...prev];
            return updated.sort((a, b) => {
              if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
          });
        }

        console.log(`[SavedSources] Batch saved ${result.created.length} sources, ${result.duplicateCount} duplicates skipped`);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to batch save sources';
        console.error('[SavedSources] Error batch saving:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const updateSource = useCallback(
    async (
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
      try {
        const updated = await sourceApi.updateSource(id, updates);

        // Update local state
        setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));

        console.log(`[SavedSources] Updated: ${updated.title} (${updated.id})`);
        return updated;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to update source';
        console.error('[SavedSources] Error updating:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const deleteSource = useCallback(async (id: string): Promise<void> => {
    try {
      await sourceApi.deleteSource(id);

      // Remove from local state
      setSources((prev) => prev.filter((s) => s.id !== id));

      console.log(`[SavedSources] Deleted: ${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete source';
      console.error('[SavedSources] Error deleting:', e);
      throw new Error(msg);
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await sourceApi.toggleSourceFavorite(id);

      // Update local state with the updated source and re-sort (favorites first)
      setSources((prev) => {
        const updatedList = prev.map((s) => (s.id === id ? updated : s));
        // Re-sort: favorites first, then by createdAt
        return updatedList.sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });

      console.log(`[SavedSources] Toggled favorite: ${id} -> ${updated.isFavorite}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to toggle favorite';
      console.error('[SavedSources] Error toggling favorite:', e);
      throw new Error(msg);
    }
  }, []);

  const incrementUsage = useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await sourceApi.incrementSourceUsage(id);

      // Update local state with incremented usage count
      setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));

      console.log(`[SavedSources] Incremented usage: ${id} -> ${updated.usageCount}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to increment usage';
      console.error('[SavedSources] Error incrementing usage:', e);
      throw new Error(msg);
    }
  }, []);

  const refreshSources = useCallback(async () => {
    await loadSources();
  }, [loadSources]);

  const searchSources = useCallback(async (query: string): Promise<SavedSource[]> => {
    try {
      const response = await sourceApi.searchSources(query);
      return response.sources;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to search sources';
      console.error('[SavedSources] Error searching:', e);
      throw new Error(msg);
    }
  }, []);

  const getSourcesByCategory = useCallback(
    async (category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev'): Promise<SavedSource[]> => {
      try {
        const response = await sourceApi.getSourcesByCategory(category);
        return response.sources;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to get sources by category';
        console.error('[SavedSources] Error getting by category:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const getSourceCount = useCallback((): number => {
    return sources.length;
  }, [sources]);

  const isSourceSaved = useCallback(
    (url: string): boolean => {
      return savedUrls.has(url);
    },
    [savedUrls]
  );

  return {
    sources,
    savedUrls,
    isLoading,
    error,
    saveSource,
    saveSourcesBatch, // Phase 15.6
    updateSource,
    deleteSource,
    toggleFavorite,
    incrementUsage,
    refreshSources,
    searchSources,
    getSourcesByCategory,
    getSourceCount,
    isSourceSaved,
  };
}

export default useSavedSources;
