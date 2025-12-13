/**
 * Trending Data Cache
 *
 * Caches trending sources to reduce external API calls from 67+ to 1 per hour.
 * Previously, every page load would fetch from 6 sources with multiple API calls each.
 */

import type { TrendingSource } from '../types/apiContracts';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * In-memory cache for trending sources
 * TTL: 1 hour (trending data doesn't change that frequently)
 */
class TrendingCache {
  private cache: CacheEntry<TrendingSource[]> | null = null;
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour in ms

  /**
   * Get cached trending sources if still valid
   */
  get(): TrendingSource[] | null {
    if (!this.cache) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - this.cache.timestamp > this.cache.ttl;

    if (isExpired) {
      console.log('[TrendingCache] Cache expired, will fetch fresh data');
      this.cache = null;
      return null;
    }

    const ageMinutes = Math.round((now - this.cache.timestamp) / 60000);
    console.log(`[TrendingCache] Cache hit - ${this.cache.data.length} sources, ${ageMinutes}m old`);
    return this.cache.data;
  }

  /**
   * Store trending sources in cache
   */
  set(data: TrendingSource[], ttl: number = this.DEFAULT_TTL): void {
    this.cache = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    console.log(`[TrendingCache] Cached ${data.length} sources with ${ttl / 60000}m TTL`);
  }

  /**
   * Force clear the cache
   */
  clear(): void {
    this.cache = null;
    console.log('[TrendingCache] Cache cleared');
  }

  /**
   * Get cache metadata for debugging
   */
  getMetadata(): { cachedAt: string; ttl: number; count: number } | null {
    if (!this.cache) return null;

    return {
      cachedAt: new Date(this.cache.timestamp).toISOString(),
      ttl: this.cache.ttl,
      count: this.cache.data.length,
    };
  }
}

// Singleton instance
export const trendingCache = new TrendingCache();
