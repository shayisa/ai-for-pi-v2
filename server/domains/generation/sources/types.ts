/**
 * Trending Source Types
 *
 * Type definitions for trending content sources.
 *
 * @module domains/generation/sources/types
 *
 * ## Original Location
 * - server.ts lines 144-154
 */

/**
 * Trending source categories
 */
export type TrendingSourceCategory = 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';

/**
 * Trending source from external APIs
 *
 * Represents a single piece of trending content from any supported source.
 */
export interface TrendingSource {
  /** Unique identifier (prefixed with source type, e.g., "hn-123") */
  id: string;
  /** Title of the content */
  title: string;
  /** URL to the original content */
  url: string;
  /** Author name (optional) */
  author?: string;
  /** Publication/source name (optional) */
  publication?: string;
  /** Publication date (optional) */
  date?: string;
  /** Source category */
  category: TrendingSourceCategory;
  /** Brief description or summary (optional) */
  summary?: string;
}
