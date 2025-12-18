/**
 * Scheduler Client Service
 * Frontend API client for scheduled newsletter sends
 */

import { apiRequest } from './apiHelper.ts';

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
  return apiRequest<ScheduledSendListResponse>('/api/scheduler');
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = async (): Promise<SchedulerStatus> => {
  return apiRequest<SchedulerStatus>('/api/scheduler/status');
};

/**
 * Get scheduled send by ID
 */
export const getScheduledSendById = async (id: string): Promise<ScheduledSend> => {
  return apiRequest<ScheduledSend>(`/api/scheduler/${encodeURIComponent(id)}`);
};

/**
 * Get scheduled sends for a newsletter
 */
export const getScheduledSendsForNewsletter = async (
  newsletterId: string
): Promise<ScheduledSendListResponse> => {
  return apiRequest<ScheduledSendListResponse>(
    `/api/scheduler/newsletter/${encodeURIComponent(newsletterId)}`
  );
};

/**
 * Schedule a newsletter for sending
 */
export const scheduleNewsletter = async (
  newsletterId: string,
  scheduledAt: string,
  recipientLists: string[]
): Promise<ScheduledSend> => {
  return apiRequest<ScheduledSend>('/api/scheduler', {
    method: 'POST',
    body: JSON.stringify({ newsletterId, scheduledAt, recipientLists }),
  });
};

/**
 * Cancel a scheduled send
 */
export const cancelScheduledSend = async (id: string): Promise<ScheduledSend> => {
  return apiRequest<ScheduledSend>(
    `/api/scheduler/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' }
  );
};

/**
 * Reschedule a send to a new time
 */
export const rescheduleNewsletter = async (
  id: string,
  newScheduledAt: string
): Promise<ScheduledSend> => {
  return apiRequest<ScheduledSend>(
    `/api/scheduler/${encodeURIComponent(id)}/reschedule`,
    {
      method: 'POST',
      body: JSON.stringify({ scheduledAt: newScheduledAt }),
    }
  );
};

/**
 * Trigger a scheduled send immediately
 */
export const triggerSendNow = async (
  id: string
): Promise<{ success: boolean; sentCount: number; error?: string }> => {
  return apiRequest<{ success: boolean; sentCount: number; error?: string }>(
    `/api/scheduler/${encodeURIComponent(id)}/send-now`,
    { method: 'POST' }
  );
};

/**
 * Delete a scheduled send
 */
export const deleteScheduledSend = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/scheduler/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
};

/**
 * Get upcoming scheduled sends
 */
export const getUpcomingScheduledSends = async (days = 7): Promise<ScheduledSendListResponse> => {
  return apiRequest<ScheduledSendListResponse>(`/api/scheduler/upcoming?days=${days}`);
};
