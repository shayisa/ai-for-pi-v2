/**
 * LogsPage Component
 *
 * Displays unified system logs from newsletter_logs and api_key_audit_log tables.
 * Features:
 * - Unified chronological timeline
 * - Filtering by source, action, date range, search
 * - Expandable log details
 * - CSV export
 * - Pagination with "Load More"
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UnifiedLogEntry, LogSource } from '../types';
import { useLogs } from '../hooks/useLogs';
import { getActionLabel, getSourceLabel, getActionTypes } from '../services/logClientService';
import {
  RefreshIcon,
  SaveIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
} from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem, expand } from '../utils/animations';

// Format timestamp for display
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Log row component with expandable details
const LogRow: React.FC<{ log: UnifiedLogEntry; isExpanded: boolean; onToggle: () => void }> = ({
  log,
  isExpanded,
  onToggle,
}) => {
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <>
      <motion.tr
        variants={staggerItem}
        className="hover:bg-pearl transition-colors cursor-pointer"
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Timestamp */}
        <td className="px-6 py-4 font-mono text-caption text-slate whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </td>

        {/* Type Badge */}
        <td className="px-6 py-4">
          <span
            className={`inline-block px-2 py-1 font-sans text-caption ${
              log.source === 'newsletter'
                ? 'bg-editorial-navy/10 text-editorial-navy'
                : 'bg-slate/10 text-slate'
            }`}
          >
            {getSourceLabel(log.source)}
          </span>
        </td>

        {/* Action */}
        <td className="px-6 py-4 font-sans text-ui text-ink">{getActionLabel(log.action)}</td>

        {/* Related Entity */}
        <td className="px-6 py-4 font-sans text-ui text-charcoal max-w-[200px] truncate">
          {log.source === 'newsletter' ? (
            <span title={log.newsletterSubject || log.newsletterId || '—'}>
              {log.newsletterSubject || log.newsletterId || '—'}
            </span>
          ) : (
            <span title={`${log.service || '—'} ${log.userEmail ? `(${log.userEmail})` : ''}`}>
              {log.service || '—'}
              {log.userEmail && (
                <span className="text-slate text-caption ml-1">({log.userEmail})</span>
              )}
            </span>
          )}
        </td>

        {/* Details Toggle */}
        <td className="px-6 py-4 text-center">
          {hasDetails ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="inline-flex items-center gap-1 font-sans text-caption text-editorial-navy hover:underline"
            >
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
              {isExpanded ? 'Hide' : 'Details'}
            </button>
          ) : (
            <span className="text-silver text-caption">—</span>
          )}
        </td>
      </motion.tr>

      {/* Expanded Details Row */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.tr variants={expand} initial="hidden" animate="visible" exit="exit">
            <td colSpan={5} className="px-6 py-4 bg-pearl border-t border-border-subtle">
              <div className="font-mono text-caption text-charcoal whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
};

export const LogsPage: React.FC = () => {
  const {
    logs,
    total,
    hasMore,
    stats,
    isLoading,
    isLoadingMore,
    isExporting,
    error,
    filters,
    setFilters,
    setSearch,
    clearFilters,
    loadMore,
    refresh,
    exportCsv,
  } = useLogs();

  // Local UI state
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const actionTypes = getActionTypes();

  // Filter action types by selected source
  const filteredActionTypes = filters.source
    ? actionTypes.filter((a) => a.source === filters.source)
    : actionTypes;

  const handleToggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const hasActiveFilters =
    filters.source || filters.action || filters.startDate || filters.endDate || filters.search;

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-10">
      {/* Page Header */}
      <header className="border-b-2 border-ink pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-h1 text-ink">System Logs</h1>
            <p className="font-serif text-body text-slate mt-2">
              View all system activity including newsletter events and API key changes
            </p>
            {stats && (
              <p className="font-sans text-caption text-silver mt-2">
                {stats.totalNewsletter} newsletter logs, {stats.totalApiAudit} API audit logs
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
            >
              <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              disabled={isExporting || logs.length === 0}
              className="flex items-center gap-2 bg-ink text-paper font-sans text-ui px-4 py-2 hover:bg-charcoal transition-colors disabled:bg-silver"
            >
              <SaveIcon className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </header>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border-l-2 border-editorial-red p-4 flex items-start justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="font-sans text-ui font-medium text-editorial-red">Error:</span>
              <span className="font-sans text-ui text-charcoal">{error}</span>
            </div>
            <button onClick={refresh} className="text-editorial-red hover:text-red-800">
              <RefreshIcon className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Toggle Button */}
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
            <span className="ml-1 px-2 py-0.5 bg-editorial-red text-paper text-caption">
              Active
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 font-sans text-caption text-editorial-red hover:underline"
          >
            <XIcon className="h-3 w-3" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-paper border border-border-subtle p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Source Filter */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Source
                  </label>
                  <select
                    value={filters.source || ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        source: (e.target.value as LogSource) || undefined,
                        action: undefined, // Clear action when source changes
                      })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="">All Sources</option>
                    <option value="newsletter">Newsletter Actions</option>
                    <option value="api_audit">API Audit</option>
                  </select>
                </div>

                {/* Action Filter */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Action
                  </label>
                  <select
                    value={filters.action || ''}
                    onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="">All Actions</option>
                    {filteredActionTypes.map((action) => (
                      <option key={action.value} value={action.value}>
                        {action.label}
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
                    value={filters.startDate || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, startDate: e.target.value || undefined })
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
                    value={filters.endDate || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, endDate: e.target.value || undefined })
                    }
                    className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
                  />
                </div>

                {/* Search */}
                <div>
                  <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver" />
                    <input
                      type="text"
                      placeholder="Subject or service..."
                      value={filters.search || ''}
                      onChange={(e) => setSearch(e.target.value)}
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
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin" />
        </div>
      )}

      {/* Logs Table */}
      {!isLoading && (
        <>
          <div className="bg-paper border border-border-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle bg-pearl">
                    <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-4 text-left font-sans text-caption text-slate uppercase tracking-wider">
                      Related Entity
                    </th>
                    <th className="px-6 py-4 text-center font-sans text-caption text-slate uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border-subtle"
                >
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center font-serif text-body text-slate">
                        {hasActiveFilters
                          ? 'No logs match your filters. Try adjusting your criteria.'
                          : 'No logs recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <LogRow
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

          {/* Pagination Info & Load More */}
          <div className="flex items-center justify-between">
            <p className="font-sans text-caption text-slate">
              Showing {logs.length} of {total} log{total !== 1 ? 's' : ''}
            </p>

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? (
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
