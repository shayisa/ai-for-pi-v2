/**
 * Tracking Client Service
 * Frontend API client for email tracking analytics
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const response = await fetch(
    `${API_BASE}/api/newsletters/${encodeURIComponent(newsletterId)}/stats`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch stats');
  }

  return response.json();
};

/**
 * Get tracking events for a newsletter
 */
export const getTrackingEvents = async (
  newsletterId: string,
  limit = 100,
  offset = 0
): Promise<TrackingEventsResponse> => {
  const response = await fetch(
    `${API_BASE}/api/newsletters/${encodeURIComponent(newsletterId)}/tracking?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch tracking events');
  }

  return response.json();
};

/**
 * Get top clicked links for a newsletter
 */
export const getTopLinks = async (
  newsletterId: string,
  limit = 10
): Promise<{ links: TopLink[] }> => {
  const response = await fetch(
    `${API_BASE}/api/newsletters/${encodeURIComponent(newsletterId)}/top-links?limit=${limit}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch top links');
  }

  return response.json();
};

/**
 * Set tracking enabled/disabled for a newsletter
 */
export const setTrackingEnabled = async (
  newsletterId: string,
  enabled: boolean
): Promise<{ success: boolean; trackingEnabled: boolean }> => {
  const response = await fetch(
    `${API_BASE}/api/newsletters/${encodeURIComponent(newsletterId)}/tracking`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set tracking');
  }

  return response.json();
};
