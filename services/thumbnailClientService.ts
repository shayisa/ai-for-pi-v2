/**
 * Thumbnail Client Service
 * Frontend API client for image style thumbnail management
 */

import type { StyleThumbnail, ThumbnailStatus } from '../types';
import { apiRequest } from './apiHelper';

/**
 * Get all stored thumbnails
 */
export const getThumbnails = async (): Promise<{ thumbnails: StyleThumbnail[] }> => {
  return apiRequest<{ thumbnails: StyleThumbnail[] }>('/api/thumbnails');
};

/**
 * Get thumbnail generation status (which styles are missing)
 */
export const getThumbnailStatus = async (): Promise<ThumbnailStatus> => {
  return apiRequest<ThumbnailStatus>('/api/thumbnails/status');
};

/**
 * Generate a thumbnail for a specific style
 */
export const generateThumbnail = async (
  styleName: string
): Promise<{ thumbnail: StyleThumbnail; cached: boolean }> => {
  return apiRequest<{ thumbnail: StyleThumbnail; cached: boolean }>(
    `/api/thumbnails/${encodeURIComponent(styleName)}/generate`,
    {
      method: 'POST',
    }
  );
};
