/**
 * SendEmailModal Component
 *
 * Modal for selecting recipient lists before sending newsletter via Gmail.
 * Features:
 * - Subscriber list multi-select with recipient counts
 * - Select All / Deselect All toggle
 * - Real-time total recipient preview
 * - Loading state during send
 *
 * Phase 18: Enhanced Send Email with Recipient Selection
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, SendIcon, UsersIcon } from './IconComponents';
import { modalOverlay, modalContent } from '../utils/animations';
import * as subscriberApi from '../services/subscriberClientService';
import type { SubscriberList } from '../types';

export interface SendEmailRecipients {
  listIds: string[];
  listNames: string[];
  emails: string[];
  totalCount: number;
}

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsletterSubject: string;
  onConfirm: (recipients: SendEmailRecipients) => Promise<void>;
}

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  newsletterSubject,
  onConfirm,
}) => {
  const [subscriberLists, setSubscriberLists] = useState<SubscriberList[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscriber lists when modal opens
  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await subscriberApi.getLists();
      setSubscriberLists(response.lists);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriber lists');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLists([]);
      setError(null);
      fetchLists();
    }
  }, [isOpen, fetchLists]);

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

  // Get selected list names
  const selectedListNames = useMemo(() => {
    return subscriberLists
      .filter(list => selectedLists.includes(list.id))
      .map(list => list.name);
  }, [selectedLists, subscriberLists]);

  // Handle send
  const handleSend = async () => {
    if (selectedLists.length === 0) {
      setError('Please select at least one subscriber list');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // Fetch all active subscribers from selected lists
      const allEmails: string[] = [];

      for (const listId of selectedLists) {
        const response = await subscriberApi.getSubscribersByList(listId);
        const activeEmails = response.subscribers
          .filter(sub => sub.status === 'active')
          .map(sub => sub.email);

        // Add unique emails only
        for (const email of activeEmails) {
          if (!allEmails.includes(email)) {
            allEmails.push(email);
          }
        }
      }

      if (allEmails.length === 0) {
        setError('No active subscribers found in selected lists');
        setIsSending(false);
        return;
      }

      await onConfirm({
        listIds: selectedLists,
        listNames: selectedListNames,
        emails: allEmails,
        totalCount: allEmails.length,
      });

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
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
                <SendIcon className="w-5 h-5 text-editorial-navy" />
                <h2 className="font-serif text-headline text-ink">Send Newsletter</h2>
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
                  Newsletter Subject
                </p>
                <p className="font-serif text-body text-ink">{newsletterSubject}</p>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-editorial-red/10 border border-editorial-red text-editorial-red px-4 py-2 font-sans text-ui">
                  {error}
                </div>
              )}

              {/* Loading State */}
              {isLoading ? (
                <div className="text-center py-8">
                  <svg className="animate-spin h-8 w-8 mx-auto text-editorial-navy" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="font-sans text-ui text-slate mt-3">Loading subscriber lists...</p>
                </div>
              ) : (
                <>
                  {/* Subscriber Lists */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-sans text-overline text-slate uppercase tracking-wide flex items-center gap-2">
                        <UsersIcon className="w-4 h-4" />
                        Select Recipients
                      </label>
                      {subscriberLists.length > 0 && (
                        <button
                          onClick={toggleAllLists}
                          className="font-sans text-caption text-editorial-navy hover:underline"
                        >
                          {selectedLists.length === subscriberLists.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>

                    {subscriberLists.length === 0 ? (
                      <div className="text-center py-6 bg-pearl border border-border-subtle">
                        <UsersIcon className="w-8 h-8 mx-auto text-silver mb-2" />
                        <p className="font-sans text-ui text-slate">No subscriber lists found.</p>
                        <p className="font-sans text-caption text-silver mt-1">
                          Create lists in Subscriber Management first.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-border-subtle divide-y divide-border-subtle max-h-[250px] overflow-y-auto">
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
                            <span className="font-mono text-caption text-slate whitespace-nowrap">
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
                        <strong>Ready to send:</strong> Newsletter will be sent to approximately{' '}
                        <strong>{totalRecipients}</strong> recipient{totalRecipients !== 1 ? 's' : ''} across{' '}
                        <strong>{selectedLists.length}</strong> list{selectedLists.length !== 1 ? 's' : ''}.
                      </p>
                      <p className="font-sans text-caption text-slate mt-1">
                        Lists: {selectedListNames.join(', ')}
                      </p>
                    </div>
                  )}
                </>
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
                onClick={handleSend}
                disabled={isSending || selectedLists.length === 0 || isLoading}
                className={`
                  px-6 py-2 font-sans text-ui transition-colors
                  ${selectedLists.length === 0 || isSending || isLoading
                    ? 'bg-silver text-paper cursor-not-allowed'
                    : 'bg-editorial-navy text-paper hover:bg-editorial-navy/90'
                  }
                `}
              >
                {isSending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SendIcon className="w-4 h-4" />
                    Send to {totalRecipients} Recipient{totalRecipients !== 1 ? 's' : ''}
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
