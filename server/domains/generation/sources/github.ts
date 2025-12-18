/**
 * GitHub Source Fetcher
 *
 * Fetches trending AI/ML repositories from GitHub.
 *
 * @module domains/generation/sources/github
 *
 * ## Original Location
 * - server.ts lines 251-290
 *
 * ## PRESERVATION NOTE
 * Do NOT modify the search query or star threshold.
 * The query is optimized for finding emerging AI tools.
 */

import type { TrendingSource } from './types';

/**
 * Fetch trending AI/ML repositories from GitHub
 *
 * Searches for recently created or updated AI/ML repositories
 * with significant star counts.
 *
 * Search criteria:
 * - Keywords: ai, ml, machine learning, automation, llm, neural
 * - Language: Python (primary AI/ML language)
 * - Stars: >1000 (ensures quality)
 * - Timeframe: Created or pushed in last 60 days
 *
 * @returns Array of trending AI/ML repositories
 *
 * API endpoint: https://api.github.com/search/repositories
 */
export const fetchGitHubTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from GitHub...");

    // Calculate dynamic date range: last 2 months
    const today = new Date();
    const twoMonthsAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const dateStr = twoMonthsAgo.toISOString().slice(0, 10);

    // Search for AI/ML tools with lower star threshold to catch emerging tools
    // Include multiple popular languages for AI tools (Python, JavaScript, R, Go, Rust)
    // Search for repos either created recently OR updated recently
    const query = `(ai+OR+ml+OR+"machine learning"+OR+automation+OR+llm+OR+neural)+language:python+stars:>1000+(created:>${dateStr}+OR+pushed:>${dateStr})`;

    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=25`
    );
    const data = await response.json();

    const repos: TrendingSource[] = [];
    if (data.items) {
      for (const repo of data.items.slice(0, 15)) {
        repos.push({
          id: `github-${repo.id}`,
          title: `${repo.name} - ${repo.description || 'An AI/ML project'}`,
          url: repo.html_url,
          author: repo.owner.login,
          publication: 'GitHub',
          date: new Date(repo.pushed_at || repo.created_at).toLocaleDateString(),
          category: 'github',
          summary: repo.description || 'Open-source AI/ML tool',
        });
      }
    }
    console.log(`Fetched ${repos.length} GitHub repos from last 2 months`);
    return repos;
  } catch (error) {
    console.error('Error fetching GitHub topics:', error);
    return [];
  }
};
