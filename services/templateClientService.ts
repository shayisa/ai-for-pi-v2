/**
 * Template Client Service
 * Frontend API client for managing newsletter templates via SQLite backend
 */

import { apiRequest } from './apiHelper.ts';

// Types
export interface TemplateSection {
  title: string;
  placeholderContent: string;
  imagePrompt?: string;
}

export interface TemplateStructure {
  introduction: string;
  sections: TemplateSection[];
  conclusion: string;
  includePromptOfDay: boolean;
}

export interface TemplateSettings {
  tone?: string;
  imageStyle?: string;
  personaId?: string;
  audiences?: string[];
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  description: string;
  structure: TemplateStructure;
  defaultSettings?: TemplateSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateListResponse {
  templates: NewsletterTemplate[];
  count: number;
}

/**
 * Get all templates (newest first)
 */
export const getTemplates = async (limit = 50): Promise<TemplateListResponse> => {
  return apiRequest<TemplateListResponse>(`/api/templates?limit=${limit}`);
};

/**
 * Get template by ID
 */
export const getTemplateById = async (id: string): Promise<NewsletterTemplate> => {
  return apiRequest<NewsletterTemplate>(`/api/templates/${encodeURIComponent(id)}`);
};

/**
 * Create a new template
 */
export const createTemplate = async (
  name: string,
  description: string,
  structure: TemplateStructure,
  defaultSettings?: TemplateSettings
): Promise<NewsletterTemplate> => {
  return apiRequest<NewsletterTemplate>('/api/templates', {
    method: 'POST',
    body: JSON.stringify({ name, description, structure, defaultSettings }),
  });
};

/**
 * Create template from existing newsletter
 */
export const createTemplateFromNewsletter = async (
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
  return apiRequest<NewsletterTemplate>('/api/templates/from-newsletter', {
    method: 'POST',
    body: JSON.stringify({ name, description, newsletter, settings }),
  });
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    structure: TemplateStructure;
    defaultSettings: TemplateSettings;
  }>
): Promise<NewsletterTemplate> => {
  return apiRequest<NewsletterTemplate>(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Delete a template
 */
export const deleteTemplate = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};
