/**
 * Archive Browser Component
 * Browse, load, and manage saved trending insights archives
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as archiveClientService from '../services/archiveClientService';
import type { Archive, ArchiveContent } from '../services/archiveClientService';

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

  // Handle load archive
  const handleLoad = (archive: Archive) => {
    onLoadArchive(archive.content, archive.audience);
    onClose();
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card-bg border border-card-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <div>
            <h2 className="text-lg font-semibold text-primary-text">Saved Archives</h2>
            <p className="text-sm text-secondary-text">
              Load previous insights without using tokens
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary-text hover:text-primary-text rounded-lg hover:bg-card-border/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchArchives}
                className="text-accent-blue hover:underline"
              >
                Try again
              </button>
            </div>
          ) : archives.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-secondary-text/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <p className="text-secondary-text">No archives yet</p>
              <p className="text-sm text-secondary-text/70 mt-1">
                Archives are created automatically when you fetch trending content
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {archives.map(archive => (
                <div
                  key={archive.id}
                  className="bg-main-bg border border-card-border rounded-lg overflow-hidden"
                >
                  {/* Archive Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-card-border/30 transition-colors"
                    onClick={() => setExpandedId(expandedId === archive.id ? null : archive.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-primary-text">{archive.name}</h3>
                        <p className="text-sm text-secondary-text mt-1">
                          {formatDate(archive.createdAt)}
                        </p>
                        <p className="text-xs text-secondary-text/70 mt-1">
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
                          className="px-3 py-1.5 bg-accent-blue text-white text-sm rounded-lg hover:bg-accent-blue/80 transition-colors"
                        >
                          Load
                        </button>
                        {/* Delete Button */}
                        {deleteConfirmId === archive.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleDelete(archive.id)}
                              className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-card-border text-secondary-text text-xs rounded hover:bg-card-border/80 transition-colors"
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
                            className="p-1.5 text-secondary-text hover:text-red-400 rounded hover:bg-card-border/50 transition-colors"
                            title="Delete archive"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        {/* Expand Arrow */}
                        <svg
                          className={`w-5 h-5 text-secondary-text transition-transform ${expandedId === archive.id ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Audience Tags */}
                    {archive.audience.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {archive.audience.map(aud => (
                          <span
                            key={aud}
                            className="px-2 py-0.5 bg-card-border text-xs text-secondary-text rounded"
                          >
                            {aud}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {expandedId === archive.id && (
                    <div className="border-t border-card-border p-4 bg-card-border/20">
                      {/* Actionable Capabilities */}
                      {archive.content.compellingContent?.actionableCapabilities && archive.content.compellingContent.actionableCapabilities.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-primary-text mb-2">
                            Actionable Capabilities ({archive.content.compellingContent.actionableCapabilities.length})
                          </h4>
                          <ul className="space-y-1">
                            {archive.content.compellingContent.actionableCapabilities.slice(0, 3).map((cap, idx) => (
                              <li key={idx} className="text-sm text-secondary-text truncate">
                                {cap.title}
                              </li>
                            ))}
                            {archive.content.compellingContent.actionableCapabilities.length > 3 && (
                              <li className="text-xs text-secondary-text/70">
                                +{archive.content.compellingContent.actionableCapabilities.length - 3} more...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Essential Tools */}
                      {archive.content.compellingContent?.essentialTools && archive.content.compellingContent.essentialTools.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-primary-text mb-2">
                            Essential Tools ({archive.content.compellingContent.essentialTools.length})
                          </h4>
                          <ul className="space-y-1">
                            {archive.content.compellingContent.essentialTools.slice(0, 3).map((tool, idx) => (
                              <li key={idx} className="text-sm text-secondary-text truncate">
                                {tool.name}
                              </li>
                            ))}
                            {archive.content.compellingContent.essentialTools.length > 3 && (
                              <li className="text-xs text-secondary-text/70">
                                +{archive.content.compellingContent.essentialTools.length - 3} more...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Sources */}
                      {archive.content.trendingSources && archive.content.trendingSources.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-primary-text mb-2">
                            Sources ({archive.content.trendingSources.length})
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {['hackernews', 'arxiv', 'github', 'reddit', 'dev'].map(cat => {
                              const count = archive.content.trendingSources?.filter(s => s.category === cat).length || 0;
                              if (count === 0) return null;
                              return (
                                <span key={cat} className="px-2 py-0.5 bg-card-border text-xs text-secondary-text rounded">
                                  {cat}: {count}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      {archive.content.metadata && (
                        <p className="text-xs text-secondary-text/50 mt-3">
                          Generated: {formatDate(archive.content.metadata.generatedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-card-border p-4 flex justify-between items-center">
          <p className="text-sm text-secondary-text">
            {archives.length} archive{archives.length !== 1 ? 's' : ''} saved locally
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-card-border text-primary-text rounded-lg hover:bg-card-border/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
