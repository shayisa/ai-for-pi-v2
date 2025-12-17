/**
 * useStyleThumbnails Hook
 *
 * Manages image style thumbnail state with auto-generation:
 * - Fetches existing thumbnails on mount
 * - Detects and generates missing thumbnails automatically
 * - Sequential generation with progress tracking
 * - Caches thumbnails in React state for session
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as thumbnailApi from '../services/thumbnailClientService';
import type { StyleThumbnail } from '../types';

interface UseStyleThumbnailsReturn {
  // Thumbnails mapped by style name for easy lookup
  thumbnails: Record<string, string>;
  // Loading state for initial fetch
  isLoading: boolean;
  // Generation state
  isGenerating: boolean;
  generatingStyles: string[];
  progress: { current: number; total: number } | null;
  // Error handling
  error: string | null;
  // Actions
  regenerateAll: () => Promise<void>;
}

// Delay between generation calls to avoid rate limiting
const GENERATION_DELAY_MS = 1000;

export function useStyleThumbnails(): UseStyleThumbnailsReturn {
  // Thumbnails record: styleName -> base64
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Loading/generating state
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStyles, setGeneratingStyles] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track if generation already started to prevent double execution
  const generationStartedRef = useRef(false);

  /**
   * Convert array of thumbnails to a record for easy lookup
   */
  const thumbnailsToRecord = (items: StyleThumbnail[]): Record<string, string> => {
    return items.reduce((acc, item) => {
      acc[item.styleName] = item.thumbnailBase64;
      return acc;
    }, {} as Record<string, string>);
  };

  /**
   * Generate missing thumbnails sequentially
   */
  const generateMissing = useCallback(async (missingStyles: string[]) => {
    if (missingStyles.length === 0) return;

    setIsGenerating(true);
    setProgress({ current: 0, total: missingStyles.length });
    setGeneratingStyles(missingStyles);

    let completed = 0;

    for (const styleName of missingStyles) {
      try {
        console.log(`[Thumbnails] Generating: ${styleName}`);
        const result = await thumbnailApi.generateThumbnail(styleName);

        // Update thumbnails record with the new thumbnail
        setThumbnails((prev) => ({
          ...prev,
          [styleName]: result.thumbnail.thumbnailBase64
        }));

        // Update progress
        completed++;
        setProgress({ current: completed, total: missingStyles.length });

        // Remove from generating list
        setGeneratingStyles((prev) => prev.filter((s) => s !== styleName));

        // Delay before next generation to avoid rate limiting
        if (completed < missingStyles.length) {
          await new Promise((resolve) => setTimeout(resolve, GENERATION_DELAY_MS));
        }
      } catch (err) {
        console.error(`[Thumbnails] Failed to generate ${styleName}:`, err);
        // Continue with next style instead of failing completely
        completed++;
        setProgress({ current: completed, total: missingStyles.length });
        setGeneratingStyles((prev) => prev.filter((s) => s !== styleName));
      }
    }

    setIsGenerating(false);
    setProgress(null);
    setGeneratingStyles([]);
  }, []);

  /**
   * Initial fetch and auto-generation
   */
  useEffect(() => {
    const initialize = async () => {
      if (generationStartedRef.current) return;
      generationStartedRef.current = true;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch existing thumbnails
        const { thumbnails: existing } = await thumbnailApi.getThumbnails();
        setThumbnails(thumbnailsToRecord(existing));

        // Check for missing styles
        const status = await thumbnailApi.getThumbnailStatus();

        if (status.missing.length > 0) {
          console.log(`[Thumbnails] Missing ${status.missing.length} thumbnails, starting generation...`);
          // Start auto-generation (runs in background)
          generateMissing(status.missing);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Thumbnails] Initialization error:', msg);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [generateMissing]);

  /**
   * Regenerate all thumbnails (clears existing and starts fresh)
   */
  const regenerateAll = useCallback(async () => {
    // Fetch status to get all style names
    const status = await thumbnailApi.getThumbnailStatus();
    const allStyles = [...status.missing];

    // Add existing styles too (they need to be regenerated)
    for (const styleName of Object.keys(thumbnails)) {
      if (!allStyles.includes(styleName)) {
        allStyles.push(styleName);
      }
    }

    // Clear current thumbnails
    setThumbnails({});

    // Generate all
    await generateMissing(allStyles);
  }, [thumbnails, generateMissing]);

  return {
    thumbnails,
    isLoading,
    isGenerating,
    generatingStyles,
    progress,
    error,
    regenerateAll
  };
}
