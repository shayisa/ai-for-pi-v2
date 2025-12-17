/**
 * Scheduler Client Service
 * Frontend API client for scheduled newsletter sends
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
export type ScheduledSendStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledSend {
  id: string;
  newsletterId: string;
  scheduledAt: string;
  recipientLists: string[];
  status: ScheduledSendStatus;
  errorMessage: string | null;
  sentAt: string | null;
  sentCount: number;
  createdAt: string;
}

export interface SchedulerStatus {
  running: boolean;
  stats: {
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
  upcoming: ScheduledSend[];
}

export interface ScheduledSendListResponse {
  scheduledSends: ScheduledSend[];
  count: number;
}

/**
 * Get all scheduled sends
 */
export const getScheduledSends = async (): Promise<ScheduledSendListResponse> => {
  const response = await fetch(`${API_BASE}/api/scheduler`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scheduled sends');
  }

  return response.json();
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = async (): Promise<SchedulerStatus> => {
  const response = await fetch(`${API_BASE}/api/scheduler/status`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scheduler status');
  }

  return response.json();
};

/**
 * Get scheduled send by ID
 */
export const getScheduledSendById = async (id: string): Promise<ScheduledSend> => {
  const response = await fetch(`${API_BASE}/api/scheduler/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scheduled send');
  }

  return response.json();
};

/**
 * Get scheduled sends for a newsletter
 */
export const getScheduledSendsForNewsletter = async (
  newsletterId: string
): Promise<ScheduledSendListResponse> => {
  const response = await fetch(
    `${API_BASE}/api/scheduler/newsletter/${encodeURIComponent(newsletterId)}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scheduled sends');
  }

  return response.json();
};

/**
 * Schedule a newsletter for sending
 */
export const scheduleNewsletter = async (
  newsletterId: string,
  scheduledAt: string,
  recipientLists: string[]
): Promise<ScheduledSend> => {
  const response = await fetch(`${API_BASE}/api/scheduler`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newsletterId, scheduledAt, recipientLists }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to schedule newsletter');
  }

  return response.json();
};

/**
 * Cancel a scheduled send
 */
export const cancelScheduledSend = async (id: string): Promise<ScheduledSend> => {
  const response = await fetch(`${API_BASE}/api/scheduler/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel scheduled send');
  }

  return response.json();
};

/**
 * Reschedule a send to a new time
 */
export const rescheduleNewsletter = async (
  id: string,
  newScheduledAt: string
): Promise<ScheduledSend> => {
  const response = await fetch(`${API_BASE}/api/scheduler/${encodeURIComponent(id)}/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledAt: newScheduledAt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reschedule send');
  }

  return response.json();
};

/**
 * Trigger a scheduled send immediately
 */
export const triggerSendNow = async (
  id: string
): Promise<{ success: boolean; sentCount: number; error?: string }> => {
  const response = await fetch(`${API_BASE}/api/scheduler/${encodeURIComponent(id)}/send-now`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to trigger send');
  }

  return response.json();
};

/**
 * Delete a scheduled send
 */
export const deleteScheduledSend = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/scheduler/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete scheduled send');
  }

  return response.json();
};

/**
 * Get upcoming scheduled sends
 */
export const getUpcomingScheduledSends = async (days = 7): Promise<ScheduledSendListResponse> => {
  const response = await fetch(`${API_BASE}/api/scheduler/upcoming?days=${days}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch upcoming sends');
  }

  return response.json();
};
