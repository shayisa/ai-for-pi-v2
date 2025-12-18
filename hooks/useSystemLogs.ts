/**
 * useSystemLogs Hook
 *
 * Comprehensive system log management with:
 * - Full Control Plane logs (all modules, actions, levels)
 * - Filtering by level, module, action, correlation ID, date range
 * - User-configurable settings (retention, query limits)
 * - Request tracing by correlation ID
 * - Statistics and storage info
 * - Manual cleanup controls
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as logApi from '../services/logClientService';
import type {
  SystemLogEntry,
  SystemLogFilterOptions,
  SystemLogStats,
  SystemLogLevel,
  LogSettings,
  ModuleInfo,
  CleanupStatus,
} from '../services/logClientService';

// =============================================================================
// TYPES
// =============================================================================

interface UseSystemLogsFilters {
  level?: SystemLogLevel;
  module?: string;
  action?: string;
  correlationId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface UseSystemLogsReturn {
  // Data
  logs: SystemLogEntry[];
  total: number;
  hasMore: boolean;
  queryLimit: number;
  stats: SystemLogStats | null;
  modules: ModuleInfo[];
  settings: LogSettings | null;
  cleanupStatus: CleanupStatus | null;

  // State
  isLoading: boolean;
  isLoadingMore: boolean;
  isLoadingStats: boolean;
  isExporting: boolean;
  isSavingSettings: boolean;
  error: string | null;

  // Filters
  filters: UseSystemLogsFilters;
  setFilters: (filters: Partial<UseSystemLogsFilters>) => void;
  setSearch: (search: string) => void;
  clearFilters: () => void;

  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  exportCsv: () => Promise<void>;
  traceLogs: (correlationId: string) => Promise<SystemLogEntry[]>;

  // Settings
  updateSettings: (settings: Partial<LogSettings>) => Promise<void>;

  // Cleanup
  runCleanup: (options?: { retentionDays?: number; maxRows?: number }) => Promise<void>;
  refreshCleanupStatus: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useSystemLogs(userEmail?: string): UseSystemLogsReturn {
  // Data state
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [queryLimit, setQueryLimit] = useState(500000);
  const [stats, setStats] = useState<SystemLogStats | null>(null);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [settings, setSettings] = useState<LogSettings | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<CleanupStatus | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFiltersInternal] = useState<UseSystemLogsFilters>({});
  const [debouncedSearch, setDebouncedSearch] = useState<string | undefined>(undefined);

  // Refs
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================================================
  // FETCH LOGS
  // ==========================================================================

  const fetchLogs = useCallback(
    async (options: SystemLogFilterOptions = {}, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await logApi.getSystemLogs({
          ...filters,
          search: debouncedSearch,
          ...options,
          limit: DEFAULT_PAGE_SIZE,
          userEmail,
        });

        if (append) {
          setLogs((prev) => [...prev, ...response.logs]);
        } else {
          setLogs(response.logs);
        }
        setTotal(response.total);
        setHasMore(response.hasMore);
        setQueryLimit(response.queryLimit);

        console.log(`[SystemLogs] Fetched ${response.logs.length} of ${response.total} logs`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch logs';
        console.error('[SystemLogs] Error fetching:', e);
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters, debouncedSearch, userEmail]
  );

  // ==========================================================================
  // FETCH STATS & MODULES
  // ==========================================================================

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const [statsData, modulesData] = await Promise.all([
        logApi.getSystemLogStats(),
        logApi.getModules(),
      ]);
      setStats(statsData);
      setModules(modulesData);
    } catch (e) {
      console.error('[SystemLogs] Error fetching stats:', e);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // ==========================================================================
  // FETCH USER SETTINGS
  // ==========================================================================

  const fetchSettings = useCallback(async () => {
    if (!userEmail) return;
    try {
      const settingsData = await logApi.getLogSettings(userEmail);
      setSettings(settingsData);
    } catch (e) {
      console.error('[SystemLogs] Error fetching settings:', e);
    }
  }, [userEmail]);

  // ==========================================================================
  // FETCH CLEANUP STATUS
  // ==========================================================================

  const refreshCleanupStatus = useCallback(async () => {
    try {
      const status = await logApi.getCleanupStatus();
      setCleanupStatus(status);
    } catch (e) {
      console.error('[SystemLogs] Error fetching cleanup status:', e);
    }
  }, []);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Initial load
  useEffect(() => {
    fetchLogs({ offset: 0 });
  }, [fetchLogs]);

  // Load stats and modules on mount
  useEffect(() => {
    fetchStats();
    refreshCleanupStatus();
  }, [fetchStats, refreshCleanupStatus]);

  // Load user settings when userEmail changes
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // FILTER HANDLERS
  // ==========================================================================

  const setSearch = useCallback((search: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setFiltersInternal((prev) => ({ ...prev, search }));

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search || undefined);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const setFilters = useCallback(
    (newFilters: Partial<UseSystemLogsFilters>) => {
      const { search, ...restFilters } = newFilters;

      setFiltersInternal((prev) => ({ ...prev, ...restFilters }));

      if (search !== undefined) {
        setSearch(search);
      }
    },
    [setSearch]
  );

  const clearFilters = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setFiltersInternal({});
    setDebouncedSearch(undefined);
  }, []);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    await fetchLogs({ offset: logs.length }, true);
  }, [fetchLogs, isLoadingMore, hasMore, logs.length]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchLogs({ offset: 0 }), fetchStats(), refreshCleanupStatus()]);
  }, [fetchLogs, fetchStats, refreshCleanupStatus]);

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      await logApi.exportSystemLogsCsv({
        ...filters,
        search: debouncedSearch,
      });
      console.log('[SystemLogs] CSV export triggered');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to export logs';
      console.error('[SystemLogs] Error exporting:', e);
      setError(msg);
    } finally {
      setIsExporting(false);
    }
  }, [filters, debouncedSearch]);

  const traceLogs = useCallback(async (correlationId: string): Promise<SystemLogEntry[]> => {
    try {
      const response = await logApi.traceLogs(correlationId);
      return response.logs;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to trace logs';
      console.error('[SystemLogs] Error tracing:', e);
      setError(msg);
      return [];
    }
  }, []);

  // ==========================================================================
  // SETTINGS
  // ==========================================================================

  const updateSettings = useCallback(
    async (newSettings: Partial<LogSettings>) => {
      if (!userEmail) {
        setError('User email required to update settings');
        return;
      }

      setIsSavingSettings(true);
      setError(null);

      try {
        const updatedSettings = await logApi.updateLogSettings(userEmail, newSettings);
        setSettings(updatedSettings);
        console.log('[SystemLogs] Settings updated:', updatedSettings);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to update settings';
        console.error('[SystemLogs] Error updating settings:', e);
        setError(msg);
      } finally {
        setIsSavingSettings(false);
      }
    },
    [userEmail]
  );

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  const runCleanup = useCallback(
    async (options?: { retentionDays?: number; maxRows?: number }) => {
      setError(null);

      try {
        const result = await logApi.runCleanup(options);
        console.log('[SystemLogs] Cleanup completed:', result);

        // Refresh logs and stats after cleanup
        await refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to run cleanup';
        console.error('[SystemLogs] Error running cleanup:', e);
        setError(msg);
      }
    },
    [refresh]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    logs,
    total,
    hasMore,
    queryLimit,
    stats,
    modules,
    settings,
    cleanupStatus,

    // State
    isLoading,
    isLoadingMore,
    isLoadingStats,
    isExporting,
    isSavingSettings,
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
    traceLogs,

    // Settings
    updateSettings,

    // Cleanup
    runCleanup,
    refreshCleanupStatus,
  };
}

export default useSystemLogs;
