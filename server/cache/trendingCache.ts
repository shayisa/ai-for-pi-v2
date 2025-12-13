/**
 * Trending Data Cache (Server-side)
 *
 * Caches trending sources to reduce external API calls from 67+ to 1 per hour.
 */

interface TrendingSource {
  id: string;
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev' | 'producthunt';
  summary?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class TrendingCache {
  private cache: CacheEntry<TrendingSource[]> | null = null;
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

  get(): TrendingSource[] | null {
    if (!this.cache) return null;

    const now = Date.now();
    if (now - this.cache.timestamp > this.cache.ttl) {
      console.log('[TrendingCache] Cache expired');
      this.cache = null;
      return null;
    }

    const ageMinutes = Math.round((now - this.cache.timestamp) / 60000);
    console.log(`[TrendingCache] Cache hit - ${this.cache.data.length} sources, ${ageMinutes}m old`);
    return this.cache.data;
  }

  set(data: TrendingSource[], ttl: number = this.DEFAULT_TTL): void {
    this.cache = { data, timestamp: Date.now(), ttl };
    console.log(`[TrendingCache] Cached ${data.length} sources`);
  }

  clear(): void {
    this.cache = null;
  }

  getMetadata(): { cachedAt: string; ttl: number; count: number } | null {
    if (!this.cache) return null;
    return {
      cachedAt: new Date(this.cache.timestamp).toISOString(),
      ttl: this.cache.ttl,
      count: this.cache.data.length,
    };
  }
}

export const trendingCache = new TrendingCache();
