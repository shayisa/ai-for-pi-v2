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
// URL Extraction Helper
// ============================================================================

/**
 * Extract all valid URLs from a potentially malformed string
 * Handles cases where AI returns multiple URLs concatenated with " and "
 * e.g., "https://monai.io/ and https://github.com/Project-MONAI/MONAI"
 *
 * @returns Array of valid URLs extracted from the input
 */
function extractValidUrls(rawUrl: string): { urls: string[]; original: string } {
  // Split on " and " to handle multiple URLs
  const candidates = rawUrl.includes(' and ')
    ? rawUrl.split(' and ').map(u => u.trim())
    : [rawUrl.trim()];

  // Validate each URL and keep only valid ones
  const validUrls: string[] = [];
  for (const candidate of candidates) {
    try {
      new URL(candidate);
      validUrls.push(candidate);
    } catch {
      console.warn(`[useRagIndexing] Invalid URL skipped: ${candidate}`);
    }
  }

  return { urls: validUrls, original: rawUrl };
}

/**
 * Get a clean, usable URL from a potentially malformed string.
 * Returns the first valid URL found, or the original if none are valid.
 * Use this for display purposes (e.g., "Learn More" links).
 *
 * Always returns the FIRST valid URL because the AI typically puts
 * the primary content URL first in multi-URL strings.
 */
export function getCleanUrl(rawUrl: string | undefined | null): string {
  // Guard against null/undefined
  if (!rawUrl) {
    return '';
  }

  if (!rawUrl.includes(' and ')) {
    return rawUrl.trim();
  }

  const { urls } = extractValidUrls(rawUrl);
  // Always return first valid URL (the primary content URL)
  return urls.length > 0 ? urls[0] : rawUrl;
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
      // Direct check first
      if (indexedUrls.has(url)) return true;

      // If URL contains " and ", check if ANY extracted URL is indexed
      if (url.includes(' and ')) {
        const { urls } = extractValidUrls(url);
        return urls.some(u => indexedUrls.has(u));
      }

      return false;
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
      const { url: rawUrl, title, sourceType, metadata } = params;

      // Extract all valid URLs from the input (handles " and " concatenation)
      const { urls, original } = extractValidUrls(rawUrl);

      if (urls.length === 0) {
        console.error(`[useRagIndexing] No valid URLs found in: ${original}`);
        return {
          url: original,
          success: false,
          wasAlreadyIndexed: false,
          error: `No valid URLs found in: ${original}`,
        };
      }

      // Log if multiple URLs were extracted
      if (urls.length > 1) {
        console.log(`[useRagIndexing] Extracted ${urls.length} URLs from: "${original}"`);
        urls.forEach((u, i) => console.log(`  [${i + 1}] ${u}`));
      } else if (urls[0] !== original) {
        console.log(`[useRagIndexing] Cleaned URL: "${original}" → "${urls[0]}"`);
      }

      // Track results for all URLs
      const results: { url: string; success: boolean; wasAlreadyIndexed: boolean; error?: string }[] = [];
      let anySuccess = false;
      let allAlreadyIndexed = true;
      const successfulUrls: string[] = [];

      // Mark all URLs as indexing
      setIndexingUrls((prev) => {
        const next = new Set(prev);
        urls.forEach(u => next.add(u));
        return next;
      });

      try {
        // Index each URL
        for (const url of urls) {
          // Check if already indexed
          if (indexedUrls.has(url)) {
            console.log(`[useRagIndexing] URL already indexed: ${url}`);
            results.push({ url, success: true, wasAlreadyIndexed: true });
            anySuccess = true;
            continue;
          }

          allAlreadyIndexed = false;

          try {
            const response = await ragApi.fetchAndIndexUrl(url, title, sourceType, metadata);

            if (response.wasAlreadyIndexed || response.document) {
              successfulUrls.push(url);
            }

            console.log(
              `[useRagIndexing] ${response.wasAlreadyIndexed ? 'Already indexed' : 'Indexed'}: ${url}`
            );

            results.push({
              url,
              success: true,
              wasAlreadyIndexed: response.wasAlreadyIndexed,
            });
            anySuccess = true;
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to index source';
            console.error(`[useRagIndexing] Error indexing ${url}:`, msg);
            results.push({ url, success: false, wasAlreadyIndexed: false, error: msg });
          }
        }

        // Add successful URLs to indexed set
        if (successfulUrls.length > 0) {
          setIndexedUrls((prev) => {
            const next = new Set(prev);
            successfulUrls.forEach(u => next.add(u));
            return next;
          });
        }

        // Return combined result
        const successCount = results.filter(r => r.success).length;
        const failedResults = results.filter(r => !r.success);

        if (anySuccess) {
          return {
            url: urls.length === 1 ? urls[0] : original,
            success: true,
            wasAlreadyIndexed: allAlreadyIndexed,
            // Include error info if some URLs failed
            error: failedResults.length > 0
              ? `Indexed ${successCount}/${urls.length} URLs. Failed: ${failedResults.map(r => r.url).join(', ')}`
              : undefined,
          };
        } else {
          return {
            url: original,
            success: false,
            wasAlreadyIndexed: false,
            error: `All URLs failed: ${failedResults.map(r => `${r.url} (${r.error})`).join('; ')}`,
          };
        }
      } finally {
        // Remove all URLs from indexing set
        setIndexingUrls((prev) => {
          const next = new Set(prev);
          urls.forEach(u => next.delete(u));
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

      // Extract valid URLs from each source (handles " and " concatenation)
      const expandedSources: IndexSourceParams[] = [];
      const invalidResults: IndexResult[] = [];

      for (const source of sources) {
        const { urls, original } = extractValidUrls(source.url);

        if (urls.length === 0) {
          console.error(`[useRagIndexing] No valid URLs in batch source: ${original}`);
          invalidResults.push({
            url: original,
            success: false,
            wasAlreadyIndexed: false,
            error: `No valid URLs found: ${original}`,
          });
        } else {
          // Add each valid URL as a separate source
          for (const url of urls) {
            if (url !== original) {
              console.log(`[useRagIndexing] Extracted URL in batch: "${original}" → "${url}"`);
            }
            expandedSources.push({ ...source, url });
          }
        }
      }

      const sanitizedSources = expandedSources;

      // If all URLs are invalid, return early
      if (sanitizedSources.length === 0) {
        return invalidResults;
      }

      // Initialize progress (count includes invalid as already failed)
      setBatchProgress({
        total: sources.length,
        completed: invalidResults.length,
        indexed: 0,
        alreadyIndexed: 0,
        failed: invalidResults.length,
        isRunning: true,
      });

      // Mark all valid URLs as indexing
      const urlsToIndex = sanitizedSources.map((s) => s.url);
      setIndexingUrls((prev) => {
        const next = new Set(prev);
        urlsToIndex.forEach((url) => next.add(url));
        return next;
      });

      const results: IndexResult[] = [...invalidResults];
      let indexed = 0;
      let alreadyIndexed = 0;
      let failed = invalidResults.length;

      try {
        // Use the batch API for efficiency
        const response = await ragApi.fetchAndIndexBatch(sanitizedSources);

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
