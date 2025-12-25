/**
 * Trending Data Cache (Server-side)
 *
 * Audience-aware caching to prevent cross-contamination between
 * different audience selections (Phase 15.2 - Audience Restructure).
 *
 * Phase 15.3: Extended with per-audience topic caching for parallel generation.
 * Supports caching at three levels:
 * 1. Source cache - Raw trending sources per audience combination
 * 2. Per-audience topic cache - Generated topics for individual audiences
 * 3. Merged topic cache - Final merged topics for audience combinations
 *
 * Key change: Cache is now keyed by sorted audience IDs, so different
 * audience selections get their own cached results.
 */

import type { TrendingTopic } from '../../types';
import type { PerAudienceResult, ParallelTrendingResult } from '../domains/generation/types/parallelGeneration';

interface TrendingSource {
  id: string;
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev' | 'producthunt' | 'gdelt';
  summary?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Per-audience topic cache entry
 */
interface PerAudienceTopicCacheEntry {
  audienceId: string;
  result: PerAudienceResult;
  timestamp: number;
  ttl: number;
}

/**
 * Merged topics cache entry
 */
interface MergedTopicsCacheEntry {
  audienceKey: string;
  result: ParallelTrendingResult;
  timestamp: number;
  ttl: number;
}

class TrendingCache {
  /**
   * Audience-keyed source cache: different audience combinations get separate caches
   * Key format: sorted, comma-separated audience IDs (e.g., "business-administration,business-intelligence")
   */
  private sourceCache: Map<string, CacheEntry<TrendingSource[]>> = new Map();

  /**
   * Phase 15.3: Per-audience topic cache
   * Key: individual audience ID
   * Enables reuse of generated topics across different audience combinations
   */
  private perAudienceTopicCache: Map<string, PerAudienceTopicCacheEntry> = new Map();

  /**
   * Phase 15.3: Merged topics cache
   * Key: sorted, comma-separated audience IDs
   * Caches final merged results for specific audience combinations
   */
  private mergedTopicsCache: Map<string, MergedTopicsCacheEntry> = new Map();

  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
  private readonly TOPIC_TTL = 30 * 60 * 1000; // 30 minutes for generated topics
  private readonly MAX_CACHE_ENTRIES = 20; // Limit memory usage per cache type

  // Legacy alias for backward compatibility
  private get cache() {
    return this.sourceCache;
  }

  /**
   * Generate cache key from audience IDs
   * Sorts IDs to ensure consistent keys regardless of selection order
   */
  private getCacheKey(audienceIds: string[]): string {
    if (audienceIds.length === 0) {
      return '_all_'; // Special key for "all audiences"
    }
    return audienceIds.slice().sort().join(',');
  }

  /**
   * Get cached sources for specific audience selection
   */
  get(audienceIds: string[] = []): TrendingSource[] | null {
    const key = this.getCacheKey(audienceIds);
    const entry = this.sourceCache.get(key);

    if (!entry) {
      console.log(`[TrendingCache] Source cache miss for audiences: ${key}`);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      console.log(`[TrendingCache] Source cache expired for audiences: ${key}`);
      this.sourceCache.delete(key);
      return null;
    }

    const ageMinutes = Math.round((now - entry.timestamp) / 60000);
    console.log(
      `[TrendingCache] Source cache hit for audiences: ${key} - ${entry.data.length} sources, ${ageMinutes}m old`
    );
    return entry.data;
  }

  /**
   * Cache sources for specific audience selection
   */
  set(audienceIds: string[], data: TrendingSource[], ttl: number = this.DEFAULT_TTL): void {
    const key = this.getCacheKey(audienceIds);

    // Enforce max entries limit (LRU-style: remove oldest when full)
    if (this.sourceCache.size >= this.MAX_CACHE_ENTRIES && !this.sourceCache.has(key)) {
      const oldestKey = this.findOldestSourceEntry();
      if (oldestKey) {
        console.log(`[TrendingCache] Evicting oldest source entry: ${oldestKey}`);
        this.sourceCache.delete(oldestKey);
      }
    }

    this.sourceCache.set(key, { data, timestamp: Date.now(), ttl });
    console.log(
      `[TrendingCache] Cached ${data.length} sources for audiences: ${key} (total entries: ${this.sourceCache.size})`
    );
  }

  /**
   * Find the oldest source cache entry for eviction
   */
  private findOldestSourceEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.sourceCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  // ===== PHASE 15.3: Per-Audience Topic Cache =====

  /**
   * Get cached topics for a single audience
   */
  getPerAudienceTopics(audienceId: string): PerAudienceResult | null {
    const entry = this.perAudienceTopicCache.get(audienceId);

    if (!entry) {
      console.log(`[TrendingCache] Per-audience topic cache miss: ${audienceId}`);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      console.log(`[TrendingCache] Per-audience topic cache expired: ${audienceId}`);
      this.perAudienceTopicCache.delete(audienceId);
      return null;
    }

    const ageMinutes = Math.round((now - entry.timestamp) / 60000);
    console.log(
      `[TrendingCache] Per-audience topic cache hit: ${audienceId} - ${entry.result.topics.length} topics, ${ageMinutes}m old`
    );
    return entry.result;
  }

  /**
   * Cache topics for a single audience
   */
  setPerAudienceTopics(audienceId: string, result: PerAudienceResult): void {
    // Enforce max entries limit
    if (this.perAudienceTopicCache.size >= this.MAX_CACHE_ENTRIES && !this.perAudienceTopicCache.has(audienceId)) {
      const oldestKey = this.findOldestPerAudienceEntry();
      if (oldestKey) {
        console.log(`[TrendingCache] Evicting oldest per-audience entry: ${oldestKey}`);
        this.perAudienceTopicCache.delete(oldestKey);
      }
    }

    this.perAudienceTopicCache.set(audienceId, {
      audienceId,
      result,
      timestamp: Date.now(),
      ttl: this.TOPIC_TTL,
    });
    console.log(
      `[TrendingCache] Cached ${result.topics.length} topics for audience: ${audienceId} (total entries: ${this.perAudienceTopicCache.size})`
    );
  }

  /**
   * Find the oldest per-audience entry for eviction
   */
  private findOldestPerAudienceEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.perAudienceTopicCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  // ===== PHASE 15.3: Merged Topics Cache =====

  /**
   * Get cached merged topics for an audience combination
   */
  getMergedTopics(audienceIds: string[]): ParallelTrendingResult | null {
    const key = this.getCacheKey(audienceIds);
    const entry = this.mergedTopicsCache.get(key);

    if (!entry) {
      console.log(`[TrendingCache] Merged topics cache miss: ${key}`);
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      console.log(`[TrendingCache] Merged topics cache expired: ${key}`);
      this.mergedTopicsCache.delete(key);
      return null;
    }

    const ageMinutes = Math.round((now - entry.timestamp) / 60000);
    const topicCount = entry.result.topics?.length || 0;
    console.log(
      `[TrendingCache] Merged topics cache hit: ${key} - ${topicCount} topics, ${ageMinutes}m old`
    );
    return entry.result;
  }

  /**
   * Cache merged topics for an audience combination
   */
  setMergedTopics(audienceIds: string[], result: ParallelTrendingResult): void {
    const key = this.getCacheKey(audienceIds);

    // Enforce max entries limit
    if (this.mergedTopicsCache.size >= this.MAX_CACHE_ENTRIES && !this.mergedTopicsCache.has(key)) {
      const oldestKey = this.findOldestMergedEntry();
      if (oldestKey) {
        console.log(`[TrendingCache] Evicting oldest merged entry: ${oldestKey}`);
        this.mergedTopicsCache.delete(oldestKey);
      }
    }

    this.mergedTopicsCache.set(key, {
      audienceKey: key,
      result,
      timestamp: Date.now(),
      ttl: this.TOPIC_TTL,
    });
    const topicCount = result.topics?.length || 0;
    console.log(
      `[TrendingCache] Cached ${topicCount} merged topics for audiences: ${key} (total entries: ${this.mergedTopicsCache.size})`
    );
  }

  /**
   * Find the oldest merged entry for eviction
   */
  private findOldestMergedEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.mergedTopicsCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  // ===== Clear Methods =====

  /**
   * Clear source cache for specific audience selection, or all if no IDs provided
   */
  clear(audienceIds?: string[]): void {
    if (audienceIds) {
      const key = this.getCacheKey(audienceIds);
      this.sourceCache.delete(key);
      console.log(`[TrendingCache] Cleared source cache for audiences: ${key}`);
    } else {
      this.sourceCache.clear();
      console.log('[TrendingCache] Cleared all source cache entries');
    }
  }

  /**
   * Clear per-audience topic cache
   */
  clearPerAudienceTopics(audienceId?: string): void {
    if (audienceId) {
      this.perAudienceTopicCache.delete(audienceId);
      console.log(`[TrendingCache] Cleared per-audience topics for: ${audienceId}`);
    } else {
      this.perAudienceTopicCache.clear();
      console.log('[TrendingCache] Cleared all per-audience topic entries');
    }
  }

  /**
   * Clear merged topics cache
   */
  clearMergedTopics(audienceIds?: string[]): void {
    if (audienceIds) {
      const key = this.getCacheKey(audienceIds);
      this.mergedTopicsCache.delete(key);
      console.log(`[TrendingCache] Cleared merged topics for audiences: ${key}`);
    } else {
      this.mergedTopicsCache.clear();
      console.log('[TrendingCache] Cleared all merged topic entries');
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.sourceCache.clear();
    this.perAudienceTopicCache.clear();
    this.mergedTopicsCache.clear();
    console.log('[TrendingCache] Cleared all cache entries across all cache types');
  }

  /**
   * Get metadata for specific audience source cache entry
   */
  getMetadata(audienceIds: string[] = []): {
    cachedAt: string;
    ttl: number;
    count: number;
    audienceKey: string;
  } | null {
    const key = this.getCacheKey(audienceIds);
    const entry = this.sourceCache.get(key);

    if (!entry) return null;

    return {
      cachedAt: new Date(entry.timestamp).toISOString(),
      ttl: entry.ttl,
      count: entry.data.length,
      audienceKey: key,
    };
  }

  /**
   * Get comprehensive stats about all cache entries
   */
  getStats(): {
    sources: {
      totalEntries: number;
      totalSources: number;
      entries: { key: string; count: number; ageMinutes: number }[];
    };
    perAudienceTopics: {
      totalEntries: number;
      totalTopics: number;
      entries: { audienceId: string; count: number; ageMinutes: number }[];
    };
    mergedTopics: {
      totalEntries: number;
      totalTopics: number;
      entries: { key: string; count: number; ageMinutes: number }[];
    };
  } {
    const now = Date.now();

    // Source cache stats
    const sourceEntries = Array.from(this.sourceCache.entries()).map(([key, entry]) => ({
      key,
      count: entry.data.length,
      ageMinutes: Math.round((now - entry.timestamp) / 60000),
    }));

    // Per-audience topic cache stats
    const perAudienceEntries = Array.from(this.perAudienceTopicCache.entries()).map(([audienceId, entry]) => ({
      audienceId,
      count: entry.result.topics.length,
      ageMinutes: Math.round((now - entry.timestamp) / 60000),
    }));

    // Merged topics cache stats
    const mergedEntries = Array.from(this.mergedTopicsCache.entries()).map(([key, entry]) => ({
      key,
      count: entry.result.topics?.length || 0,
      ageMinutes: Math.round((now - entry.timestamp) / 60000),
    }));

    return {
      sources: {
        totalEntries: this.sourceCache.size,
        totalSources: sourceEntries.reduce((sum, e) => sum + e.count, 0),
        entries: sourceEntries,
      },
      perAudienceTopics: {
        totalEntries: this.perAudienceTopicCache.size,
        totalTopics: perAudienceEntries.reduce((sum, e) => sum + e.count, 0),
        entries: perAudienceEntries,
      },
      mergedTopics: {
        totalEntries: this.mergedTopicsCache.size,
        totalTopics: mergedEntries.reduce((sum, e) => sum + e.count, 0),
        entries: mergedEntries,
      },
    };
  }
}

export const trendingCache = new TrendingCache();
