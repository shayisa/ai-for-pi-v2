/**
 * Dev.to Source Fetcher
 *
 * Fetches trending AI articles from Dev.to.
 *
 * @module domains/generation/sources/devto
 *
 * ## Original Location
 * - server.ts lines 353-378
 *
 * ## PRESERVATION NOTE
 * Do NOT modify the tag filter or article count.
 */

import type { TrendingSource } from './types';

/**
 * Fetch trending AI articles from Dev.to
 *
 * Fetches top AI-tagged articles from the past week.
 * Returns up to 8 articles.
 *
 * @returns Array of trending Dev.to articles
 *
 * API endpoint: https://dev.to/api/articles
 */
export const fetchDevToTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from Dev.to...");
    const response = await fetch('https://dev.to/api/articles?tag=ai&top=7');
    const articles = await response.json();

    const posts: TrendingSource[] = [];
    if (Array.isArray(articles)) {
      for (const article of articles.slice(0, 8)) {
        posts.push({
          id: `devto-${article.id}`,
          title: article.title,
          url: article.url,
          author: article.user.name,
          publication: 'Dev.to',
          date: new Date(article.published_at).toLocaleDateString(),
          category: 'dev',
          summary: article.description || '',
        });
      }
    }
    return posts;
  } catch (error) {
    console.error('Error fetching Dev.to topics:', error);
    return [];
  }
};
