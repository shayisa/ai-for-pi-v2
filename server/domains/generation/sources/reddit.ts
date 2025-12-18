/**
 * Reddit Source Fetcher
 *
 * Fetches trending posts from AI/ML and domain-specific subreddits.
 *
 * @module domains/generation/sources/reddit
 *
 * ## Original Location
 * - server.ts lines 293-350
 *
 * ## PRESERVATION NOTE
 * Do NOT modify the subreddit list without explicit approval.
 * These subreddits cover all 4 professional domains.
 */

import type { TrendingSource } from './types';

/**
 * Subreddits covering all 4 professional domains
 *
 * Categories:
 * - AI/ML/Automation core (high signal)
 * - Forensic Anthropology & Archaeology
 * - Business Automation & Productivity
 * - Analytics & Data Science
 */
const subreddits = [
  // AI/ML/Automation core (high signal)
  'MachineLearning', 'artificial', 'programming',
  // Forensic Anthropology & Archaeology
  'forensics', 'archaeology', 'anthropology', 'biology', 'AskAnthropology', 'paleontology',
  // Business Automation & Productivity
  'BusinessIntelligence', 'automation', 'productmanagement', 'productivity',
  // Analytics & Data Science
  'analytics', 'datascience', 'statistics'
];

/**
 * Fetch trending posts from Reddit
 *
 * Fetches top posts from the past 2 months across all targeted subreddits.
 * Up to 15 posts per subreddit for balanced coverage.
 *
 * @returns Array of trending Reddit posts
 *
 * API endpoint: https://www.reddit.com/r/{subreddit}/top.json
 */
export const fetchRedditTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from Reddit...");

    const posts: TrendingSource[] = [];
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    for (const subreddit of subreddits) {
      try {
        // Fetch from past 2 months with higher limit to get 15-20 posts per subreddit
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=two_months&limit=25`, {
          headers: { 'User-Agent': userAgent }
        });
        const data = await response.json();

        if (data.data && data.data.children) {
          // Take up to 15 posts per subreddit for balanced coverage
          for (const post of data.data.children.slice(0, 15)) {
            const p = post.data;
            if (p.title && p.url) {
              posts.push({
                id: `reddit-${p.id}`,
                title: p.title,
                url: p.url.startsWith('http') ? p.url : `https://reddit.com${p.permalink}`,
                author: p.author || 'Reddit User',
                publication: `r/${p.subreddit}`,
                date: new Date(p.created_utc * 1000).toLocaleDateString(),
                category: 'reddit',
                summary: `${p.ups} upvotes`,
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Error fetching r/${subreddit}:`, error);
        // Continue with next subreddit on error
        continue;
      }
    }

    console.log(`Fetched ${posts.length} posts from ${subreddits.length} subreddits`);
    return posts;
  } catch (error) {
    console.error('Error fetching Reddit topics:', error);
    return [];
  }
};
