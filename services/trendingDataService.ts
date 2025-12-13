/**
 * Trending Data Service
 * Fetches real trending topics from multiple free APIs
 * Provides sources with titles, URLs, authors, and publication info
 */

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface TrendingSource {
    id: string;
    title: string;
    url: string;
    author?: string;
    publication?: string;
    date?: string;
    category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
    summary?: string;
}

// Fetch top stories from HackerNews (free, no auth needed)
const fetchHackerNewsTopics = async (): Promise<TrendingSource[]> => {
    try {
        console.log("Fetching from HackerNews...");
        // Get top story IDs
        const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const storyIds = (await topStoriesRes.json()).slice(0, 10);

        // Fetch story details
        const stories: TrendingSource[] = [];
        for (const id of storyIds) {
            try {
                const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                const story = await storyRes.json();
                if (story && story.title && story.url) {
                    stories.push({
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
        return stories;
    } catch (error) {
        console.error('Error fetching HackerNews topics:', error);
        return [];
    }
};

// Fetch latest AI/ML papers from ArXiv (free, no auth needed)
const fetchArxivTopics = async (): Promise<TrendingSource[]> => {
    try {
        console.log("Fetching from ArXiv...");
        // ArXiv doesn't have direct REST API, but we can use the public interface
        const response = await fetch(
            'http://export.arxiv.org/api/query?search_query=cat:cs.AI+AND+submittedDate:[202401010000+TO+202412312359]&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending'
        );
        const xmlText = await response.text();

        // Parse simple XML (ArXiv returns Atom XML)
        const papers: TrendingSource[] = [];
        const titleMatches = xmlText.match(/<title[^>]*>[^<]+<\/title>/g) || [];
        const linkMatches = xmlText.match(/<link[^>]*href="([^"]*)"[^>]*\/>/g) || [];
        const authorMatches = xmlText.match(/<name>([^<]+)<\/name>/g) || [];
        const publishedMatches = xmlText.match(/<published>([^<]+)<\/published>/g) || [];

        for (let i = 1; i < Math.min(titleMatches.length, 6); i++) {
            const title = titleMatches[i].replace(/<[^>]*>/g, '').trim();
            const link = linkMatches[i * 2]?.match(/href="([^"]*)"/)?.at(1) || '';
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
                    summary: 'AI/ML Research Paper',
                });
            }
        }
        return papers;
    } catch (error) {
        console.error('Error fetching ArXiv topics:', error);
        return [];
    }
};

// Fetch trending repositories from GitHub (free, no auth needed)
const fetchGitHubTopics = async (): Promise<TrendingSource[]> => {
    try {
        console.log("Fetching from GitHub Trending...");
        // GitHub doesn't have official API for trending, but we can use a proxy
        const response = await fetch('https://api.github.com/search/repositories?q=language:python+stars:>10000+created:>2024-01-01&sort=stars&order=desc&per_page=10');
        const data = await response.json();

        const repos: TrendingSource[] = [];
        if (data.items) {
            for (const repo of data.items.slice(0, 8)) {
                repos.push({
                    id: `github-${repo.id}`,
                    title: `${repo.name} - ${repo.description || 'A Python project'}`,
                    url: repo.html_url,
                    author: repo.owner.login,
                    publication: 'GitHub',
                    date: new Date(repo.created_at).toLocaleDateString(),
                    category: 'github',
                    summary: repo.description || '',
                });
            }
        }
        return repos;
    } catch (error) {
        console.error('Error fetching GitHub topics:', error);
        return [];
    }
};

// Fetch trending discussions from Reddit (free, no auth needed for public data)
const fetchRedditTopics = async (): Promise<TrendingSource[]> => {
    try {
        console.log("Fetching from Reddit...");
        const response = await fetch('https://www.reddit.com/r/MachineLearning/top.json?t=week&limit=10', {
            headers: { 'User-Agent': 'AI-Newsletter-App/1.0' }
        });
        const data = await response.json();

        const posts: TrendingSource[] = [];
        if (data.data && data.data.children) {
            for (const post of data.data.children.slice(0, 8)) {
                const p = post.data;
                posts.push({
                    id: `reddit-${p.id}`,
                    title: p.title,
                    url: p.url.startsWith('http') ? p.url : `https://reddit.com${p.permalink}`,
                    author: p.author,
                    publication: `r/${p.subreddit}`,
                    date: new Date(p.created_utc * 1000).toLocaleDateString(),
                    category: 'reddit',
                    summary: `${p.ups} upvotes`,
                });
            }
        }
        return posts;
    } catch (error) {
        console.error('Error fetching Reddit topics:', error);
        return [];
    }
};

// Fetch trending articles from Dev.to (free, no auth needed)
const fetchDevToTopics = async (): Promise<TrendingSource[]> => {
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

/**
 * Fetch all trending topics from backend (which fetches from multiple sources)
 * Returns mixed array of sources for Claude to analyze
 */
export const fetchAllTrendingSources = async (): Promise<TrendingSource[]> => {
    console.log("Fetching trending data from backend...");

    try {
        const endpoint = `${API_BASE_URL}/api/fetchTrendingSources`;
        console.log(`Calling endpoint: ${endpoint}`);
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Backend API error: ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`Fetched ${data.sources.length} trending sources from backend`);
        return data.sources || [];
    } catch (error) {
        console.error('Error fetching trending sources from backend:', error);
        return [];
    }
};

/**
 * Filter sources by category/audience relevance
 */
export const filterSourcesByAudience = (sources: TrendingSource[], audience: string[]): TrendingSource[] => {
    // Map audiences to preferred categories
    const audiencePreferences: Record<string, string[]> = {
        academics: ['arxiv', 'github', 'dev'],
        business: ['hackernews', 'reddit', 'dev'],
        analysts: ['hackernews', 'reddit', 'github', 'dev'],
    };

    let preferredCategories: string[] = [];
    for (const aud of audience) {
        preferredCategories = [...preferredCategories, ...(audiencePreferences[aud] || [])];
    }

    if (preferredCategories.length === 0) {
        return sources; // Return all if no preference
    }

    // Shuffle and filter to get variety
    const filtered = sources.filter(s => preferredCategories.includes(s.category));
    return filtered.sort(() => Math.random() - 0.5).slice(0, 12);
};
