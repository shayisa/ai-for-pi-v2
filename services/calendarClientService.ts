/**
 * Calendar Client Service
 * Frontend API client for content calendar management
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
export type CalendarStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface CalendarEntrySettings {
  selectedAudience?: Record<string, boolean>;
  selectedTone?: string;
  selectedFlavors?: Record<string, boolean>;
  selectedImageStyle?: string;
  personaId?: string | null;
}

export interface CalendarEntry {
  id: string;
  scheduledDate: string;
  title: string;
  description: string;
  topics: string[];
  status: CalendarStatus;
  newsletterId: string | null;
  settings: CalendarEntrySettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarListResponse {
  entries: CalendarEntry[];
  count: number;
}

/**
 * Get calendar entries (optionally filtered by date range)
 */
export const getEntries = async (
  startDate?: string,
  endDate?: string
): Promise<CalendarListResponse> => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const queryString = params.toString();
  const url = `${API_BASE}/api/calendar${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch calendar entries');
  }

  return response.json();
};

/**
 * Get entries for a specific month
 */
export const getEntriesByMonth = async (
  year: number,
  month: number
): Promise<CalendarListResponse> => {
  const response = await fetch(`${API_BASE}/api/calendar/month/${year}/${month}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch calendar entries');
  }

  return response.json();
};

/**
 * Get upcoming entries
 */
export const getUpcomingEntries = async (days = 7): Promise<CalendarListResponse> => {
  const response = await fetch(`${API_BASE}/api/calendar/upcoming?days=${days}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch upcoming entries');
  }

  return response.json();
};

/**
 * Get entry by ID
 */
export const getEntryById = async (id: string): Promise<CalendarEntry> => {
  const response = await fetch(`${API_BASE}/api/calendar/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch calendar entry');
  }

  return response.json();
};

/**
 * Create a new calendar entry
 */
export const createEntry = async (
  title: string,
  scheduledDate: string,
  description = '',
  topics: string[] = [],
  status: CalendarStatus = 'planned',
  settings: CalendarEntrySettings | null = null
): Promise<CalendarEntry> => {
  const response = await fetch(`${API_BASE}/api/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, scheduledDate, description, topics, status, settings }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create calendar entry');
  }

  return response.json();
};

/**
 * Update a calendar entry
 */
export const updateEntry = async (
  id: string,
  updates: Partial<{
    title: string;
    scheduledDate: string;
    description: string;
    topics: string[];
    status: CalendarStatus;
    settings: CalendarEntrySettings | null;
  }>
): Promise<CalendarEntry> => {
  const response = await fetch(`${API_BASE}/api/calendar/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update calendar entry');
  }

  return response.json();
};

/**
 * Link a newsletter to a calendar entry
 */
export const linkNewsletter = async (
  entryId: string,
  newsletterId: string
): Promise<CalendarEntry> => {
  const response = await fetch(
    `${API_BASE}/api/calendar/${encodeURIComponent(entryId)}/link`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsletterId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to link newsletter');
  }

  return response.json();
};

/**
 * Unlink a newsletter from a calendar entry
 */
export const unlinkNewsletter = async (entryId: string): Promise<CalendarEntry> => {
  const response = await fetch(
    `${API_BASE}/api/calendar/${encodeURIComponent(entryId)}/unlink`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlink newsletter');
  }

  return response.json();
};

/**
 * Delete a calendar entry
 */
export const deleteEntry = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/calendar/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete calendar entry');
  }

  return response.json();
};
