/**
 * System Log Database Service
 *
 * Handles persistence of Control Plane logs to SQLite with:
 * - Configurable retention policy (default 90 days)
 * - Query limits for performance (default 500K rows)
 * - Proper indexing for fast queries
 * - Log level filtering
 */

import db from '../db/init.ts';

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SystemLogEntry {
  id: number;
  correlationId: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  action: string;
  message: string;
  durationMs: number | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  errorName: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  errorCode: string | null;
}

export interface SystemLogInput {
  correlationId: string;
  timestamp: Date;
  level: LogLevel;
  module: string;
  action: string;
  message: string;
  durationMs?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface SystemLogFilterOptions {
  correlationId?: string;
  level?: LogLevel | LogLevel[];
  module?: string;
  action?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SystemLogsResponse {
  logs: SystemLogEntry[];
  total: number;
  hasMore: boolean;
  queryLimit: number;
}

export interface LogSettings {
  retentionDays: number;
  queryLimit: number;
  minLevel: LogLevel;
}

export interface LogStats {
  totalLogs: number;
  byLevel: Record<LogLevel, number>;
  byModule: Record<string, number>;
  oldestLog: string | null;
  newestLog: string | null;
  storageEstimateKb: number;
}

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

interface SystemLogRow {
  id: number;
  correlation_id: string;
  timestamp: string;
  level: string;
  module: string;
  action: string;
  message: string;
  duration_ms: number | null;
  user_id: string | null;
  metadata: string | null;
  error_name: string | null;
  error_message: string | null;
  error_stack: string | null;
  error_code: string | null;
}

interface UserSettingsRow {
  id: number;
  user_email: string;
  log_retention_days: number;
  log_query_limit: number;
  log_min_level: string;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_QUERY_LIMIT = 500000;
const DEFAULT_MIN_LEVEL: LogLevel = 'info';
const DEFAULT_PAGE_SIZE = 50;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to SystemLogEntry
 */
const rowToLogEntry = (row: SystemLogRow): SystemLogEntry => ({
  id: row.id,
  correlationId: row.correlation_id,
  timestamp: row.timestamp,
  level: row.level as LogLevel,
  module: row.module,
  action: row.action,
  message: row.message,
  durationMs: row.duration_ms,
  userId: row.user_id,
  metadata: row.metadata ? JSON.parse(row.metadata) : null,
  errorName: row.error_name,
  errorMessage: row.error_message,
  errorStack: row.error_stack,
  errorCode: row.error_code,
});

/**
 * Check if log level meets minimum threshold
 */
const meetsMinLevel = (level: LogLevel, minLevel: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
};

// =============================================================================
// LOG PERSISTENCE
// =============================================================================

/**
 * Insert a log entry into the database
 */
export const insertLog = (log: SystemLogInput): number => {
  const stmt = db.prepare(`
    INSERT INTO system_logs (
      correlation_id, timestamp, level, module, action, message,
      duration_ms, user_id, metadata,
      error_name, error_message, error_stack, error_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    log.correlationId,
    log.timestamp.toISOString(),
    log.level,
    log.module,
    log.action,
    log.message,
    log.durationMs ?? null,
    log.userId ?? null,
    log.metadata ? JSON.stringify(log.metadata) : null,
    log.error?.name ?? null,
    log.error?.message ?? null,
    log.error?.stack ?? null,
    log.error?.code ?? null
  );

  return result.lastInsertRowid as number;
};

/**
 * Batch insert multiple log entries (more efficient)
 */
export const insertLogsBatch = (logs: SystemLogInput[]): number => {
  const stmt = db.prepare(`
    INSERT INTO system_logs (
      correlation_id, timestamp, level, module, action, message,
      duration_ms, user_id, metadata,
      error_name, error_message, error_stack, error_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((logEntries: SystemLogInput[]) => {
    let count = 0;
    for (const log of logEntries) {
      stmt.run(
        log.correlationId,
        log.timestamp.toISOString(),
        log.level,
        log.module,
        log.action,
        log.message,
        log.durationMs ?? null,
        log.userId ?? null,
        log.metadata ? JSON.stringify(log.metadata) : null,
        log.error?.name ?? null,
        log.error?.message ?? null,
        log.error?.stack ?? null,
        log.error?.code ?? null
      );
      count++;
    }
    return count;
  });

  return insertMany(logs);
};

// =============================================================================
// LOG QUERYING
// =============================================================================

/**
 * Get system logs with filtering and pagination
 */
export const getSystemLogs = (
  options: SystemLogFilterOptions = {},
  settings?: Partial<LogSettings>
): SystemLogsResponse => {
  const queryLimit = settings?.queryLimit ?? DEFAULT_QUERY_LIMIT;
  const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, 1000);
  const offset = options.offset ?? 0;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.correlationId) {
    conditions.push('correlation_id = ?');
    params.push(options.correlationId);
  }

  if (options.level) {
    if (Array.isArray(options.level)) {
      conditions.push(`level IN (${options.level.map(() => '?').join(', ')})`);
      params.push(...options.level);
    } else {
      conditions.push('level = ?');
      params.push(options.level);
    }
  }

  if (options.module) {
    conditions.push('module = ?');
    params.push(options.module);
  }

  if (options.action) {
    conditions.push('action = ?');
    params.push(options.action);
  }

  if (options.userId) {
    conditions.push('user_id = ?');
    params.push(options.userId);
  }

  if (options.startDate) {
    conditions.push('timestamp >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push('timestamp <= ?');
    params.push(options.endDate + ' 23:59:59');
  }

  if (options.search) {
    conditions.push('(message LIKE ? OR module LIKE ? OR action LIKE ? OR correlation_id LIKE ?)');
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total (capped at queryLimit for performance)
  const countQuery = `
    SELECT COUNT(*) as total FROM (
      SELECT 1 FROM system_logs ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ?
    )
  `;
  const countResult = db.prepare(countQuery).get(...params, queryLimit) as { total: number };
  const total = countResult.total;

  // Get paginated results
  const selectQuery = `
    SELECT * FROM system_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(selectQuery).all(...params, limit, offset) as SystemLogRow[];

  const logs = rows.map(rowToLogEntry);
  const hasMore = offset + logs.length < total;

  return { logs, total, hasMore, queryLimit };
};

/**
 * Get logs by correlation ID (for request tracing)
 */
export const getLogsByCorrelationId = (correlationId: string): SystemLogEntry[] => {
  const rows = db.prepare(`
    SELECT * FROM system_logs
    WHERE correlation_id = ?
    ORDER BY timestamp ASC
  `).all(correlationId) as SystemLogRow[];

  return rows.map(rowToLogEntry);
};

/**
 * Get unique modules with log counts
 */
export const getModules = (): Array<{ module: string; count: number }> => {
  return db.prepare(`
    SELECT module, COUNT(*) as count
    FROM system_logs
    GROUP BY module
    ORDER BY count DESC
  `).all() as Array<{ module: string; count: number }>;
};

/**
 * Get unique actions for a module
 */
export const getActionsForModule = (module: string): Array<{ action: string; count: number }> => {
  return db.prepare(`
    SELECT action, COUNT(*) as count
    FROM system_logs
    WHERE module = ?
    GROUP BY action
    ORDER BY count DESC
  `).all(module) as Array<{ action: string; count: number }>;
};

// =============================================================================
// LOG STATISTICS
// =============================================================================

/**
 * Get log statistics
 */
export const getLogStats = (): LogStats => {
  // Total count
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM system_logs').get() as { count: number };

  // By level
  const byLevelRows = db.prepare(`
    SELECT level, COUNT(*) as count FROM system_logs GROUP BY level
  `).all() as Array<{ level: string; count: number }>;

  const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const row of byLevelRows) {
    byLevel[row.level as LogLevel] = row.count;
  }

  // By module (top 10)
  const byModuleRows = db.prepare(`
    SELECT module, COUNT(*) as count FROM system_logs
    GROUP BY module ORDER BY count DESC LIMIT 10
  `).all() as Array<{ module: string; count: number }>;

  const byModule: Record<string, number> = {};
  for (const row of byModuleRows) {
    byModule[row.module] = row.count;
  }

  // Date range
  const dateRange = db.prepare(`
    SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM system_logs
  `).get() as { oldest: string | null; newest: string | null };

  // Estimate storage (avg 500 bytes per row)
  const storageEstimateKb = Math.round((totalResult.count * 500) / 1024);

  return {
    totalLogs: totalResult.count,
    byLevel,
    byModule,
    oldestLog: dateRange.oldest,
    newestLog: dateRange.newest,
    storageEstimateKb,
  };
};

// =============================================================================
// LOG RETENTION & CLEANUP
// =============================================================================

/**
 * Delete logs older than retention period
 * @returns Number of deleted rows
 */
export const cleanupOldLogs = (retentionDays: number = DEFAULT_RETENTION_DAYS): number => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffIso = cutoffDate.toISOString();

  const result = db.prepare(`
    DELETE FROM system_logs WHERE timestamp < ?
  `).run(cutoffIso);

  console.log(`[SystemLogDb] Cleaned up ${result.changes} logs older than ${retentionDays} days`);
  return result.changes;
};

/**
 * Delete logs exceeding row limit (keeps newest)
 * @returns Number of deleted rows
 */
export const enforceRowLimit = (maxRows: number = DEFAULT_QUERY_LIMIT): number => {
  // Get current count
  const countResult = db.prepare('SELECT COUNT(*) as count FROM system_logs').get() as { count: number };

  if (countResult.count <= maxRows) {
    return 0;
  }

  const rowsToDelete = countResult.count - maxRows;

  // Delete oldest rows
  const result = db.prepare(`
    DELETE FROM system_logs WHERE id IN (
      SELECT id FROM system_logs ORDER BY timestamp ASC LIMIT ?
    )
  `).run(rowsToDelete);

  console.log(`[SystemLogDb] Enforced row limit: deleted ${result.changes} oldest logs`);
  return result.changes;
};

/**
 * Run full cleanup (retention + row limit)
 */
export const runCleanup = (
  retentionDays: number = DEFAULT_RETENTION_DAYS,
  maxRows: number = DEFAULT_QUERY_LIMIT
): { deletedByAge: number; deletedByLimit: number } => {
  const deletedByAge = cleanupOldLogs(retentionDays);
  const deletedByLimit = enforceRowLimit(maxRows);

  // Vacuum database if significant cleanup occurred
  if (deletedByAge + deletedByLimit > 1000) {
    try {
      db.exec('VACUUM');
      console.log('[SystemLogDb] Vacuumed database after cleanup');
    } catch (err) {
      console.warn('[SystemLogDb] Failed to vacuum:', err);
    }
  }

  return { deletedByAge, deletedByLimit };
};

// =============================================================================
// USER SETTINGS
// =============================================================================

/**
 * Get user's log settings
 */
export const getUserLogSettings = (userEmail: string): LogSettings => {
  const row = db.prepare(`
    SELECT * FROM user_settings WHERE user_email = ?
  `).get(userEmail) as UserSettingsRow | undefined;

  if (!row) {
    return {
      retentionDays: DEFAULT_RETENTION_DAYS,
      queryLimit: DEFAULT_QUERY_LIMIT,
      minLevel: DEFAULT_MIN_LEVEL,
    };
  }

  return {
    retentionDays: row.log_retention_days,
    queryLimit: row.log_query_limit,
    minLevel: row.log_min_level as LogLevel,
  };
};

/**
 * Update user's log settings
 */
export const updateUserLogSettings = (
  userEmail: string,
  settings: Partial<LogSettings>
): LogSettings => {
  const existing = getUserLogSettings(userEmail);
  const updated = { ...existing, ...settings };

  db.prepare(`
    INSERT INTO user_settings (user_email, log_retention_days, log_query_limit, log_min_level, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_email) DO UPDATE SET
      log_retention_days = excluded.log_retention_days,
      log_query_limit = excluded.log_query_limit,
      log_min_level = excluded.log_min_level,
      updated_at = datetime('now')
  `).run(userEmail, updated.retentionDays, updated.queryLimit, updated.minLevel);

  console.log(`[SystemLogDb] Updated log settings for ${userEmail}:`, updated);
  return updated;
};

// =============================================================================
// CSV EXPORT
// =============================================================================

/**
 * Export logs to CSV format
 */
export const exportLogsToCsv = (options: SystemLogFilterOptions = {}): string => {
  // Get logs without pagination limit
  const { logs } = getSystemLogs({ ...options, limit: 10000, offset: 0 });

  const headers = [
    'ID',
    'Timestamp',
    'Level',
    'Module',
    'Action',
    'Message',
    'Duration (ms)',
    'Correlation ID',
    'User ID',
    'Metadata',
    'Error Name',
    'Error Message',
  ];

  const rows = logs.map((log) => [
    log.id.toString(),
    log.timestamp,
    log.level,
    log.module,
    log.action,
    log.message,
    log.durationMs?.toString() || '',
    log.correlationId,
    log.userId || '',
    log.metadata ? JSON.stringify(log.metadata) : '',
    log.errorName || '',
    log.errorMessage || '',
  ]);

  const escapeValue = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.map((v) => escapeValue(v)).join(',')),
  ];

  return csvLines.join('\n');
};

// =============================================================================
// EXPORTS
// =============================================================================

export {
  DEFAULT_RETENTION_DAYS,
  DEFAULT_QUERY_LIMIT,
  DEFAULT_MIN_LEVEL,
  meetsMinLevel,
};
