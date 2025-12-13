/**
 * Newsletter Client Service
 * Frontend API client for managing newsletters via SQLite backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export interface NewsletterListResponse {
  newsletters: Newsletter[];
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
  const response = await fetch(`${API_BASE}/api/newsletters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newsletter, topics, settings })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save newsletter');
  }

  return response.json();
};

/**
 * Get all newsletters (newest first)
 */
export const getNewsletters = async (limit = 50): Promise<NewsletterListResponse> => {
  const response = await fetch(`${API_BASE}/api/newsletters?limit=${limit}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch newsletters');
  }

  return response.json();
};

/**
 * Get a single newsletter by ID
 */
export const getNewsletterById = async (id: string): Promise<Newsletter> => {
  const response = await fetch(`${API_BASE}/api/newsletters/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch newsletter');
  }

  return response.json();
};

/**
 * Delete a newsletter
 */
export const deleteNewsletter = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/newsletters/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete newsletter');
  }

  return response.json();
};

/**
 * Log an action for a newsletter
 */
export const logAction = async (
  newsletterId: string,
  action: 'created' | 'saved_to_drive' | 'sent_email',
  details?: Record<string, unknown>
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/newsletters/${newsletterId}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, details })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to log action');
  }

  return response.json();
};

/**
 * Get logs for a newsletter
 */
export const getNewsletterLogs = async (newsletterId: string): Promise<{ logs: NewsletterLog[] }> => {
  const response = await fetch(`${API_BASE}/api/newsletters/${newsletterId}/logs`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch logs');
  }

  return response.json();
};
