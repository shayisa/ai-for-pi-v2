/**
 * Log Client Service
 * Frontend API client for fetching unified system logs
 */

import type { LogSource, LogFilterOptions, LogsResponse, LogStats } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Build query string from filter options
 */
const buildQueryString = (options: LogFilterOptions): string => {
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
 * Get unified logs with optional filtering
 */
export const getLogs = async (options: LogFilterOptions = {}): Promise<LogsResponse> => {
  const queryString = buildQueryString(options);
  const response = await fetch(`${API_BASE}/api/logs${queryString}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch logs');
  }

  return response.json();
};

/**
 * Export logs to CSV and trigger download
 */
export const exportLogsCsv = async (options: LogFilterOptions = {}): Promise<void> => {
  const queryString = buildQueryString(options);
  const response = await fetch(`${API_BASE}/api/logs/export${queryString}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to export logs');
  }

  // Get CSV content
  const csvContent = await response.text();

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Generate filename with current date
  const date = new Date().toISOString().split('T')[0];
  link.download = `system-logs-${date}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Get log statistics
 */
export const getLogStats = async (): Promise<LogStats> => {
  const response = await fetch(`${API_BASE}/api/logs/stats`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch log statistics');
  }

  return response.json();
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

/**
 * Get source display label
 */
export const getSourceLabel = (source: LogSource): string => {
  const labels: Record<LogSource, string> = {
    newsletter: 'Newsletter',
    api_audit: 'API Audit',
  };
  return labels[source] || source;
};

/**
 * Get all available action types for filtering
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
