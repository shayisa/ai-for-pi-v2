/**
 * ArchiveIndexDialog Component
 *
 * Dialog shown when loading an archive, prompting the user to optionally
 * index the archive's sources to the RAG Knowledge Base.
 *
 * Shows:
 * - Total sources available to index
 * - How many are already indexed
 * - How many are new
 *
 * Options:
 * - Skip: Load archive without indexing
 * - Index New Only: Index only sources not yet in KB
 * - Index All: Re-index all sources (including already indexed)
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, DatabasePlusIcon, CheckIcon } from './IconComponents';
import { modalOverlay, modalContent } from '../utils/animations';
import type { ArchiveContent } from '../services/archiveClientService';

interface ArchiveIndexDialogProps {
  isOpen: boolean;
  archiveName: string;
  archiveContent: ArchiveContent;
  indexedUrls: Set<string>;
  onSkip: () => void;
  onIndexNew: () => void;
  onIndexAll: () => void;
  onClose: () => void;
}

interface SourceCounts {
  trendingTopics: { total: number; indexed: number; new: number };
  tools: { total: number; indexed: number; new: number };
  sources: { total: number; indexed: number; new: number };
  totals: { total: number; indexed: number; new: number };
}

export const ArchiveIndexDialog: React.FC<ArchiveIndexDialogProps> = ({
  isOpen,
  archiveName,
  archiveContent,
  indexedUrls,
  onSkip,
  onIndexNew,
  onIndexAll,
  onClose,
}) => {
  // Calculate source counts
  const counts = useMemo<SourceCounts>(() => {
    // Trending topics with resource URLs
    const trendingTopicUrls = (archiveContent.trendingTopics || [])
      .filter(t => t.resource)
      .map(t => t.resource!);
    const trendingTopicsIndexed = trendingTopicUrls.filter(url => indexedUrls.has(url)).length;

    // Essential tools with URLs
    const toolUrls = (archiveContent.compellingContent?.essentialTools || [])
      .filter(t => t.url)
      .map(t => t.url);
    const toolsIndexed = toolUrls.filter(url => indexedUrls.has(url)).length;

    // Trending sources with URLs
    const sourceUrls = (archiveContent.trendingSources || [])
      .filter(s => s.url)
      .map(s => s.url);
    const sourcesIndexed = sourceUrls.filter(url => indexedUrls.has(url)).length;

    const totalAll = trendingTopicUrls.length + toolUrls.length + sourceUrls.length;
    const totalIndexed = trendingTopicsIndexed + toolsIndexed + sourcesIndexed;

    return {
      trendingTopics: {
        total: trendingTopicUrls.length,
        indexed: trendingTopicsIndexed,
        new: trendingTopicUrls.length - trendingTopicsIndexed,
      },
      tools: {
        total: toolUrls.length,
        indexed: toolsIndexed,
        new: toolUrls.length - toolsIndexed,
      },
      sources: {
        total: sourceUrls.length,
        indexed: sourcesIndexed,
        new: sourceUrls.length - sourcesIndexed,
      },
      totals: {
        total: totalAll,
        indexed: totalIndexed,
        new: totalAll - totalIndexed,
      },
    };
  }, [archiveContent, indexedUrls]);

  // Check if there's anything to index
  const hasSourcesWithUrls = counts.totals.total > 0;
  const allAlreadyIndexed = counts.totals.new === 0 && counts.totals.total > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-paper border border-border-subtle w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-editorial-navy/10 flex items-center justify-center">
                  <DatabasePlusIcon className="w-5 h-5 text-editorial-navy" />
                </div>
                <div>
                  <h2 className="font-display text-h3 text-ink">Index to Knowledge Base?</h2>
                  <p className="font-sans text-caption text-slate mt-0.5">
                    {archiveName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate hover:text-ink transition-colors p-1"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {!hasSourcesWithUrls ? (
                <p className="font-serif text-body text-slate text-center py-4">
                  This archive has no indexable sources.
                </p>
              ) : (
                <>
                  <p className="font-serif text-body text-charcoal mb-4">
                    This archive contains sources that can be indexed to your Knowledge Base for RAG-enhanced queries.
                  </p>

                  {/* Source breakdown */}
                  <div className="bg-pearl border border-border-subtle p-4 space-y-3">
                    {counts.trendingTopics.total > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-ui text-ink">Trending Topics</span>
                        <div className="flex items-center gap-2">
                          {counts.trendingTopics.indexed > 0 && (
                            <span className="flex items-center gap-1 font-sans text-caption text-emerald-600">
                              <CheckIcon className="w-3.5 h-3.5" />
                              {counts.trendingTopics.indexed} indexed
                            </span>
                          )}
                          {counts.trendingTopics.new > 0 && (
                            <span className="font-sans text-caption text-editorial-navy font-medium">
                              {counts.trendingTopics.new} new
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {counts.tools.total > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-ui text-ink">Essential Tools</span>
                        <div className="flex items-center gap-2">
                          {counts.tools.indexed > 0 && (
                            <span className="flex items-center gap-1 font-sans text-caption text-emerald-600">
                              <CheckIcon className="w-3.5 h-3.5" />
                              {counts.tools.indexed} indexed
                            </span>
                          )}
                          {counts.tools.new > 0 && (
                            <span className="font-sans text-caption text-editorial-navy font-medium">
                              {counts.tools.new} new
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {counts.sources.total > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-ui text-ink">Inspiration Sources</span>
                        <div className="flex items-center gap-2">
                          {counts.sources.indexed > 0 && (
                            <span className="flex items-center gap-1 font-sans text-caption text-emerald-600">
                              <CheckIcon className="w-3.5 h-3.5" />
                              {counts.sources.indexed} indexed
                            </span>
                          )}
                          {counts.sources.new > 0 && (
                            <span className="font-sans text-caption text-editorial-navy font-medium">
                              {counts.sources.new} new
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Total line */}
                    <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                      <span className="font-sans text-ui font-medium text-ink">Total</span>
                      <span className="font-sans text-ui text-charcoal">
                        {counts.totals.indexed} of {counts.totals.total} already indexed
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer / Actions */}
            <div className="px-6 py-4 bg-pearl border-t border-border-subtle flex items-center justify-end gap-3">
              <button
                onClick={onSkip}
                className="px-4 py-2 font-sans text-ui text-slate hover:text-ink transition-colors"
              >
                Skip
              </button>

              {hasSourcesWithUrls && counts.totals.new > 0 && (
                <button
                  onClick={onIndexNew}
                  className="px-4 py-2 bg-ink text-paper font-sans text-ui hover:bg-charcoal transition-colors"
                >
                  Index {counts.totals.new} New
                </button>
              )}

              {hasSourcesWithUrls && !allAlreadyIndexed && counts.totals.indexed > 0 && (
                <button
                  onClick={onIndexAll}
                  className="px-4 py-2 border border-ink text-ink font-sans text-ui hover:bg-pearl transition-colors"
                >
                  Index All ({counts.totals.total})
                </button>
              )}

              {allAlreadyIndexed && (
                <button
                  onClick={onSkip}
                  className="px-4 py-2 bg-emerald-600 text-paper font-sans text-ui hover:bg-emerald-700 transition-colors"
                >
                  All Indexed - Continue
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ArchiveIndexDialog;
