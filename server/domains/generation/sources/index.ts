/**
 * Trending Sources Module
 *
 * Aggregates all trending source fetchers.
 *
 * @module domains/generation/sources
 */
export { fetchHackerNewsTopics } from './hackerNews';
export { fetchArxivTopics } from './arxiv';
export { fetchGitHubTopics } from './github';
export { fetchRedditTopics } from './reddit';
export { fetchDevToTopics } from './devto';
export { fetchAllTrendingSources } from './aggregator';
export type { TrendingSource, TrendingSourceCategory } from './types';
