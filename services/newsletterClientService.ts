/**
 * Newsletter Client Service
 * Frontend API client for managing newsletters via SQLite backend
 * Supports both v1 (legacy) and v2 (enhanced) newsletter formats
 */

import type { EnhancedNewsletter } from '../types';
import { apiRequest } from './apiHelper.ts';

// Types
export interface NewsletterSection {
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface PromptOfTheDay {
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
}

export interface Newsletter {
  id: string;
  createdAt: string;
  subject: string;
  introduction: string;
  conclusion: string;
  sections: NewsletterSection[];
  promptOfTheDay?: PromptOfTheDay;
  topics: string[];
  audience?: string[];
  tone?: string;
  imageStyle?: string;
}

export interface NewsletterSettings {
  audience?: string[];
  tone?: string;
  imageStyle?: string;
}

export interface NewsletterLog {
  id: number;
  newsletterId: string;
  action: string;
  actionAt: string;
  details?: Record<string, unknown>;
}

// Format-aware types for v1/v2 support
export interface NewsletterWithFormat {
  formatVersion: 'v1' | 'v2';
  newsletter: Newsletter | EnhancedNewsletter;
  id: string;
  createdAt: string;
  subject: string;
  topics: string[];
}

export interface NewsletterListResponse {
  newsletters: NewsletterWithFormat[];
  count: number;
}

/**
 * Save a newsletter to SQLite
 */
export const saveNewsletter = async (
  newsletter: {
    id: string;
    subject: string;
    introduction: string;
    sections: NewsletterSection[];
    conclusion: string;
    promptOfTheDay?: PromptOfTheDay;
  },
  topics: string[],
  settings?: NewsletterSettings
): Promise<Newsletter> => {
  return apiRequest<Newsletter>('/api/newsletters', {
    method: 'POST',
    body: JSON.stringify({ newsletter, topics, settings })
  });
};

/**
 * Get all newsletters (newest first)
 */
export const getNewsletters = async (limit = 50): Promise<NewsletterListResponse> => {
  return apiRequest<NewsletterListResponse>(`/api/newsletters?limit=${limit}`);
};

/**
 * Get a single newsletter by ID with format detection
 */
export const getNewsletterById = async (id: string): Promise<NewsletterWithFormat> => {
  return apiRequest<NewsletterWithFormat>(`/api/newsletters/${id}`);
};

/**
 * Get an enhanced newsletter by ID (v2 format only)
 */
export const getEnhancedNewsletterById = async (id: string): Promise<EnhancedNewsletter> => {
  return apiRequest<EnhancedNewsletter>(`/api/newsletters/${id}/enhanced`);
};

/**
 * Delete a newsletter
 */
export const deleteNewsletter = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/newsletters/${id}`, {
    method: 'DELETE'
  });
};

/**
 * Update newsletter sections (to save imageUrls after client-side generation)
 */
export const updateNewsletterSections = async (
  newsletterId: string,
  sections?: NewsletterSection[],
  audienceSections?: unknown[],
  formatVersion?: 'v1' | 'v2'
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/newsletters/${newsletterId}/sections`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sections, audienceSections, formatVersion })
    }
  );
};

/**
 * Log an action for a newsletter
 */
export const logAction = async (
  newsletterId: string,
  action: 'created' | 'saved_to_drive' | 'sent_email',
  details?: Record<string, unknown>
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/newsletters/${newsletterId}/log`,
    {
      method: 'POST',
      body: JSON.stringify({ action, details })
    }
  );
};

/**
 * Get logs for a newsletter
 */
export const getNewsletterLogs = async (newsletterId: string): Promise<{ logs: NewsletterLog[] }> => {
  return apiRequest<{ logs: NewsletterLog[] }>(`/api/newsletters/${newsletterId}/logs`);
};

/**
 * Phase 9c: Get newsletters that used a specific saved prompt
 * Uses the savedPromptId stored in prompt_of_day JSON
 */
export const getNewslettersBySavedPromptId = async (promptId: string): Promise<NewsletterListResponse> => {
  return apiRequest<NewsletterListResponse>(`/api/newsletters/by-prompt/${encodeURIComponent(promptId)}`);
};
