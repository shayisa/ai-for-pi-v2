/**
 * HackerNews Source Fetcher
 *
 * Fetches trending AI-related stories from HackerNews.
 *
 * @module domains/generation/sources/hackerNews
 *
 * ## Original Location
 * - server.ts lines 156-195
 *
 * ## PRESERVATION NOTE
 * Do NOT modify the AI keyword filter regex or story count.
 */

import type { TrendingSource } from './types';

/**
 * AI/ML keywords filter
 *
 * Used to identify AI-related stories from the general HN feed.
 */
const aiKeywords = /\b(ai|ml|machine learning|neural|deep learning|llm|language model|gpt|claude|automation|robotics|computer vision|nlp|transformer|diffusion|agent|agent|api|tool)\b/i;

/**
 * Fetch trending AI topics from HackerNews
 *
 * Fetches top 50 stories, filters for AI-related content,
 * and returns the top 12 AI-related stories.
 *
 * @returns Array of trending AI stories from HackerNews
 *
 * API endpoints:
 * - https://hacker-news.firebaseio.com/v0/topstories.json
 * - https://hacker-news.firebaseio.com/v0/item/{id}.json
 */
export const fetchHackerNewsTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from HackerNews...");
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const storyIds = (await topStoriesRes.json()).slice(0, 50); // Fetch more to filter

    const allStories: TrendingSource[] = [];
    for (const id of storyIds) {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = await storyRes.json();
        if (story && story.title && story.url) {
          allStories.push({
            id: `hn-${id}`,
            title: story.title,
            url: story.url,
            author: story.by,
            publication: 'HackerNews',
            date: new Date(story.time * 1000).toLocaleDateString(),
            category: 'hackernews',
          });
        }
      } catch (e) {
        console.error(`Error fetching HackerNews story ${id}:`, e);
      }
    }

    // Filter for AI-related stories only
    const aiStories = allStories.filter(story => aiKeywords.test(story.title));
    console.log(`Fetched ${aiStories.length} AI-related stories from HackerNews`);

    // Return top 12 AI-related stories
    return aiStories.slice(0, 12);
  } catch (error) {
    console.error('Error fetching HackerNews topics:', error);
    return [];
  }
};
