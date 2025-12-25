/**
 * CalendarEntryPickerModal
 *
 * Phase 16: Newsletter-Calendar Entry Linking
 *
 * Modal for selecting a calendar entry to link a newsletter to.
 * Used from GenerateNewsletterPage to explicitly save a newsletter to a calendar entry.
 * Follows NewsletterPickerModal.tsx pattern for consistency.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, SearchIcon, CalendarIcon } from './IconComponents';
import * as calendarApi from '../services/calendarClientService';
import type { CalendarEntry } from '../services/calendarClientService';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';

interface CalendarEntryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entryId: string, entryTitle: string) => void;
  currentEntryId?: string | null;
}

export const CalendarEntryPickerModal: React.FC<CalendarEntryPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentEntryId,
}) => {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [showLinkedConfirm, setShowLinkedConfirm] = useState<CalendarEntry | null>(null);

  // Load calendar entries when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadEntries = async () => {
      setLoading(true);
      setError(null);
      setEntries([]);
      setSearchQuery('');
      setShowLinkedConfirm(null);
      console.log('[CalendarEntryPickerModal] Loading entries...');

      try {
        // Get entries for the next 60 days (reasonable range for planning)
        const response = await calendarApi.getUpcomingEntries(60);
        const items = response.entries || [];
        console.log(`[CalendarEntryPickerModal] Loaded ${items.length} entries`);

        // Filter out items without valid IDs to prevent React key errors
        const validItems = items.filter((e) => {
          if (!e.id || e.id.trim() === '') {
            console.warn('[CalendarEntryPickerModal] Skipping entry with empty ID:', e.title);
            return false;
          }
          return true;
        });

        console.log(`[CalendarEntryPickerModal] ${validItems.length} entries with valid IDs`);

        // Sort by scheduled date ascending (nearest first)
        setEntries(
          validItems.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load calendar entries';
        console.error('[CalendarEntryPickerModal] Error:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
  }, [isOpen]);

  // Filter entries by search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

  // Handle entry selection
  const handleSelectEntry = (entry: CalendarEntry) => {
    if (selectingId) return; // Prevent double-click

    // If entry already has a newsletter linked, show confirmation
    if (entry.newsletterId && entry.newsletterId !== currentEntryId) {
      setShowLinkedConfirm(entry);
      return;
    }

    performSelection(entry);
  };

  // Perform the actual selection
  const performSelection = (entry: CalendarEntry) => {
    setSelectingId(entry.id);
    console.log(`[CalendarEntryPickerModal] Selected entry: ${entry.id}`);

    try {
      onSelect(entry.id, entry.title);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select entry';
      console.error('[CalendarEntryPickerModal] Selection error:', err);
      setError(errorMessage);
    } finally {
      setSelectingId(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown date';
    }
  };

  // Get status badge styles
  const getStatusBadge = (status: string): { bg: string; text: string } => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
      case 'in_progress':
        return { bg: 'bg-amber-100', text: 'text-amber-700' };
      case 'cancelled':
        return { bg: 'bg-red-100', text: 'text-red-700' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700' };
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50"
        variants={modalOverlay}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={onClose}
      >
        <motion.div
          className="bg-paper w-full max-w-lg mx-4 shadow-editorial max-h-[80vh] flex flex-col"
          variants={modalContent}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle flex-shrink-0">
            <h2 className="font-serif text-subheadline text-ink">Save to Calendar Entry</h2>
            <button
              onClick={onClose}
              className="p-1 text-slate hover:text-ink transition-colors"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-3 border-b border-border-subtle flex-shrink-0">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search calendar entries..."
                className="w-full pl-10 pr-4 py-2 border border-border-subtle bg-pearl font-sans text-ui focus:outline-none focus:border-editorial-navy"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-editorial-navy border-t-transparent" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && filteredEntries.length === 0 && (
              <div className="text-center py-8 text-slate">
                {entries.length === 0 ? (
                  <div className="space-y-2">
                    <CalendarIcon className="h-8 w-8 mx-auto text-slate/50" />
                    <p>No upcoming calendar entries.</p>
                    <p className="text-sm">Create one in the Content Calendar first.</p>
                  </div>
                ) : (
                  <p>No entries match your search.</p>
                )}
              </div>
            )}

            {!loading && !error && filteredEntries.length > 0 && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {filteredEntries.map((entry, index) => {
                  const isCurrentlyLinked = currentEntryId === entry.id;
                  const hasExistingLink = !!entry.newsletterId && !isCurrentlyLinked;
                  const isSelecting = selectingId === entry.id;
                  const statusBadge = getStatusBadge(entry.status);

                  return (
                    <motion.button
                      key={entry.id || `fallback-${index}`}
                      variants={staggerItem}
                      onClick={() => handleSelectEntry(entry)}
                      disabled={isSelecting}
                      className={`w-full text-left p-4 border transition-colors ${
                        isCurrentlyLinked
                          ? 'bg-emerald-50 border-emerald-200'
                          : hasExistingLink
                          ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                          : 'bg-pearl border-border-subtle hover:border-editorial-navy'
                      } ${isSelecting ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-ui text-ink font-medium truncate">
                            {entry.title}
                          </p>
                          <p className="font-sans text-caption text-slate mt-1">
                            {formatDate(entry.scheduledDate)}
                          </p>
                          {entry.description && (
                            <p className="font-sans text-caption text-slate/70 mt-1 line-clamp-1">
                              {entry.description}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadge.bg} ${statusBadge.text}`}>
                            {entry.status.replace('_', ' ')}
                          </span>
                          {isCurrentlyLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Linked
                            </span>
                          ) : hasExistingLink ? (
                            <span className="text-amber-600 text-xs font-medium">
                              Has newsletter
                            </span>
                          ) : (
                            <span className="text-editorial-navy text-sm font-medium">
                              Select
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border-subtle flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 font-sans text-ui text-charcoal hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>

        {/* Confirmation Dialog for Overwriting Existing Link */}
        <AnimatePresence>
          {showLinkedConfirm && (
            <motion.div
              className="fixed inset-0 bg-ink/30 flex items-center justify-center z-60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLinkedConfirm(null)}
            >
              <motion.div
                className="bg-paper p-6 shadow-editorial max-w-sm mx-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-serif text-subheadline text-ink mb-2">Replace Existing Link?</h3>
                <p className="text-sm text-slate mb-4">
                  "{showLinkedConfirm.title}" already has a newsletter linked.
                  This will replace the existing link with the current newsletter.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowLinkedConfirm(null)}
                    className="px-4 py-2 font-sans text-ui text-charcoal hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      performSelection(showLinkedConfirm);
                      setShowLinkedConfirm(null);
                    }}
                    className="px-4 py-2 font-sans text-ui text-white bg-editorial-navy hover:bg-editorial-navy/90 transition-colors"
                  >
                    Replace Link
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default CalendarEntryPickerModal;
