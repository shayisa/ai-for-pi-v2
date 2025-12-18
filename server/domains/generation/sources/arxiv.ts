/**
 * ArXiv Source Fetcher
 *
 * Fetches recent AI/ML research papers from ArXiv.
 *
 * @module domains/generation/sources/arxiv
 *
 * ## Original Location
 * - server.ts lines 198-248
 *
 * ## PRESERVATION NOTE
 * Do NOT modify the category filters or date range logic.
 * The 60-day window ensures fresh academic content.
 */

import type { TrendingSource } from './types';

/**
 * Fetch trending AI/ML papers from ArXiv
 *
 * Queries multiple relevant categories covering forensic anthropology,
 * archaeology, business automation, and analytics applications.
 *
 * Categories queried:
 * - cs.AI: Artificial Intelligence
 * - stat.ML: Machine Learning (Statistics)
 * - cs.LG: Machine Learning (CS)
 * - cs.CV: Computer Vision
 * - q-bio: Quantitative Biology
 *
 * Time window: Last 60 days
 *
 * @returns Array of recent AI/ML papers
 *
 * API endpoint: https://export.arxiv.org/api/query
 */
export const fetchArxivTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from ArXiv...");

    // Calculate dynamic date range: last 60 days
    const today = new Date();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startDate = sixtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '') + '0000';
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '') + '2359';

    // Query multiple relevant categories: AI, ML, Learning, Computer Vision, Quantitative Biology
    // These cover forensic anthropology, archaeology, business automation, and analytics applications
    const categories = 'cat:cs.AI+OR+cat:stat.ML+OR+cat:cs.LG+OR+cat:cs.CV+OR+cat:q-bio';
    const query = `${categories}+AND+submittedDate:[${startDate}+TO+${endDate}]`;

    const response = await fetch(
      `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=30&sortBy=submittedDate&sortOrder=descending`
    );
    const xmlText = await response.text();

    const papers: TrendingSource[] = [];
    const titleMatches = xmlText.match(/<title[^>]*>[^<]+<\/title>/g) || [];
    const linkMatches = xmlText.match(/<link[^>]*href="([^"]*)"/g) || [];
    const authorMatches = xmlText.match(/<name>([^<]+)<\/name>/g) || [];
    const publishedMatches = xmlText.match(/<published>([^<]+)<\/published>/g) || [];

    for (let i = 1; i < Math.min(titleMatches.length, 16); i++) {
      const title = titleMatches[i].replace(/<[^>]*>/g, '').trim();
      const link = linkMatches[i * 2]?.match(/href="([^"]*)/)?.[1] || '';
      const author = authorMatches[i * 2]?.replace(/<[^>]*>/g, '').trim() || 'ArXiv Author';
      const date = publishedMatches[i]?.replace(/<[^>]*>/g, '').trim().split('T')[0] || '';

      if (title && link) {
        papers.push({
          id: `arxiv-${i}`,
          title,
          url: link,
          author,
          publication: 'ArXiv',
          date,
          category: 'arxiv',
          summary: 'AI/ML Research Paper (last 60 days)',
        });
      }
    }
    console.log(`Fetched ${papers.length} ArXiv papers from last 60 days`);
    return papers;
  } catch (error) {
    console.error('Error fetching ArXiv topics:', error);
    return [];
  }
};
