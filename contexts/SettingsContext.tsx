/**
 * SettingsContext - Settings and configuration state management
 *
 * Phase 6b: Extracted from App.tsx
 *
 * Handles:
 * - Settings modal visibility
 * - Google Drive/Gmail settings
 * - Settings persistence to localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { GoogleSettings } from '../types';

// Default settings (from App.tsx)
const DEFAULT_SETTINGS: GoogleSettings = {
  driveFolderName: 'AI for PI Newsletters',
};

interface SettingsState {
  isSettingsOpen: boolean;
  googleSettings: GoogleSettings | null;
}

interface SettingsActions {
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  saveSettings: (settings: GoogleSettings) => void;
}

type SettingsContextValue = SettingsState & SettingsActions;

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  // Settings modal state (from App.tsx line 153)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Google settings state (from App.tsx line 147)
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings | null>(null);

  /**
   * Open settings modal
   */
  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  /**
   * Close settings modal
   */
  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  /**
   * Toggle settings modal
   */
  const toggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  /**
   * Save settings to state and localStorage
   * Preserves exact behavior from App.tsx handleSaveSettings
   */
  const saveSettings = useCallback((settings: GoogleSettings) => {
    setGoogleSettings(settings);
    localStorage.setItem('googleSettings', JSON.stringify(settings));
  }, []);

  /**
   * Load settings from localStorage on mount
   * Preserves exact behavior from App.tsx useEffect (lines 1166-1173)
   */
  useEffect(() => {
    const storedSettings = localStorage.getItem('googleSettings');
    if (storedSettings) {
      try {
        setGoogleSettings(JSON.parse(storedSettings));
      } catch (err) {
        console.warn('[SettingsContext] Failed to parse stored settings');
        setGoogleSettings(DEFAULT_SETTINGS);
      }
    } else {
      setGoogleSettings(DEFAULT_SETTINGS);
    }
  }, []);

  const value: SettingsContextValue = {
    // State
    isSettingsOpen,
    googleSettings,
    // Actions
    openSettings,
    closeSettings,
    toggleSettings,
    saveSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

/**
 * Hook to access settings context
 * Throws error if used outside SettingsProvider
 */
export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

/**
 * Hook to check if Google Drive is configured
 */
export const useIsGoogleDriveConfigured = (): boolean => {
  const { googleSettings } = useSettings();
  return !!googleSettings?.driveFolderName;
};

export default SettingsContext;
