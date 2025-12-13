/**
 * useHistory Hook
 *
 * Manages newsletter generation history including:
 * - Local storage persistence
 * - Google Sheets sync
 * - History limit management
 */

import { useState, useCallback, useEffect } from 'react';
import type { Newsletter, HistoryItem, GoogleSettings, GapiAuthData } from '../types';
import * as googleApi from '../services/googleApiService';

interface UseHistoryReturn {
  history: HistoryItem[];
  addToHistory: (newsletter: Newsletter, topics: string[]) => void;
  loadFromHistory: (item: HistoryItem) => { newsletter: Newsletter; topics: string[] };
  clearHistory: () => void;
  loadFromGoogleSheets: (settings: GoogleSettings, accessToken: string) => Promise<void>;
}

const STORAGE_KEY = 'generationHistory';
const MAX_HISTORY_ITEMS = 50;

export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error('[History] Failed to parse stored history:', e);
      }
    }
  }, []);

  const addToHistory = useCallback((newsletter: Newsletter, topics: string[]) => {
    const newItem: HistoryItem = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      subject: newsletter.subject,
      newsletter,
      topics,
    };

    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('[History] Could not save to localStorage (quota exceeded):', e);
      }

      return updated;
    });
  }, []);

  const loadFromHistory = useCallback((item: HistoryItem): { newsletter: Newsletter; topics: string[] } => {
    return {
      newsletter: item.newsletter,
      topics: item.topics,
    };
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadFromGoogleSheets = useCallback(async (settings: GoogleSettings, accessToken: string) => {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const sheetHistory = await googleApi.readHistoryFromSheet(
        settings.logSheetName,
        settings.driveFolderName
      );

      if (sheetHistory && sheetHistory.length > 0) {
        setHistory(sheetHistory);

        // Update localStorage to keep it in sync
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sheetHistory));
        } catch (e) {
          console.warn('[History] Could not update localStorage:', e);
        }

        console.log(`[History] Loaded ${sheetHistory.length} items from Google Sheets`);
      }
    } catch (e) {
      console.error('[History] Error loading from Google Sheets:', e);
      throw e;
    }
  }, []);

  return {
    history,
    addToHistory,
    loadFromHistory,
    clearHistory,
    loadFromGoogleSheets,
  };
}
