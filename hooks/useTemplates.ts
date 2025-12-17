/**
 * useTemplates Hook
 *
 * Manages newsletter template state using SQLite backend:
 * - Loads templates from SQLite on mount
 * - Provides CRUD operations
 */

import { useState, useCallback, useEffect } from 'react';
import * as templateApi from '../services/templateClientService';
import type {
  NewsletterTemplate,
  TemplateStructure,
  TemplateSettings,
} from '../services/templateClientService';

interface UseTemplatesReturn {
  templates: NewsletterTemplate[];
  isLoading: boolean;
  error: string | null;
  createTemplate: (
    name: string,
    description: string,
    structure: TemplateStructure,
    defaultSettings?: TemplateSettings
  ) => Promise<NewsletterTemplate>;
  createFromNewsletter: (
    name: string,
    description: string,
    newsletter: {
      introduction?: string;
      sections: Array<{ title: string; content: string; imagePrompt?: string }>;
      conclusion?: string;
      promptOfTheDay?: unknown;
    },
    settings?: TemplateSettings
  ) => Promise<NewsletterTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  refreshTemplates: () => Promise<void>;
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates from SQLite
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await templateApi.getTemplates();
      setTemplates(response.templates);
      console.log(`[useTemplates] Loaded ${response.templates.length} templates from SQLite`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load templates';
      console.error('[useTemplates] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Create a new template
  const createTemplate = useCallback(
    async (
      name: string,
      description: string,
      structure: TemplateStructure,
      defaultSettings?: TemplateSettings
    ): Promise<NewsletterTemplate> => {
      const template = await templateApi.createTemplate(name, description, structure, defaultSettings);
      setTemplates((prev) => [template, ...prev]);
      console.log(`[useTemplates] Created template: ${name}`);
      return template;
    },
    []
  );

  // Create template from existing newsletter
  const createFromNewsletter = useCallback(
    async (
      name: string,
      description: string,
      newsletter: {
        introduction?: string;
        sections: Array<{ title: string; content: string; imagePrompt?: string }>;
        conclusion?: string;
        promptOfTheDay?: unknown;
      },
      settings?: TemplateSettings
    ): Promise<NewsletterTemplate> => {
      const template = await templateApi.createTemplateFromNewsletter(
        name,
        description,
        newsletter,
        settings
      );
      setTemplates((prev) => [template, ...prev]);
      console.log(`[useTemplates] Created template from newsletter: ${name}`);
      return template;
    },
    []
  );

  // Delete a template
  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    await templateApi.deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    console.log(`[useTemplates] Deleted template: ${id}`);
  }, []);

  // Refresh templates
  const refreshTemplates = useCallback(async () => {
    await loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    createFromNewsletter,
    deleteTemplate,
    refreshTemplates,
  };
}
