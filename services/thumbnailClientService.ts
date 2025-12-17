/**
 * Thumbnail Client Service
 * Frontend API client for image style thumbnail management
 */

import type { StyleThumbnail, ThumbnailStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get all stored thumbnails
 */
export const getThumbnails = async (): Promise<{ thumbnails: StyleThumbnail[] }> => {
  const response = await fetch(`${API_BASE}/api/thumbnails`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch thumbnails');
  }

  return response.json();
};

/**
 * Get thumbnail generation status (which styles are missing)
 */
export const getThumbnailStatus = async (): Promise<ThumbnailStatus> => {
  const response = await fetch(`${API_BASE}/api/thumbnails/status`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch thumbnail status');
  }

  return response.json();
};

/**
 * Generate a thumbnail for a specific style
 */
export const generateThumbnail = async (
  styleName: string
): Promise<{ thumbnail: StyleThumbnail; cached: boolean }> => {
  const response = await fetch(`${API_BASE}/api/thumbnails/${styleName}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to generate thumbnail for ${styleName}`);
  }

  return response.json();
};
