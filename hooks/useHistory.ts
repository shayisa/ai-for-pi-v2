/**
 * useHistory Hook
 *
 * Manages newsletter generation history using SQLite backend:
 * - Loads newsletter history from SQLite on mount
 * - Saves new newsletters to SQLite
 * - Provides history navigation and management
 */

import { useState, useCallback, useEffect } from 'react';
import type { Newsletter, HistoryItem } from '../types';
import * as newsletterApi from '../services/newsletterClientService';

interface UseHistoryReturn {
  history: HistoryItem[];
  isLoading: boolean;
  error: string | null;
  addToHistory: (newsletter: Newsletter, topics: string[]) => Promise<void>;
  loadFromHistory: (item: HistoryItem) => { newsletter: Newsletter; topics: string[] };
  deleteFromHistory: (id: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const MAX_HISTORY_ITEMS = 50;

/**
 * Convert SQLite Newsletter to HistoryItem format
 */
const newsletterToHistoryItem = (nl: newsletterApi.Newsletter): HistoryItem => ({
  id: parseInt(nl.id, 10) || Date.now(),
  date: new Date(nl.createdAt).toLocaleString(),
  subject: nl.subject,
  newsletter: {
    id: nl.id,
    subject: nl.subject,
    introduction: nl.introduction,
    sections: nl.sections,
    conclusion: nl.conclusion,
    promptOfTheDay: nl.promptOfTheDay,
  },
  topics: nl.topics,
});

export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history from SQLite on mount
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await newsletterApi.getNewsletters(MAX_HISTORY_ITEMS);
      const items = response.newsletters.map(newsletterToHistoryItem);
      setHistory(items);
      console.log(`[History] Loaded ${items.length} newsletters from SQLite`);
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
      // Save to SQLite
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
      const newItem = newsletterToHistoryItem(saved);
      setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS));

      console.log(`[History] Saved newsletter: ${saved.subject}`);
    } catch (e) {
      console.error('[History] Error saving newsletter:', e);
      throw e;
    }
  }, []);

  const loadFromHistory = useCallback((item: HistoryItem): { newsletter: Newsletter; topics: string[] } => {
    return {
      newsletter: item.newsletter,
      topics: item.topics,
    };
  }, []);

  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      await newsletterApi.deleteNewsletter(id);
      setHistory(prev => prev.filter(item => String(item.newsletter.id) !== id));
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
