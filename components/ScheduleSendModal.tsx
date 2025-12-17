/**
 * ScheduleSendModal Component
 *
 * Modal for scheduling newsletter sends with:
 * - Date/time picker with minimum time validation
 * - Subscriber list multi-select
 * - Preview of scheduled send details
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, ClockIcon, CalendarIcon } from './IconComponents';
import { modalOverlay, modalContent } from '../utils/animations';
import type { SubscriberList } from '../types';

interface ScheduleSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsletterId: string;
  newsletterSubject: string;
  subscriberLists: SubscriberList[];
  onSchedule: (scheduledAt: string, recipientLists: string[]) => Promise<void>;
}

// Get minimum date/time (5 minutes from now)
const getMinDateTime = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  return now.toISOString().slice(0, 16);
};

// Get user's timezone abbreviation
const getTimezoneAbbr = (): string => {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' });
  const parts = formatter.formatToParts(new Date());
  const timeZonePart = parts.find(part => part.type === 'timeZoneName');
  return timeZonePart?.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const ScheduleSendModal: React.FC<ScheduleSendModalProps> = ({
  isOpen,
  onClose,
  newsletterId,
  newsletterSubject,
  subscriberLists,
  onSchedule,
}) => {
  // Initialize with a time 30 minutes from now
  const getDefaultDateTime = (): string => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toISOString().slice(0, 16);
  };

  const [scheduledDateTime, setScheduledDateTime] = useState(getDefaultDateTime());
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone = useMemo(() => getTimezoneAbbr(), []);
  const minDateTime = useMemo(() => getMinDateTime(), []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setScheduledDateTime(getDefaultDateTime());
      setSelectedLists([]);
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key and body overflow
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Toggle list selection
  const toggleList = (listId: string) => {
    setSelectedLists(prev =>
      prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  // Select/deselect all lists
  const toggleAllLists = () => {
    if (selectedLists.length === subscriberLists.length) {
      setSelectedLists([]);
    } else {
      setSelectedLists(subscriberLists.map(l => l.id));
    }
  };

  // Calculate total recipients
  const totalRecipients = useMemo(() => {
    return subscriberLists
      .filter(list => selectedLists.includes(list.id))
      .reduce((sum, list) => sum + list.subscriberCount, 0);
  }, [selectedLists, subscriberLists]);

  // Handle schedule
  const handleSchedule = async () => {
    if (selectedLists.length === 0) {
      setError('Please select at least one subscriber list');
      return;
    }

    const scheduledDate = new Date(scheduledDateTime);
    const now = new Date();
    const minTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

    if (scheduledDate < minTime) {
      setError('Scheduled time must be at least 5 minutes in the future');
      return;
    }

    setIsScheduling(true);
    setError(null);

    try {
      // Convert to ISO string for API
      await onSchedule(scheduledDate.toISOString(), selectedLists);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule send');
    } finally {
      setIsScheduling(false);
    }
  };

  // Format display date
  const formatDisplayDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={modalOverlay}
          onClick={onClose}
        >
          <motion.div
            className="bg-paper w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-editorial mx-4"
            variants={modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-paper border-b border-border-subtle px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClockIcon className="w-5 h-5 text-editorial-navy" />
                <h2 className="font-serif text-headline text-ink">Schedule Send</h2>
              </div>
              <button
                onClick={onClose}
                className="text-slate hover:text-ink transition-colors p-1"
                aria-label="Close"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Newsletter Subject Preview */}
              <div className="bg-pearl p-4 border border-border-subtle">
                <p className="font-sans text-caption text-slate uppercase tracking-wide mb-1">
                  Newsletter
                </p>
                <p className="font-serif text-body text-ink">{newsletterSubject}</p>
                <p className="font-mono text-caption text-silver mt-1">{newsletterId}</p>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-editorial-red/10 border border-editorial-red text-editorial-red px-4 py-2 font-sans text-ui">
                  {error}
                </div>
              )}

              {/* Date/Time Picker */}
              <div>
                <label className="block font-sans text-overline text-slate uppercase tracking-wide mb-2">
                  <CalendarIcon className="w-4 h-4 inline mr-2" />
                  Schedule Date & Time ({timezone})
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  min={minDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-4 py-3 border border-border-subtle bg-pearl font-sans text-body text-ink focus:outline-none focus:border-editorial-navy transition-colors"
                />
                <p className="font-sans text-caption text-silver mt-1">
                  {formatDisplayDate(scheduledDateTime)} {timezone}
                </p>
              </div>

              {/* Subscriber Lists */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-sans text-overline text-slate uppercase tracking-wide">
                    Recipient Lists
                  </label>
                  <button
                    onClick={toggleAllLists}
                    className="font-sans text-caption text-editorial-navy hover:underline"
                  >
                    {selectedLists.length === subscriberLists.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {subscriberLists.length === 0 ? (
                  <div className="text-center py-6 bg-pearl border border-border-subtle">
                    <p className="font-sans text-ui text-slate">No subscriber lists found.</p>
                    <p className="font-sans text-caption text-silver mt-1">
                      Create lists in Subscriber Management first.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border-subtle divide-y divide-border-subtle max-h-[200px] overflow-y-auto">
                    {subscriberLists.map((list) => (
                      <label
                        key={list.id}
                        className={`
                          flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                          ${selectedLists.includes(list.id) ? 'bg-editorial-navy/5' : 'hover:bg-pearl'}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLists.includes(list.id)}
                          onChange={() => toggleList(list.id)}
                          className="w-4 h-4 text-editorial-navy border-border-subtle rounded focus:ring-editorial-navy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-ui text-ink truncate">{list.name}</p>
                          {list.description && (
                            <p className="font-sans text-caption text-silver truncate">{list.description}</p>
                          )}
                        </div>
                        <span className="font-mono text-caption text-slate">
                          {list.subscriberCount} {list.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              {selectedLists.length > 0 && (
                <div className="bg-editorial-gold/10 border border-editorial-gold/30 p-4">
                  <p className="font-sans text-ui text-ink">
                    <strong>Summary:</strong> Newsletter will be sent to{' '}
                    <strong>{totalRecipients}</strong> recipient{totalRecipients !== 1 ? 's' : ''} across{' '}
                    <strong>{selectedLists.length}</strong> list{selectedLists.length !== 1 ? 's' : ''} on{' '}
                    <strong>{formatDisplayDate(scheduledDateTime)}</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-paper border-t border-border-subtle px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 font-sans text-ui text-charcoal hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={isScheduling || selectedLists.length === 0}
                className={`
                  px-6 py-2 font-sans text-ui transition-colors
                  ${selectedLists.length === 0 || isScheduling
                    ? 'bg-silver text-paper cursor-not-allowed'
                    : 'bg-editorial-navy text-paper hover:bg-editorial-navy/90'
                  }
                `}
              >
                {isScheduling ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Scheduling...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    Schedule Send
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
