/**
 * useGoogleWorkspace Hook
 *
 * @deprecated This hook is no longer used. Workflow actions have been moved directly to App.tsx
 * and subscribers are now managed via SQLite (subscriberClientService).
 *
 * This file is kept for reference but should not be used in new code.
 *
 * Manages Google Workspace integration including:
 * - OAuth authentication
 * - Google Drive operations
 * - Google Sheets operations (DEPRECATED - use SQLite)
 * - Gmail operations
 * - Settings persistence
 */

import { useState, useCallback, useEffect } from 'react';
import type { GoogleSettings, GapiAuthData, Newsletter } from '../types';
import * as googleApi from '../services/googleApiService';

interface WorkflowStatus {
  message: string;
  type: 'success' | 'error';
}

interface WorkflowActions {
  savedToDrive: boolean;
  sentEmail: boolean;
}

interface UseGoogleWorkspaceReturn {
  // Auth state
  authData: GapiAuthData | null;
  isGoogleApiInitialized: boolean;
  isAuthenticated: boolean;

  // Settings
  googleSettings: GoogleSettings | null;
  setGoogleSettings: React.Dispatch<React.SetStateAction<GoogleSettings | null>>;
  saveSettings: (settings: GoogleSettings) => void;

  // Workflow
  workflowStatus: WorkflowStatus | null;
  workflowActions: WorkflowActions;

  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  executeWorkflowAction: (action: 'drive' | 'sheet' | 'gmail', newsletter: Newsletter, topics: string[], selectedEmailLists?: string[]) => Promise<void>;

  // Drive operations
  saveToDrive: (newsletter: Newsletter, topics: string[]) => Promise<string>;
  loadFromDrive: (fileId: string) => Promise<{ newsletter: Newsletter; topics: string[] }>;
}

const DEFAULT_SETTINGS: GoogleSettings = {
  driveFolderName: 'AI for PI Newsletters',
};

export function useGoogleWorkspace(): UseGoogleWorkspaceReturn {
  const [authData, setAuthData] = useState<GapiAuthData | null>(null);
  const [isGoogleApiInitialized, setIsGoogleApiInitialized] = useState(false);
  const [googleSettings, setGoogleSettings] = useState<GoogleSettings | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [workflowActions, setWorkflowActions] = useState<WorkflowActions>({
    savedToDrive: false,
    sentEmail: false,
  });

  // Initialize Google API and load settings
  useEffect(() => {
    // Load settings from localStorage
    const storedSettings = localStorage.getItem('googleSettings');
    if (storedSettings) {
      setGoogleSettings(JSON.parse(storedSettings));
    } else {
      setGoogleSettings(DEFAULT_SETTINGS);
    }

    // Initialize Google API client
    googleApi.initClient(
      (data) => {
        setAuthData(data);
      },
      () => {
        setIsGoogleApiInitialized(true);
        console.log('[GoogleWorkspace] API initialized');
      }
    );
  }, []);

  const saveSettings = useCallback((settings: GoogleSettings) => {
    setGoogleSettings(settings);
    localStorage.setItem('googleSettings', JSON.stringify(settings));
  }, []);

  const signIn = useCallback(async () => {
    try {
      const userEmail = authData?.email || 'shayisa@gmail.com';
      await googleApi.signIn(userEmail);
      // Auth data will be set by the callback in initClient
    } catch (error) {
      console.error('[GoogleWorkspace] Sign in error:', error);
      throw error;
    }
  }, [authData?.email]);

  const signOut = useCallback(async () => {
    try {
      const userEmail = authData?.email || 'shayisa@gmail.com';
      await googleApi.signOut(userEmail);
      setAuthData(null);
      setWorkflowActions({ savedToDrive: false, sentEmail: false });
    } catch (error) {
      console.error('[GoogleWorkspace] Sign out error:', error);
      throw error;
    }
  }, [authData?.email]);

  const saveToDrive = useCallback(async (newsletter: Newsletter, topics: string[]): Promise<string> => {
    if (!googleSettings || !authData?.access_token || !authData?.email) {
      throw new Error('Not authenticated or settings not configured');
    }

    const result = await googleApi.saveToDrive(authData.email, newsletter, topics);
    setWorkflowActions(prev => ({ ...prev, savedToDrive: true }));
    return result;
  }, [googleSettings, authData]);

  const loadFromDrive = useCallback(async (fileId: string): Promise<{ newsletter: Newsletter; topics: string[] }> => {
    if (!authData?.access_token) {
      throw new Error('Not authenticated');
    }

    // This would need to be implemented in googleApiService
    throw new Error('loadFromDrive not yet implemented');
  }, [authData]);

  const executeWorkflowAction = useCallback(async (
    action: 'drive' | 'sheet' | 'gmail',
    newsletter: Newsletter,
    topics: string[],
    selectedEmailLists?: string[]
  ) => {
    if (!googleSettings || !authData?.access_token) {
      throw new Error('Not authenticated or settings not configured');
    }

    setWorkflowStatus({ message: `Executing ${action} action...`, type: 'success' });

    try {
      let resultMessage = '';

      switch (action) {
        case 'drive':
          resultMessage = await googleApi.saveToDrive(authData.email, newsletter, topics);
          setWorkflowActions(prev => ({ ...prev, savedToDrive: true }));
          break;

        case 'sheet':
          // DEPRECATED: Sheet logging removed - use SQLite instead
          throw new Error('Sheet logging is deprecated. Use SQLite newsletter logs.');

        case 'gmail':
          // DEPRECATED: Email sending moved to App.tsx with SQLite subscribers
          throw new Error('Email sending moved to App.tsx. Use SQLite subscribers.');
      }

      setWorkflowStatus({ message: resultMessage, type: 'success' });
    } catch (error) {
      console.error(`[GoogleWorkspace] ${action} action error:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setWorkflowStatus({ message: `Error during ${action} action: ${errorMessage}`, type: 'error' });
      throw error;
    }
  }, [googleSettings, authData, workflowActions]);

  return {
    // Auth state
    authData,
    isGoogleApiInitialized,
    isAuthenticated: !!authData?.access_token,

    // Settings
    googleSettings,
    setGoogleSettings,
    saveSettings,

    // Workflow
    workflowStatus,
    workflowActions,

    // Actions
    signIn,
    signOut,
    executeWorkflowAction,

    // Drive operations
    saveToDrive,
    loadFromDrive,
  };
}
