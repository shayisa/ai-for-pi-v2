/**
 * Template Client Service
 * Frontend API client for managing newsletter templates via SQLite backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const response = await fetch(`${API_BASE}/api/templates?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch templates');
  }

  return response.json();
};

/**
 * Get template by ID
 */
export const getTemplateById = async (id: string): Promise<NewsletterTemplate> => {
  const response = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch template');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, structure, defaultSettings }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/templates/from-newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, newsletter, settings }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template from newsletter');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update template');
  }

  return response.json();
};

/**
 * Delete a template
 */
export const deleteTemplate = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete template');
  }

  return response.json();
};
