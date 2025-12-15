/**
 * Source Fetching Service
 *
 * Fetches content from multiple sources for newsletter generation:
 * - GDELT (news)
 * - ArXiv (academic papers)
 * - HackerNews (tech news)
 * - Reddit (community discussions)
 * - GitHub (trending repos)
 * - Dev.to (developer articles)
 */

export interface SourceArticle {
  title: string;
  url: string;
  source: 'gdelt' | 'arxiv' | 'hackernews' | 'reddit' | 'github' | 'devto';
  date?: string;
  snippet?: string;
  author?: string;
}

export interface FetchSourcesOptions {
  keywords?: string[];
  subreddits?: string[];
  arxivCategories?: string[];
  limit?: number;
}

export interface FetchSourcesResult {
  articles: SourceArticle[];
  sources: {
    gdelt: { status: 'success' | 'failed'; count: number; error?: string };
    arxiv: { status: 'success' | 'failed'; count: number; error?: string };
    hackernews: { status: 'success' | 'failed'; count: number; error?: string };
    reddit: { status: 'success' | 'failed'; count: number; error?: string };
    github: { status: 'success' | 'failed'; count: number; error?: string };
    devto: { status: 'success' | 'failed'; count: number; error?: string };
  };
  totalCount: number;
  fetchTimeMs: number;
}

/**
 * Fetch news articles from GDELT
 */
async function fetchGDELT(
  keywords: string[],
  limit: number = 10
): Promise<{ articles: SourceArticle[]; error?: string }> {
  try {
    // GDELT requires quoted phrases for multi-word queries
    const query = keywords
      .slice(0, 3)
      .map((k) => (k.includes(' ') ? `"${k}"` : k))
      .join(' OR ');

    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodedQuery}&mode=ArtList&format=json&maxrecords=${limit}&timespan=7d`;

    const response = await fetch(url);
    const text = await response.text();

    // GDELT returns HTML error pages sometimes
    if (!text.startsWith('{')) {
      return { articles: [], error: 'GDELT returned non-JSON response' };
    }

    const data = JSON.parse(text);
    const gdeltArticles = data.articles || [];

    const articles: SourceArticle[] = gdeltArticles.slice(0, limit).map(
      (article: { title?: string; url: string; seendate?: string; domain?: string }) => ({
        title: article.title || 'Untitled',
        url: article.url,
        source: 'gdelt' as const,
        date: article.seendate,
        snippet: article.domain,
      })
    );

    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch academic papers from ArXiv
 */
async function fetchArXiv(
  categories: string[] = ['cs.AI'],
  limit: number = 10
): Promise<{ articles: SourceArticle[]; error?: string }> {
  try {
    const categoryQuery = categories.join('+OR+');
    const url = `http://export.arxiv.org/api/query?search_query=cat:${categoryQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;

    const response = await fetch(url);
    const xml = await response.text();

    // Simple XML parsing for entries
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    const articles: SourceArticle[] = [];

    for (const entry of entries.slice(0, limit)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const authorMatch = entry.match(/<name>([\s\S]*?)<\/name>/);
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);

      if (titleMatch && idMatch) {
        articles.push({
          title: titleMatch[1].replace(/\s+/g, ' ').trim(),
          url: idMatch[1].trim(),
          source: 'arxiv',
          snippet: summaryMatch?.[1]?.replace(/\s+/g, ' ').trim().substring(0, 300),
          author: authorMatch?.[1]?.trim(),
          date: publishedMatch?.[1]?.trim(),
        });
      }
    }

    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch top stories from HackerNews
 */
async function fetchHackerNews(
  limit: number = 10
): Promise<{ articles: SourceArticle[]; error?: string }> {
  try {
    const topStoriesUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const response = await fetch(topStoriesUrl);
    const storyIds = (await response.json()) as number[];

    const articles: SourceArticle[] = [];

    for (const storyId of storyIds.slice(0, limit * 2)) {
      if (articles.length >= limit) break;

      try {
        const storyUrl = `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`;
        const storyResponse = await fetch(storyUrl);
        const story = (await storyResponse.json()) as {
          title?: string;
          url?: string;
          time?: number;
          by?: string;
        };

        // Only include stories with external URLs
        if (story.url && story.title) {
          articles.push({
            title: story.title,
            url: story.url,
            source: 'hackernews',
            date: story.time ? new Date(story.time * 1000).toISOString() : undefined,
            author: story.by,
          });
        }
      } catch {
        // Skip failed story fetches
      }
    }

    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch posts from Reddit subreddits
 */
async function fetchReddit(
  subreddits: string[] = ['MachineLearning'],
  limit: number = 10
): Promise<{ articles: SourceArticle[]; error?: string }> {
  try {
    const articles: SourceArticle[] = [];

    for (const subreddit of subreddits.slice(0, 3)) {
      if (articles.length >= limit) break;

      try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${Math.ceil(limit / subreddits.length)}`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'AI-Newsletter/1.0' },
        });

        const data = (await response.json()) as {
          data?: {
            children?: Array<{
              data: {
                title: string;
                url: string;
                created_utc: number;
                author: string;
                selftext?: string;
              };
            }>;
          };
        };

        const posts = data.data?.children || [];

        for (const post of posts) {
          // Only include posts with external URLs (not reddit.com)
          if (post.data.url && !post.data.url.includes('reddit.com')) {
            articles.push({
              title: post.data.title,
              url: post.data.url,
              source: 'reddit',
              date: new Date(post.data.created_utc * 1000).toISOString(),
              author: post.data.author,
              snippet: post.data.selftext?.substring(0, 200),
            });
          }
        }
      } catch {
        // Skip failed subreddit fetches
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { articles: articles.slice(0, limit) };
  } catch (error) {
    return {
      articles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch trending repositories from GitHub
 */
async function fetchGitHub(
  limit: number = 5
): Promise<{ articles: SourceArticle[]; error?: string }> {
  try {
    // Search for recently created repos with AI/ML topics
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const url = `https://api.github.com/search/repositories?q=topic:machine-learning+created:>${oneWeekAgo}&sort=stars&order=desc&per_page=${limit}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Newsletter/1.0',
      },
    });

    const data = (await response.json()) as {
      items?: Array<{
        full_name: string;
        html_url: string;
        description?: string;
        owner?: { login: string };
        created_at?: string;
      }>;
    };

    const repos = data.items || [];

    const articles: SourceArticle[] = repos.slice(0, limit).map((repo) => ({
      title: repo.full_name,
      url: repo.html_url,
      source: 'github' as const,
      snippet: repo.description?.substring(0, 200),
      author: repo.owner?.login,
      date: repo.created_at,
    }));

    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch articles from Dev.to
 */
async function fetchDevTo(
  limit: number = 5
): Promise<{ articles: SourceArticle[]; error?: string }> {
  try {
    const url = `https://dev.to/api/articles?tag=ai&per_page=${limit}&top=7`;

    const response = await fetch(url);
    const data = (await response.json()) as Array<{
      title: string;
      url: string;
      description?: string;
      user?: { username: string };
      published_at?: string;
    }>;

    const articles: SourceArticle[] = data.slice(0, limit).map((article) => ({
      title: article.title,
      url: article.url,
      source: 'devto' as const,
      snippet: article.description?.substring(0, 200),
      author: article.user?.username,
      date: article.published_at,
    }));

    return { articles };
  } catch (error) {
    return {
      articles: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch content from all sources in parallel
 */
export async function fetchAllSources(
  options: FetchSourcesOptions = {}
): Promise<FetchSourcesResult> {
  const startTime = Date.now();
  const {
    keywords = ['artificial intelligence', 'machine learning'],
    subreddits = ['MachineLearning', 'artificial'],
    arxivCategories = ['cs.AI', 'cs.LG'],
    limit = 5,
  } = options;

  // Fetch from all sources in parallel
  const [gdeltResult, arxivResult, hnResult, redditResult, githubResult, devtoResult] =
    await Promise.all([
      fetchGDELT(keywords, limit),
      fetchArXiv(arxivCategories, limit),
      fetchHackerNews(limit),
      fetchReddit(subreddits, limit),
      fetchGitHub(limit),
      fetchDevTo(limit),
    ]);

  // Combine all articles
  const allArticles: SourceArticle[] = [
    ...gdeltResult.articles,
    ...arxivResult.articles,
    ...hnResult.articles,
    ...redditResult.articles,
    ...githubResult.articles,
    ...devtoResult.articles,
  ];

  const result: FetchSourcesResult = {
    articles: allArticles,
    sources: {
      gdelt: {
        status: gdeltResult.error ? 'failed' : 'success',
        count: gdeltResult.articles.length,
        error: gdeltResult.error,
      },
      arxiv: {
        status: arxivResult.error ? 'failed' : 'success',
        count: arxivResult.articles.length,
        error: arxivResult.error,
      },
      hackernews: {
        status: hnResult.error ? 'failed' : 'success',
        count: hnResult.articles.length,
        error: hnResult.error,
      },
      reddit: {
        status: redditResult.error ? 'failed' : 'success',
        count: redditResult.articles.length,
        error: redditResult.error,
      },
      github: {
        status: githubResult.error ? 'failed' : 'success',
        count: githubResult.articles.length,
        error: githubResult.error,
      },
      devto: {
        status: devtoResult.error ? 'failed' : 'success',
        count: devtoResult.articles.length,
        error: devtoResult.error,
      },
    },
    totalCount: allArticles.length,
    fetchTimeMs: Date.now() - startTime,
  };

  console.log(
    `[SourceFetching] Fetched ${result.totalCount} articles in ${result.fetchTimeMs}ms`
  );

  return result;
}

export default {
  fetchAllSources,
  fetchGDELT,
  fetchArXiv,
  fetchHackerNews,
  fetchReddit,
  fetchGitHub,
  fetchDevTo,
};
