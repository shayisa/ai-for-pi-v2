/**
 * Web Search Results Cache
 *
 * Caches web search results to avoid redundant API calls during agentic loops.
 * Similar queries within the same session will reuse cached results.
 */

interface SearchCacheEntry {
  result: string;
  timestamp: number;
}

/**
 * In-memory cache for web search results
 * TTL: 15 minutes (search results should be reasonably fresh)
 */
class SearchCache {
  private cache = new Map<string, SearchCacheEntry>();
  private readonly TTL = 15 * 60 * 1000; // 15 minutes in ms
  private readonly MAX_ENTRIES = 100; // Prevent memory bloat

  /**
   * Normalize query for consistent cache keys
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Get cached search result if still valid
   */
  get(query: string): string | null {
    const key = this.normalizeQuery(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > this.TTL;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[SearchCache] Cache hit for query: "${query.substring(0, 50)}..."`);
    return entry.result;
  }

  /**
   * Store search result in cache
   */
  set(query: string, result: string): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.normalizeQuery(query);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });

    console.log(`[SearchCache] Cached result for query: "${query.substring(0, 50)}..."`);
  }

  /**
   * Clear all cached search results
   */
  clear(): void {
    this.cache.clear();
    console.log('[SearchCache] Cache cleared');
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { entries: number; maxEntries: number } {
    return {
      entries: this.cache.size,
      maxEntries: this.MAX_ENTRIES,
    };
  }
}

// Singleton instance
export const searchCache = new SearchCache();
