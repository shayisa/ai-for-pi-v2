/**
 * usePresets Hook
 *
 * Manages newsletter presets including:
 * - Local storage persistence
 * - Cloud sync via Google Sheets
 */

import { useState, useCallback, useEffect } from 'react';
import type { Preset } from '../types';
import { savePresetsToCloud, loadPresetsFromCloud } from '../services/claudeService';

interface UsePresetsReturn {
  presets: Preset[];
  savePreset: (name: string, settings: Preset['settings']) => void;
  loadPreset: (preset: Preset) => Preset['settings'];
  deletePreset: (name: string) => void;
  syncToCloud: (accessToken: string) => Promise<void>;
  loadFromCloud: (accessToken: string) => Promise<void>;
}

const STORAGE_KEY = 'newsletterPresets';

export function usePresets(): UsePresetsReturn {
  const [presets, setPresets] = useState<Preset[]>([]);

  // Load presets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch (e) {
        console.error('[Presets] Failed to parse stored presets:', e);
      }
    }
  }, []);

  const savePreset = useCallback((name: string, settings: Preset['settings']) => {
    const newPreset: Preset = { name, settings };

    setPresets(prev => {
      // Remove existing preset with same name, add new one at the beginning
      const updated = prev.filter(p => p.name !== name);
      updated.unshift(newPreset);

      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const loadPreset = useCallback((preset: Preset): Preset['settings'] => {
    return preset.settings;
  }, []);

  const deletePreset = useCallback((name: string) => {
    setPresets(prev => {
      const updated = prev.filter(p => p.name !== name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const syncToCloud = useCallback(async (accessToken: string) => {
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in to sync presets to Google Sheets.');
    }
    await savePresetsToCloud(presets, accessToken);
  }, [presets]);

  const loadFromCloud = useCallback(async (accessToken: string) => {
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in to load presets from Google Sheets.');
    }

    const result = await loadPresetsFromCloud(accessToken);
    if (result.presets && result.presets.length > 0) {
      setPresets(result.presets);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.presets));
    }
  }, []);

  return {
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    syncToCloud,
    loadFromCloud,
  };
}
