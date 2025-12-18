/**
 * usePromptImport Hook
 *
 * Phase 11f: Manages prompt import state and operations.
 * Supports importing from URLs and files with template support.
 */

import { useState, useCallback, useEffect } from 'react';
import * as importApi from '../services/promptImportClientService';
import type {
  PromptImportResult,
  PromptImportTemplate,
  ParsingMethod,
} from '../types';
import type {
  UrlImportResponse,
  FileImportResponse,
  ImportFromUrlOptions,
  ImportFromFileOptions,
} from '../services/promptImportClientService';

// ============================================================================
// Types
// ============================================================================

interface UsePromptImportReturn {
  // State
  isImporting: boolean;
  lastResult: PromptImportResult | null;
  error: string | null;
  templates: PromptImportTemplate[];
  templatesLoading: boolean;

  // Import actions
  importFromUrl: (url: string, options?: ImportFromUrlOptions) => Promise<UrlImportResponse>;
  importFromFile: (file: File, options?: ImportFromFileOptions) => Promise<FileImportResponse>;
  resetImportState: () => void;

  // Template management
  loadTemplates: () => Promise<void>;
  createTemplate: (template: {
    name: string;
    sourceType: 'url' | 'file';
    sourcePattern: string;
    parsingInstructions?: string;
    fieldPatterns?: PromptImportTemplate['fieldPatterns'];
  }) => Promise<PromptImportTemplate>;
  updateTemplate: (
    id: string,
    updates: Partial<{
      name: string;
      sourcePattern: string;
      parsingInstructions: string;
      fieldPatterns: PromptImportTemplate['fieldPatterns'];
    }>
  ) => Promise<PromptImportTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
}

interface UsePromptImportOptions {
  /** Auto-load templates on mount */
  autoLoadTemplates?: boolean;
  /** User email for AI parsing */
  userEmail?: string;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePromptImport(options: UsePromptImportOptions = {}): UsePromptImportReturn {
  const { autoLoadTemplates = true, userEmail } = options;

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [lastResult, setLastResult] = useState<PromptImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Template state
  const [templates, setTemplates] = useState<PromptImportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // ============================================================================
  // Template Management
  // ============================================================================

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const response = await importApi.getTemplates();
      setTemplates(response.templates);
      console.log(`[PromptImport] Loaded ${response.templates.length} templates`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load templates';
      console.error('[PromptImport] Error loading templates:', e);
      // Don't set error state for template loading - it's not critical
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // Auto-load templates on mount
  useEffect(() => {
    if (autoLoadTemplates) {
      loadTemplates();
    }
  }, [autoLoadTemplates, loadTemplates]);

  const createTemplate = useCallback(
    async (template: {
      name: string;
      sourceType: 'url' | 'file';
      sourcePattern: string;
      parsingInstructions?: string;
      fieldPatterns?: PromptImportTemplate['fieldPatterns'];
    }): Promise<PromptImportTemplate> => {
      try {
        const created = await importApi.createTemplate(template);
        setTemplates((prev) => [created, ...prev]);
        console.log(`[PromptImport] Created template: ${created.name}`);
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create template';
        console.error('[PromptImport] Error creating template:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      updates: Partial<{
        name: string;
        sourcePattern: string;
        parsingInstructions: string;
        fieldPatterns: PromptImportTemplate['fieldPatterns'];
      }>
    ): Promise<PromptImportTemplate> => {
      try {
        const updated = await importApi.updateTemplate(id, updates);
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? updated : t))
        );
        console.log(`[PromptImport] Updated template: ${id}`);
        return updated;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to update template';
        console.error('[PromptImport] Error updating template:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    try {
      await importApi.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      console.log(`[PromptImport] Deleted template: ${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete template';
      console.error('[PromptImport] Error deleting template:', e);
      throw new Error(msg);
    }
  }, []);

  // ============================================================================
  // Import Operations
  // ============================================================================

  const importFromUrl = useCallback(
    async (url: string, importOptions?: ImportFromUrlOptions): Promise<UrlImportResponse> => {
      setIsImporting(true);
      setError(null);

      try {
        const result = await importApi.importFromUrl(url, {
          ...importOptions,
          userEmail: importOptions?.userEmail || userEmail,
        });

        setLastResult(result);
        console.log(`[PromptImport] URL import ${result.success ? 'succeeded' : 'partially succeeded'}:`, result);

        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to import from URL';
        console.error('[PromptImport] URL import error:', e);
        setError(msg);
        setLastResult({
          success: false,
          parsingMethod: 'regex',
          error: msg,
          processingTimeMs: 0,
        });
        throw new Error(msg);
      } finally {
        setIsImporting(false);
      }
    },
    [userEmail]
  );

  const importFromFile = useCallback(
    async (file: File, importOptions?: ImportFromFileOptions): Promise<FileImportResponse> => {
      setIsImporting(true);
      setError(null);

      try {
        const result = await importApi.importFromFile(file, {
          ...importOptions,
          userEmail: importOptions?.userEmail || userEmail,
        });

        setLastResult(result);
        console.log(`[PromptImport] File import ${result.success ? 'succeeded' : 'partially succeeded'}:`, result);

        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to import file';
        console.error('[PromptImport] File import error:', e);
        setError(msg);
        setLastResult({
          success: false,
          parsingMethod: 'regex',
          error: msg,
          processingTimeMs: 0,
        });
        throw new Error(msg);
      } finally {
        setIsImporting(false);
      }
    },
    [userEmail]
  );

  const resetImportState = useCallback(() => {
    setLastResult(null);
    setError(null);
    setIsImporting(false);
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isImporting,
    lastResult,
    error,
    templates,
    templatesLoading,

    // Import actions
    importFromUrl,
    importFromFile,
    resetImportState,

    // Template management
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

export default usePromptImport;
