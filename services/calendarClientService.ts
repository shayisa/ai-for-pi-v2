/**
 * Calendar Client Service
 * Frontend API client for content calendar management
 */

import { apiRequest } from './apiHelper.ts';

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
  return apiRequest<CalendarListResponse>(
    `/api/calendar${queryString ? `?${queryString}` : ''}`
  );
};

/**
 * Get entries for a specific month
 */
export const getEntriesByMonth = async (
  year: number,
  month: number
): Promise<CalendarListResponse> => {
  return apiRequest<CalendarListResponse>(`/api/calendar/month/${year}/${month}`);
};

/**
 * Get upcoming entries
 */
export const getUpcomingEntries = async (days = 7): Promise<CalendarListResponse> => {
  return apiRequest<CalendarListResponse>(`/api/calendar/upcoming?days=${days}`);
};

/**
 * Get entry by ID
 */
export const getEntryById = async (id: string): Promise<CalendarEntry> => {
  return apiRequest<CalendarEntry>(`/api/calendar/${encodeURIComponent(id)}`);
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
  return apiRequest<CalendarEntry>('/api/calendar', {
    method: 'POST',
    body: JSON.stringify({ title, scheduledDate, description, topics, status, settings }),
  });
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
  return apiRequest<CalendarEntry>(`/api/calendar/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Link a newsletter to a calendar entry
 */
export const linkNewsletter = async (
  entryId: string,
  newsletterId: string
): Promise<CalendarEntry> => {
  return apiRequest<CalendarEntry>(
    `/api/calendar/${encodeURIComponent(entryId)}/link`,
    {
      method: 'POST',
      body: JSON.stringify({ newsletterId }),
    }
  );
};

/**
 * Unlink a newsletter from a calendar entry
 */
export const unlinkNewsletter = async (entryId: string): Promise<CalendarEntry> => {
  return apiRequest<CalendarEntry>(
    `/api/calendar/${encodeURIComponent(entryId)}/unlink`,
    { method: 'POST' }
  );
};

/**
 * Delete a calendar entry
 */
export const deleteEntry = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/calendar/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
};
