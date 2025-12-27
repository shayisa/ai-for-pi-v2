/**
 * SentHistoryPage
 *
 * Page to view sent newsletter history with stats and previews.
 *
 * Phase 18: Enhanced Send Email with Recipient Selection & Sent History
 *
 * Features:
 * - Table with date, subject, recipients, topics, open/click rates
 * - Expandable rows for full newsletter preview
 * - Date range and list filters
 * - Pagination
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '../utils/animations';
import {
  SendIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarIcon,
  UsersIcon,
  ChartIcon,
  RefreshIcon,
} from '../components/IconComponents';
import * as sentHistoryApi from '../services/sentHistoryClientService';
import * as subscriberApi from '../services/subscriberClientService';
import type { SentHistoryItem, SentHistoryStats } from '../services/sentHistoryClientService';
import type { SubscriberList } from '../types';

const PAGE_SIZE = 20;

export const SentHistoryPage: React.FC = () => {
  // Data state
  const [items, setItems] = useState<SentHistoryItem[]>([]);
  const [stats, setStats] = useState<SentHistoryStats | null>(null);
  const [lists, setLists] = useState<SubscriberList[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Expansion state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch subscriber lists for filter dropdown
  const fetchLists = useCallback(async () => {
    try {
      const response = await subscriberApi.getLists();
      setLists(response.lists);
    } catch (e) {
      console.error('Failed to fetch lists:', e);
    }
  }, []);

  // Fetch sent history
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sentHistoryApi.getSentHistory({
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        listId: selectedListId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      setItems(response.items);
      setTotal(response.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sent history');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedListId, dateFrom, dateTo]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await sentHistoryApi.getSentHistoryStats();
      setStats(response);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLists();
    fetchStats();
  }, [fetchLists, fetchStats]);

  // Fetch history when filters change
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedListId, dateFrom, dateTo]);

  // Toggle row expansion
  const toggleExpand = async (id: string, newsletterId: string) => {
    const newExpanded = new Set(expandedIds);

    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      // Fetch detail if not already loaded
      const item = items.find((i) => i.id === id);
      if (item && !item.newsletterContent) {
        try {
          const detail = await sentHistoryApi.getSentHistoryDetail(newsletterId);
          setItems((prev) =>
            prev.map((i) =>
              i.id === id ? { ...i, newsletterContent: detail.newsletterContent } : i
            )
          );
        } catch (e) {
          console.error('Failed to fetch newsletter content:', e);
        }
      }
      newExpanded.add(id);
    }

    setExpandedIds(newExpanded);
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedListId('');
    setDateFrom('');
    setDateTo('');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = selectedListId || dateFrom || dateTo;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Page Header */}
      <header className="border-b-2 border-ink pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-h1 text-ink flex items-center gap-3">
              <SendIcon className="w-8 h-8" />
              Sent History
            </h1>
            <p className="font-serif text-body text-slate mt-2">
              Track your newsletter email deliveries and engagement
            </p>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {
              fetchHistory();
              fetchStats();
            }}
            className="flex items-center gap-2 text-slate hover:text-ink transition-colors font-sans text-ui"
          >
            <RefreshIcon className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-paper border border-border-subtle p-4">
            <div className="flex items-center gap-2 text-slate mb-1">
              <SendIcon className="w-4 h-4" />
              <span className="font-sans text-caption uppercase tracking-wide">Newsletters Sent</span>
            </div>
            <p className="font-display text-h2 text-ink">{stats.totalSent}</p>
          </div>
          <div className="bg-paper border border-border-subtle p-4">
            <div className="flex items-center gap-2 text-slate mb-1">
              <UsersIcon className="w-4 h-4" />
              <span className="font-sans text-caption uppercase tracking-wide">Total Emails</span>
            </div>
            <p className="font-display text-h2 text-ink">{stats.totalEmails.toLocaleString()}</p>
          </div>
          <div className="bg-paper border border-border-subtle p-4">
            <div className="flex items-center gap-2 text-slate mb-1">
              <ChartIcon className="w-4 h-4" />
              <span className="font-sans text-caption uppercase tracking-wide">Avg Open Rate</span>
            </div>
            <p className="font-display text-h2 text-ink">{stats.averageOpenRate}%</p>
          </div>
          <div className="bg-paper border border-border-subtle p-4">
            <div className="flex items-center gap-2 text-slate mb-1">
              <ChartIcon className="w-4 h-4" />
              <span className="font-sans text-caption uppercase tracking-wide">Avg Click Rate</span>
            </div>
            <p className="font-display text-h2 text-ink">{stats.averageClickRate}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-pearl border border-border-subtle p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* List filter */}
          <div className="flex items-center gap-2">
            <label className="font-sans text-caption text-slate uppercase tracking-wide">
              List:
            </label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="px-3 py-1.5 border border-border-subtle bg-paper font-sans text-ui text-ink focus:outline-none focus:border-editorial-navy"
            >
              <option value="">All Lists</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date from filter */}
          <div className="flex items-center gap-2">
            <label className="font-sans text-caption text-slate uppercase tracking-wide">
              From:
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-border-subtle bg-paper font-sans text-ui text-ink focus:outline-none focus:border-editorial-navy"
            />
          </div>

          {/* Date to filter */}
          <div className="flex items-center gap-2">
            <label className="font-sans text-caption text-slate uppercase tracking-wide">
              To:
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-border-subtle bg-paper font-sans text-ui text-ink focus:outline-none focus:border-editorial-navy"
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="font-sans text-caption text-editorial-navy hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-editorial-red/10 border border-editorial-red text-editorial-red px-4 py-3 font-sans text-ui">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-8 w-8 mx-auto text-editorial-navy" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="font-sans text-ui text-slate mt-3">Loading sent history...</p>
        </div>
      ) : items.length === 0 ? (
        // Empty state
        <div className="text-center py-12 bg-pearl border border-border-subtle">
          <SendIcon className="w-12 h-12 mx-auto text-silver mb-4" />
          <h3 className="font-serif text-headline text-ink mb-2">No sent history yet</h3>
          <p className="font-sans text-ui text-slate">
            {hasFilters
              ? 'No newsletters match the selected filters.'
              : 'Newsletters you send via email will appear here.'}
          </p>
        </div>
      ) : (
        // Data table
        <div className="border border-border-subtle bg-paper">
          <table className="w-full">
            <thead className="bg-pearl border-b border-border-subtle">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wide">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wide">
                  Subject
                </th>
                <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wide">
                  Recipients
                </th>
                <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wide">
                  Topics
                </th>
                <th className="px-4 py-3 text-right font-sans text-caption text-slate uppercase tracking-wide">
                  Opens
                </th>
                <th className="px-4 py-3 text-right font-sans text-caption text-slate uppercase tracking-wide">
                  Clicks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((item) => {
                const isExpanded = expandedIds.has(item.id);
                return (
                  <React.Fragment key={item.id}>
                    {/* Main row */}
                    <tr
                      className="hover:bg-pearl/50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(item.id, item.newsletterId)}
                    >
                      <td className="px-4 py-3 text-slate">
                        {isExpanded ? (
                          <ChevronDownIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-caption text-charcoal whitespace-nowrap">
                        {formatDate(item.sentAt)}
                      </td>
                      <td className="px-4 py-3 font-serif text-body text-ink max-w-xs truncate">
                        {item.subject}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.listNames.slice(0, 2).map((name, i) => (
                            <span
                              key={i}
                              className="inline-block px-2 py-0.5 bg-editorial-navy/10 text-editorial-navy font-sans text-caption"
                            >
                              {name}
                            </span>
                          ))}
                          {item.listNames.length > 2 && (
                            <span className="font-sans text-caption text-slate">
                              +{item.listNames.length - 2} more
                            </span>
                          )}
                          <span className="font-mono text-caption text-silver ml-1">
                            ({item.recipientCount})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {item.topics.slice(0, 2).map((topic, i) => (
                            <span
                              key={i}
                              className="inline-block px-2 py-0.5 bg-pearl border border-border-subtle font-sans text-caption text-charcoal truncate max-w-[100px]"
                            >
                              {topic}
                            </span>
                          ))}
                          {item.topics.length > 2 && (
                            <span className="font-sans text-caption text-slate">
                              +{item.topics.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ui">
                        {item.stats ? (
                          <span className={item.stats.openRate > 30 ? 'text-editorial-green' : 'text-charcoal'}>
                            {item.stats.openRate}%
                          </span>
                        ) : (
                          <span className="text-silver">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ui">
                        {item.stats ? (
                          <span className={item.stats.clickRate > 10 ? 'text-editorial-green' : 'text-charcoal'}>
                            {item.stats.clickRate}%
                          </span>
                        ) : (
                          <span className="text-silver">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-pearl/30">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-6 space-y-4">
                                {/* Recipient details */}
                                <div>
                                  <h4 className="font-sans text-overline text-slate uppercase tracking-wide mb-2">
                                    Recipient Lists
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {item.listNames.map((name, i) => (
                                      <span
                                        key={i}
                                        className="inline-block px-3 py-1 bg-editorial-navy/10 text-editorial-navy font-sans text-ui"
                                      >
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="font-sans text-caption text-slate mt-2">
                                    Sent to {item.recipientCount} recipient{item.recipientCount !== 1 ? 's' : ''}
                                  </p>
                                </div>

                                {/* Stats detail */}
                                {item.stats && (
                                  <div>
                                    <h4 className="font-sans text-overline text-slate uppercase tracking-wide mb-2">
                                      Engagement Stats
                                    </h4>
                                    <div className="grid grid-cols-4 gap-4">
                                      <div>
                                        <p className="font-sans text-caption text-slate">Total Sent</p>
                                        <p className="font-mono text-body text-ink">{item.stats.totalSent}</p>
                                      </div>
                                      <div>
                                        <p className="font-sans text-caption text-slate">Unique Opens</p>
                                        <p className="font-mono text-body text-ink">{item.stats.uniqueOpens}</p>
                                      </div>
                                      <div>
                                        <p className="font-sans text-caption text-slate">Open Rate</p>
                                        <p className="font-mono text-body text-ink">{item.stats.openRate}%</p>
                                      </div>
                                      <div>
                                        <p className="font-sans text-caption text-slate">Click Rate</p>
                                        <p className="font-mono text-body text-ink">{item.stats.clickRate}%</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Topics */}
                                <div>
                                  <h4 className="font-sans text-overline text-slate uppercase tracking-wide mb-2">
                                    Topics
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {item.topics.map((topic, i) => (
                                      <span
                                        key={i}
                                        className="inline-block px-3 py-1 bg-pearl border border-border-subtle font-sans text-ui text-charcoal"
                                      >
                                        {topic}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Newsletter Preview */}
                                {item.newsletterContent && (
                                  <div>
                                    <h4 className="font-sans text-overline text-slate uppercase tracking-wide mb-2">
                                      Newsletter Preview
                                    </h4>
                                    <div className="bg-paper border border-border-subtle p-4 max-h-[300px] overflow-y-auto">
                                      <h5 className="font-serif text-headline text-ink mb-2">
                                        {item.newsletterContent.subject as string}
                                      </h5>
                                      {item.newsletterContent.introduction && (
                                        <p className="font-serif text-body text-charcoal mb-4">
                                          {item.newsletterContent.introduction as string}
                                        </p>
                                      )}
                                      {item.newsletterContent.sections && Array.isArray(item.newsletterContent.sections) && (
                                        <div className="space-y-3">
                                          {(item.newsletterContent.sections as Array<{ title?: string; content?: string }>).slice(0, 3).map((section, i) => (
                                            <div key={i}>
                                              <h6 className="font-sans text-ui text-ink font-semibold">
                                                {section.title}
                                              </h6>
                                              <p className="font-serif text-body text-charcoal line-clamp-2">
                                                {section.content}
                                              </p>
                                            </div>
                                          ))}
                                          {(item.newsletterContent.sections as Array<unknown>).length > 3 && (
                                            <p className="font-sans text-caption text-slate italic">
                                              +{(item.newsletterContent.sections as Array<unknown>).length - 3} more sections...
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-pearl">
              <p className="font-sans text-caption text-slate">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 font-sans text-ui transition-colors ${
                    currentPage === 1
                      ? 'text-silver cursor-not-allowed'
                      : 'text-editorial-navy hover:underline'
                  }`}
                >
                  Previous
                </button>
                <span className="font-mono text-caption text-charcoal">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 font-sans text-ui transition-colors ${
                    currentPage === totalPages
                      ? 'text-silver cursor-not-allowed'
                      : 'text-editorial-navy hover:underline'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
