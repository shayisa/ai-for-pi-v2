/**
 * Trending Sources Aggregator
 *
 * Orchestrates parallel fetching from all trending sources.
 *
 * @module domains/generation/sources/aggregator
 *
 * ## Original Location
 * - server.ts lines 383-413
 *
 * ## PRESERVATION NOTE
 * Do NOT modify the source list or parallel fetching logic.
 */

import type { TrendingSource } from './types';
import { fetchHackerNewsTopics } from './hackerNews';
import { fetchArxivTopics } from './arxiv';
import { fetchGitHubTopics } from './github';
import { fetchRedditTopics } from './reddit';
import { fetchDevToTopics } from './devto';

/**
 * Fetch all trending sources in parallel
 *
 * Aggregates content from 5 real sources:
 * - HackerNews: AI-related tech news
 * - ArXiv: Academic AI/ML papers
 * - GitHub: Trending AI/ML repositories
 * - Reddit: Domain-specific discussions
 * - Dev.to: Developer AI articles
 *
 * NOTE: Product Hunt was removed - it was 100% mock data.
 * Will add real API integration in future.
 *
 * @returns Combined array of trending sources from all platforms
 *
 * @example
 * const sources = await fetchAllTrendingSources();
 * console.log(`Fetched ${sources.length} total sources`);
 */
export const fetchAllTrendingSources = async (): Promise<TrendingSource[]> => {
  console.log("Fetching trending data from all REAL sources...");
  try {
    const [
      hackerNewsTopics,
      arxivTopics,
      githubTopics,
      redditTopics,
      devtoTopics,
    ] = await Promise.all([
      fetchHackerNewsTopics(),
      fetchArxivTopics(),
      fetchGitHubTopics(),
      fetchRedditTopics(),
      fetchDevToTopics(),
    ]);

    const allSources = [
      ...hackerNewsTopics,
      ...arxivTopics,
      ...githubTopics,
      ...redditTopics,
      ...devtoTopics,
    ];

    console.log(`Fetched ${allSources.length} trending sources from 5 REAL sources (HN, ArXiv, GitHub, Reddit, Dev.to)`);
    return allSources;
  } catch (error) {
    console.error('Error fetching trending sources:', error);
    return [];
  }
};
