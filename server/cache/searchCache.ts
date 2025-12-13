/**
 * Web Search Results Cache (Server-side)
 *
 * Caches web search results to avoid redundant API calls during agentic loops.
 */

interface SearchCacheEntry {
  result: string;
  timestamp: number;
}

class SearchCache {
  private cache = new Map<string, SearchCacheEntry>();
  private readonly TTL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_ENTRIES = 100;

  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  get(query: string): string | null {
    const key = this.normalizeQuery(query);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[SearchCache] Cache hit for: "${query.substring(0, 40)}..."`);
    return entry.result;
  }

  set(query: string, result: string): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const key = this.normalizeQuery(query);
    this.cache.set(key, { result, timestamp: Date.now() });
    console.log(`[SearchCache] Cached: "${query.substring(0, 40)}..."`);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { entries: number; maxEntries: number } {
    return { entries: this.cache.size, maxEntries: this.MAX_ENTRIES };
  }
}

export const searchCache = new SearchCache();
