/**
 * Email Tracking Service
 * Handles tracking of email opens and link clicks
 */

import db from '../db/init.ts';
import * as crypto from 'crypto';

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
  lastUpdated: string;
  openRate: number;
  clickRate: number;
}

interface DbTrackingRow {
  id: string;
  newsletter_id: string;
  recipient_email: string;
  tracking_type: string;
  link_url: string | null;
  tracked_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface DbStatsRow {
  newsletter_id: string;
  total_sent: number;
  total_opens: number;
  unique_opens: number;
  total_clicks: number;
  unique_clicks: number;
  last_updated: string;
}

/**
 * Generate a unique tracking ID
 */
export const generateTrackingId = (): string => {
  return `trk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Generate a tracking pixel ID for email opens
 * Format: newsletterId:recipientEmail (base64 encoded)
 */
export const generateOpenTrackingId = (newsletterId: string, recipientEmail: string): string => {
  const data = `${newsletterId}:${recipientEmail}`;
  return Buffer.from(data).toString('base64url');
};

/**
 * Parse an open tracking ID
 */
export const parseOpenTrackingId = (
  trackingId: string
): { newsletterId: string; recipientEmail: string } | null => {
  try {
    const data = Buffer.from(trackingId, 'base64url').toString('utf-8');
    const [newsletterId, recipientEmail] = data.split(':');
    if (!newsletterId || !recipientEmail) return null;
    return { newsletterId, recipientEmail };
  } catch {
    return null;
  }
};

/**
 * Generate a tracking URL for link clicks
 * Format: newsletterId:recipientEmail:destUrl (base64 encoded)
 */
export const generateClickTrackingId = (
  newsletterId: string,
  recipientEmail: string,
  destUrl: string
): string => {
  const data = `${newsletterId}:${recipientEmail}:${destUrl}`;
  return Buffer.from(data).toString('base64url');
};

/**
 * Parse a click tracking ID
 */
export const parseClickTrackingId = (
  trackingId: string
): { newsletterId: string; recipientEmail: string; destUrl: string } | null => {
  try {
    const data = Buffer.from(trackingId, 'base64url').toString('utf-8');
    const parts = data.split(':');
    if (parts.length < 3) return null;
    const [newsletterId, recipientEmail, ...destParts] = parts;
    const destUrl = destParts.join(':'); // URLs may contain colons
    if (!newsletterId || !recipientEmail || !destUrl) return null;
    return { newsletterId, recipientEmail, destUrl };
  } catch {
    return null;
  }
};

/**
 * Record a tracking event
 */
export const recordTrackingEvent = (
  newsletterId: string,
  recipientEmail: string,
  trackingType: TrackingType,
  linkUrl?: string,
  ipAddress?: string,
  userAgent?: string
): TrackingEvent => {
  const id = generateTrackingId();

  db.prepare(`
    INSERT INTO email_tracking (id, newsletter_id, recipient_email, tracking_type, link_url, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, newsletterId, recipientEmail, trackingType, linkUrl || null, ipAddress || null, userAgent || null);

  // Update aggregated stats
  updateStats(newsletterId);

  console.log(`[Tracking] Recorded ${trackingType} for ${newsletterId} from ${recipientEmail}`);

  return {
    id,
    newsletterId,
    recipientEmail,
    trackingType,
    linkUrl: linkUrl || null,
    trackedAt: new Date().toISOString(),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  };
};

/**
 * Update aggregated stats for a newsletter
 */
const updateStats = (newsletterId: string): void => {
  // Get current counts
  const openCount = db
    .prepare('SELECT COUNT(*) as count FROM email_tracking WHERE newsletter_id = ? AND tracking_type = ?')
    .get(newsletterId, 'open') as { count: number };

  const uniqueOpenCount = db
    .prepare('SELECT COUNT(DISTINCT recipient_email) as count FROM email_tracking WHERE newsletter_id = ? AND tracking_type = ?')
    .get(newsletterId, 'open') as { count: number };

  const clickCount = db
    .prepare('SELECT COUNT(*) as count FROM email_tracking WHERE newsletter_id = ? AND tracking_type = ?')
    .get(newsletterId, 'click') as { count: number };

  const uniqueClickCount = db
    .prepare('SELECT COUNT(DISTINCT recipient_email) as count FROM email_tracking WHERE newsletter_id = ? AND tracking_type = ?')
    .get(newsletterId, 'click') as { count: number };

  // Upsert stats
  db.prepare(`
    INSERT INTO email_stats (newsletter_id, total_opens, unique_opens, total_clicks, unique_clicks, last_updated)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(newsletter_id) DO UPDATE SET
      total_opens = excluded.total_opens,
      unique_opens = excluded.unique_opens,
      total_clicks = excluded.total_clicks,
      unique_clicks = excluded.unique_clicks,
      last_updated = datetime('now')
  `).run(newsletterId, openCount.count, uniqueOpenCount.count, clickCount.count, uniqueClickCount.count);
};

/**
 * Initialize or update sent count for a newsletter
 */
export const recordSentCount = (newsletterId: string, sentCount: number): void => {
  db.prepare(`
    INSERT INTO email_stats (newsletter_id, total_sent, last_updated)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(newsletter_id) DO UPDATE SET
      total_sent = excluded.total_sent,
      last_updated = datetime('now')
  `).run(newsletterId, sentCount);

  console.log(`[Tracking] Recorded ${sentCount} sent for ${newsletterId}`);
};

/**
 * Get stats for a newsletter
 */
export const getNewsletterStats = (newsletterId: string): EmailStats | null => {
  const row = db
    .prepare('SELECT * FROM email_stats WHERE newsletter_id = ?')
    .get(newsletterId) as DbStatsRow | undefined;

  if (!row) {
    return null;
  }

  const openRate = row.total_sent > 0 ? (row.unique_opens / row.total_sent) * 100 : 0;
  const clickRate = row.unique_opens > 0 ? (row.unique_clicks / row.unique_opens) * 100 : 0;

  return {
    newsletterId: row.newsletter_id,
    totalSent: row.total_sent,
    totalOpens: row.total_opens,
    uniqueOpens: row.unique_opens,
    totalClicks: row.total_clicks,
    uniqueClicks: row.unique_clicks,
    lastUpdated: row.last_updated,
    openRate: Math.round(openRate * 10) / 10,
    clickRate: Math.round(clickRate * 10) / 10,
  };
};

/**
 * Get tracking events for a newsletter
 */
export const getTrackingEvents = (
  newsletterId: string,
  limit = 100,
  offset = 0
): { events: TrackingEvent[]; total: number } => {
  const rows = db
    .prepare(`
      SELECT * FROM email_tracking
      WHERE newsletter_id = ?
      ORDER BY tracked_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(newsletterId, limit, offset) as DbTrackingRow[];

  const total = db
    .prepare('SELECT COUNT(*) as count FROM email_tracking WHERE newsletter_id = ?')
    .get(newsletterId) as { count: number };

  return {
    events: rows.map((row) => ({
      id: row.id,
      newsletterId: row.newsletter_id,
      recipientEmail: row.recipient_email,
      trackingType: row.tracking_type as TrackingType,
      linkUrl: row.link_url,
      trackedAt: row.tracked_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    })),
    total: total.count,
  };
};

/**
 * Get top clicked links for a newsletter
 */
export const getTopLinks = (
  newsletterId: string,
  limit = 10
): Array<{ url: string; clicks: number; uniqueClicks: number }> => {
  const rows = db
    .prepare(`
      SELECT
        link_url as url,
        COUNT(*) as clicks,
        COUNT(DISTINCT recipient_email) as unique_clicks
      FROM email_tracking
      WHERE newsletter_id = ? AND tracking_type = 'click' AND link_url IS NOT NULL
      GROUP BY link_url
      ORDER BY clicks DESC
      LIMIT ?
    `)
    .all(newsletterId, limit) as Array<{ url: string; clicks: number; unique_clicks: number }>;

  return rows.map((row) => ({
    url: row.url,
    clicks: row.clicks,
    uniqueClicks: row.unique_clicks,
  }));
};

/**
 * Check if tracking is enabled for a newsletter
 */
export const isTrackingEnabled = (newsletterId: string): boolean => {
  const row = db
    .prepare('SELECT tracking_enabled FROM newsletters WHERE id = ?')
    .get(newsletterId) as { tracking_enabled: number } | undefined;

  return row?.tracking_enabled === 1;
};

/**
 * Set tracking enabled/disabled for a newsletter
 */
export const setTrackingEnabled = (newsletterId: string, enabled: boolean): void => {
  db.prepare('UPDATE newsletters SET tracking_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, newsletterId);
  console.log(`[Tracking] Set tracking_enabled=${enabled} for ${newsletterId}`);
};

/**
 * Generate 1x1 transparent GIF for tracking pixel
 */
export const getTrackingPixel = (): Buffer => {
  // 1x1 transparent GIF
  return Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
};
