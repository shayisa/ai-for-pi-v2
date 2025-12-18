/**
 * PresetsContext - Newsletter preset management
 *
 * Phase 6d: Extracted from App.tsx
 *
 * Handles:
 * - Preset CRUD operations
 * - localStorage persistence
 * - Cloud sync to Google Sheets (when authenticated)
 *
 * Three-Tier Storage Flow (MUST PRESERVE):
 * 1. Save preset → localStorage (instant feedback)
 * 2. Save preset → SQLite via /api/presets (persistent)
 * 3. (Optional) Sync → Google Drive via /api/savePresets (cloud backup)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Preset } from '../types';
import { savePresetsToCloud, loadPresetsFromCloud } from '../services/claudeService';
import { useAuth } from './AuthContext';

interface PresetsState {
  presets: Preset[];
  isSyncing: boolean;
}

interface PresetsActions {
  savePreset: (name: string, settings: Preset['settings']) => void;
  loadPreset: (preset: Preset) => Preset['settings'];
  deletePreset: (name: string) => void;
  setPresets: (presets: Preset[]) => void;
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
}

type PresetsContextValue = PresetsState & PresetsActions;

const PresetsContext = createContext<PresetsContextValue | null>(null);

interface PresetsProviderProps {
  children: ReactNode;
}

export const PresetsProvider: React.FC<PresetsProviderProps> = ({ children }) => {
  const { authData } = useAuth();

  // Presets state (from App.tsx line 155)
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Load presets from localStorage on mount
   * Preserves exact behavior from App.tsx useEffect (lines 1225-1228)
   */
  useEffect(() => {
    const storedPresets = localStorage.getItem('newsletterPresets');
    if (storedPresets) {
      try {
        setPresets(JSON.parse(storedPresets));
      } catch (err) {
        console.warn('[PresetsContext] Failed to parse stored presets');
      }
    }
  }, []);

  /**
   * Save a preset
   * Preserves exact behavior from App.tsx handleSavePreset (lines 234-249)
   */
  const savePreset = useCallback((name: string, settings: Preset['settings']) => {
    const newPreset: Preset = {
      name,
      settings,
    };
    const updatedPresets = presets.filter((p) => p.name !== name);
    updatedPresets.unshift(newPreset);
    setPresets(updatedPresets);
    localStorage.setItem('newsletterPresets', JSON.stringify(updatedPresets));
  }, [presets]);

  /**
   * Load a preset (returns settings for consumer to apply)
   * Preserves exact behavior from App.tsx handleLoadPreset (lines 251-258)
   */
  const loadPreset = useCallback((preset: Preset): Preset['settings'] => {
    return preset.settings;
  }, []);

  /**
   * Delete a preset
   * Preserves exact behavior from App.tsx handleDeletePreset (lines 260-264)
   */
  const deletePreset = useCallback((name: string) => {
    const updatedPresets = presets.filter((p) => p.name !== name);
    setPresets(updatedPresets);
    localStorage.setItem('newsletterPresets', JSON.stringify(updatedPresets));
  }, [presets]);

  /**
   * Sync presets to Google Sheets
   * Preserves exact behavior from App.tsx handleSyncPresetsToCloud (lines 319-329)
   */
  const syncToCloud = useCallback(async () => {
    if (!authData?.access_token) {
      throw new Error('Not authenticated. Please sign in to sync presets to Google Sheets.');
    }
    setIsSyncing(true);
    try {
      await savePresetsToCloud(presets, authData.access_token);
    } finally {
      setIsSyncing(false);
    }
  }, [presets, authData?.access_token]);

  /**
   * Load presets from Google Sheets
   * Preserves exact behavior from App.tsx handleLoadPresetsFromCloud (lines 331-345)
   */
  const loadFromCloud = useCallback(async () => {
    if (!authData?.access_token) {
      throw new Error('Not authenticated. Please sign in to load presets from Google Sheets.');
    }
    setIsSyncing(true);
    try {
      const result = await loadPresetsFromCloud(authData.access_token);
      if (result.presets && result.presets.length > 0) {
        setPresets(result.presets);
        localStorage.setItem('newsletterPresets', JSON.stringify(result.presets));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [authData?.access_token]);

  const value: PresetsContextValue = {
    // State
    presets,
    isSyncing,
    // Actions
    savePreset,
    loadPreset,
    deletePreset,
    setPresets,
    syncToCloud,
    loadFromCloud,
  };

  return <PresetsContext.Provider value={value}>{children}</PresetsContext.Provider>;
};

/**
 * Hook to access presets context
 * Throws error if used outside PresetsProvider
 */
export const usePresets = (): PresetsContextValue => {
  const context = useContext(PresetsContext);
  if (!context) {
    throw new Error('usePresets must be used within a PresetsProvider');
  }
  return context;
};

export default PresetsContext;
