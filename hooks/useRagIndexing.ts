/**
 * useRagIndexing Hook
 *
 * Manages source indexing to the RAG Knowledge Base:
 * - Tracks which URLs are already indexed
 * - Handles indexing individual sources
 * - Handles batch indexing with progress
 * - Provides loading states per-URL
 *
 * Optimized for use with InspirationSourcesPanel and DiscoverTopicsPage.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as ragApi from '../services/ragClientService';
import type { SourceIndexType } from '../services/ragClientService';
import type { RagDocument } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface IndexSourceParams {
  url: string;
  title: string;
  sourceType: SourceIndexType;
  metadata?: Record<string, unknown>;
}

export interface IndexResult {
  url: string;
  success: boolean;
  wasAlreadyIndexed: boolean;
  document?: RagDocument;
  error?: string;
}

export interface BatchIndexProgress {
  total: number;
  completed: number;
  indexed: number;
  alreadyIndexed: number;
  failed: number;
  isRunning: boolean;
}

export interface UseRagIndexingReturn {
  // State
  indexedUrls: Set<string>;
  indexingUrls: Set<string>;
  loading: boolean;
  error: string | null;

  // Status checks
  isIndexed: (url: string) => boolean;
  isIndexing: (url: string) => boolean;

  // Single indexing
  indexSource: (params: IndexSourceParams) => Promise<IndexResult>;

  // Batch indexing
  indexSourcesBatch: (sources: IndexSourceParams[]) => Promise<IndexResult[]>;
  batchProgress: BatchIndexProgress | null;
  cancelBatch: () => void;

  // Refresh
  refreshIndexedUrls: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRagIndexing(): UseRagIndexingReturn {
  // Set of URLs that are already indexed
  const [indexedUrls, setIndexedUrls] = useState<Set<string>>(new Set());

  // Set of URLs currently being indexed
  const [indexingUrls, setIndexingUrls] = useState<Set<string>>(new Set());

  // Overall loading state (for initial fetch)
  const [loading, setLoading] = useState(true);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Batch progress tracking
  const [batchProgress, setBatchProgress] = useState<BatchIndexProgress | null>(null);

  // Batch cancellation ref
  const batchCancelledRef = useRef(false);

  // ============================================================================
  // Load Indexed URLs
  // ============================================================================

  const refreshIndexedUrls = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const urls = await ragApi.getIndexedUrls();
      setIndexedUrls(urls);
      console.log(`[useRagIndexing] Loaded ${urls.size} indexed URLs`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load indexed URLs';
      console.error('[useRagIndexing] Error loading indexed URLs:', e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refreshIndexedUrls();
  }, [refreshIndexedUrls]);

  // ============================================================================
  // Status Checks
  // ============================================================================

  const isIndexed = useCallback(
    (url: string): boolean => {
      return indexedUrls.has(url);
    },
    [indexedUrls]
  );

  const isIndexing = useCallback(
    (url: string): boolean => {
      return indexingUrls.has(url);
    },
    [indexingUrls]
  );

  // ============================================================================
  // Single Source Indexing
  // ============================================================================

  const indexSource = useCallback(
    async (params: IndexSourceParams): Promise<IndexResult> => {
      const { url, title, sourceType, metadata } = params;

      // Check if already indexed
      if (indexedUrls.has(url)) {
        console.log(`[useRagIndexing] URL already indexed: ${url}`);
        return {
          url,
          success: true,
          wasAlreadyIndexed: true,
        };
      }

      // Mark as indexing
      setIndexingUrls((prev) => new Set(prev).add(url));

      try {
        const response = await ragApi.fetchAndIndexUrl(url, title, sourceType, metadata);

        if (response.wasAlreadyIndexed || response.document) {
          // Add to indexed set
          setIndexedUrls((prev) => new Set(prev).add(url));
        }

        console.log(
          `[useRagIndexing] ${response.wasAlreadyIndexed ? 'Already indexed' : 'Indexed'}: ${url}`
        );

        return {
          url,
          success: true,
          wasAlreadyIndexed: response.wasAlreadyIndexed,
          document: response.document || undefined,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to index source';
        console.error(`[useRagIndexing] Error indexing ${url}:`, e);

        return {
          url,
          success: false,
          wasAlreadyIndexed: false,
          error: msg,
        };
      } finally {
        // Remove from indexing set
        setIndexingUrls((prev) => {
          const next = new Set(prev);
          next.delete(url);
          return next;
        });
      }
    },
    [indexedUrls]
  );

  // ============================================================================
  // Batch Source Indexing
  // ============================================================================

  const indexSourcesBatch = useCallback(
    async (sources: IndexSourceParams[]): Promise<IndexResult[]> => {
      if (sources.length === 0) {
        return [];
      }

      // Reset cancellation flag
      batchCancelledRef.current = false;

      // Initialize progress
      setBatchProgress({
        total: sources.length,
        completed: 0,
        indexed: 0,
        alreadyIndexed: 0,
        failed: 0,
        isRunning: true,
      });

      // Mark all as indexing
      const urlsToIndex = sources.map((s) => s.url);
      setIndexingUrls((prev) => {
        const next = new Set(prev);
        urlsToIndex.forEach((url) => next.add(url));
        return next;
      });

      const results: IndexResult[] = [];
      let indexed = 0;
      let alreadyIndexed = 0;
      let failed = 0;

      try {
        // Use the batch API for efficiency
        const response = await ragApi.fetchAndIndexBatch(sources);

        // Process results and update indexed set
        const newlyIndexedUrls: string[] = [];

        for (const result of response.results) {
          // Check if cancelled
          if (batchCancelledRef.current) {
            console.log('[useRagIndexing] Batch cancelled');
            break;
          }

          if (result.status === 'indexed') {
            indexed++;
            newlyIndexedUrls.push(result.url);
            results.push({
              url: result.url,
              success: true,
              wasAlreadyIndexed: false,
              document: result.document,
            });
          } else if (result.status === 'exists') {
            alreadyIndexed++;
            newlyIndexedUrls.push(result.url);
            results.push({
              url: result.url,
              success: true,
              wasAlreadyIndexed: true,
              document: result.document,
            });
          } else {
            failed++;
            results.push({
              url: result.url,
              success: false,
              wasAlreadyIndexed: false,
              error: result.error,
            });
          }

          // Update progress
          setBatchProgress((prev) =>
            prev
              ? {
                  ...prev,
                  completed: prev.completed + 1,
                  indexed,
                  alreadyIndexed,
                  failed,
                }
              : null
          );
        }

        // Add newly indexed URLs to set
        if (newlyIndexedUrls.length > 0) {
          setIndexedUrls((prev) => {
            const next = new Set(prev);
            newlyIndexedUrls.forEach((url) => next.add(url));
            return next;
          });
        }

        console.log(
          `[useRagIndexing] Batch complete: indexed=${indexed}, alreadyIndexed=${alreadyIndexed}, failed=${failed}`
        );

        return results;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Batch indexing failed';
        console.error('[useRagIndexing] Batch error:', e);

        // Return failure results for all sources
        return sources.map((s) => ({
          url: s.url,
          success: false,
          wasAlreadyIndexed: false,
          error: msg,
        }));
      } finally {
        // Clear indexing set for all sources
        setIndexingUrls((prev) => {
          const next = new Set(prev);
          urlsToIndex.forEach((url) => next.delete(url));
          return next;
        });

        // Mark batch as complete
        setBatchProgress((prev) =>
          prev
            ? {
                ...prev,
                isRunning: false,
              }
            : null
        );
      }
    },
    []
  );

  const cancelBatch = useCallback(() => {
    batchCancelledRef.current = true;
    console.log('[useRagIndexing] Batch cancellation requested');
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    indexedUrls,
    indexingUrls,
    loading,
    error,

    // Status checks
    isIndexed,
    isIndexing,

    // Single indexing
    indexSource,

    // Batch indexing
    indexSourcesBatch,
    batchProgress,
    cancelBatch,

    // Refresh
    refreshIndexedUrls,
  };
}

export default useRagIndexing;
