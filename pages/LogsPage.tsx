/**
 * LogsPage Component
 *
 * Comprehensive system logs viewer with:
 * - Full Control Plane logs (all modules, actions, levels)
 * - Request tracing by correlation ID
 * - Filtering by level, module, action, date range, search
 * - User-configurable settings (retention, query limits)
 * - Statistics and storage info
 * - CSV export
 * - Legacy unified logs tab (backward compatibility)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemLogs } from '../hooks/useSystemLogs';
import { useLogs } from '../hooks/useLogs';
import { useAuth } from '../contexts';
import {
  getLevelDisplay,
  getActionLabel,
  formatDuration,
  formatTimestamp,
  formatStorageSize,
  getSourceLabel,
} from '../services/logClientService';
import type { SystemLogEntry, SystemLogLevel, UnifiedLogEntry } from '../services/logClientService';
import {
  RefreshIcon,
  SaveIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
  SettingsIcon,
} from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem, expand } from '../utils/animations';

// =============================================================================
// SYSTEM LOG ROW COMPONENT
// =============================================================================

const SystemLogRow: React.FC<{
  log: SystemLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onTraceClick: (correlationId: string) => void;
}> = ({ log, isExpanded, onToggle, onTraceClick }) => {
  const hasDetails =
    log.metadata ||
    log.errorName ||
    log.durationMs !== null;
  const levelDisplay = getLevelDisplay(log.level);

  return (
    <>
      <motion.tr
        variants={staggerItem}
        className="hover:bg-pearl transition-colors cursor-pointer"
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Timestamp */}
        <td className="px-4 py-3 font-mono text-caption text-slate whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>

        {/* Level Badge */}
        <td className="px-4 py-3">
          <span
            className={`inline-block px-2 py-0.5 font-sans text-caption font-medium ${levelDisplay.colorClass}`}
          >
            {levelDisplay.label}
          </span>
        </td>

        {/* Module */}
        <td className="px-4 py-3 font-sans text-ui text-ink">{log.module}</td>

        {/* Action */}
        <td className="px-4 py-3 font-sans text-ui text-charcoal">{getActionLabel(log.action)}</td>

        {/* Message */}
        <td className="px-4 py-3 font-sans text-ui text-charcoal max-w-[300px] truncate" title={log.message}>
          {log.message}
        </td>

        {/* Duration */}
        <td className="px-4 py-3 font-mono text-caption text-slate text-right">
          {formatDuration(log.durationMs)}
        </td>

        {/* Correlation ID */}
        <td className="px-4 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTraceClick(log.correlationId);
            }}
            className="font-mono text-caption text-editorial-navy hover:underline truncate max-w-[120px] block"
            title={`Trace: ${log.correlationId}`}
          >
            {log.correlationId.slice(0, 12)}...
          </button>
        </td>

        {/* Expand */}
        <td className="px-4 py-3 text-center">
          {hasDetails ? (
            <ChevronDownIcon
              className={`h-4 w-4 text-slate transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          ) : (
            <span className="text-silver">—</span>
          )}
        </td>
      </motion.tr>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.tr variants={expand} initial="hidden" animate="visible" exit="exit">
            <td colSpan={8} className="px-4 py-4 bg-pearl border-t border-border-subtle">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Metadata */}
                {log.metadata && (
                  <div>
                    <h4 className="font-sans text-caption text-slate uppercase tracking-wider mb-2">
                      Metadata
                    </h4>
                    <pre className="font-mono text-caption text-charcoal bg-paper p-3 overflow-x-auto border border-border-subtle">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error Info */}
                {log.errorName && (
                  <div>
                    <h4 className="font-sans text-caption text-slate uppercase tracking-wider mb-2">
                      Error
                    </h4>
                    <div className="bg-red-50 border border-red-200 p-3">
                      <p className="font-sans text-ui font-medium text-editorial-red">{log.errorName}</p>
                      <p className="font-sans text-caption text-charcoal mt-1">{log.errorMessage}</p>
                      {log.errorStack && (
                        <pre className="font-mono text-caption text-slate mt-2 overflow-x-auto">
                          {log.errorStack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {/* Full Correlation ID */}
                <div>
                  <h4 className="font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Correlation ID
                  </h4>
                  <code className="font-mono text-caption text-ink bg-paper px-2 py-1 border border-border-subtle">
                    {log.correlationId}
                  </code>
                </div>

                {/* User ID */}
                {log.userId && (
                  <div>
                    <h4 className="font-sans text-caption text-slate uppercase tracking-wider mb-2">
                      User
                    </h4>
                    <span className="font-sans text-ui text-ink">{log.userId}</span>
                  </div>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
};

// =============================================================================
// LEGACY LOG ROW COMPONENT (Backward Compatibility)
// =============================================================================

const LegacyLogRow: React.FC<{
  log: UnifiedLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ log, isExpanded, onToggle }) => {
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <>
      <motion.tr
        variants={staggerItem}
        className="hover:bg-pearl transition-colors cursor-pointer"
        onClick={hasDetails ? onToggle : undefined}
      >
        <td className="px-4 py-3 font-mono text-caption text-slate whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-block px-2 py-0.5 font-sans text-caption ${
              log.source === 'newsletter'
                ? 'bg-editorial-navy/10 text-editorial-navy'
                : 'bg-slate/10 text-slate'
            }`}
          >
            {getSourceLabel(log.source)}
          </span>
        </td>
        <td className="px-4 py-3 font-sans text-ui text-ink">{getActionLabel(log.action)}</td>
        <td className="px-4 py-3 font-sans text-ui text-charcoal max-w-[200px] truncate">
          {log.source === 'newsletter'
            ? log.newsletterSubject || log.newsletterId || '—'
            : log.service || '—'}
        </td>
        <td className="px-4 py-3 text-center">
          {hasDetails ? (
            <ChevronDownIcon
              className={`h-4 w-4 text-slate transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          ) : (
            <span className="text-silver">—</span>
          )}
        </td>
      </motion.tr>
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.tr variants={expand} initial="hidden" animate="visible" exit="exit">
            <td colSpan={5} className="px-4 py-4 bg-pearl border-t border-border-subtle">
              <pre className="font-mono text-caption text-charcoal overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
};

// =============================================================================
// SETTINGS PANEL
// =============================================================================

const SettingsPanel: React.FC<{
  settings: { retentionDays: number; queryLimit: number; minLevel: SystemLogLevel } | null;
  onUpdateSettings: (settings: Partial<{ retentionDays: number; queryLimit: number; minLevel: SystemLogLevel }>) => Promise<void>;
  isSaving: boolean;
  stats: {
    totalLogs: number;
    storageEstimateKb: number;
    oldestLog: string | null;
    newestLog: string | null;
  } | null;
  onRunCleanup: () => Promise<void>;
}> = ({ settings, onUpdateSettings, isSaving, stats, onRunCleanup }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    if (localSettings) {
      await onUpdateSettings(localSettings);
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      await onRunCleanup();
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (!localSettings) return null;

  return (
    <div className="bg-paper border border-border-subtle p-6 space-y-6">
      <h3 className="font-display text-h4 text-ink">Log Settings</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Retention Days */}
        <div>
          <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
            Retention Period (Days)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={localSettings.retentionDays}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, retentionDays: parseInt(e.target.value, 10) })
            }
            className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
          />
          <p className="font-sans text-caption text-silver mt-1">Logs older than this are deleted</p>
        </div>

        {/* Query Limit */}
        <div>
          <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
            Query Limit (Rows)
          </label>
          <select
            value={localSettings.queryLimit}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, queryLimit: parseInt(e.target.value, 10) })
            }
            className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
          >
            <option value={100000}>100,000</option>
            <option value={250000}>250,000</option>
            <option value={500000}>500,000 (Default)</option>
            <option value={750000}>750,000</option>
            <option value={1000000}>1,000,000</option>
          </select>
          <p className="font-sans text-caption text-silver mt-1">Max rows for queries</p>
        </div>

        {/* Min Level */}
        <div>
          <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
            Minimum Display Level
          </label>
          <select
            value={localSettings.minLevel}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, minLevel: e.target.value as SystemLogLevel })
            }
            className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
          >
            <option value="debug">Debug (All)</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error Only</option>
          </select>
          <p className="font-sans text-caption text-silver mt-1">Filter logs by severity</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-pearl p-4 border border-border-subtle">
          <h4 className="font-sans text-caption text-slate uppercase tracking-wider mb-3">
            Storage Statistics
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="font-sans text-h4 text-ink">{stats.totalLogs.toLocaleString()}</p>
              <p className="font-sans text-caption text-slate">Total Logs</p>
            </div>
            <div>
              <p className="font-sans text-h4 text-ink">{formatStorageSize(stats.storageEstimateKb)}</p>
              <p className="font-sans text-caption text-slate">Estimated Size</p>
            </div>
            <div>
              <p className="font-sans text-ui text-ink">
                {stats.oldestLog ? formatTimestamp(stats.oldestLog) : '—'}
              </p>
              <p className="font-sans text-caption text-slate">Oldest Log</p>
            </div>
            <div>
              <p className="font-sans text-ui text-ink">
                {stats.newestLog ? formatTimestamp(stats.newestLog) : '—'}
              </p>
              <p className="font-sans text-caption text-slate">Newest Log</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
        <button
          onClick={handleCleanup}
          disabled={isCleaningUp}
          className="flex items-center gap-2 border border-editorial-red text-editorial-red px-4 py-2 font-sans text-ui hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isCleaningUp ? 'Cleaning...' : 'Run Cleanup Now'}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-ink text-paper px-4 py-2 font-sans text-ui hover:bg-charcoal transition-colors disabled:bg-silver"
        >
          <SaveIcon className={`h-4 w-4 ${isSaving ? 'animate-pulse' : ''}`} />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

type TabType = 'system' | 'legacy';

export const LogsPage: React.FC = () => {
  const { authData } = useAuth();
  const userEmail = authData?.email;

  // System logs hook
  const systemLogs = useSystemLogs(userEmail);

  // Legacy logs hook (for backward compatibility)
  const legacyLogs = useLogs();

  // Local UI state
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [traceCorrelationId, setTraceCorrelationId] = useState<string | null>(null);
  const [tracedLogs, setTracedLogs] = useState<SystemLogEntry[]>([]);

  // Handle trace click
  const handleTraceClick = async (correlationId: string) => {
    setTraceCorrelationId(correlationId);
    const logs = await systemLogs.traceLogs(correlationId);
    setTracedLogs(logs);
  };

  // Clear trace
  const clearTrace = () => {
    setTraceCorrelationId(null);
    setTracedLogs([]);
  };

  const handleToggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Determine which data to use
  const isSystemTab = activeTab === 'system';
  const currentLogs = isSystemTab ? systemLogs : legacyLogs;

  const hasActiveFilters = isSystemTab
    ? systemLogs.filters.level ||
      systemLogs.filters.module ||
      systemLogs.filters.action ||
      systemLogs.filters.search ||
      systemLogs.filters.startDate ||
      systemLogs.filters.endDate
    : legacyLogs.filters.source ||
      legacyLogs.filters.action ||
      legacyLogs.filters.search ||
      legacyLogs.filters.startDate ||
      legacyLogs.filters.endDate;

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      {/* Page Header */}
      <header className="border-b-2 border-ink pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-h1 text-ink">System Logs</h1>
            <p className="font-serif text-body text-slate mt-2">
              View all system activity, trace requests, and manage log settings
            </p>
            {isSystemTab && systemLogs.stats && (
              <p className="font-sans text-caption text-silver mt-2">
                {systemLogs.stats.totalLogs.toLocaleString()} logs •{' '}
                {formatStorageSize(systemLogs.stats.storageEstimateKb)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 border px-4 py-2 font-sans text-ui transition-colors ${
                showSettings
                  ? 'border-ink text-ink bg-pearl'
                  : 'border-border-subtle text-slate hover:text-ink hover:border-ink'
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={currentLogs.refresh}
              disabled={currentLogs.isLoading}
              className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
            >
              <RefreshIcon className={`h-4 w-4 ${currentLogs.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={currentLogs.exportCsv}
              disabled={currentLogs.isExporting || currentLogs.logs.length === 0}
              className="flex items-center gap-2 bg-ink text-paper font-sans text-ui px-4 py-2 hover:bg-charcoal transition-colors disabled:bg-silver"
            >
              <SaveIcon className={`h-4 w-4 ${currentLogs.isExporting ? 'animate-pulse' : ''}`} />
              {currentLogs.isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && isSystemTab && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <SettingsPanel
              settings={systemLogs.settings}
              onUpdateSettings={systemLogs.updateSettings}
              isSaving={systemLogs.isSavingSettings}
              stats={systemLogs.stats}
              onRunCleanup={systemLogs.runCleanup}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-3 font-sans text-ui transition-colors border-b-2 -mb-px ${
            activeTab === 'system'
              ? 'border-ink text-ink'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          System Logs
          {systemLogs.stats && (
            <span className="ml-2 text-caption text-silver">
              ({systemLogs.stats.totalLogs.toLocaleString()})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('legacy')}
          className={`px-4 py-3 font-sans text-ui transition-colors border-b-2 -mb-px ${
            activeTab === 'legacy'
              ? 'border-ink text-ink'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          Legacy Logs
          {legacyLogs.stats && (
            <span className="ml-2 text-caption text-silver">
              ({legacyLogs.stats.totalNewsletter + legacyLogs.stats.totalApiAudit})
            </span>
          )}
        </button>
      </div>

      {/* Trace Banner */}
      {traceCorrelationId && (
        <div className="bg-editorial-navy/10 border border-editorial-navy p-4 flex items-center justify-between">
          <div>
            <span className="font-sans text-ui text-editorial-navy font-medium">Tracing Request: </span>
            <code className="font-mono text-caption text-ink">{traceCorrelationId}</code>
            <span className="font-sans text-caption text-slate ml-2">
              ({tracedLogs.length} related logs)
            </span>
          </div>
          <button
            onClick={clearTrace}
            className="flex items-center gap-1 font-sans text-caption text-editorial-navy hover:underline"
          >
            <XIcon className="h-3 w-3" />
            Clear Trace
          </button>
        </div>
      )}

      {/* Error Message */}
      <AnimatePresence>
        {currentLogs.error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border-l-2 border-editorial-red p-4 flex items-center justify-between"
          >
            <span className="font-sans text-ui text-charcoal">{currentLogs.error}</span>
            <button onClick={currentLogs.refresh} className="text-editorial-red hover:text-red-800">
              <RefreshIcon className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 font-sans text-ui transition-colors ${
            showFilters || hasActiveFilters ? 'text-ink' : 'text-slate hover:text-ink'
          }`}
        >
          <FilterIcon className="h-4 w-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && !showFilters && (
            <span className="ml-1 px-2 py-0.5 bg-editorial-red text-paper text-caption">Active</span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={currentLogs.clearFilters}
            className="flex items-center gap-1 font-sans text-caption text-editorial-red hover:underline"
          >
            <XIcon className="h-3 w-3" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Filter Panel - System Logs */}
      <AnimatePresence>
        {showFilters && isSystemTab && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-paper border border-border-subtle p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Level Filter */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Level
                  </label>
                  <select
                    value={systemLogs.filters.level || ''}
                    onChange={(e) =>
                      systemLogs.setFilters({
                        level: (e.target.value as SystemLogLevel) || undefined,
                      })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warn</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>

                {/* Module Filter */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Module
                  </label>
                  <select
                    value={systemLogs.filters.module || ''}
                    onChange={(e) =>
                      systemLogs.setFilters({ module: e.target.value || undefined })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="">All Modules</option>
                    {systemLogs.modules.map((m) => (
                      <option key={m.module} value={m.module}>
                        {m.module} ({m.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={systemLogs.filters.startDate || ''}
                    onChange={(e) =>
                      systemLogs.setFilters({ startDate: e.target.value || undefined })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={systemLogs.filters.endDate || ''}
                    onChange={(e) =>
                      systemLogs.setFilters({ endDate: e.target.value || undefined })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver" />
                    <input
                      type="text"
                      placeholder="Message, module, action, correlation ID..."
                      value={systemLogs.filters.search || ''}
                      onChange={(e) => systemLogs.setSearch(e.target.value)}
                      className="w-full bg-pearl border border-border-subtle pl-10 pr-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Panel - Legacy Logs */}
      <AnimatePresence>
        {showFilters && !isSystemTab && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-paper border border-border-subtle p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Source Filter */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Source
                  </label>
                  <select
                    value={legacyLogs.filters.source || ''}
                    onChange={(e) =>
                      legacyLogs.setFilters({
                        source: (e.target.value as 'newsletter' | 'api_audit') || undefined,
                        action: undefined,
                      })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="">All Sources</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="api_audit">API Audit</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={legacyLogs.filters.startDate || ''}
                    onChange={(e) =>
                      legacyLogs.setFilters({ ...legacyLogs.filters, startDate: e.target.value || undefined })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={legacyLogs.filters.endDate || ''}
                    onChange={(e) =>
                      legacyLogs.setFilters({ ...legacyLogs.filters, endDate: e.target.value || undefined })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* Search */}
                <div className="lg:col-span-2">
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver" />
                    <input
                      type="text"
                      placeholder="Subject or service..."
                      value={legacyLogs.filters.search || ''}
                      onChange={(e) => legacyLogs.setSearch(e.target.value)}
                      className="w-full bg-pearl border border-border-subtle pl-10 pr-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {currentLogs.isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin" />
        </div>
      )}

      {/* Logs Table - System Logs */}
      {!currentLogs.isLoading && isSystemTab && (
        <>
          <div className="bg-paper border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle bg-pearl">
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Module
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-4 py-3 text-right font-sans text-caption text-slate uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Trace
                    </th>
                    <th className="px-4 py-3 text-center font-sans text-caption text-slate uppercase tracking-wider w-12">

                    </th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border-subtle"
                >
                  {(traceCorrelationId ? tracedLogs : systemLogs.logs).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center font-serif text-body text-slate">
                        {hasActiveFilters || traceCorrelationId
                          ? 'No logs match your criteria.'
                          : 'No system logs recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    (traceCorrelationId ? tracedLogs : systemLogs.logs).map((log) => (
                      <SystemLogRow
                        key={log.id}
                        log={log}
                        isExpanded={expandedLogId === log.id}
                        onToggle={() => handleToggleExpand(log.id)}
                        onTraceClick={handleTraceClick}
                      />
                    ))
                  )}
                </motion.tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {!traceCorrelationId && (
            <div className="flex items-center justify-between">
              <p className="font-sans text-caption text-slate">
                Showing {systemLogs.logs.length} of {systemLogs.total.toLocaleString()} logs
                {systemLogs.total >= systemLogs.queryLimit && (
                  <span className="ml-1 text-silver">(query limited to {systemLogs.queryLimit.toLocaleString()})</span>
                )}
              </p>
              {systemLogs.hasMore && (
                <button
                  onClick={systemLogs.loadMore}
                  disabled={systemLogs.isLoadingMore}
                  className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
                >
                  {systemLogs.isLoadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-ink border-t-transparent animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Logs Table - Legacy Logs */}
      {!currentLogs.isLoading && !isSystemTab && (
        <>
          <div className="bg-paper border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle bg-pearl">
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Related Entity
                    </th>
                    <th className="px-4 py-3 text-center font-sans text-caption text-slate uppercase tracking-wider w-12">

                    </th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border-subtle"
                >
                  {legacyLogs.logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center font-serif text-body text-slate">
                        {hasActiveFilters ? 'No logs match your filters.' : 'No legacy logs recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    legacyLogs.logs.map((log) => (
                      <LegacyLogRow
                        key={`${log.source}-${log.id}`}
                        log={log}
                        isExpanded={expandedLogId === log.id}
                        onToggle={() => handleToggleExpand(log.id)}
                      />
                    ))
                  )}
                </motion.tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="font-sans text-caption text-slate">
              Showing {legacyLogs.logs.length} of {legacyLogs.total} logs
            </p>
            {legacyLogs.hasMore && (
              <button
                onClick={legacyLogs.loadMore}
                disabled={legacyLogs.isLoadingMore}
                className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
              >
                {legacyLogs.isLoadingMore ? (
                  <>
                    <div className="w-4 h-4 border-2 border-ink border-t-transparent animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default LogsPage;
