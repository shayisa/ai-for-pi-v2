/**
 * Log Client Service
 *
 * Frontend API client for system logs with:
 * - Full Control Plane logs (system_logs table)
 * - Legacy unified logs (newsletter + api_key)
 * - User settings for retention and query limits
 * - Cleanup controls
 */

import { apiRequest, API_BASE } from './apiHelper.ts';

// =============================================================================
// TYPES
// =============================================================================

// Legacy types (backward compatibility)
export type LogSource = 'newsletter' | 'api_audit';

export interface LogFilterOptions {
  source?: LogSource;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UnifiedLogEntry {
  id: number;
  source: LogSource;
  timestamp: string;
  action: string;
  newsletterId: string | null;
  newsletterSubject: string | null;
  userEmail: string | null;
  service: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
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

// New System Log types
export type SystemLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SystemLogEntry {
  id: number;
  correlationId: string;
  timestamp: string;
  level: SystemLogLevel;
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

export interface SystemLogFilterOptions {
  correlationId?: string;
  level?: SystemLogLevel | SystemLogLevel[];
  module?: string;
  action?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  userEmail?: string;
}

export interface SystemLogsResponse {
  logs: SystemLogEntry[];
  total: number;
  hasMore: boolean;
  queryLimit: number;
}

export interface SystemLogStats {
  totalLogs: number;
  byLevel: Record<SystemLogLevel, number>;
  byModule: Record<string, number>;
  oldestLog: string | null;
  newestLog: string | null;
  storageEstimateKb: number;
}

export interface LogSettings {
  retentionDays: number;
  queryLimit: number;
  minLevel: SystemLogLevel;
}

export interface CleanupResult {
  deletedByAge: number;
  deletedByLimit: number;
  duration: number;
}

export interface CleanupStatus {
  isInitialized: boolean;
  isSchedulerRunning: boolean;
  lastCleanupTime: number | null;
  nextCleanupTime: number | null;
}

export interface ModuleInfo {
  module: string;
  count: number;
}

export interface ActionInfo {
  action: string;
  count: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build query string from legacy filter options
 */
const buildLegacyQueryString = (options: LogFilterOptions): string => {
  const params = new URLSearchParams();

  if (options.source) params.append('source', options.source);
  if (options.action) params.append('action', options.action);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.search) params.append('search', options.search);
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.offset !== undefined) params.append('offset', String(options.offset));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * Build query string from system log filter options
 */
const buildSystemLogQueryString = (options: SystemLogFilterOptions): string => {
  const params = new URLSearchParams();

  if (options.correlationId) params.append('correlationId', options.correlationId);
  if (options.level) {
    if (Array.isArray(options.level)) {
      options.level.forEach((l) => params.append('level', l));
    } else {
      params.append('level', options.level);
    }
  }
  if (options.module) params.append('module', options.module);
  if (options.action) params.append('action', options.action);
  if (options.userId) params.append('userId', options.userId);
  if (options.search) params.append('search', options.search);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.offset !== undefined) params.append('offset', String(options.offset));
  if (options.userEmail) params.append('userEmail', options.userEmail);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

// =============================================================================
// SYSTEM LOGS API (New - Full Visibility)
// =============================================================================

/**
 * Get system logs with filtering
 */
export const getSystemLogs = async (
  options: SystemLogFilterOptions = {}
): Promise<SystemLogsResponse> => {
  const queryString = buildSystemLogQueryString(options);
  return apiRequest<SystemLogsResponse>(`/api/logs/system${queryString}`);
};

/**
 * Export system logs to CSV
 */
export const exportSystemLogsCsv = async (
  options: SystemLogFilterOptions = {}
): Promise<void> => {
  const queryString = buildSystemLogQueryString(options);
  const response = await fetch(`${API_BASE}/api/logs/system/export${queryString}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || 'Failed to export system logs');
  }

  const csvContent = await response.text();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const date = new Date().toISOString().split('T')[0];
  link.download = `system-logs-${date}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Get system log statistics
 */
export const getSystemLogStats = async (): Promise<SystemLogStats> => {
  return apiRequest<SystemLogStats>('/api/logs/system/stats');
};

/**
 * Get list of modules with log counts
 */
export const getModules = async (): Promise<ModuleInfo[]> => {
  const response = await apiRequest<{ modules: ModuleInfo[] }>('/api/logs/system/modules');
  return response.modules;
};

/**
 * Get actions for a specific module
 */
export const getActionsForModule = async (module: string): Promise<ActionInfo[]> => {
  const response = await apiRequest<{ actions: ActionInfo[] }>(
    `/api/logs/system/actions/${encodeURIComponent(module)}`
  );
  return response.actions;
};

/**
 * Trace logs by correlation ID (request tracing)
 */
export const traceLogs = async (
  correlationId: string
): Promise<{ logs: SystemLogEntry[]; correlationId: string }> => {
  return apiRequest<{ logs: SystemLogEntry[]; correlationId: string }>(
    `/api/logs/system/trace/${encodeURIComponent(correlationId)}`
  );
};

// =============================================================================
// USER SETTINGS API
// =============================================================================

/**
 * Get user's log settings
 */
export const getLogSettings = async (userEmail: string): Promise<LogSettings> => {
  return apiRequest<LogSettings>(`/api/logs/settings?userEmail=${encodeURIComponent(userEmail)}`);
};

/**
 * Update user's log settings
 */
export const updateLogSettings = async (
  userEmail: string,
  settings: Partial<LogSettings>
): Promise<LogSettings> => {
  return apiRequest<LogSettings>('/api/logs/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, ...settings }),
  });
};

// =============================================================================
// CLEANUP API
// =============================================================================

/**
 * Trigger manual cleanup
 */
export const runCleanup = async (options?: {
  retentionDays?: number;
  maxRows?: number;
}): Promise<CleanupResult> => {
  return apiRequest<CleanupResult>('/api/logs/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
};

/**
 * Get cleanup scheduler status
 */
export const getCleanupStatus = async (): Promise<CleanupStatus> => {
  return apiRequest<CleanupStatus>('/api/logs/cleanup/status');
};

// =============================================================================
// LEGACY UNIFIED LOGS API (Backward Compatibility)
// =============================================================================

/**
 * Get unified logs with optional filtering (legacy)
 */
export const getLogs = async (options: LogFilterOptions = {}): Promise<LogsResponse> => {
  const queryString = buildLegacyQueryString(options);
  return apiRequest<LogsResponse>(`/api/logs${queryString}`);
};

/**
 * Export unified logs to CSV (legacy)
 */
export const exportLogsCsv = async (options: LogFilterOptions = {}): Promise<void> => {
  const queryString = buildLegacyQueryString(options);
  const response = await fetch(`${API_BASE}/api/logs/export${queryString}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || error.error || 'Failed to export logs');
  }

  const csvContent = await response.text();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const date = new Date().toISOString().split('T')[0];
  link.download = `unified-logs-${date}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Get unified log statistics (legacy)
 */
export const getLogStats = async (): Promise<LogStats> => {
  return apiRequest<LogStats>('/api/logs/stats');
};

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Get human-readable action label
 */
export const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    // Newsletter actions
    created: 'Newsletter Created',
    saved_to_drive: 'Saved to Drive',
    sent_email: 'Email Sent',
    // API key actions
    save: 'Key Saved',
    delete: 'Key Deleted',
    validate_success: 'Validation Passed',
    validate_failure: 'Validation Failed',
    // System log common actions
    list: 'List',
    get: 'Get',
    create: 'Create',
    update: 'Update',
    search: 'Search',
    export: 'Export',
    generate: 'Generate',
    validate: 'Validate',
  };
  return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Get source display label (legacy)
 */
export const getSourceLabel = (source: LogSource): string => {
  const labels: Record<LogSource, string> = {
    newsletter: 'Newsletter',
    api_audit: 'API Audit',
  };
  return labels[source] || source;
};

/**
 * Get log level display label with color class
 */
export const getLevelDisplay = (
  level: SystemLogLevel
): { label: string; colorClass: string } => {
  const displays: Record<SystemLogLevel, { label: string; colorClass: string }> = {
    debug: { label: 'DEBUG', colorClass: 'text-slate-500 bg-slate-100' },
    info: { label: 'INFO', colorClass: 'text-blue-700 bg-blue-100' },
    warn: { label: 'WARN', colorClass: 'text-amber-700 bg-amber-100' },
    error: { label: 'ERROR', colorClass: 'text-red-700 bg-red-100' },
  };
  return displays[level] || { label: level.toUpperCase(), colorClass: 'text-gray-700 bg-gray-100' };
};

/**
 * Get all available action types for filtering (legacy)
 */
export const getActionTypes = (): { value: string; label: string; source: LogSource }[] => [
  { value: 'created', label: 'Newsletter Created', source: 'newsletter' },
  { value: 'saved_to_drive', label: 'Saved to Drive', source: 'newsletter' },
  { value: 'sent_email', label: 'Email Sent', source: 'newsletter' },
  { value: 'save', label: 'Key Saved', source: 'api_audit' },
  { value: 'delete', label: 'Key Deleted', source: 'api_audit' },
  { value: 'validate_success', label: 'Validation Passed', source: 'api_audit' },
  { value: 'validate_failure', label: 'Validation Failed', source: 'api_audit' },
];

/**
 * Format duration for display
 */
export const formatDuration = (ms: number | null): string => {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Format storage size for display
 */
export const formatStorageSize = (kb: number): string => {
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(1)} GB`;
};
