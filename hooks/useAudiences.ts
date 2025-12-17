/**
 * useAudiences Hook
 *
 * Manages custom audience state using SQLite backend:
 * - Loads audiences from SQLite on mount
 * - Provides CRUD operations
 * - Migrates localStorage data on first load
 */

import { useState, useCallback, useEffect } from 'react';
import type { AudienceConfig } from '../types';
import * as audienceApi from '../services/audienceClientService';

interface UseAudiencesReturn {
  customAudiences: AudienceConfig[];
  isLoading: boolean;
  error: string | null;
  addAudience: (audience: AudienceConfig) => Promise<void>;
  removeAudience: (id: string) => Promise<void>;
  refreshAudiences: () => Promise<void>;
}

const MIGRATION_KEY = 'customAudiences_migrated_to_sqlite';

export function useAudiences(): UseAudiencesReturn {
  const [customAudiences, setCustomAudiences] = useState<AudienceConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert API response to AudienceConfig format
  const toAudienceConfig = (audience: audienceApi.CustomAudience): AudienceConfig => ({
    id: audience.id,
    name: audience.name,
    description: audience.description,
    generated: audience.generated
      ? {
          persona: audience.generated.persona,
          relevance_keywords: audience.generated.relevance_keywords,
          subreddits: audience.generated.subreddits || [],
          arxiv_categories: audience.generated.arxiv_categories || [],
          search_templates: audience.generated.search_templates || [],
        }
      : undefined,
    isCustom: true,
  });

  // Load audiences from SQLite
  const loadAudiences = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await audienceApi.getCustomAudiences();
      const audiences = response.audiences.map(toAudienceConfig);
      setCustomAudiences(audiences);
      console.log(`[useAudiences] Loaded ${audiences.length} custom audiences from SQLite`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load audiences';
      console.error('[useAudiences] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Migrate localStorage data to SQLite (one-time)
  const migrateFromLocalStorage = useCallback(async () => {
    const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
    if (alreadyMigrated) return;

    const storedData = localStorage.getItem('customAudiences');
    if (!storedData) {
      localStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    try {
      const audiences: AudienceConfig[] = JSON.parse(storedData);
      if (audiences.length === 0) {
        localStorage.setItem(MIGRATION_KEY, 'true');
        return;
      }

      console.log(`[useAudiences] Migrating ${audiences.length} audiences from localStorage`);

      for (const audience of audiences) {
        try {
          await audienceApi.saveAudience({
            id: audience.id,
            name: audience.name,
            description: audience.description,
            generated: audience.generated,
            isCustom: true,
          });
        } catch (err) {
          console.warn(`[useAudiences] Failed to migrate audience ${audience.id}:`, err);
        }
      }

      localStorage.setItem(MIGRATION_KEY, 'true');
      console.log('[useAudiences] Migration complete');
    } catch (e) {
      console.error('[useAudiences] Migration failed:', e);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await migrateFromLocalStorage();
      await loadAudiences();
    };
    init();
  }, [loadAudiences, migrateFromLocalStorage]);

  // Add a new audience
  const addAudience = useCallback(async (audience: AudienceConfig) => {
    try {
      const saved = await audienceApi.saveAudience({
        id: audience.id,
        name: audience.name,
        description: audience.description,
        generated: audience.generated,
        isCustom: true,
      });

      setCustomAudiences(prev => [...prev, toAudienceConfig(saved)]);
      console.log(`[useAudiences] Added audience: ${audience.name}`);
    } catch (e) {
      console.error('[useAudiences] Error adding audience:', e);
      throw e;
    }
  }, []);

  // Remove an audience
  const removeAudience = useCallback(async (id: string) => {
    try {
      await audienceApi.deleteAudience(id);
      setCustomAudiences(prev => prev.filter(a => a.id !== id));
      console.log(`[useAudiences] Removed audience: ${id}`);
    } catch (e) {
      console.error('[useAudiences] Error removing audience:', e);
      throw e;
    }
  }, []);

  // Refresh audiences
  const refreshAudiences = useCallback(async () => {
    await loadAudiences();
  }, [loadAudiences]);

  return {
    customAudiences,
    isLoading,
    error,
    addAudience,
    removeAudience,
    refreshAudiences,
  };
}
