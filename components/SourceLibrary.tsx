/**
 * Source Library Component
 * Modal for browsing, managing, and viewing saved inspiration sources
 *
 * Phase: Topic/Source Persistence
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSavedSources } from '../hooks/useSavedSources';
import type { SavedSource } from '../services/sourceClientService';
import { XIcon, TrashIcon, SearchIcon, StarIcon, LinkIcon } from './IconComponents';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';

interface SourceLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryFilter = 'all' | 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';

export const SourceLibrary: React.FC<SourceLibraryProps> = ({ isOpen, onClose }) => {
  const { sources, isLoading, error, deleteSource, toggleFavorite, refreshSources } =
    useSavedSources();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filteredSources, setFilteredSources] = useState<SavedSource[]>([]);

  // Filter sources based on search query and category
  useEffect(() => {
    let filtered = sources;

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((s) => s.category === categoryFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          (s.author && s.author.toLowerCase().includes(query)) ||
          (s.summary && s.summary.toLowerCase().includes(query))
      );
    }

    setFilteredSources(filtered);
  }, [sources, searchQuery, categoryFilter]);

  // Refresh when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshSources();
      setSearchQuery('');
      setCategoryFilter('all');
      setDeleteConfirmId(null);
    }
  }, [isOpen, refreshSources]);

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteSource(id);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete source:', err);
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

  // Get category badge styling
  const getCategoryBadge = (category: SavedSource['category']) => {
    const badges = {
      hackernews: { label: 'Hacker News', bg: 'bg-orange-100', text: 'text-orange-700' },
      arxiv: { label: 'ArXiv', bg: 'bg-red-100', text: 'text-red-700' },
      github: { label: 'GitHub', bg: 'bg-gray-100', text: 'text-gray-700' },
      reddit: { label: 'Reddit', bg: 'bg-orange-50', text: 'text-orange-600' },
      dev: { label: 'Dev.to', bg: 'bg-indigo-100', text: 'text-indigo-700' },
    };
    return badges[category] || { label: category, bg: 'bg-gray-100', text: 'text-gray-600' };
  };

  // Get category counts
  const getCategoryCounts = useCallback(() => {
    const counts: Record<CategoryFilter, number> = {
      all: sources.length,
      hackernews: 0,
      arxiv: 0,
      github: 0,
      reddit: 0,
      dev: 0,
    };

    sources.forEach((s) => {
      if (counts[s.category] !== undefined) {
        counts[s.category]++;
      }
    });

    return counts;
  }, [sources]);

  const categoryCounts = getCategoryCounts();

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
            className="bg-paper border border-border-subtle w-full max-w-3xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
              <div>
                <h2 className="font-display text-h2 text-ink">Source Library</h2>
                <p className="font-sans text-caption text-slate mt-1">
                  Your saved inspiration sources
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate hover:text-ink transition-colors p-2"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="px-8 py-4 border-b border-border-subtle space-y-3">
              {/* Search */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-silver" />
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-pearl border border-border-subtle font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-editorial-navy"
                />
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'hackernews', 'arxiv', 'github', 'reddit', 'dev'] as CategoryFilter[]).map(
                  (cat) => {
                    const isActive = categoryFilter === cat;
                    const count = categoryCounts[cat];
                    const label =
                      cat === 'all'
                        ? 'All'
                        : getCategoryBadge(cat as SavedSource['category']).label;

                    return (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1 font-sans text-caption transition-colors ${
                          isActive
                            ? 'bg-ink text-paper'
                            : 'bg-pearl border border-border-subtle text-slate hover:border-silver'
                        }`}
                      >
                        {label}
                        <span className="ml-1 opacity-60">({count})</span>
                      </button>
                    );
                  }
                )}
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
                    onClick={refreshSources}
                    className="font-sans text-ui text-editorial-navy hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 border-2 border-silver flex items-center justify-center">
                    <LinkIcon className="w-8 h-8 text-silver" />
                  </div>
                  <p className="font-serif text-body text-slate">
                    {searchQuery || categoryFilter !== 'all'
                      ? 'No matching sources found'
                      : 'No saved sources yet'}
                  </p>
                  <p className="font-sans text-caption text-silver mt-2">
                    {searchQuery || categoryFilter !== 'all'
                      ? 'Try a different search term or filter'
                      : 'Save sources from "What\'s Trending" to build your library'}
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {filteredSources.map((source) => {
                    const badge = getCategoryBadge(source.category);
                    return (
                      <motion.div
                        key={source.id}
                        variants={staggerItem}
                        className="bg-pearl border border-border-subtle hover:border-silver transition-colors"
                      >
                        <div className="p-4 flex items-start gap-4">
                          {/* Favorite Star */}
                          <button
                            onClick={(e) => handleToggleFavorite(source.id, e)}
                            className={`mt-0.5 p-1 transition-colors ${
                              source.isFavorite
                                ? 'text-amber-500 hover:text-amber-600'
                                : 'text-silver hover:text-slate'
                            }`}
                            title={source.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <StarIcon
                              className="h-4 w-4"
                              fill={source.isFavorite ? 'currentColor' : 'none'}
                            />
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-sans text-ui font-medium text-ink truncate">
                              {source.title}
                            </h3>
                            {source.summary && (
                              <p className="font-sans text-caption text-slate mt-1 line-clamp-2">
                                {source.summary}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span
                                className={`px-2 py-0.5 font-sans text-caption ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                              {source.author && (
                                <span className="font-sans text-caption text-silver">
                                  by {source.author}
                                </span>
                              )}
                              {source.publication && (
                                <span className="font-sans text-caption text-silver">
                                  {source.publication}
                                </span>
                              )}
                              <span className="font-sans text-caption text-silver">
                                {formatDate(source.createdAt)}
                              </span>
                              {source.usageCount > 0 && (
                                <span className="font-sans text-caption text-silver">
                                  Used {source.usageCount}x
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-ink text-paper font-sans text-caption hover:bg-charcoal transition-colors"
                            >
                              Open
                            </a>
                            {deleteConfirmId === source.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(source.id)}
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
                                onClick={() => setDeleteConfirmId(source.id)}
                                className="p-1.5 text-slate hover:text-editorial-red transition-colors"
                                title="Delete source"
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
                {filteredSources.length} source{filteredSources.length !== 1 ? 's' : ''}
                {categoryFilter !== 'all' && ` in ${getCategoryBadge(categoryFilter as SavedSource['category']).label}`}
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

export default SourceLibrary;
