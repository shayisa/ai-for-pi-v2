/**
 * Archive Browser Component
 * Browse, load, and manage saved trending insights archives
 *
 * Phase 6: Added archive indexing dialog integration
 * When loading an archive, prompts user to index sources to RAG Knowledge Base
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as archiveClientService from '../services/archiveClientService';
import type { Archive, ArchiveContent } from '../services/archiveClientService';
import { XIcon, TrashIcon, ChevronDownIcon } from './IconComponents';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';
import { ArchiveIndexDialog } from './ArchiveIndexDialog';
import { useRagIndexing } from '../hooks/useRagIndexing';
import type { SourceIndexType } from '../services/ragClientService';

interface ArchiveBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadArchive: (content: ArchiveContent, audience: string[]) => void;
}

export const ArchiveBrowser: React.FC<ArchiveBrowserProps> = ({
  isOpen,
  onClose,
  onLoadArchive
}) => {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Phase 6: Archive indexing state
  const [pendingArchive, setPendingArchive] = useState<Archive | null>(null);
  const [isIndexDialogOpen, setIsIndexDialogOpen] = useState(false);

  // RAG indexing hook
  const { indexedUrls, indexSourcesBatch, refreshIndexedUrls } = useRagIndexing();

  // Fetch archives when modal opens
  const fetchArchives = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await archiveClientService.getArchives(50);
      setArchives(response.archives);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archives');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  // Handle delete archive
  const handleDelete = async (id: string) => {
    try {
      await archiveClientService.deleteArchive(id);
      setArchives(prev => prev.filter(a => a.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete archive');
    }
  };

  // Handle load archive - show index dialog first
  const handleLoad = (archive: Archive) => {
    setPendingArchive(archive);
    setIsIndexDialogOpen(true);
  };

  // Complete the archive load (after index dialog)
  const completeLoad = useCallback(() => {
    if (pendingArchive) {
      onLoadArchive(pendingArchive.content, pendingArchive.audience);
      setPendingArchive(null);
      setIsIndexDialogOpen(false);
      onClose();
    }
  }, [pendingArchive, onLoadArchive, onClose]);

  // Extract indexable sources from archive content
  const extractSourcesToIndex = useCallback((content: ArchiveContent, indexOnlyNew: boolean) => {
    const sources: Array<{
      url: string;
      title: string;
      sourceType: SourceIndexType;
      metadata?: Record<string, unknown>;
    }> = [];

    // Trending topics with resource URLs
    (content.trendingTopics || []).forEach(topic => {
      if (topic.resource) {
        if (!indexOnlyNew || !indexedUrls.has(topic.resource)) {
          sources.push({
            url: topic.resource,
            title: topic.title,
            sourceType: 'archive',
            metadata: { audienceId: topic.audienceId, fromArchive: true },
          });
        }
      }
    });

    // Essential tools with URLs
    (content.compellingContent?.essentialTools || []).forEach(tool => {
      if (tool.url) {
        if (!indexOnlyNew || !indexedUrls.has(tool.url)) {
          sources.push({
            url: tool.url,
            title: tool.name,
            sourceType: 'archive',
            metadata: { purpose: tool.purpose, fromArchive: true },
          });
        }
      }
    });

    // Trending sources
    (content.trendingSources || []).forEach(source => {
      if (source.url) {
        if (!indexOnlyNew || !indexedUrls.has(source.url)) {
          sources.push({
            url: source.url,
            title: source.title,
            sourceType: 'archive',
            metadata: {
              category: source.category,
              author: source.author,
              publication: source.publication,
              fromArchive: true,
            },
          });
        }
      }
    });

    return sources;
  }, [indexedUrls]);

  // Handle skip - just load archive without indexing
  const handleSkip = useCallback(() => {
    completeLoad();
  }, [completeLoad]);

  // Handle index new only
  const handleIndexNew = useCallback(async () => {
    if (!pendingArchive) return;

    const sources = extractSourcesToIndex(pendingArchive.content, true);
    if (sources.length > 0) {
      console.log(`[ArchiveBrowser] Indexing ${sources.length} new sources from archive`);
      await indexSourcesBatch(sources);
      await refreshIndexedUrls();
    }

    completeLoad();
  }, [pendingArchive, extractSourcesToIndex, indexSourcesBatch, refreshIndexedUrls, completeLoad]);

  // Handle index all
  const handleIndexAll = useCallback(async () => {
    if (!pendingArchive) return;

    const sources = extractSourcesToIndex(pendingArchive.content, false);
    if (sources.length > 0) {
      console.log(`[ArchiveBrowser] Indexing all ${sources.length} sources from archive`);
      await indexSourcesBatch(sources);
      await refreshIndexedUrls();
    }

    completeLoad();
  }, [pendingArchive, extractSourcesToIndex, indexSourcesBatch, refreshIndexedUrls, completeLoad]);

  // Handle dialog close (cancel)
  const handleDialogClose = useCallback(() => {
    setPendingArchive(null);
    setIsIndexDialogOpen(false);
  }, []);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get content preview
  const getPreview = (content: ArchiveContent) => {
    const capabilities = content.compellingContent?.actionableCapabilities?.length || 0;
    const tools = content.compellingContent?.essentialTools?.length || 0;
    const sources = content.trendingSources?.length || 0;

    return `${capabilities} capabilities, ${tools} tools, ${sources} sources`;
  };

  return (
    <>
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
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
              <div>
                <h2 className="font-display text-h2 text-ink">Saved Archives</h2>
                <p className="font-sans text-caption text-slate mt-1">
                  Load previous insights without using tokens
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate hover:text-ink transition-colors p-2"
              >
                <XIcon className="h-5 w-5" />
              </button>
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
                    onClick={fetchArchives}
                    className="font-sans text-ui text-editorial-navy hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : archives.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 border-2 border-silver flex items-center justify-center">
                    <svg className="w-8 h-8 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <p className="font-serif text-body text-slate">No archives yet</p>
                  <p className="font-sans text-caption text-silver mt-2">
                    Archives are created automatically when you fetch trending content
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  {archives.map(archive => (
                    <motion.div
                      key={archive.id}
                      variants={staggerItem}
                      className="bg-pearl border border-border-subtle"
                    >
                      {/* Archive Header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-paper transition-colors"
                        onClick={() => setExpandedId(expandedId === archive.id ? null : archive.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-sans text-ui font-medium text-ink">{archive.name}</h3>
                            <p className="font-sans text-caption text-slate mt-1">
                              {formatDate(archive.createdAt)}
                            </p>
                            <p className="font-sans text-caption text-silver mt-1">
                              {getPreview(archive.content)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {/* Load Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoad(archive);
                              }}
                              className="px-3 py-1.5 bg-ink text-paper font-sans text-caption hover:bg-charcoal transition-colors"
                            >
                              Load
                            </button>
                            {/* Delete Button */}
                            {deleteConfirmId === archive.id ? (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleDelete(archive.id)}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(archive.id);
                                }}
                                className="p-1.5 text-slate hover:text-editorial-red transition-colors"
                                title="Delete archive"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                            {/* Expand Arrow */}
                            <ChevronDownIcon
                              className={`h-5 w-5 text-slate transition-transform ${expandedId === archive.id ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {/* Audience Tags */}
                        {archive.audience.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {archive.audience.map(aud => (
                              <span
                                key={aud}
                                className="px-2 py-0.5 bg-paper border border-border-subtle font-sans text-caption text-slate"
                              >
                                {aud}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {expandedId === archive.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border-subtle overflow-hidden"
                          >
                            <div className="p-4 bg-paper">
                              {/* Actionable Capabilities */}
                              {archive.content.compellingContent?.actionableCapabilities && archive.content.compellingContent.actionableCapabilities.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="font-sans text-caption font-medium text-ink mb-2 uppercase tracking-wider">
                                    Capabilities ({archive.content.compellingContent.actionableCapabilities.length})
                                  </h4>
                                  <ul className="space-y-1">
                                    {archive.content.compellingContent.actionableCapabilities.slice(0, 3).map((cap, idx) => (
                                      <li key={idx} className="font-sans text-caption text-slate truncate">
                                        {cap.title}
                                      </li>
                                    ))}
                                    {archive.content.compellingContent.actionableCapabilities.length > 3 && (
                                      <li className="font-sans text-caption text-silver">
                                        +{archive.content.compellingContent.actionableCapabilities.length - 3} more...
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}

                              {/* Essential Tools */}
                              {archive.content.compellingContent?.essentialTools && archive.content.compellingContent.essentialTools.length > 0 && (
                                <div className="mb-4">
                                  <h4 className="font-sans text-caption font-medium text-ink mb-2 uppercase tracking-wider">
                                    Tools ({archive.content.compellingContent.essentialTools.length})
                                  </h4>
                                  <ul className="space-y-1">
                                    {archive.content.compellingContent.essentialTools.slice(0, 3).map((tool, idx) => (
                                      <li key={idx} className="font-sans text-caption text-slate truncate">
                                        {tool.name}
                                      </li>
                                    ))}
                                    {archive.content.compellingContent.essentialTools.length > 3 && (
                                      <li className="font-sans text-caption text-silver">
                                        +{archive.content.compellingContent.essentialTools.length - 3} more...
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}

                              {/* Sources */}
                              {archive.content.trendingSources && archive.content.trendingSources.length > 0 && (
                                <div>
                                  <h4 className="font-sans text-caption font-medium text-ink mb-2 uppercase tracking-wider">
                                    Sources ({archive.content.trendingSources.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {['hackernews', 'arxiv', 'github', 'reddit', 'dev'].map(cat => {
                                      const count = archive.content.trendingSources?.filter(s => s.category === cat).length || 0;
                                      if (count === 0) return null;
                                      return (
                                        <span key={cat} className="px-2 py-0.5 bg-pearl border border-border-subtle font-sans text-caption text-slate">
                                          {cat}: {count}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Metadata */}
                              {archive.content.metadata && (
                                <p className="font-sans text-caption text-silver mt-4">
                                  Generated: {formatDate(archive.content.metadata.generatedAt)}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-pearl border-t border-border-subtle flex justify-between items-center">
              <p className="font-sans text-caption text-slate">
                {archives.length} archive{archives.length !== 1 ? 's' : ''} saved locally
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

      {/* Phase 6: Archive Index Dialog */}
      {pendingArchive && (
        <ArchiveIndexDialog
          isOpen={isIndexDialogOpen}
          archiveName={pendingArchive.name}
          archiveContent={pendingArchive.content}
          indexedUrls={indexedUrls}
          onSkip={handleSkip}
          onIndexNew={handleIndexNew}
          onIndexAll={handleIndexAll}
          onClose={handleDialogClose}
        />
      )}
    </>
  );
};
