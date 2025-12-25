/**
 * NewsletterPickerModal
 *
 * Phase 16: Newsletter-Calendar Entry Linking
 *
 * Modal for selecting from existing newsletters to link to a calendar entry.
 * Follows LoadFromDriveModal.tsx pattern for consistency.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, SearchIcon } from './IconComponents';
import * as newsletterApi from '../services/newsletterClientService';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';

interface NewsletterItem {
  id: string;
  subject: string;
  createdAt: string;
}

interface NewsletterPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (newsletterId: string, subject: string) => void;
  currentLinkedId?: string | null;
}

export const NewsletterPickerModal: React.FC<NewsletterPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentLinkedId,
}) => {
  const [newsletters, setNewsletters] = useState<NewsletterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // Load newsletters when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadNewsletters = async () => {
      setLoading(true);
      setError(null);
      setNewsletters([]);
      setSearchQuery('');
      console.log('[NewsletterPickerModal] Loading newsletters...');

      try {
        const response = await newsletterApi.getNewsletters(50);
        const items = response.newsletters || [];
        console.log(`[NewsletterPickerModal] Loaded ${items.length} newsletters`);

        // Filter out items without valid IDs to prevent React key errors
        const validItems = items.filter((n) => {
          if (!n.id || n.id.trim() === '') {
            console.warn('[NewsletterPickerModal] Skipping newsletter with empty ID:', n.subject);
            return false;
          }
          return true;
        });

        console.log(`[NewsletterPickerModal] ${validItems.length} newsletters with valid IDs`);

        setNewsletters(
          validItems.map((n) => ({
            id: n.id,
            subject: n.subject || 'Untitled Newsletter',
            createdAt: n.createdAt || new Date().toISOString(),
          }))
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load newsletters';
        console.error('[NewsletterPickerModal] Error:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadNewsletters();
  }, [isOpen]);

  // Filter newsletters by search query
  const filteredNewsletters = useMemo(() => {
    if (!searchQuery.trim()) return newsletters;
    const query = searchQuery.toLowerCase();
    return newsletters.filter((n) => n.subject.toLowerCase().includes(query));
  }, [newsletters, searchQuery]);

  // Handle newsletter selection
  const handleSelectNewsletter = async (newsletter: NewsletterItem) => {
    if (selectingId) return; // Prevent double-click

    setSelectingId(newsletter.id);
    console.log(`[NewsletterPickerModal] Selected newsletter: ${newsletter.id}`);

    try {
      onSelect(newsletter.id, newsletter.subject);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select newsletter';
      console.error('[NewsletterPickerModal] Selection error:', err);
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
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Unknown date';
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
            <h2 className="font-serif text-subheadline text-ink">Select Newsletter</h2>
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
                placeholder="Search newsletters..."
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

            {!loading && !error && filteredNewsletters.length === 0 && (
              <div className="text-center py-8 text-slate">
                {newsletters.length === 0 ? (
                  <p>No newsletters yet. Generate one first.</p>
                ) : (
                  <p>No newsletters match your search.</p>
                )}
              </div>
            )}

            {!loading && !error && filteredNewsletters.length > 0 && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {filteredNewsletters.map((newsletter, index) => {
                  const isCurrentlyLinked = currentLinkedId === newsletter.id;
                  const isSelecting = selectingId === newsletter.id;

                  return (
                    <motion.button
                      key={newsletter.id || `fallback-${index}`}
                      variants={staggerItem}
                      onClick={() => handleSelectNewsletter(newsletter)}
                      disabled={isSelecting}
                      className={`w-full text-left p-4 border transition-colors ${
                        isCurrentlyLinked
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-pearl border-border-subtle hover:border-editorial-navy'
                      } ${isSelecting ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-ui text-ink font-medium truncate">
                            {newsletter.subject}
                          </p>
                          <p className="font-sans text-caption text-slate mt-1">
                            Created: {formatDate(newsletter.createdAt)}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {isCurrentlyLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Linked
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
      </motion.div>
    </AnimatePresence>
  );
};

export default NewsletterPickerModal;
