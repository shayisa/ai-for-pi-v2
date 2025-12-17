/**
 * Draft Client Service
 * Frontend API client for auto-saving and restoring newsletter drafts
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
 */
export const getDraft = async (userEmail: string): Promise<NewsletterDraft | null> => {
  const response = await fetch(
    `${API_BASE}/api/drafts/${encodeURIComponent(userEmail)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch draft');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, content, topics, settings }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save draft');
  }

  return response.json();
};

/**
 * Delete draft
 */
export const deleteDraft = async (
  userEmail: string
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(
    `${API_BASE}/api/drafts/${encodeURIComponent(userEmail)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete draft');
  }

  return response.json();
};

/**
 * Check if draft exists
 */
export const hasDraft = async (userEmail: string): Promise<boolean> => {
  const response = await fetch(
    `${API_BASE}/api/drafts/${encodeURIComponent(userEmail)}/exists`
  );

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.exists;
};
