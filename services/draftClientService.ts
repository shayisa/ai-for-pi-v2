/**
 * Draft Client Service
 * Frontend API client for auto-saving and restoring newsletter drafts
 */

import { apiRequest, API_BASE } from './apiHelper.ts';

// Types matching backend
export interface DraftContent {
  newsletter?: {
    subject?: string;
    introduction?: string;
    sections?: Array<{ title: string; content: string; imagePrompt?: string }>;
    conclusion?: string;
  };
  enhancedNewsletter?: unknown;
  formatVersion: 'v1' | 'v2';
}

export interface DraftSettings {
  selectedTone?: string;
  selectedImageStyle?: string;
  selectedAudiences?: string[];
  personaId?: string | null;
  promptOfTheDay?: unknown;
}

export interface NewsletterDraft {
  id: string;
  userEmail: string;
  content: DraftContent;
  topics: string[];
  settings: DraftSettings;
  lastSavedAt: string;
}

/**
 * Get draft for current user
 *
 * Returns null if no draft exists (200 response with { draft: null }).
 * Backend returns 200 for both "draft exists" and "no draft" cases
 * since checking for a draft is a valid query, not an error case.
 *
 * Usage in App.tsx:
 *   const draft = await getDraft(userEmail);
 *   if (draft) { showRecoveryPrompt(); }
 */
export const getDraft = async (userEmail: string): Promise<NewsletterDraft | null> => {
  const response = await fetch(
    `${API_BASE}/api/drafts/${encodeURIComponent(userEmail)}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || 'Failed to fetch draft');
  }

  const json = await response.json();
  // Backend returns { data: { draft: <draft_or_null> } }
  return json.data?.draft ?? null;
};

/**
 * Save or update draft
 */
export const saveDraft = async (
  userEmail: string,
  content: DraftContent,
  topics: string[],
  settings: DraftSettings
): Promise<NewsletterDraft> => {
  return apiRequest<NewsletterDraft>('/api/drafts', {
    method: 'POST',
    body: JSON.stringify({ userEmail, content, topics, settings }),
  });
};

/**
 * Delete draft
 */
export const deleteDraft = async (
  userEmail: string
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/drafts/${encodeURIComponent(userEmail)}`,
    { method: 'DELETE' }
  );
};

// NOTE: hasDraft() function removed in Phase 7b (dead code - never called from frontend)
// Backend still has GET /api/drafts/:userEmail/exists endpoint if needed in future
