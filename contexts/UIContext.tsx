/**
 * UIContext - UI state management
 *
 * Phase 6a: Extracted from App.tsx
 * Phase 6g.0: Extended with modal states (editingImage, isAudienceEditorOpen, isPersonaEditorOpen, editingPersona)
 *
 * Handles:
 * - Active page navigation
 * - Loading states (with progress)
 * - Error display and retry
 * - Workflow status messages (toasts)
 * - Modal states (image editor, audience editor, persona editor)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { WriterPersona } from '../types';

// Page types (from App.tsx)
export type ActivePage =
  | 'authentication'
  | 'discoverTopics'
  | 'toneAndVisuals'
  | 'generateNewsletter'
  | 'history'
  | 'subscriberManagement'
  | 'logs'
  | 'contentCalendar';

// Error state type (from App.tsx line 112-115)
export interface ErrorState {
  message: string;
  onRetry?: () => void;
}

// Workflow status type (from App.tsx line 149)
export interface WorkflowStatus {
  message: string;
  type: 'success' | 'error';
}

// Editing image state type (from App.tsx line 135)
export interface EditingImage {
  index: number;
  src: string;
  mimeType: string;
  prompt: string;
}

interface UIState {
  activePage: ActivePage;
  loading: string | null;
  progress: number;
  error: ErrorState | null;
  workflowStatus: WorkflowStatus | null;

  // Modal states (Phase 6g.0)
  editingImage: EditingImage | null;
  isAudienceEditorOpen: boolean;
  isPersonaEditorOpen: boolean;
  editingPersona: WriterPersona | null;
}

interface UIActions {
  setActivePage: (page: ActivePage) => void;
  setLoading: (message: string | null) => void;
  setProgress: (progress: number) => void;
  setError: (error: ErrorState | null) => void;
  setWorkflowStatus: (status: WorkflowStatus | null) => void;
  clearError: () => void;
  showSuccess: (message: string) => void;
  showError: (message: string, onRetry?: () => void) => void;

  // Modal actions (Phase 6g.0)
  setEditingImage: (image: EditingImage | null) => void;
  openImageEditor: (index: number, src: string, mimeType: string, prompt: string) => void;
  closeImageEditor: () => void;
  openAudienceEditor: () => void;
  closeAudienceEditor: () => void;
  openPersonaEditor: (persona?: WriterPersona | null) => void;
  closePersonaEditor: () => void;
}

type UIContextValue = UIState & UIActions;

const UIContext = createContext<UIContextValue | null>(null);

interface UIProviderProps {
  children: ReactNode;
  defaultPage?: ActivePage;
}

export const UIProvider: React.FC<UIProviderProps> = ({
  children,
  defaultPage = 'authentication',
}) => {
  // Core UI state (from App.tsx lines 121, 125-127, 149)
  const [activePage, setActivePage] = useState<ActivePage>(defaultPage);
  const [loading, setLoading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<ErrorState | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);

  // Modal states (Phase 6g.0 - from App.tsx lines 135, 214-215, 232)
  const [editingImage, setEditingImage] = useState<EditingImage | null>(null);
  const [isAudienceEditorOpen, setIsAudienceEditorOpen] = useState<boolean>(false);
  const [isPersonaEditorOpen, setIsPersonaEditorOpen] = useState<boolean>(false);
  const [editingPersona, setEditingPersona] = useState<WriterPersona | null>(null);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Show success message in workflow status
   */
  const showSuccess = useCallback((message: string) => {
    setWorkflowStatus({ message, type: 'success' });
  }, []);

  /**
   * Show error with optional retry callback
   */
  const showError = useCallback((message: string, onRetry?: () => void) => {
    setError({ message, onRetry });
  }, []);

  /**
   * Open image editor modal
   * Preserves exact behavior from App.tsx line 1629:
   * setEditingImage({ index, src, mimeType: 'image/png', prompt })
   */
  const openImageEditor = useCallback(
    (index: number, src: string, mimeType: string, prompt: string) => {
      setEditingImage({ index, src, mimeType, prompt });
    },
    []
  );

  /**
   * Close image editor modal
   * Preserves exact behavior from App.tsx line 1019, 1712
   */
  const closeImageEditor = useCallback(() => {
    setEditingImage(null);
  }, []);

  /**
   * Open audience editor modal
   * Preserves exact behavior from App.tsx line 1659
   */
  const openAudienceEditor = useCallback(() => {
    setIsAudienceEditorOpen(true);
  }, []);

  /**
   * Close audience editor modal
   * Preserves exact behavior from App.tsx line 1750
   */
  const closeAudienceEditor = useCallback(() => {
    setIsAudienceEditorOpen(false);
  }, []);

  /**
   * Open persona editor modal (optionally with persona to edit)
   * Preserves exact behavior from App.tsx lines 1599-1606:
   * - onOpenPersonaEditor: setEditingPersona(null); setIsPersonaEditorOpen(true)
   * - onEditPersona: setEditingPersona(persona); setIsPersonaEditorOpen(true)
   */
  const openPersonaEditor = useCallback((persona?: WriterPersona | null) => {
    setEditingPersona(persona ?? null);
    setIsPersonaEditorOpen(true);
  }, []);

  /**
   * Close persona editor modal
   * Preserves exact behavior from App.tsx lines 1760-1763
   */
  const closePersonaEditor = useCallback(() => {
    setIsPersonaEditorOpen(false);
    setEditingPersona(null);
  }, []);

  const value: UIContextValue = {
    // State
    activePage,
    loading,
    progress,
    error,
    workflowStatus,
    // Modal states (Phase 6g.0)
    editingImage,
    isAudienceEditorOpen,
    isPersonaEditorOpen,
    editingPersona,
    // Actions
    setActivePage,
    setLoading,
    setProgress,
    setError,
    setWorkflowStatus,
    clearError,
    showSuccess,
    showError,
    // Modal actions (Phase 6g.0)
    setEditingImage,
    openImageEditor,
    closeImageEditor,
    openAudienceEditor,
    closeAudienceEditor,
    openPersonaEditor,
    closePersonaEditor,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

/**
 * Hook to access UI context
 * Throws error if used outside UIProvider
 */
export const useUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

/**
 * Hook for navigation
 */
export const useNavigation = () => {
  const { activePage, setActivePage } = useUI();
  return { activePage, setActivePage };
};

/**
 * Hook for loading state
 */
export const useLoading = () => {
  const { loading, progress, setLoading, setProgress } = useUI();
  const isLoading = !!loading;
  return { loading, progress, isLoading, setLoading, setProgress };
};

/**
 * Hook for error handling
 */
export const useError = () => {
  const { error, setError, clearError, showError } = useUI();
  return { error, setError, clearError, showError };
};

/**
 * Hook for modal states (Phase 6g.0)
 */
export const useModals = () => {
  const {
    editingImage,
    isAudienceEditorOpen,
    isPersonaEditorOpen,
    editingPersona,
    setEditingImage,
    openImageEditor,
    closeImageEditor,
    openAudienceEditor,
    closeAudienceEditor,
    openPersonaEditor,
    closePersonaEditor,
  } = useUI();

  return {
    // Image editor
    editingImage,
    setEditingImage,
    openImageEditor,
    closeImageEditor,
    isImageEditorOpen: !!editingImage,
    // Audience editor
    isAudienceEditorOpen,
    openAudienceEditor,
    closeAudienceEditor,
    // Persona editor
    isPersonaEditorOpen,
    editingPersona,
    openPersonaEditor,
    closePersonaEditor,
  };
};

export default UIContext;
