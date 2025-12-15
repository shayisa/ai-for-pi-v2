/**
 * POC 2: Source Fetching
 *
 * Tests all source APIs to verify they work and return expected data:
 * - GDELT (NEW - unlimited, no full text)
 * - NewsData.io (NEW - 200 credits/day free)
 * - Semantic Scholar (NEW - academic papers)
 * - ArXiv (existing)
 * - Reddit (existing)
 * - HackerNews (existing)
 * - GitHub (existing)
 * - Dev.to (existing)
 *
 * Run: npx ts-node poc/2-source-fetching.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Types
interface SourceResult {
  source: string;
  status: 'success' | 'failed';
  articles_returned: number;
  sample?: {
    title: string;
    url: string;
    date?: string;
    author?: string;
  };
  has_full_text: boolean;
  rate_limit_info: string;
  time_ms: number;
  error?: string;
}

interface Article {
  id: string;
  title: string;
  url: string;
  author?: string;
  date?: string;
  source: string;
  summary?: string;
}

// Test query for all sources
const TEST_QUERY = 'artificial intelligence';
const TEST_KEYWORDS = ['AI', 'machine learning', 'automation'];

/**
 * GDELT DOC 2.0 API
 * Endpoint: https://api.gdeltproject.org/api/v2/doc/doc
 * Free, unlimited, no auth required
 * Returns article metadata (no full text)
 */
async function fetchGDELT(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[GDELT] Fetching...');

    // GDELT requires keywords with at least 3 characters
    // Use "artificial intelligence" as a phrase
    const query = encodeURIComponent('"artificial intelligence"');
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&format=json&maxrecords=25&timespan=7d`;

    const response = await fetch(url);
    const text = await response.text();

    // GDELT returns plain text error messages, not JSON
    if (!text.startsWith('{')) {
      throw new Error(`GDELT returned error: ${text.substring(0, 100)}`);
    }

    const data = JSON.parse(text);
    const articles: Article[] = [];

    if (data.articles && Array.isArray(data.articles)) {
      for (const article of data.articles.slice(0, 25)) {
        articles.push({
          id: `gdelt-${article.url?.substring(0, 50)}`,
          title: article.title || 'No title',
          url: article.url || '',
          author: article.sourcecountry || 'Unknown',
          date: article.seendate ? new Date(article.seendate).toLocaleDateString() : undefined,
          source: 'GDELT',
          summary: article.domain || '',
        });
      }
    }

    console.log(`[GDELT] Fetched ${articles.length} articles`);

    return {
      source: 'GDELT',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: false,
      rate_limit_info: 'Unlimited (no documented limits)',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[GDELT] Error:', error);
    return {
      source: 'GDELT',
      status: 'failed',
      articles_returned: 0,
      has_full_text: false,
      rate_limit_info: 'Unlimited',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * NewsData.io API
 * Endpoint: https://newsdata.io/api/1/news
 * Free tier: 200 credits/day (10 articles per credit = 2000 articles/day)
 * Requires API key
 */
async function fetchNewsDataIO(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[NewsData.io] Fetching...');

    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
      return {
        source: 'NewsData.io',
        status: 'failed',
        articles_returned: 0,
        has_full_text: false,
        rate_limit_info: '200 credits/day (2000 articles)',
        time_ms: Date.now() - startTime,
        error: 'NEWSDATA_API_KEY not set in .env.local',
      };
    }

    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=artificial%20intelligence&language=en`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const articles: Article[] = [];

    if (data.results && Array.isArray(data.results)) {
      for (const article of data.results.slice(0, 10)) {
        articles.push({
          id: `newsdata-${article.article_id}`,
          title: article.title || 'No title',
          url: article.link || '',
          author: article.creator?.[0] || article.source_id || 'Unknown',
          date: article.pubDate ? new Date(article.pubDate).toLocaleDateString() : undefined,
          source: 'NewsData.io',
          summary: article.description || '',
        });
      }
    }

    console.log(`[NewsData.io] Fetched ${articles.length} articles`);

    return {
      source: 'NewsData.io',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: false, // Free tier doesn't include full text
      rate_limit_info: '200 credits/day (2000 articles, 12hr delay)',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[NewsData.io] Error:', error);
    return {
      source: 'NewsData.io',
      status: 'failed',
      articles_returned: 0,
      has_full_text: false,
      rate_limit_info: '200 credits/day',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Semantic Scholar API
 * Endpoint: https://api.semanticscholar.org/graph/v1/paper/search
 * Free: 5000 requests/5min (shared pool), or 1 RPS with API key
 */
async function fetchSemanticScholar(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[Semantic Scholar] Fetching...');

    // Add small delay to avoid rate limiting (shared pool)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Search for AI-related papers
    const query = encodeURIComponent('machine learning forensic');
    const fields = 'title,url,authors,year,abstract,citationCount';
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${query}&limit=10&fields=${fields}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Add API key if available (increases rate limit)
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const articles: Article[] = [];

    if (data.data && Array.isArray(data.data)) {
      for (const paper of data.data.slice(0, 15)) {
        articles.push({
          id: `s2-${paper.paperId}`,
          title: paper.title || 'No title',
          url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          author: paper.authors?.[0]?.name || 'Unknown',
          date: paper.year?.toString() || undefined,
          source: 'Semantic Scholar',
          summary: paper.abstract?.substring(0, 200) || `${paper.citationCount || 0} citations`,
        });
      }
    }

    console.log(`[Semantic Scholar] Fetched ${articles.length} papers`);

    return {
      source: 'Semantic Scholar',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: true, // Has abstracts
      rate_limit_info: apiKey ? '1 RPS with API key' : '5000 req/5min (shared pool)',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Semantic Scholar] Error:', error);
    return {
      source: 'Semantic Scholar',
      status: 'failed',
      articles_returned: 0,
      has_full_text: true,
      rate_limit_info: '5000 req/5min',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * ArXiv API (existing, verified working)
 */
async function fetchArXiv(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[ArXiv] Fetching...');

    const today = new Date();
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startDate = sixtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '') + '0000';
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '') + '2359';

    const categories = 'cat:cs.AI+OR+cat:stat.ML+OR+cat:cs.CV';
    const query = `${categories}+AND+submittedDate:[${startDate}+TO+${endDate}]`;

    const response = await fetch(
      `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending`
    );
    const xmlText = await response.text();

    const articles: Article[] = [];
    const titleMatches = xmlText.match(/<title[^>]*>[^<]+<\/title>/g) || [];
    const linkMatches = xmlText.match(/<link[^>]*href="([^"]*)"/g) || [];

    for (let i = 1; i < Math.min(titleMatches.length, 16); i++) {
      const title = titleMatches[i].replace(/<[^>]*>/g, '').trim();
      const link = linkMatches[i * 2]?.match(/href="([^"]*)/)?.[1] || '';

      if (title && link) {
        articles.push({
          id: `arxiv-${i}`,
          title,
          url: link,
          source: 'ArXiv',
        });
      }
    }

    console.log(`[ArXiv] Fetched ${articles.length} papers`);

    return {
      source: 'ArXiv',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
      } : undefined,
      has_full_text: true, // Has abstracts
      rate_limit_info: 'Unlimited (be respectful)',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[ArXiv] Error:', error);
    return {
      source: 'ArXiv',
      status: 'failed',
      articles_returned: 0,
      has_full_text: true,
      rate_limit_info: 'Unlimited',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reddit API (existing, verified working)
 */
async function fetchReddit(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[Reddit] Fetching...');

    const subreddits = ['MachineLearning', 'artificial', 'forensics'];
    const articles: Article[] = [];
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    for (const subreddit of subreddits) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=5`,
          { headers: { 'User-Agent': userAgent } }
        );
        const data = await response.json();

        if (data.data?.children) {
          for (const post of data.data.children.slice(0, 5)) {
            const p = post.data;
            if (p.title && p.url) {
              articles.push({
                id: `reddit-${p.id}`,
                title: p.title,
                url: p.url.startsWith('http') ? p.url : `https://reddit.com${p.permalink}`,
                author: p.author,
                date: new Date(p.created_utc * 1000).toLocaleDateString(),
                source: `r/${p.subreddit}`,
                summary: `${p.ups} upvotes`,
              });
            }
          }
        }
      } catch (e) {
        console.warn(`[Reddit] Error fetching r/${subreddit}:`, e);
      }
    }

    console.log(`[Reddit] Fetched ${articles.length} posts`);

    return {
      source: 'Reddit',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: false, // Just titles/links
      rate_limit_info: 'IP-based rate limiting',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Reddit] Error:', error);
    return {
      source: 'Reddit',
      status: 'failed',
      articles_returned: 0,
      has_full_text: false,
      rate_limit_info: 'IP-based',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * HackerNews API (existing, verified working)
 */
async function fetchHackerNews(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[HackerNews] Fetching...');

    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const storyIds = (await topStoriesRes.json()).slice(0, 20);

    const aiKeywords = /\b(ai|ml|machine learning|llm|gpt|claude|automation|neural)\b/i;
    const articles: Article[] = [];

    for (const id of storyIds) {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = await storyRes.json();
        if (story?.title && story?.url && aiKeywords.test(story.title)) {
          articles.push({
            id: `hn-${id}`,
            title: story.title,
            url: story.url,
            author: story.by,
            date: new Date(story.time * 1000).toLocaleDateString(),
            source: 'HackerNews',
          });
        }
      } catch (e) {
        // Continue on individual story errors
      }
    }

    console.log(`[HackerNews] Fetched ${articles.length} AI-related stories`);

    return {
      source: 'HackerNews',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: false,
      rate_limit_info: 'Unlimited',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[HackerNews] Error:', error);
    return {
      source: 'HackerNews',
      status: 'failed',
      articles_returned: 0,
      has_full_text: false,
      rate_limit_info: 'Unlimited',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * GitHub API (existing)
 */
async function fetchGitHub(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[GitHub] Fetching...');

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

    // Simpler query - search for AI repos updated in last 30 days
    const query = `artificial intelligence language:python stars:>50 pushed:>${dateStr}`;
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`
    );
    const data = await response.json();

    const articles: Article[] = [];
    if (data.items) {
      for (const repo of data.items.slice(0, 10)) {
        articles.push({
          id: `github-${repo.id}`,
          title: `${repo.name} - ${repo.description || 'AI/ML project'}`,
          url: repo.html_url,
          author: repo.owner.login,
          date: new Date(repo.pushed_at).toLocaleDateString(),
          source: 'GitHub',
          summary: `${repo.stargazers_count} stars`,
        });
      }
    }

    console.log(`[GitHub] Fetched ${articles.length} repos`);

    return {
      source: 'GitHub',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: false,
      rate_limit_info: '60 req/hour unauthenticated',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[GitHub] Error:', error);
    return {
      source: 'GitHub',
      status: 'failed',
      articles_returned: 0,
      has_full_text: false,
      rate_limit_info: '60 req/hour',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Dev.to API (existing)
 */
async function fetchDevTo(): Promise<SourceResult> {
  const startTime = Date.now();
  try {
    console.log('[Dev.to] Fetching...');

    const response = await fetch('https://dev.to/api/articles?tag=ai&top=7');
    const data = await response.json();

    const articles: Article[] = [];
    if (Array.isArray(data)) {
      for (const article of data.slice(0, 8)) {
        articles.push({
          id: `devto-${article.id}`,
          title: article.title,
          url: article.url,
          author: article.user.name,
          date: new Date(article.published_at).toLocaleDateString(),
          source: 'Dev.to',
          summary: article.description,
        });
      }
    }

    console.log(`[Dev.to] Fetched ${articles.length} articles`);

    return {
      source: 'Dev.to',
      status: 'success',
      articles_returned: articles.length,
      sample: articles[0] ? {
        title: articles[0].title,
        url: articles[0].url,
        date: articles[0].date,
        author: articles[0].author,
      } : undefined,
      has_full_text: true, // Has descriptions
      rate_limit_info: 'Generous limits',
      time_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Dev.to] Error:', error);
    return {
      source: 'Dev.to',
      status: 'failed',
      articles_returned: 0,
      has_full_text: true,
      rate_limit_info: 'Generous limits',
      time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('=== POC 2: Source Fetching ===\n');

  // Run all fetchers in parallel
  const [
    gdeltResult,
    newsDataResult,
    semanticScholarResult,
    arxivResult,
    redditResult,
    hackerNewsResult,
    githubResult,
    devToResult,
  ] = await Promise.all([
    fetchGDELT(),
    fetchNewsDataIO(),
    fetchSemanticScholar(),
    fetchArXiv(),
    fetchReddit(),
    fetchHackerNews(),
    fetchGitHub(),
    fetchDevTo(),
  ]);

  const results = [
    gdeltResult,
    newsDataResult,
    semanticScholarResult,
    arxivResult,
    redditResult,
    hackerNewsResult,
    githubResult,
    devToResult,
  ];

  // Print results
  console.log('\n=== RESULTS ===\n');

  for (const result of results) {
    const statusIcon = result.status === 'success' ? '✓' : '✗';
    console.log(`${statusIcon} ${result.source}`);
    console.log(`  Articles: ${result.articles_returned}`);
    console.log(`  Has full text: ${result.has_full_text}`);
    console.log(`  Rate limit: ${result.rate_limit_info}`);
    console.log(`  Time: ${result.time_ms}ms`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.sample) {
      console.log(`  Sample: "${result.sample.title.substring(0, 60)}..."`);
    }
    console.log('');
  }

  // Summary
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const totalArticles = results.reduce((sum, r) => sum + r.articles_returned, 0);
  const totalTime = results.reduce((sum, r) => sum + r.time_ms, 0);

  console.log('=== SUMMARY ===');
  console.log(`Total sources: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total articles: ${totalArticles}`);
  console.log(`Total time: ${totalTime}ms`);

  // Write output
  const output = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total_sources: results.length,
      successful: successful.length,
      failed: failed.length,
      total_articles: totalArticles,
      total_time_ms: totalTime,
    },
  };

  const outputPath = path.join(__dirname, 'output', '2-sources.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch(console.error);
