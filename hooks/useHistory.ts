/**
 * useHistory Hook
 *
 * Manages newsletter generation history using SQLite backend:
 * - Loads newsletter history from SQLite on mount
 * - Saves new newsletters to SQLite
 * - Provides history navigation and management
 * - Supports both v1 (legacy) and v2 (enhanced) newsletter formats
 */

import { useState, useCallback, useEffect } from 'react';
import type { Newsletter, EnhancedNewsletter, EnhancedHistoryItem } from '../types';
import * as newsletterApi from '../services/newsletterClientService';
import type { NewsletterWithFormat } from '../services/newsletterClientService';

interface UseHistoryReturn {
  history: EnhancedHistoryItem[];
  isLoading: boolean;
  error: string | null;
  addToHistory: (newsletter: Newsletter, topics: string[]) => Promise<void>;
  loadFromHistory: (item: EnhancedHistoryItem) => {
    newsletter: Newsletter | EnhancedNewsletter;
    topics: string[];
    formatVersion: 'v1' | 'v2';
  };
  deleteFromHistory: (id: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const MAX_HISTORY_ITEMS = 50;

/**
 * Convert format-aware newsletter response to EnhancedHistoryItem
 */
const newsletterWithFormatToHistoryItem = (item: NewsletterWithFormat): EnhancedHistoryItem => ({
  id: item.id,
  date: new Date(item.createdAt).toLocaleString(),
  subject: item.subject,
  newsletter: item.newsletter,
  topics: item.topics,
  formatVersion: item.formatVersion,
});

export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<EnhancedHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history from SQLite on mount
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await newsletterApi.getNewsletters(MAX_HISTORY_ITEMS);
      const items = response.newsletters.map(newsletterWithFormatToHistoryItem);
      setHistory(items);
      console.log(`[History] Loaded ${items.length} newsletters from SQLite (v1: ${items.filter(i => i.formatVersion === 'v1').length}, v2: ${items.filter(i => i.formatVersion === 'v2').length})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load history';
      console.error('[History] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const addToHistory = useCallback(async (newsletter: Newsletter, topics: string[]) => {
    try {
      // Save to SQLite (v1 format - enhanced newsletters are saved via server directly)
      const saved = await newsletterApi.saveNewsletter(
        {
          id: newsletter.id || `nl_${Date.now()}`,
          subject: newsletter.subject,
          introduction: newsletter.introduction,
          sections: newsletter.sections,
          conclusion: newsletter.conclusion,
          promptOfTheDay: newsletter.promptOfTheDay,
        },
        topics
      );

      // Update local state with the new item at the top
      const newItem: EnhancedHistoryItem = {
        id: saved.id,
        date: new Date(saved.createdAt).toLocaleString(),
        subject: saved.subject,
        newsletter: {
          id: saved.id,
          subject: saved.subject,
          introduction: saved.introduction,
          sections: saved.sections,
          conclusion: saved.conclusion,
          promptOfTheDay: saved.promptOfTheDay,
        },
        topics: saved.topics,
        formatVersion: 'v1',
      };
      setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS));

      console.log(`[History] Saved newsletter: ${saved.subject}`);
    } catch (e) {
      console.error('[History] Error saving newsletter:', e);
      throw e;
    }
  }, []);

  const loadFromHistory = useCallback((item: EnhancedHistoryItem): {
    newsletter: Newsletter | EnhancedNewsletter;
    topics: string[];
    formatVersion: 'v1' | 'v2';
  } => {
    return {
      newsletter: item.newsletter,
      topics: item.topics,
      formatVersion: item.formatVersion,
    };
  }, []);

  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      await newsletterApi.deleteNewsletter(id);
      setHistory(prev => prev.filter(item => String(item.id) !== id));
      console.log(`[History] Deleted newsletter: ${id}`);
    } catch (e) {
      console.error('[History] Error deleting newsletter:', e);
      throw e;
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  return {
    history,
    isLoading,
    error,
    addToHistory,
    loadFromHistory,
    deleteFromHistory,
    refreshHistory,
  };
}
