/**
 * Unified Log Database Service
 * Provides combined access to newsletter_logs and api_key_audit_log tables
 * for a unified system activity timeline view
 */

import db from '../db/init.ts';

// Types
export type LogSource = 'newsletter' | 'api_audit';

export type NewsletterAction = 'created' | 'saved_to_drive' | 'sent_email';
export type ApiAuditAction = 'save' | 'delete' | 'validate_success' | 'validate_failure';

export interface UnifiedLogEntry {
  id: number;
  source: LogSource;
  timestamp: string;
  action: string;
  // Newsletter-specific
  newsletterId: string | null;
  newsletterSubject: string | null;
  // API audit-specific
  userEmail: string | null;
  service: string | null;
  ipAddress: string | null;
  // Shared
  details: Record<string, unknown> | null;
}

export interface LogFilterOptions {
  source?: LogSource;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogsResponse {
  logs: UnifiedLogEntry[];
  total: number;
  hasMore: boolean;
}

export interface LogStats {
  totalNewsletter: number;
  totalApiAudit: number;
  byAction: Record<string, number>;
}

// Internal row type for UNION query result
interface UnifiedLogRow {
  id: number;
  source: string;
  timestamp: string;
  action: string;
  newsletter_id: string | null;
  newsletter_subject: string | null;
  user_email: string | null;
  service: string | null;
  ip_address: string | null;
  details: string | null;
}

/**
 * Convert database row to UnifiedLogEntry
 */
const rowToLogEntry = (row: UnifiedLogRow): UnifiedLogEntry => ({
  id: row.id,
  source: row.source as LogSource,
  timestamp: row.timestamp,
  action: row.action,
  newsletterId: row.newsletter_id,
  newsletterSubject: row.newsletter_subject,
  userEmail: row.user_email,
  service: row.service,
  ipAddress: row.ip_address,
  details: row.details ? JSON.parse(row.details) : null,
});

/**
 * Build WHERE clause and params for filtering
 */
const buildWhereClause = (
  options: LogFilterOptions,
  tablePrefix: string
): { conditions: string[]; params: unknown[] } => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.action) {
    conditions.push(`${tablePrefix}.action = ?`);
    params.push(options.action);
  }

  if (options.startDate) {
    conditions.push(`${tablePrefix}.timestamp >= ?`);
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push(`${tablePrefix}.timestamp <= ?`);
    params.push(options.endDate + ' 23:59:59');
  }

  return { conditions, params };
};

/**
 * Get unified logs from both tables with filtering and pagination
 */
export const getUnifiedLogs = (options: LogFilterOptions = {}): LogsResponse => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  // Build newsletter logs query
  const buildNewsletterQuery = () => {
    const { conditions, params } = buildWhereClause(
      { ...options, startDate: options.startDate, endDate: options.endDate, action: options.action },
      'nl'
    );

    // Add search filter for newsletter subject
    if (options.search) {
      conditions.push(`(n.subject LIKE ? OR nl.newsletter_id LIKE ?)`);
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return {
      sql: `
        SELECT
          nl.id,
          'newsletter' as source,
          nl.action_at as timestamp,
          nl.action,
          nl.newsletter_id,
          n.subject as newsletter_subject,
          NULL as user_email,
          NULL as service,
          NULL as ip_address,
          nl.details
        FROM newsletter_logs nl
        LEFT JOIN newsletters n ON nl.newsletter_id = n.id
        ${whereClause}
      `,
      params,
    };
  };

  // Build API audit logs query
  const buildAuditQuery = () => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.action) {
      conditions.push(`al.action = ?`);
      params.push(options.action);
    }

    if (options.startDate) {
      conditions.push(`al.created_at >= ?`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`al.created_at <= ?`);
      params.push(options.endDate + ' 23:59:59');
    }

    // Add search filter for service or email
    if (options.search) {
      conditions.push(`(al.service LIKE ? OR al.user_email LIKE ?)`);
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return {
      sql: `
        SELECT
          al.id,
          'api_audit' as source,
          al.created_at as timestamp,
          al.action,
          NULL as newsletter_id,
          NULL as newsletter_subject,
          al.user_email,
          al.service,
          al.ip_address,
          NULL as details
        FROM api_key_audit_log al
        ${whereClause}
      `,
      params,
    };
  };

  // Build the UNION query based on source filter
  let unionQuery: string;
  let unionParams: unknown[];

  if (options.source === 'newsletter') {
    const nq = buildNewsletterQuery();
    unionQuery = nq.sql;
    unionParams = nq.params;
  } else if (options.source === 'api_audit') {
    const aq = buildAuditQuery();
    unionQuery = aq.sql;
    unionParams = aq.params;
  } else {
    // Both sources - use UNION ALL
    const nq = buildNewsletterQuery();
    const aq = buildAuditQuery();
    unionQuery = `${nq.sql} UNION ALL ${aq.sql}`;
    unionParams = [...nq.params, ...aq.params];
  }

  // Count total matching records
  const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery})`;
  const countResult = db.prepare(countQuery).get(...unionParams) as { total: number };
  const total = countResult.total;

  // Get paginated results
  const paginatedQuery = `
    SELECT * FROM (${unionQuery})
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(paginatedQuery).all(...unionParams, limit, offset) as UnifiedLogRow[];

  const logs = rows.map(rowToLogEntry);
  const hasMore = offset + logs.length < total;

  console.log(`[LogDb] Retrieved ${logs.length} of ${total} unified logs`);

  return { logs, total, hasMore };
};

/**
 * Export logs to CSV format
 */
export const exportLogsToCsv = (options: LogFilterOptions = {}): string => {
  // Get all logs without pagination
  const { logs } = getUnifiedLogs({ ...options, limit: 10000, offset: 0 });

  // CSV headers
  const headers = [
    'Timestamp',
    'Type',
    'Action',
    'Newsletter ID',
    'Newsletter Subject',
    'User Email',
    'Service',
    'IP Address',
    'Details',
  ];

  // CSV rows
  const rows = logs.map((log) => [
    log.timestamp,
    log.source,
    log.action,
    log.newsletterId || '',
    log.newsletterSubject || '',
    log.userEmail || '',
    log.service || '',
    log.ipAddress || '',
    log.details ? JSON.stringify(log.details) : '',
  ]);

  // Escape CSV values
  const escapeValue = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  // Build CSV string
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.map((v) => escapeValue(String(v))).join(',')),
  ];

  console.log(`[LogDb] Exported ${logs.length} logs to CSV`);

  return csvLines.join('\n');
};

/**
 * Get log statistics
 */
export const getLogStats = (): LogStats => {
  // Count newsletter logs
  const nlCount = db.prepare('SELECT COUNT(*) as count FROM newsletter_logs').get() as { count: number };

  // Count API audit logs
  const alCount = db.prepare('SELECT COUNT(*) as count FROM api_key_audit_log').get() as { count: number };

  // Count by action (newsletter)
  const nlByAction = db.prepare(`
    SELECT action, COUNT(*) as count FROM newsletter_logs GROUP BY action
  `).all() as Array<{ action: string; count: number }>;

  // Count by action (api audit)
  const alByAction = db.prepare(`
    SELECT action, COUNT(*) as count FROM api_key_audit_log GROUP BY action
  `).all() as Array<{ action: string; count: number }>;

  // Combine action counts
  const byAction: Record<string, number> = {};
  for (const row of nlByAction) {
    byAction[row.action] = row.count;
  }
  for (const row of alByAction) {
    byAction[row.action] = (byAction[row.action] || 0) + row.count;
  }

  console.log(`[LogDb] Stats: ${nlCount.count} newsletter logs, ${alCount.count} API audit logs`);

  return {
    totalNewsletter: nlCount.count,
    totalApiAudit: alCount.count,
    byAction,
  };
};

/**
 * Get human-readable action labels
 */
export const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    created: 'Newsletter Created',
    saved_to_drive: 'Saved to Drive',
    sent_email: 'Email Sent',
    save: 'Key Saved',
    delete: 'Key Deleted',
    validate_success: 'Validation Passed',
    validate_failure: 'Validation Failed',
  };
  return labels[action] || action;
};
