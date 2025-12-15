/**
 * useLogs Hook
 *
 * Manages system logs state with filtering, pagination, and export:
 * - Fetches unified logs from both newsletter_logs and api_key_audit_log
 * - Supports filtering by source, action, date range, and search
 * - Debounced search to reduce API calls
 * - Pagination with "Load More" functionality
 * - CSV export with current filters applied
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { UnifiedLogEntry, LogFilterOptions, LogStats, LogSource } from '../types';
import * as logApi from '../services/logClientService';

interface UseLogsFilters {
  source?: LogSource;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface UseLogsReturn {
  // Data
  logs: UnifiedLogEntry[];
  total: number;
  hasMore: boolean;
  stats: LogStats | null;

  // State
  isLoading: boolean;
  isLoadingMore: boolean;
  isExporting: boolean;
  error: string | null;

  // Filters
  filters: UseLogsFilters;
  setFilters: (filters: UseLogsFilters) => void;
  setSearch: (search: string) => void;
  clearFilters: () => void;

  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  exportCsv: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function useLogs(): UseLogsReturn {
  // Data state
  const [logs, setLogs] = useState<UnifiedLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<LogStats | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFiltersInternal] = useState<UseLogsFilters>({});
  const [debouncedSearch, setDebouncedSearch] = useState<string | undefined>(undefined);

  // Refs for debounce
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch logs with current filters
  const fetchLogs = useCallback(async (options: LogFilterOptions = {}, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await logApi.getLogs({
        ...filters,
        search: debouncedSearch,
        ...options,
        limit: DEFAULT_PAGE_SIZE,
      });

      if (append) {
        setLogs(prev => [...prev, ...response.logs]);
      } else {
        setLogs(response.logs);
      }
      setTotal(response.total);
      setHasMore(response.hasMore);

      console.log(`[Logs] Fetched ${response.logs.length} of ${response.total} logs`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch logs';
      console.error('[Logs] Error fetching:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filters, debouncedSearch]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await logApi.getLogStats();
      setStats(statsData);
    } catch (e) {
      console.error('[Logs] Error fetching stats:', e);
    }
  }, []);

  // Initial load and reload on filter changes
  useEffect(() => {
    fetchLogs({ offset: 0 });
  }, [fetchLogs]);

  // Load stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Debounced search handler
  const setSearch = useCallback((search: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Update the filters immediately (for UI responsiveness)
    setFiltersInternal(prev => ({ ...prev, search }));

    // Debounce the actual API call
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search || undefined);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Set filters (non-search)
  const setFilters = useCallback((newFilters: UseLogsFilters) => {
    // Handle search separately with debounce
    const { search, ...restFilters } = newFilters;

    setFiltersInternal(prev => ({ ...prev, ...restFilters }));

    if (search !== undefined) {
      setSearch(search);
    }
  }, [setSearch]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setFiltersInternal({});
    setDebouncedSearch(undefined);
  }, []);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    await fetchLogs({ offset: logs.length }, true);
  }, [fetchLogs, isLoadingMore, hasMore, logs.length]);

  // Refresh from start
  const refresh = useCallback(async () => {
    await fetchLogs({ offset: 0 });
    await fetchStats();
  }, [fetchLogs, fetchStats]);

  // Export to CSV
  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      await logApi.exportLogsCsv({
        ...filters,
        search: debouncedSearch,
      });
      console.log('[Logs] CSV export triggered');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to export logs';
      console.error('[Logs] Error exporting:', e);
      setError(msg);
    } finally {
      setIsExporting(false);
    }
  }, [filters, debouncedSearch]);

  return {
    // Data
    logs,
    total,
    hasMore,
    stats,

    // State
    isLoading,
    isLoadingMore,
    isExporting,
    error,

    // Filters
    filters,
    setFilters,
    setSearch,
    clearFilters,

    // Actions
    loadMore,
    refresh,
    exportCsv,
  };
}
