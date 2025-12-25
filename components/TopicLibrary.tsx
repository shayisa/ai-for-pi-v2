/**
 * Topic Library Component
 * Modal for browsing, managing, and selecting saved topics
 *
 * Phase: Topic/Source Persistence
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSavedTopics } from '../hooks/useSavedTopics';
import type { SavedTopic } from '../services/topicClientService';
import { XIcon, TrashIcon, SearchIcon, StarIcon } from './IconComponents';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';

interface TopicLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTopic: (topic: string) => void;
}

export const TopicLibrary: React.FC<TopicLibraryProps> = ({
  isOpen,
  onClose,
  onSelectTopic,
}) => {
  const { topics, isLoading, error, deleteTopic, toggleFavorite, refreshTopics } = useSavedTopics();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filteredTopics, setFilteredTopics] = useState<SavedTopic[]>([]);

  // Filter topics based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTopics(topics);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTopics(
        topics.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            (t.description && t.description.toLowerCase().includes(query))
        )
      );
    }
  }, [topics, searchQuery]);

  // Refresh when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshTopics();
      setSearchQuery('');
      setDeleteConfirmId(null);
    }
  }, [isOpen, refreshTopics]);

  // Handle topic selection
  const handleSelect = useCallback(
    (topic: SavedTopic) => {
      onSelectTopic(topic.title);
      onClose();
    },
    [onSelectTopic, onClose]
  );

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteTopic(id);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete topic:', err);
    }
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(id);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get category label and color
  const getCategoryBadge = (category: SavedTopic['category']) => {
    const badges = {
      suggested: { label: 'AI Suggested', bg: 'bg-editorial-navy/10', text: 'text-editorial-navy' },
      trending: { label: 'Trending', bg: 'bg-amber-100', text: 'text-amber-700' },
      manual: { label: 'Custom', bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    return badges[category] || badges.manual;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-paper border border-border-subtle w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
              <div>
                <h2 className="font-display text-h2 text-ink">Topic Library</h2>
                <p className="font-sans text-caption text-slate mt-1">
                  Your saved topics for newsletter creation
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate hover:text-ink transition-colors p-2"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-8 py-4 border-b border-border-subtle">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-silver" />
                <input
                  type="text"
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-pearl border border-border-subtle font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-editorial-navy"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="font-sans text-ui text-editorial-red mb-4">{error}</p>
                  <button
                    onClick={refreshTopics}
                    className="font-sans text-ui text-editorial-navy hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredTopics.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 border-2 border-silver flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-silver"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <p className="font-serif text-body text-slate">
                    {searchQuery ? 'No matching topics found' : 'No saved topics yet'}
                  </p>
                  <p className="font-sans text-caption text-silver mt-2">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Save topics from AI suggestions or "What\'s Trending" to build your library'}
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {filteredTopics.map((topic) => {
                    const badge = getCategoryBadge(topic.category);
                    return (
                      <motion.div
                        key={topic.id}
                        variants={staggerItem}
                        className="bg-pearl border border-border-subtle hover:border-silver transition-colors"
                      >
                        <div className="p-4 flex items-start gap-4">
                          {/* Favorite Star */}
                          <button
                            onClick={(e) => handleToggleFavorite(topic.id, e)}
                            className={`mt-0.5 p-1 transition-colors ${
                              topic.isFavorite
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-silver hover:text-slate'
                            }`}
                            title={topic.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <StarIcon
                              className="h-4 w-4"
                              fill={topic.isFavorite ? 'currentColor' : 'none'}
                            />
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-sans text-ui font-medium text-ink truncate">
                              {topic.title}
                            </h3>
                            {topic.description && (
                              <p className="font-sans text-caption text-slate mt-1 line-clamp-2">
                                {topic.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={`px-2 py-0.5 font-sans text-caption ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                              <span className="font-sans text-caption text-silver">
                                {formatDate(topic.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSelect(topic)}
                              className="px-3 py-1.5 bg-ink text-paper font-sans text-caption hover:bg-charcoal transition-colors"
                            >
                              Use Topic
                            </button>
                            {deleteConfirmId === topic.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(topic.id)}
                                  className="px-2 py-1 bg-editorial-red text-paper font-sans text-caption hover:bg-red-700 transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 border border-border-subtle font-sans text-caption text-slate hover:bg-paper transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(topic.id)}
                                className="p-1.5 text-slate hover:text-editorial-red transition-colors"
                                title="Delete topic"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-pearl border-t border-border-subtle flex justify-between items-center">
              <p className="font-sans text-caption text-slate">
                {filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
              <button
                onClick={onClose}
                className="font-sans text-ui text-slate hover:text-ink transition-colors px-4 py-2"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TopicLibrary;
