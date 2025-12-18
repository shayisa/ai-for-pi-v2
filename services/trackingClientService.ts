/**
 * Tracking Client Service
 * Frontend API client for email tracking analytics
 */

import { apiRequest } from './apiHelper.ts';

// Types
export type TrackingType = 'open' | 'click';

export interface TrackingEvent {
  id: string;
  newsletterId: string;
  recipientEmail: string;
  trackingType: TrackingType;
  linkUrl: string | null;
  trackedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface EmailStats {
  newsletterId: string;
  totalSent: number;
  totalOpens: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClicks: number;
  lastUpdated: string | null;
  openRate: number;
  clickRate: number;
}

export interface TopLink {
  url: string;
  clicks: number;
  uniqueClicks: number;
}

export interface TrackingEventsResponse {
  events: TrackingEvent[];
  total: number;
}

/**
 * Get stats for a newsletter
 */
export const getNewsletterStats = async (newsletterId: string): Promise<EmailStats> => {
  return apiRequest<EmailStats>(
    `/api/newsletters/${encodeURIComponent(newsletterId)}/stats`
  );
};

/**
 * Get tracking events for a newsletter
 */
export const getTrackingEvents = async (
  newsletterId: string,
  limit = 100,
  offset = 0
): Promise<TrackingEventsResponse> => {
  return apiRequest<TrackingEventsResponse>(
    `/api/newsletters/${encodeURIComponent(newsletterId)}/tracking?limit=${limit}&offset=${offset}`
  );
};

/**
 * Get top clicked links for a newsletter
 */
export const getTopLinks = async (
  newsletterId: string,
  limit = 10
): Promise<{ links: TopLink[] }> => {
  return apiRequest<{ links: TopLink[] }>(
    `/api/newsletters/${encodeURIComponent(newsletterId)}/top-links?limit=${limit}`
  );
};

/**
 * Set tracking enabled/disabled for a newsletter
 */
export const setTrackingEnabled = async (
  newsletterId: string,
  enabled: boolean
): Promise<{ success: boolean; trackingEnabled: boolean }> => {
  return apiRequest<{ success: boolean; trackingEnabled: boolean }>(
    `/api/newsletters/${encodeURIComponent(newsletterId)}/tracking`,
    {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }
  );
};
