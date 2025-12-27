/**
 * Sent History Database Service
 * Queries for sent newsletter history with stats
 *
 * Phase 18: Enhanced Send Email with Recipient Selection & Sent History
 */

import db from '../db/init.ts';

// Types
export interface SentHistoryItem {
  id: string;
  newsletterId: string;
  sentAt: string;
  subject: string;
  topics: string[];
  listNames: string[];
  listIds: string[];
  recipientCount: number;
  recipientEmails?: string[];
  stats: {
    totalSent: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number;
    clickRate: number;
  } | null;
  newsletterContent?: Record<string, unknown>;
}

export interface SentHistoryOptions {
  limit?: number;
  offset?: number;
  listId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SentHistoryResponse {
  items: SentHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

interface DbLogRow {
  id: number;
  newsletter_id: string;
  action: string;
  action_at: string;
  details: string | null;
}

interface DbNewsletterRow {
  id: string;
  created_at: string;
  subject: string;
  introduction: string;
  conclusion: string;
  sections: string;
  prompt_of_day: string | null;
  topics: string;
  audience: string | null;
  tone: string | null;
  image_style: string | null;
  editors_note: string | null;
  tool_of_day: string | null;
  audience_sections: string | null;
  format_version: string | null;
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

interface JoinedRow {
  // From newsletter_logs
  log_id: number;
  newsletter_id: string;
  action_at: string;
  details: string | null;
  // From newsletters
  subject: string | null;
  topics: string | null;
  sections: string | null;
  introduction: string | null;
  conclusion: string | null;
  prompt_of_day: string | null;
  audience: string | null;
  editors_note: string | null;
  tool_of_day: string | null;
  audience_sections: string | null;
  format_version: string | null;
  // From email_stats
  total_sent: number | null;
  total_opens: number | null;
  unique_opens: number | null;
  total_clicks: number | null;
  unique_clicks: number | null;
}

/**
 * Parse JSON safely with fallback
 */
const safeJsonParse = <T>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

/**
 * Get sent newsletter history with stats
 */
export const getSentHistory = (options: SentHistoryOptions = {}): SentHistoryResponse => {
  const { limit = 50, offset = 0, listId, dateFrom, dateTo } = options;

  // Build WHERE clause for filters
  const conditions: string[] = ["nl.action = 'sent_email'"];
  const params: (string | number)[] = [];

  if (dateFrom) {
    conditions.push('nl.action_at >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push('nl.action_at <= ?');
    params.push(dateTo);
  }

  // For listId filter, we need to check the JSON details
  // This is less efficient but necessary given the schema
  let listFilter = '';
  if (listId) {
    listFilter = listId; // We'll filter in JS after query
  }

  const whereClause = conditions.join(' AND ');

  // Count total for pagination
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM newsletter_logs nl
    WHERE ${whereClause}
  `);
  const countResult = countStmt.get(...params) as { total: number };
  const total = countResult?.total || 0;

  // Main query with JOIN
  const stmt = db.prepare(`
    SELECT
      nl.id as log_id,
      nl.newsletter_id,
      nl.action_at,
      nl.details,
      n.subject,
      n.topics,
      n.sections,
      n.introduction,
      n.conclusion,
      n.prompt_of_day,
      n.audience,
      n.editors_note,
      n.tool_of_day,
      n.audience_sections,
      n.format_version,
      es.total_sent,
      es.total_opens,
      es.unique_opens,
      es.total_clicks,
      es.unique_clicks
    FROM newsletter_logs nl
    LEFT JOIN newsletters n ON nl.newsletter_id = n.id
    LEFT JOIN email_stats es ON nl.newsletter_id = es.newsletter_id
    WHERE ${whereClause}
    ORDER BY nl.action_at DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...params, limit, offset) as JoinedRow[];

  // Transform rows to SentHistoryItem
  let items: SentHistoryItem[] = rows.map((row) => {
    const details = safeJsonParse<Record<string, unknown>>(row.details, {});

    // Extract data from details JSON
    const listNames = (details.list_names as string[]) || [];
    const listIds = (details.sent_to_lists as string[]) || [];
    const recipientCount = (details.recipient_count as number) || 0;
    const recipientEmails = details.recipient_emails as string[] | undefined;

    // Calculate stats
    let stats: SentHistoryItem['stats'] = null;
    if (row.total_sent !== null) {
      const openRate = row.total_sent > 0
        ? ((row.unique_opens || 0) / row.total_sent) * 100
        : 0;
      const clickRate = (row.unique_opens || 0) > 0
        ? ((row.unique_clicks || 0) / (row.unique_opens || 1)) * 100
        : 0;

      stats = {
        totalSent: row.total_sent || 0,
        uniqueOpens: row.unique_opens || 0,
        uniqueClicks: row.unique_clicks || 0,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
      };
    }

    return {
      id: String(row.log_id),
      newsletterId: row.newsletter_id,
      sentAt: row.action_at,
      subject: row.subject || 'Untitled Newsletter',
      topics: safeJsonParse<string[]>(row.topics, []),
      listNames,
      listIds,
      recipientCount,
      recipientEmails,
      stats,
    };
  });

  // Apply listId filter in JS (since it's in JSON details)
  if (listFilter) {
    items = items.filter((item) => item.listIds.includes(listFilter));
  }

  return {
    items,
    total: listFilter ? items.length : total, // Recalculate if filtered
    limit,
    offset,
  };
};

/**
 * Get detailed sent history for a specific newsletter
 * Includes full newsletter content for preview
 */
export const getSentHistoryDetail = (newsletterId: string): SentHistoryItem | null => {
  const stmt = db.prepare(`
    SELECT
      nl.id as log_id,
      nl.newsletter_id,
      nl.action_at,
      nl.details,
      n.subject,
      n.topics,
      n.sections,
      n.introduction,
      n.conclusion,
      n.prompt_of_day,
      n.audience,
      n.editors_note,
      n.tool_of_day,
      n.audience_sections,
      n.format_version,
      es.total_sent,
      es.total_opens,
      es.unique_opens,
      es.total_clicks,
      es.unique_clicks
    FROM newsletter_logs nl
    LEFT JOIN newsletters n ON nl.newsletter_id = n.id
    LEFT JOIN email_stats es ON nl.newsletter_id = es.newsletter_id
    WHERE nl.newsletter_id = ? AND nl.action = 'sent_email'
    ORDER BY nl.action_at DESC
    LIMIT 1
  `);

  const row = stmt.get(newsletterId) as JoinedRow | undefined;

  if (!row) return null;

  const details = safeJsonParse<Record<string, unknown>>(row.details, {});

  // Extract data from details JSON
  const listNames = (details.list_names as string[]) || [];
  const listIds = (details.sent_to_lists as string[]) || [];
  const recipientCount = (details.recipient_count as number) || 0;
  const recipientEmails = details.recipient_emails as string[] | undefined;

  // Calculate stats
  let stats: SentHistoryItem['stats'] = null;
  if (row.total_sent !== null) {
    const openRate = row.total_sent > 0
      ? ((row.unique_opens || 0) / row.total_sent) * 100
      : 0;
    const clickRate = (row.unique_opens || 0) > 0
      ? ((row.unique_clicks || 0) / (row.unique_opens || 1)) * 100
      : 0;

    stats = {
      totalSent: row.total_sent || 0,
      uniqueOpens: row.unique_opens || 0,
      uniqueClicks: row.unique_clicks || 0,
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10,
    };
  }

  // Build newsletter content for preview
  const newsletterContent: Record<string, unknown> = {
    id: row.newsletter_id,
    subject: row.subject,
    introduction: row.introduction,
    conclusion: row.conclusion,
    sections: safeJsonParse(row.sections, []),
    promptOfTheDay: safeJsonParse(row.prompt_of_day, null),
    audience: safeJsonParse(row.audience, []),
    formatVersion: row.format_version || 'v1',
  };

  // Add v2 fields if present
  if (row.format_version === 'v2') {
    newsletterContent.editorsNote = row.editors_note;
    newsletterContent.toolOfDay = safeJsonParse(row.tool_of_day, null);
    newsletterContent.audienceSections = safeJsonParse(row.audience_sections, []);
  }

  return {
    id: String(row.log_id),
    newsletterId: row.newsletter_id,
    sentAt: row.action_at,
    subject: row.subject || 'Untitled Newsletter',
    topics: safeJsonParse<string[]>(row.topics, []),
    listNames,
    listIds,
    recipientCount,
    recipientEmails,
    stats,
    newsletterContent,
  };
};

/**
 * Get summary stats for sent history
 */
export const getSentHistoryStats = (): {
  totalSent: number;
  totalEmails: number;
  averageOpenRate: number;
  averageClickRate: number;
} => {
  const stmt = db.prepare(`
    SELECT
      COUNT(DISTINCT nl.newsletter_id) as total_sent,
      SUM(es.total_sent) as total_emails,
      AVG(CASE WHEN es.total_sent > 0 THEN (es.unique_opens * 100.0 / es.total_sent) ELSE 0 END) as avg_open_rate,
      AVG(CASE WHEN es.unique_opens > 0 THEN (es.unique_clicks * 100.0 / es.unique_opens) ELSE 0 END) as avg_click_rate
    FROM newsletter_logs nl
    LEFT JOIN email_stats es ON nl.newsletter_id = es.newsletter_id
    WHERE nl.action = 'sent_email'
  `);

  const row = stmt.get() as {
    total_sent: number;
    total_emails: number | null;
    avg_open_rate: number | null;
    avg_click_rate: number | null;
  };

  return {
    totalSent: row.total_sent || 0,
    totalEmails: row.total_emails || 0,
    averageOpenRate: Math.round((row.avg_open_rate || 0) * 10) / 10,
    averageClickRate: Math.round((row.avg_click_rate || 0) * 10) / 10,
  };
};
