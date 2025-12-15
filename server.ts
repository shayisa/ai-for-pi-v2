import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { trendingCache } from './server/cache/trendingCache.ts';
import { searchCache } from './server/cache/searchCache.ts';
import * as archiveService from './server/services/archiveService.ts';
import * as newsletterDbService from './server/services/newsletterDbService.ts';
import * as promptDbService from './server/services/promptDbService.ts';
import * as subscriberDbService from './server/services/subscriberDbService.ts';
import * as apiKeyDbService from './server/services/apiKeyDbService.ts';
import * as googleOAuthService from './server/services/googleOAuthService.ts';
import * as googleDriveService from './server/services/googleDriveService.ts';
import * as googleGmailService from './server/services/googleGmailService.ts';
import * as sourceFetchingService from './server/services/sourceFetchingService.ts';
import * as articleExtractorService from './server/services/articleExtractorService.ts';
import * as audienceGenerationService from './server/services/audienceGenerationService.ts';
import * as logDbService from './server/services/logDbService.ts';
import type { EnhancedNewsletter, AudienceConfig } from './types.ts';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Token optimization constants
const MAX_SEARCH_ITERATIONS = 2; // Cap agentic loops to prevent runaway token usage

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Cache for Anthropic client (recreated if API key changes)
let cachedAnthropicClient: Anthropic | null = null;
let cachedApiKey: string | null = null;

// Get Anthropic client with API key from SQLite or env
const getAnthropicClient = async (): Promise<Anthropic> => {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first
  let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'claude') : null;

  // Fall back to environment variable
  if (!apiKey) {
    apiKey = process.env.VITE_ANTHROPIC_API_KEY || null;
  }

  if (!apiKey) {
    throw new Error('Claude API key not configured. Please add it in Settings.');
  }

  // Reuse cached client if API key hasn't changed
  if (cachedAnthropicClient && cachedApiKey === apiKey) {
    return cachedAnthropicClient;
  }

  // Create new client with updated API key
  cachedAnthropicClient = new Anthropic({ apiKey });
  cachedApiKey = apiKey;
  return cachedAnthropicClient;
};

// Helper: Get audience description
const getAudienceDescription = (audience: string[]): string => {
  const audienceMap: Record<string, string> = {
    academics:
      "- Forensic anthropology professors specializing in skeletal analysis, trauma interpretation, taphonomy, and mass disaster victim identification using AI for morphometric analysis, age estimation, and ancestry classification. Digital/computational archaeology researchers applying LiDAR processing, photogrammetry, 3D site reconstruction, geospatial analysis, and remote sensing to archaeological site discovery and artifact documentation.",
    business:
      "- Business administrators and office managers seeking AI-powered workflow automation, document processing, meeting transcription, task orchestration, business process automation (BPA), robotic process automation (RPA), and productivity enhancement tools to streamline operations and reduce manual overhead.",
    analysts:
      "- Business analytics and logistics professionals using data mining, predictive analytics, supply chain optimization, demand forecasting, inventory management, route optimization, warehouse automation, and ML-driven insights to extract actionable intelligence from structured and unstructured data lakes.",
  };

  if (audience.length === 0 || audience.length === 3) {
    return `
- Forensic anthropology professors specializing in skeletal analysis, trauma interpretation, taphonomy, and mass disaster victim identification using AI for morphometric analysis, age estimation, and ancestry classification. Digital/computational archaeology researchers applying LiDAR processing, photogrammetry, 3D site reconstruction, geospatial analysis, and remote sensing to archaeological site discovery and artifact documentation.
- Business administrators and office managers seeking AI-powered workflow automation, document processing, meeting transcription, task orchestration, business process automation (BPA), robotic process automation (RPA), and productivity enhancement tools to streamline operations and reduce manual overhead.
- Business analytics and logistics professionals using data mining, predictive analytics, supply chain optimization, demand forecasting, inventory management, route optimization, warehouse automation, and ML-driven insights to extract actionable intelligence from structured and unstructured data lakes.
        `;
  }

  return audience.map((key) => audienceMap[key]).join("\n");
};

// Helper: Remove emojis and special symbols
const removeEmojis = (text: string): string => {
  // Remove emojis and other special symbols
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/[\u{2000}-\u{206F}]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

// Helper: Sanitize newsletter object to remove emojis
const sanitizeNewsletter = (newsletter: any) => {
  if (newsletter.subject) {
    newsletter.subject = removeEmojis(newsletter.subject);
  }
  if (newsletter.sections && Array.isArray(newsletter.sections)) {
    newsletter.sections.forEach((section: any) => {
      if (section.title) {
        section.title = removeEmojis(section.title);
      }
    });
  }
  return newsletter;
};

// Helper: Get date range description for recency constraints
const getDateRangeDescription = (): { startDate: string; endDate: string; range: string } => {
  const today = new Date();
  const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

  const startDate = sixtyDaysAgo.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    startDate,
    endDate,
    range: `${startDate} to ${endDate}`
  };
};

// Helper: Fetch trending sources (CORS-free from backend)
interface TrendingSource {
  id: string;
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
  summary?: string;
}

const fetchHackerNewsTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from HackerNews...");
    const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const storyIds = (await topStoriesRes.json()).slice(0, 50); // Fetch more to filter

    // AI/ML keywords to filter for
    const aiKeywords = /\b(ai|ml|machine learning|neural|deep learning|llm|language model|gpt|claude|automation|robotics|computer vision|nlp|transformer|diffusion|agent|agent|api|tool)\b/i;

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

const fetchArxivTopics = async (): Promise<TrendingSource[]> => {
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

const fetchGitHubTopics = async (): Promise<TrendingSource[]> => {
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

const fetchRedditTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from Reddit...");

    // Expanded subreddit coverage for all 4 professional domains
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

// NOTE: Product Hunt removed - was 100% mock data. Will add real API integration in future.

const fetchAllTrendingSources = async (): Promise<TrendingSource[]> => {
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

// Helper: Get flavor instructions
const getFlavorInstructions = (flavors: string[]): string => {
  if (flavors.length === 0) return "";

  const flavorMap: Record<string, string> = {
    includeHumor:
      "- You may sprinkle in one or two instances of light-hearted, clever humor where appropriate, without undermining the main tone.",
    useSlang:
      "- You may incorporate some modern, conversational slang to make the content feel more relatable and authentic.",
    useJargon:
      "- You should incorporate relevant technical jargon where it adds precision and is appropriate for the expert audience.",
    useAnalogies:
      "- You should use relatable analogies and simple metaphors to explain complex technical concepts.",
    citeData:
      "- Wherever possible, you should cite specific data points, statistics, or findings to add authority and credibility to your points.",
  };

  const instructions = flavors.map((key) => flavorMap[key]).filter(Boolean);

  if (instructions.length === 0) return "";

  return `

    Additionally, adhere to the following stylistic instructions:
    ${instructions.join("\n")}
    `;
};

const searchGuidance = `\nWhen conducting your web search using the web_search tool, you MUST prioritize information from reputable, high-quality sources. Your search should focus on major tech news sites (like TechCrunch AI), official AI research blogs (like OpenAI, Google DeepMind), academic publications, and domain-specific resources for forensics and archaeology. The goal is to find the most relevant, accurate, and current information to fulfill the user's request.`;

// Tool definitions
const webSearchTool = {
  name: "web_search",
  description:
    "Search the web for current information about AI tools, trends, and how-to guides",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant web information",
      },
    },
    required: ["query"],
  },
};

// Helper: Format Brave Search API results for Claude
const formatBraveSearchResults = (results: any): string => {
  if (!results || (!results.web && !results.news)) {
    return "No search results found.";
  }

  let formatted = "## Web Search Results\n\n";

  // Format web results
  if (results.web && results.web.results && results.web.results.length > 0) {
    formatted += "### Web Results:\n";
    results.web.results.slice(0, 10).forEach((result: any, index: number) => {
      formatted += `\n${index + 1}. **${result.title}** (${result.url})\n`;
      if (result.description) {
        formatted += `   ${result.description}\n`;
      }
    });
  }

  // Format news results if available
  if (results.news && results.news.results && results.news.results.length > 0) {
    formatted += "\n### News Results:\n";
    results.news.results.slice(0, 5).forEach((result: any, index: number) => {
      formatted += `\n${index + 1}. **${result.title}** (${result.url})\n`;
      if (result.description) {
        formatted += `   ${result.description}\n`;
      }
      if (result.date) {
        formatted += `   Published: ${result.date}\n`;
      }
    });
  }

  return formatted;
};

// NOTE: Mock search results removed - newsletters now use ONLY real data or graceful degradation

// Helper: Fetch results from Brave Search API with timeout (NO mock fallback)
const fetchBraveSearchResults = async (query: string): Promise<string> => {
  const adminEmail = process.env.ADMIN_EMAIL;

  // Try SQLite first, then env var
  let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'brave') : null;
  if (!apiKey) {
    apiKey = process.env.VITE_BRAVE_SEARCH_API_KEY || null;
  }

  const NO_RESULTS_MESSAGE = `No current web search results available for "${query}". Please use your training knowledge to provide accurate, helpful information about this topic.`;

  if (!apiKey) {
    console.warn("[BraveSearch] API key not configured - using training knowledge");
    return NO_RESULTS_MESSAGE;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pm`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("[BraveSearch] Rate limit exceeded");
      } else if (response.status === 401 || response.status === 403) {
        console.warn("[BraveSearch] Authentication failed - check API key");
      } else {
        console.warn(`[BraveSearch] API error: ${response.status}`);
      }
      return NO_RESULTS_MESSAGE;
    }

    const data = await response.json();

    if (!data || (!data.web && !data.news)) {
      console.log("[BraveSearch] Empty results received");
      return NO_RESULTS_MESSAGE;
    }

    return formatBraveSearchResults(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[BraveSearch] Request timeout");
    } else {
      console.warn("[BraveSearch] Error:", error);
    }
    return NO_RESULTS_MESSAGE;
  }
};

// Web search function that uses Brave API with caching
const performWebSearch = async (query: string): Promise<string> => {
  // Check cache first
  const cached = searchCache.get(query);
  if (cached) {
    return cached;
  }

  console.log(`[WebSearch] Fetching: ${query}`);
  try {
    const result = await fetchBraveSearchResults(query);
    searchCache.set(query, result);
    return result;
  } catch (error) {
    console.error("performWebSearch error:", error);
    // Return empty results instead of fake mock data (quality improvement)
    return "Web search temporarily unavailable. Please use your training knowledge for this query.";
  }
};

// Process tool calls from Claude
const processToolCall = async (
  toolName: string,
  toolInput: Record<string, string>
): Promise<string> => {
  if (toolName === "web_search") {
    return performWebSearch(toolInput.query);
  }
  throw new Error(`Unknown tool: ${toolName}`);
};

// API Routes

// Score sources by recency, engagement, and practicality
const scoreSourceForPracticality = (source: TrendingSource): number => {
  let score = 0;

  // Recency: sources from today score higher
  if (source.date) {
    const sourceDate = new Date(source.date);
    const today = new Date();
    const daysOld = (today.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld === 0) score += 30;
    else if (daysOld === 1) score += 20;
    else if (daysOld <= 7) score += 10;
  }

  // Engagement: GitHub stars and Reddit upvotes
  if (source.summary) {
    if (source.summary.includes("star") || source.summary.includes("upvote")) {
      const num = parseInt(source.summary.match(/\d+/)?.[0] || "0");
      if (num > 1000) score += 25;
      else if (num > 100) score += 15;
      else if (num > 0) score += 5;
    }
  }

  // Practicality: certain keywords indicate practical content
  const practicalKeywords = ["tutorial", "guide", "implementation", "how to", "setup", "library", "tool", "framework", "api", "resource", "code", "github"];
  const titleLower = source.title.toLowerCase();
  const summaryLower = (source.summary || "").toLowerCase();
  const combinedText = `${titleLower} ${summaryLower}`;

  const matchedKeywords = practicalKeywords.filter(kw => combinedText.includes(kw)).length;
  score += matchedKeywords * 5;

  // Domain-specific keywords: HIGH VALUE for audience relevance (60 keywords across 4 domains)
  const domainKeywords = {
    forensic: ["skeletal", "bone", "remains", "forensic", "osteology", "trauma", "taphonomy", "morphometric", "ancestry", "bioarchaeology", "pathology", "identification", "decomposition", "craniofacial", "odontology"],
    archaeology: ["lidar", "photogrammetry", "archaeological", "artifact", "excavation", "geospatial", "gis", "remote sensing", "3d reconstruction", "site analysis", "stratigraphy", "cultural heritage", "heritage preservation", "landscape analysis", "ground-penetrating radar"],
    automation: ["workflow", "automation", "orchestration", "rpa", "bpa", "process optimization", "document processing", "task management", "productivity", "efficiency", "integration", "api workflow", "no-code", "low-code", "zapier"],
    analytics: ["analytics", "logistics", "supply chain", "forecasting", "optimization", "inventory", "warehouse", "route planning", "demand planning", "data mining", "predictive", "dashboard", "visualization", "kpi", "reporting"]
  };

  // Check all domain keywords across all categories
  let domainMatches = 0;
  Object.values(domainKeywords).forEach(keywordList => {
    keywordList.forEach(keyword => {
      if (combinedText.includes(keyword)) {
        domainMatches++;
      }
    });
  });

  // Each domain keyword match adds significant value
  score += domainMatches * 8;

  // Source type: ArXiv and GitHub tend to have more structured content
  if (source.category === "arxiv" || source.category === "github") score += 15;

  return score;
};

// Fetch Trending Sources (with caching)
app.get("/api/fetchTrendingSources", async (req, res) => {
  try {
    // Check cache first (reduces 67+ API calls to 1 per hour)
    const cached = trendingCache.get();
    if (cached) {
      const metadata = trendingCache.getMetadata();
      return res.json({
        sources: cached,
        cachedAt: metadata?.cachedAt,
        ttl: metadata?.ttl,
      });
    }

    // Fetch fresh data
    console.log('[TrendingSources] Cache miss, fetching fresh data...');
    const sources = await fetchAllTrendingSources();

    // Store in cache
    trendingCache.set(sources);

    res.json({ sources });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching trending sources:", errorMessage);
    res.status(500).json({ error: "Failed to fetch trending sources", details: errorMessage });
  }
});

// Generate Compelling Trending Content (with actionable insights + tools)
app.post("/api/generateCompellingTrendingContent", async (req, res) => {
  try {
    const { audience, sources: rawSources } = req.body;
    const audienceDescription = getAudienceDescription(audience);
    const dateRange = getDateRangeDescription();

    // Parse sources if they're provided
    let topSources: TrendingSource[] = [];
    if (rawSources && typeof rawSources === "string") {
      // Sources provided as formatted string, fetch and score fresh sources
      const allSources = await fetchAllTrendingSources();
      const scoredSources = allSources
        .map(s => ({ source: s, score: scoreSourceForPracticality(s) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(item => item.source);
      topSources = scoredSources;
    }

    const sourceSummary = topSources.length > 0
      ? topSources.map(s => `- "${s.title}" from ${s.publication} (${s.category}, ${s.date}): ${s.url}\n  ${s.summary || ""}`).join('\n')
      : "";

    const userMessage = `
    You are an expert in making AI capabilities accessible and practical for professionals.

    Your task: Extract the MOST COMPELLING and ACTIONABLE insights from these trending sources.

    RECENCY REQUIREMENT: Focus ONLY on insights and tools released or significantly updated between ${dateRange.range}. All recommendations must be from the last 60 days. Ignore any older content or frameworks unless they've been updated recently.

    ${sourceSummary ? `Here are today's top trending developments:\n${sourceSummary}` : ""}

    Create a response with TWO sections:

    **SECTION 1: ACTIONABLE AI CAPABILITIES** (3-4 items)
    For each item, provide:
    - What It Is: One sentence explanation
    - New Capability: What AI can NOW do that wasn't possible before
    - Who Should Care: Why THIS audience needs this
    - How to Get Started: Specific, immediate first step (code snippet, tool name, or action)
    - Expected Impact: Concrete benefit (time saved, accuracy improved, cost reduced, etc.)
    - Resource: GitHub repo, paper link, or tool name

    **SECTION 2: ESSENTIAL TOOLS & RESOURCES** (5-7 items)
    For each:
    - Tool/Paper Name
    - One-line what it does
    - Why it matters NOW
    - Direct link

    Focus on:
    - SPECIFIC tools and capabilities (not vague concepts)
    - IMMEDIATELY IMPLEMENTABLE (not theoretical)
    - AUDIENCE-TAILORED for: ${audienceDescription}
    - NOVEL capabilities they may not have considered
    - PRACTICAL examples they can use this week

    When suggesting tools and capabilities, prioritize those with direct applications to:
    - Forensic anthropology: skeletal analysis automation, morphometric measurements, ancestry classification, trauma pattern recognition, taphonomic analysis
    - Digital/computational archaeology: LiDAR data processing, photogrammetry pipelines, 3D site reconstruction, geospatial analysis, artifact classification
    - Business administration: workflow orchestration tools, document automation, meeting intelligence, task automation, process mining
    - Business analytics/logistics: supply chain optimization, demand forecasting, route planning, warehouse automation, predictive maintenance

    Format as valid JSON with this structure:
    {
      "actionableCapabilities": [
        {
          "title": "...",
          "whatItIs": "...",
          "newCapability": "...",
          "whoShouldCare": "...",
          "howToGetStarted": "...",
          "expectedImpact": "...",
          "resource": "..."
        }
      ],
      "essentialTools": [
        {
          "name": "...",
          "description": "...",
          "whyNow": "...",
          "link": "..."
        }
      ]
    }
    `;

    const systemPrompt = `You are a seasoned consultant and technology strategist who speaks plainly and authentically. Your gift is translating complex AI developments into practical guidance that feels like advice from a trusted colleague, not a textbook. You extract specific, immediately actionable insights, tools, and implementation steps. You write with clarity, personality, and genuine helpfulness—always focusing on what professionals can actually DO TODAY. Always return valid JSON with human-centered guidance.`;

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Use Haiku for this summarization task (token optimization)
    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: systemPrompt,
      messages: messages,
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    res.json({ text: textBlock.text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating compelling trending content:", errorMessage);
    res.status(500).json({ error: "Failed to generate compelling trending content", details: errorMessage });
  }
});

// Generate Newsletter Content
app.post("/api/generateNewsletter", async (req, res) => {
  try {
    const { topics, audience, tone, flavors, imageStyle } = req.body;

    const audienceDescription = getAudienceDescription(audience);
    const flavorInstructions = getFlavorInstructions(flavors);
    const dateRange = getDateRangeDescription();

    const imageStyleMap: Record<string, string> = {
      photorealistic: "photorealistic",
      vector: "vector illustration",
      watercolor: "watercolor painting",
      pixel: "pixel art",
      minimalist: "minimalist line art",
      oilPainting: "oil painting",
    };
    const styleDescription = imageStyleMap[imageStyle] || "photorealistic";

    const userMessage = `
    You are an award-winning professional newsletter writer with a background in technology journalism and expert storytelling. Your task is to research and write compelling, human-centric newsletter content about: "${topics.join(
      ", "
    )}".

    Your newsletter reaches this specific and discerning audience:
    ${audienceDescription}

    CRITICAL: Your writing must feel written by a knowledgeable, engaging human—NOT an AI. Avoid:
    - Predictable structures or lists that feel formulaic
    - Overuse of phrases like "importantly," "it's worth noting," or "as we can see"
    - Overly formal or robotic language
    - Excessive hedging or disclaimers
    - Repetitive explanations of concepts

    Instead, embrace:
    - Conversational, authentic voice with personality
    - Natural transitions between ideas
    - Genuine insights and context that add real value
    - Occasional casual language that feels appropriate to the audience
    - Direct, unfiltered perspective

    Your content should demonstrate understanding of these domain-specific applications:
    - For forensic anthropologists: AI tools for skeletal morphology analysis, automated age/sex estimation, trauma analysis, mass disaster identification workflows, 3D bone modeling
    - For digital archaeologists: LiDAR processing workflows, automated artifact classification, 3D site reconstruction from drone imagery, geospatial pattern recognition, cultural heritage digitization
    - For business administrators: Workflow automation platforms (n8n, Zapier, Make), document intelligence, meeting summarization, calendar orchestration, email automation, approval routing
    - For business analysts: Supply chain predictive models, inventory optimization, route planning algorithms, warehouse robotics, demand forecasting, logistics dashboards

    You MUST tailor the content, examples, and language to be relevant and valuable to this specific audience. Think like a newsletter editor writing for people you know.

    The primary tone MUST be ${tone}. Reflect this authentically throughout the subject, introduction, sections, and conclusion—not as an overlay but as the natural voice.
    ${flavorInstructions}

    RECENCY REQUIREMENT: Focus ONLY on tools, tutorials, developments, and advancements published or significantly updated between ${dateRange.range}. Do NOT suggest tools that haven't been meaningfully updated since 2023. Do NOT reference older solutions unless they received major recent improvements.

    ACTIONABILITY REQUIREMENTS (MANDATORY for every tool/technique mentioned):
    Every section MUST include actionability information so readers can immediately implement what they learn:
    1. Implementation Time: State how long to get started (e.g., "15 minutes to first result")
    2. Skill Level: Specify required expertise (beginner/intermediate/advanced)
    3. Prerequisites: List required tools/accounts (e.g., "Requires Python 3.9+ and pip")
    4. Concrete Steps: Provide 3-5 numbered steps to get started
    5. Expected Outcome: What user will achieve (e.g., "You'll have a working classifier")

    SOURCE REQUIREMENTS:
    - Every tool mentioned MUST include a direct link to its documentation or GitHub
    - Include at least 2 sources per section with verifiable URLs
    - Do NOT invent or guess URLs - only include URLs you found via web search

    When you find relevant web pages, you MUST embed hyperlinks directly within the text of the 'content' field for each section using HTML \`<a>\` tags. For example: \`<a href='URL' target="_blank" rel="noopener noreferrer">this new tool</a>\`.

    The final output MUST be a valid JSON object. Do not include any text outside of the JSON object, including markdown backticks.
    IMPORTANT: Do NOT use emojis, icons, or special symbols in the subject line or section titles.
    The JSON object should have the following structure:
    {
      "subject": "A catchy, compelling email subject line that would make readers genuinely want to open it. NO emojis or symbols.",
      "introduction": "A warm, engaging introduction that hooks the reader immediately. This must be plain text, without any HTML tags. It should feel like a friendly note from a knowledgeable colleague.",
      "sections": [
        {
          "title": "Title for this section (e.g., a specific tool or how-to)",
          "content": "Conversational, detailed explanation written in a natural voice. Explain what it does and how to use it. Share genuine insights and context. This content MUST include inline HTML \`<a>\` tags linking to the original sources or examples. The text should be formatted with HTML paragraph tags \`<p>\` for readability.",
          "imagePrompt": "A simple, descriptive prompt for an AI image generator to create a relevant image for this section. The image MUST be in a ${styleDescription} style.",
          "actionability": {
            "implementationTime": "e.g., '15 minutes' or '1 hour'",
            "skillLevel": "beginner | intermediate | advanced",
            "prerequisites": ["Required tool 1", "Required account/API key"],
            "steps": ["Step 1: Do this", "Step 2: Then this", "Step 3: Finally this"],
            "expectedOutcome": "What the reader will have achieved"
          },
          "sources": [
            {"url": "https://actual-url.com", "title": "Source title"}
          ]
        }
      ],
      "conclusion": "A thoughtful, conversational closing paragraph. This must be plain text, without any HTML tags. End with something genuine and memorable."
    }
  ` + searchGuidance;

    const systemPrompt = `You are an expert professional newsletter writer and technology journalist with years of experience crafting engaging, authentic content for diverse audiences. Your strength is transforming complex topics into compelling narratives that feel human, genuine, and insightful—never robotic or formulaic.

Your task: Create a newsletter that reads like it was written by a seasoned, knowledgeable professional who genuinely cares about helping your readers. Focus on clarity, authenticity, and real value.

You have access to web search to find the latest, most relevant information. The final output MUST be a single, valid JSON object. Do not include any text outside of the JSON object.`;

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    // Agentic loop for tool use
    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < MAX_SEARCH_ITERATIONS) {
      iterations++;
      console.log(`[Newsletter] Agentic loop iteration ${iterations}/${MAX_SEARCH_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      messages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolResult = await processToolCall(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, string>
        );
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    if (iterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[Newsletter] Reached max iterations (${MAX_SEARCH_ITERATIONS}), forcing final response`);

      // Extract tool_use blocks from response
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );

      // Add the assistant message with tool_use
      messages.push({
        role: "assistant",
        content: response.content,
      });

      // Add tool_result blocks for each tool_use (required by API)
      // Include an explicit instruction after the tool results
      const toolResultContent: (Anthropic.Messages.ToolResultBlockParam | Anthropic.Messages.TextBlockParam)[] = [
        ...toolUseBlocks.map(block => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: "[Max iterations reached - proceeding with gathered information]",
        })),
        {
          type: "text" as const,
          text: "Now please generate the newsletter based on the search results you gathered. Return only the JSON response.",
        }
      ];

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      // Final call WITHOUT tools to force text output
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
      });
      console.log('[Newsletter] Final response stop_reason:', response.stop_reason);
      console.log('[Newsletter] Final response content types:', response.content.map(b => b.type));
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response and sanitize emojis
    try {
      const newsletter = JSON.parse(textBlock.text);
      const sanitized = sanitizeNewsletter(newsletter);

      // Auto-save newsletter to SQLite
      const newsletterId = `nl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      try {
        newsletterDbService.saveNewsletter(
          {
            id: newsletterId,
            subject: sanitized.subject || 'Untitled Newsletter',
            introduction: sanitized.introduction || '',
            sections: sanitized.sections || [],
            conclusion: sanitized.conclusion || '',
            promptOfTheDay: sanitized.promptOfTheDay,
          },
          topics,
          { audience, tone, imageStyle }
        );
        console.log(`[Newsletter] Auto-saved to SQLite: ${newsletterId}`);
        // Include the ID in the response so frontend knows the saved ID
        sanitized.id = newsletterId;
      } catch (saveError) {
        console.error('[Newsletter] Failed to auto-save:', saveError);
        // Continue even if save fails - newsletter was still generated
      }

      res.json({ text: JSON.stringify(sanitized) });
    } catch {
      // If JSON parsing fails, return the text as-is
      res.json({ text: textBlock.text });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating newsletter:", errorMessage);
    console.error("Full error:", error);
    res.status(500).json({ error: "Failed to generate newsletter", details: errorMessage });
  }
});

// ============================================================================
// Enhanced Newsletter Generation (v2 Format)
// ============================================================================

// Generate Enhanced Newsletter with multi-source fetching and structured format
app.post("/api/generateEnhancedNewsletter", async (req, res) => {
  try {
    const { topics, audiences, imageStyle, promptOfTheDay: userPromptOfTheDay } = req.body as {
      topics: string[];
      audiences: AudienceConfig[];
      imageStyle?: string;
      promptOfTheDay?: {
        title: string;
        summary: string;
        examplePrompts: string[];
        promptCode: string;
      } | null;
    };

    console.log('[EnhancedNewsletter] Starting generation for audiences:', audiences.map(a => a.name));
    if (userPromptOfTheDay) {
      console.log('[EnhancedNewsletter] User-supplied promptOfTheDay:', userPromptOfTheDay.title);
    }

    // Step 1: Collect keywords and config from all audiences
    const allKeywords: string[] = [];
    const allSubreddits: string[] = [];
    const allArxivCategories: string[] = [];

    for (const audience of audiences) {
      if (audience.generated) {
        allKeywords.push(...(audience.generated.relevance_keywords || []));
        allSubreddits.push(...(audience.generated.subreddits || []));
        allArxivCategories.push(...(audience.generated.arxiv_categories || []));
      }
    }

    // Add topics to keywords
    allKeywords.push(...topics);

    // Deduplicate
    const uniqueKeywords = [...new Set(allKeywords)].slice(0, 10);
    const uniqueSubreddits = [...new Set(allSubreddits)].slice(0, 5);
    const uniqueArxivCategories = [...new Set(allArxivCategories)].slice(0, 4);

    // Step 2: Fetch sources from multiple APIs
    console.log('[EnhancedNewsletter] Fetching sources...');
    const sourceResult = await sourceFetchingService.fetchAllSources({
      keywords: uniqueKeywords,
      subreddits: uniqueSubreddits,
      arxivCategories: uniqueArxivCategories,
      limit: 5,
    });
    console.log(`[EnhancedNewsletter] Fetched ${sourceResult.totalCount} articles`);

    // Step 3: Extract article content
    console.log('[EnhancedNewsletter] Extracting article content...');
    const extractionResult = await articleExtractorService.extractMultipleArticles(
      sourceResult.articles,
      { maxArticles: 10, maxContentLength: 3000, delayMs: 200 }
    );
    console.log(`[EnhancedNewsletter] Extracted ${extractionResult.successCount} articles`);

    // Step 4: Build source context for Claude
    const sourceContext = articleExtractorService.buildSourceContext(
      extractionResult.extracted,
      { maxTotalLength: 25000, maxPerArticle: 2000 }
    );

    // Step 5: Build audience descriptions
    const audienceDescriptions = audienceGenerationService.getAudiencePromptDescription(audiences);

    // Step 6: Generate enhanced newsletter with Claude
    console.log('[EnhancedNewsletter] Generating newsletter with Claude...');

    const enhancedSystemPrompt = `You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools in their work.

Your task is to generate a newsletter in the ENHANCED FORMAT with:
1. Editor's Note - Personal, conversational opening that sets the tone (2-3 sentences)
2. Tool of the Day - One standout tool featured prominently from the sources
3. Audience Sections - ONE section per audience with specific relevance
4. Practical Prompts - Ready-to-use AI prompts for each section
5. CTAs - Clear calls to action
6. Source Citations - Every claim cites its source URL
7. Prompt of the Day - A featured prompt technique with title, summary, example variations, and full structured promptCode with XML-like tags

RULES:
- Every factual claim MUST cite its source URL from the provided sources
- Each audience section MUST have a "Why It Matters" explanation specific to that audience
- Practical prompts should be immediately usable - copy-paste ready
- Keep the tone authoritative but accessible
- NO hallucinated tools or statistics - use ONLY what's in the provided sources
- Do NOT use emojis in titles or section headers

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "editorsNote": { "message": "string" },
  "toolOfTheDay": { "name": "string", "url": "string", "whyNow": "string", "quickStart": "string" },
  "audienceSections": [{
    "audienceId": "string",
    "audienceName": "string",
    "title": "string",
    "whyItMatters": "string",
    "content": "string (can include <a href='url'>text</a> links)",
    "practicalPrompt": { "scenario": "string", "prompt": "string", "isToolSpecific": boolean },
    "cta": { "text": "string", "action": "copy_prompt" },
    "sources": [{ "url": "string", "title": "string" }],
    "imagePrompt": "string - A descriptive prompt for AI image generation showing this concept visually"
  }],
  "promptOfTheDay": {
    "title": "string - A catchy title for the featured prompt technique",
    "summary": "string - 2-3 sentences explaining what this prompt technique does and why it's valuable",
    "examplePrompts": ["string - 3 example variations of how to use this prompt technique"],
    "promptCode": "string - The full structured prompt with XML-like tags (e.g., <role>...</role><context>...</context><task>...</task>)"
  },
  "conclusion": "string",
  "subject": "string - A compelling email subject line"
}`;

    const enhancedUserPrompt = `Generate an enhanced newsletter for these audiences:

AUDIENCES:
${audienceDescriptions}

TOPICS TO COVER:
${topics.join(', ')}

SOURCE CONTENT (use these for citations):
${sourceContext}

Generate the newsletter JSON now. Remember:
- ONE section per audience (${audiences.length} sections total)
- Cite sources with URLs from the SOURCE CONTENT above
- Include practical, ready-to-use prompts that readers can copy directly
- Make "Why It Matters" specific and compelling for each audience
- Include an imagePrompt for each section - a descriptive prompt for AI image generation
- Include a compelling subject line for the email
- Include promptOfTheDay with a useful prompt technique - include title, summary, 3 examplePrompts variations, and full promptCode with XML-style tags like <role>, <context>, <task>, etc.`;

    const response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: enhancedSystemPrompt,
      messages: [{ role: "user", content: enhancedUserPrompt }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const newsletter: EnhancedNewsletter = JSON.parse(jsonText);

    // If user supplied a promptOfTheDay, use it instead of the LLM-generated one
    if (userPromptOfTheDay) {
      newsletter.promptOfTheDay = userPromptOfTheDay;
      console.log('[EnhancedNewsletter] Using user-supplied promptOfTheDay:', userPromptOfTheDay.title);
    }

    // Generate a subject from the content
    newsletter.subject = newsletter.audienceSections[0]?.title ||
      `AI Tools Update: ${newsletter.toolOfTheDay?.name || 'This Week'}`;

    // Auto-save to SQLite
    const newsletterId = `enl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      newsletterDbService.saveEnhancedNewsletter(
        { ...newsletter, id: newsletterId },
        topics,
        { audience: audiences.map(a => a.id), imageStyle }
      );
      console.log(`[EnhancedNewsletter] Saved to SQLite: ${newsletterId}`);
      newsletter.id = newsletterId;
    } catch (saveError) {
      console.error('[EnhancedNewsletter] Failed to save:', saveError);
    }

    console.log('[EnhancedNewsletter] Generation complete');
    res.json({ newsletter, sources: sourceResult.sources });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating enhanced newsletter:", errorMessage);
    res.status(500).json({ error: "Failed to generate enhanced newsletter", details: errorMessage });
  }
});

// Generate Audience Configuration using AI
app.post("/api/generateAudienceConfig", async (req, res) => {
  try {
    const { name, description } = req.body as { name: string; description: string };

    if (!name || !description) {
      return res.status(400).json({ error: "Name and description are required" });
    }

    // Get API key
    const adminEmail = process.env.ADMIN_EMAIL;
    let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'claude') : null;
    if (!apiKey) {
      apiKey = process.env.VITE_ANTHROPIC_API_KEY || null;
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Claude API key not configured" });
    }

    const result = await audienceGenerationService.generateAudienceConfig(
      apiKey,
      name,
      description
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to generate config" });
    }

    res.json({
      config: result.config,
      timeMs: result.timeMs,
      tokensUsed: result.tokensUsed,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating audience config:", errorMessage);
    res.status(500).json({ error: "Failed to generate audience config", details: errorMessage });
  }
});

// Fetch sources from multiple APIs
app.get("/api/fetchMultiSources", async (req, res) => {
  try {
    const keywords = (req.query.keywords as string)?.split(',') || ['artificial intelligence'];
    const subreddits = (req.query.subreddits as string)?.split(',') || ['MachineLearning'];
    const arxivCategories = (req.query.arxiv as string)?.split(',') || ['cs.AI'];
    const limit = parseInt(req.query.limit as string) || 5;

    const result = await sourceFetchingService.fetchAllSources({
      keywords,
      subreddits,
      arxivCategories,
      limit,
    });

    res.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching sources:", errorMessage);
    res.status(500).json({ error: "Failed to fetch sources", details: errorMessage });
  }
});

// Get default audiences with their generated configs
app.get("/api/defaultAudiences", (_req, res) => {
  const audiences = audienceGenerationService.getDefaultAudiences();
  res.json({ audiences });
});

// Generate Topic Suggestions (based on real trending sources)
app.post("/api/generateTopicSuggestions", async (req, res) => {
  try {
    const { audience, sources } = req.body;
    const audienceDescription = getAudienceDescription(audience);
    const dateRange = getDateRangeDescription();

    // If sources are provided, use real data; otherwise fall back to web search
    const sourceSummary = sources
      ? `Here are current trending topics from real AI communities:\n${sources}`
      : "";

    const userMessage = `
    You are an expert technical writer and tutorial creator specializing in actionable, implementation-focused content.
    Your task is to generate a list of 10 HOW-TO tutorial topic suggestions that readers can immediately implement.

    CRITICAL FORMAT REQUIREMENTS:
    - Every topic MUST start with an action verb (Build, Deploy, Implement, Configure, Optimize, Automate, Create, Integrate, Set Up, Analyze, Process, etc.)
    - Every topic MUST be a practical tutorial or guide format
    - Every topic MUST include specific tools, libraries, or technologies by name (NOT generic "AI tools")
    - Every topic MUST have a clear, measurable outcome

    RECENCY REQUIREMENT: Focus ONLY on developments, tools, and research published or updated between ${dateRange.range}. Do NOT suggest topics based on older content unless there's a recent, significant development.

    ${sourceSummary ? `Based on these real trending sources and latest developments:
    ${sourceSummary}` : "Based on the latest trends and news in AI,"}

    Generate tutorial topics that are:
    - IMPLEMENTATION-FOCUSED: Step-by-step guides, not conceptual overviews
    - TOOL-SPECIFIC: Name exact libraries, APIs, frameworks, or services (e.g., "Claude API", "LangChain", "n8n", "Llama 3.2", not just "AI tools")
    - OUTCOME-DRIVEN: Clear statement of what the reader will build/accomplish
    - IMMEDIATELY ACTIONABLE: Can be started within 1 hour of reading
    - AUDIENCE-TAILORED: Directly applicable to this specific audience:
    ${audienceDescription}

    Prioritize topics that address these domain-specific use cases:
    - Forensic anthropology applications: skeletal analysis AI, trauma pattern recognition, morphometric analysis automation, mass fatality incident response, age/sex/ancestry estimation
    - Digital/computational archaeology applications: LiDAR site discovery, photogrammetry pipelines, artifact classification, 3D reconstruction, geospatial analysis, cultural heritage preservation
    - Business automation applications: workflow orchestration, document processing automation, meeting intelligence, RPA implementation, API integration, no-code/low-code tools
    - Business analytics/logistics applications: supply chain optimization, demand forecasting models, inventory management, route optimization, warehouse automation, predictive analytics

    AVOID these non-tutorial formats:
    - "Understanding [topic]" or "Introduction to [topic]" (too passive)
    - "The State of [technology]" or "Trends in [field]" (too descriptive)
    - "[Company] Announces [product]" (news, not tutorial)
    - "Why [concept] Matters" (opinion, not implementation)
    - Any title without a specific tool or technology named

    The final output MUST be a valid JSON object. Do not include any text outside of the JSON object.
    The JSON object should be an array of 10 strings.
    Example format (REQUIRED STRUCTURE):
    [
      "Build an Automated ArXiv Research Monitor Using n8n and Claude API",
      "Deploy a Skeletal Age Estimation Model with PyTorch and Anthropic Vision",
      "Implement Real-Time LiDAR Processing Pipeline Using Open3D and Python",
      "Automate Supply Chain Forecasting with Prophet, Pandas, and Streamlit",
      "Configure Document Intelligence Workflow Using Claude 3.5 and LangChain",
      "Set Up a Multi-Agent Research Assistant with CrewAI and GPT-4",
      "Integrate Slack Notifications into Your Data Pipeline Using Webhooks",
      "Optimize Inventory Predictions Using XGBoost and Historical Sales Data",
      "Create a Custom RAG System for Archaeological Research with Pinecone",
      "Process Archaeological Photos with Photogrammetry Using Meshroom and Blender"
    ]

    QUALITY CHECK: Each topic MUST:
    1. Start with action verb (Build, Deploy, etc.)
    2. Name specific tools/technologies (NOT generic "AI tools")
    3. State clear application domain
    4. Be completable as a tutorial within 30-60 minutes of reading time
  ` + (sources ? "" : searchGuidance);

    const systemPrompt = `You are an experienced technical writer and tutorial creator specializing in actionable, implementation-focused content. Your expertise is transforming new AI developments into step-by-step guides that readers can follow immediately. You NEVER suggest passive informational topics—every suggestion must be a hands-on tutorial or how-to guide with specific tools named. Think like someone who writes for O'Reilly, Real Python, or Towards Data Science—practical, specific, and immediately implementable.`;

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let suggestIterations = 0;
    while (response.stop_reason === "tool_use" && suggestIterations < MAX_SEARCH_ITERATIONS) {
      suggestIterations++;
      console.log(`[TopicSuggestions] Agentic loop iteration ${suggestIterations}/${MAX_SEARCH_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      messages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolResult = await processToolCall(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, string>
        );
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    if (suggestIterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[TopicSuggestions] Reached max iterations, forcing final response`);
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          ...toolUseBlocks.map(block => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "[Max iterations reached]",
          })),
          { type: "text" as const, text: "Now please generate the topic suggestions based on the search results." }
        ],
      });
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages,
      });
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    res.json({ text: textBlock.text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating topic suggestions:", errorMessage);
    console.error("Full error:", error);
    res.status(500).json({ error: "Failed to generate topic suggestions", details: errorMessage });
  }
});

// Generate Trending Topics
app.post("/api/generateTrendingTopics", async (req, res) => {
  try {
    const { audience } = req.body;
    const audienceDescription = getAudienceDescription(audience);
    const dateRange = getDateRangeDescription();

    const userMessage = `
    You are an AI implementation strategist. Your task is to identify 2-3 of the most actionable, tutorial-worthy AI developments from the last 60 days that readers can immediately implement.

    Your analysis MUST be tailored for this specific audience:
    ${audienceDescription}

    CRITICAL FORMAT REQUIREMENTS:
    - Every title MUST be phrased as a "How-To" tutorial or implementation guide
    - Every title MUST start with action verbs: "How to Build", "How to Deploy", "How to Implement", "How to Automate", "How to Configure", etc.
    - Every summary MUST focus on IMPLEMENTATION STEPS, not just descriptions
    - Every summary MUST include specific tools/technologies by name

    Focus on developments that have clear, implementable applications to:
    - Forensic anthropology: skeletal analysis automation, trauma pattern classification, victim identification workflows, morphometric measurements, taphonomy modeling
    - Digital/computational archaeology: LiDAR data processing, 3D reconstruction pipelines, artifact classification systems, site discovery automation, geospatial analysis tools
    - Business administration: workflow orchestration, document automation systems, meeting intelligence tools, task automation frameworks, process mining implementations
    - Business analytics/logistics: supply chain optimization models, demand forecasting systems, inventory management automation, route planning algorithms, predictive maintenance tools

    RECENCY REQUIREMENT: Focus ONLY on tools, libraries, models, or APIs announced or significantly updated between ${dateRange.range}. Ignore all developments from before ${dateRange.startDate}. This must be CURRENT and IMPLEMENTABLE content only.

    For each development, provide:
    1. A HOW-TO formatted title (e.g., "How to Build...", "How to Deploy...", "How to Automate...")
    2. An implementation-focused summary that includes:
       - Specific tools/libraries/models to use
       - Key implementation steps or approach
       - Expected outcome or capability gained
       - Why this is relevant NOW for the audience

    The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object, including markdown backticks.
    Each object in the array should have the following structure:
    {
      "title": "How to [Action Verb]...",
      "summary": "Brief summary including specific tools, implementation steps, expected outcome, and why it matters NOW."
    }

    Example format (REQUIRED STRUCTURE):
    [
        {
            "title": "How to Build a Skeletal Analysis Pipeline Using Claude Vision API and Python",
            "summary": "Claude 3.5's new vision capabilities (released October 2024) enable forensic anthropologists to automate skeletal element identification and trauma documentation. Implementation: Use Claude API with base64-encoded bone images, prompt for morphometric measurements, integrate with existing case management systems. Expected outcome: 60% reduction in initial documentation time with standardized measurement protocols."
        },
        {
            "title": "How to Deploy Automated LiDAR Site Discovery with Open3D and PyTorch",
            "summary": "Recent updates to Open3D (v0.18, September 2024) combined with PyTorch's improved point cloud processing enable archaeologists to automate site anomaly detection from drone LiDAR scans. Implementation: Process raw .las files with Open3D, train anomaly detection model using labeled examples, export georeferenced site predictions. Expected outcome: Identify potential archaeological features 10x faster than manual scan review."
        },
        {
            "title": "How to Automate Business Workflows Using n8n Cloud and Claude Integration",
            "summary": "n8n's new Claude node (November 2024) enables business administrators to build no-code AI workflows for document processing, email triage, and meeting follow-ups. Implementation: Connect n8n to Gmail/Slack, configure Claude prompts for task extraction, route actions to project management tools. Expected outcome: Automate 80% of routine administrative decisions without code."
        }
    ]
  ` + searchGuidance;

    const systemPrompt = `You are a seasoned technical implementation consultant who translates new AI developments into actionable how-to guides. Your gift is identifying what's newly possible and explaining exactly how to implement it, step-by-step. You never write passive news summaries—you write implementation guides with specific tools, clear steps, and measurable outcomes. Think like someone who writes for Hacker News "Show HN" posts or technical tutorial blogs—every insight must be immediately actionable.`;

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let trendingIterations = 0;
    while (response.stop_reason === "tool_use" && trendingIterations < MAX_SEARCH_ITERATIONS) {
      trendingIterations++;
      console.log(`[TrendingTopics] Agentic loop iteration ${trendingIterations}/${MAX_SEARCH_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      messages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolResult = await processToolCall(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, string>
        );
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    if (trendingIterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[TrendingTopics] Reached max iterations, forcing final response`);
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          ...toolUseBlocks.map(block => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "[Max iterations reached]",
          })),
          { type: "text" as const, text: "Now please generate the trending topics based on the search results." }
        ],
      });
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages,
      });
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    res.json({ text: textBlock.text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating trending topics:", errorMessage);
    console.error("Full error:", error);
    res.status(500).json({ error: "Failed to generate trending topics", details: errorMessage });
  }
});

// Generate Trending Topics with Real Sources
app.post("/api/generateTrendingTopicsWithSources", async (req, res) => {
  try {
    const { audience, sources } = req.body;
    const audienceDescription = getAudienceDescription(audience);

    const userMessage = `
    You are an AI news analyst. Your task is to identify and summarize 2-3 of the most compelling developments from real, trending sources.

    Here are the current trending sources from various AI communities:
    ${sources}

    Your analysis MUST be tailored for a specific audience:
    ${audienceDescription}

    Based on these real sources, identify the most relevant and important trends. For each development, provide a concise title and a brief, easy-to-understand summary explaining what it is and why it's important for this audience.

    The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object, including markdown backticks.
    Each object in the array should have the following structure:
    {
      "title": "A concise title for the trending topic",
      "summary": "A brief summary of the topic and its relevance to the audience."
    }

    Example format:
    [
        {
            "title": "Latest AI Research Breakthrough",
            "summary": "Recent developments in AI are enabling new capabilities relevant to your field."
        },
        {
            "title": "Emerging AI Tools for Professionals",
            "summary": "New tools are emerging that can help professionals in your area stay ahead."
        }
    ]
  ` + searchGuidance;

    const systemPrompt = `You are an AI news analyst specializing in identifying trending AI developments from real sources. Your task is to analyze provided trending sources and summarize the most relevant developments for specific audiences. The final output MUST be a valid JSON array of objects. Do not include any text outside of the JSON object.`;

    let messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let response = await (await getAnthropicClient()).messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [webSearchTool],
      messages: messages,
    });

    // Handle tool calls with iteration cap (token optimization)
    let srcIterations = 0;
    while (response.stop_reason === "tool_use" && srcIterations < MAX_SEARCH_ITERATIONS) {
      srcIterations++;
      console.log(`[TrendingWithSources] Agentic loop iteration ${srcIterations}/${MAX_SEARCH_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      messages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolResult = await processToolCall(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, string>
        );
        toolResultContent.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      messages.push({
        role: "user",
        content: toolResultContent,
      });

      response = await (await getAnthropicClient()).messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    // If we hit max iterations and response is still tool_use, force a final text response
    if (srcIterations >= MAX_SEARCH_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[TrendingWithSources] Reached max iterations, forcing final response`);
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          ...toolUseBlocks.map(block => ({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "[Max iterations reached]",
          })),
          { type: "text" as const, text: "Now please generate the trending topics with sources based on the search results." }
        ],
      });
      response = await (await getAnthropicClient()).messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages,
      });
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      throw new Error("No text response from Claude");
    }

    res.json({ text: textBlock.text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating trending topics with sources:", errorMessage);
    console.error("Full error:", error);
    res.status(500).json({ error: "Failed to generate trending topics with sources", details: errorMessage });
  }
});

// Image Generation via Stability AI
app.post("/api/generateImage", async (req, res) => {
  try {
    const { prompt, imageStyle } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Get Stability API key from SQLite first, fallback to env var
    let stabilityApiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'stability') : null;
    if (!stabilityApiKey) {
      stabilityApiKey = process.env.VITE_STABILITY_API_KEY || null;
    }
    if (!stabilityApiKey) {
      return res.status(500).json({ error: "Stability AI API key not configured" });
    }

    // Map image style to description
    const imageStyleMap: Record<string, string> = {
      photorealistic: "photorealistic",
      vector: "vector illustration",
      watercolor: "watercolor painting",
      pixel: "pixel art",
      minimalist: "minimalist line art",
      oilPainting: "oil painting",
    };
    const styleDescription = imageStyleMap[imageStyle] || "photorealistic";

    // Prepend style to prompt to ensure it's applied
    const styledPrompt = `${styleDescription} style: ${prompt}`;

    console.log(`Generating image for prompt: ${styledPrompt.substring(0, 80)}...`);

    const formData = new FormData();
    formData.append("prompt", styledPrompt);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", "1:1");

    const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stabilityApiKey}`,
        "Accept": "application/json",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Stability AI error:", response.status, errorText);
      return res.status(response.status).json({
        error: `Stability AI API error: ${response.status}`,
        details: errorText,
      });
    }

    const responseJson = await response.json() as {
      image?: string;
      errors?: string[];
    };

    if (responseJson.errors && responseJson.errors.length > 0) {
      return res.status(400).json({
        error: "Image generation failed",
        details: responseJson.errors.join(", "),
      });
    }

    if (responseJson.image) {
      console.log("Image generated successfully");
      return res.json({ image: responseJson.image });
    }

    return res.status(500).json({ error: "No image in Stability AI response" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating image:", errorMessage);
    res.status(500).json({ error: "Failed to generate image", details: errorMessage });
  }
});

// ===================================================================
// PRESET MANAGEMENT ENDPOINTS
// ===================================================================

// Save presets to Google Sheets
app.post("/api/savePresets", async (req, res) => {
  try {
    const { presets, accessToken } = req.body;

    if (!presets || !Array.isArray(presets)) {
      return res.status(400).json({ error: "Invalid presets data" });
    }

    if (!accessToken) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Call the Google Sheets API to save presets
    // We need to temporarily set the access token in a way that googleApiService can use it
    // Since we can't modify googleApiService directly from here, we'll use the Google API directly

    const sheetName = "Newsletter Presets";
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
    const encodedQuery = encodeURIComponent(query);

    // Check if presets sheet exists
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!listResponse.ok) {
      return res.status(listResponse.status).json({ error: "Failed to access Google Sheets" });
    }

    const listResult = await listResponse.json();
    let sheetId = listResult.files?.[0]?.id;

    // Create sheet if it doesn't exist
    if (!sheetId) {
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: sheetName }
        })
      });

      if (!createResponse.ok) {
        return res.status(createResponse.status).json({ error: "Failed to create presets sheet" });
      }

      const spreadsheet = await createResponse.json();
      sheetId = spreadsheet.spreadsheetId;

      // Add headers
      const headers = ['Preset Name', 'Audience', 'Tone', 'Flavors', 'Topics', 'Image Style', 'Created Date'];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [headers] })
        }
      );
    }

    // Convert presets to rows
    const rows = presets.map((preset: any) => [
      preset.name,
      JSON.stringify(preset.settings.selectedAudience),
      preset.settings.selectedTone,
      JSON.stringify(preset.settings.selectedFlavors),
      JSON.stringify(preset.settings.selectedTopics || []),
      preset.settings.selectedImageStyle,
      new Date().toISOString()
    ]);

    // Clear existing data
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 1
              }
            }
          }]
        })
      }
    ).catch(() => {
      // Ignore errors on clear, will append instead
    });

    // Append rows
    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: rows })
      }
    );

    if (!appendResponse.ok) {
      return res.status(appendResponse.status).json({ error: "Failed to save presets" });
    }

    res.json({ message: `${presets.length} preset(s) saved to Google Sheets` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving presets:", errorMessage);
    res.status(500).json({ error: "Failed to save presets", details: errorMessage });
  }
});

// Load presets from Google Sheets
app.get("/api/loadPresets", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      return res.status(401).json({ error: "Access token required" });
    }

    const sheetName = "Newsletter Presets";
    const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`;
    const encodedQuery = encodeURIComponent(query);

    // Find presets sheet
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!listResponse.ok) {
      return res.status(listResponse.status).json({ error: "Failed to access Google Sheets" });
    }

    const listResult = await listResponse.json();
    const sheetId = listResult.files?.[0]?.id;

    // If sheet doesn't exist, return empty presets
    if (!sheetId) {
      return res.json({ presets: [] });
    }

    // Read preset rows
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'Sheet1'!A2:G`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!readResponse.ok) {
      return res.status(readResponse.status).json({ error: "Failed to read presets" });
    }

    const data = await readResponse.json();
    const rows = data.values || [];

    // Convert rows back to presets
    const presets = rows
      .filter((row: any[]) => row[0])
      .map((row: any[]) => ({
        name: row[0],
        settings: {
          selectedAudience: row[1] ? JSON.parse(row[1]) : {},
          selectedTone: row[2] || 'professional',
          selectedFlavors: row[3] ? JSON.parse(row[3]) : {},
          selectedTopics: row[4] ? JSON.parse(row[4]) : [],
          selectedImageStyle: row[5] || 'photorealistic'
        }
      }));

    res.json({ presets });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error loading presets:", errorMessage);
    res.status(500).json({ error: "Failed to load presets", details: errorMessage });
  }
});

// ===================================================================
// ARCHIVE MANAGEMENT ENDPOINTS
// ===================================================================

// Get all archives (newest first)
app.get("/api/archives", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const archives = archiveService.getArchives(limit);
    res.json({ archives, count: archives.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching archives:", errorMessage);
    res.status(500).json({ error: "Failed to fetch archives", details: errorMessage });
  }
});

// Get single archive by ID
app.get("/api/archives/:id", (req, res) => {
  try {
    const archive = archiveService.getArchiveById(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: "Archive not found" });
    }
    res.json(archive);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching archive:", errorMessage);
    res.status(500).json({ error: "Failed to fetch archive", details: errorMessage });
  }
});

// Save new archive
app.post("/api/archives", (req, res) => {
  try {
    const { content, audience, name } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const archive = archiveService.saveArchive(content, audience || [], name);
    res.json(archive);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving archive:", errorMessage);
    res.status(500).json({ error: "Failed to save archive", details: errorMessage });
  }
});

// Delete archive by ID
app.delete("/api/archives/:id", (req, res) => {
  try {
    const success = archiveService.deleteArchive(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Archive not found" });
    }
    res.json({ success: true, message: "Archive deleted" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting archive:", errorMessage);
    res.status(500).json({ error: "Failed to delete archive", details: errorMessage });
  }
});

// Search archives by name
app.get("/api/archives/search/:query", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const archives = archiveService.searchArchives(req.params.query, limit);
    res.json({ archives, count: archives.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error searching archives:", errorMessage);
    res.status(500).json({ error: "Failed to search archives", details: errorMessage });
  }
});

// ===================================================================
// NEWSLETTER MANAGEMENT ENDPOINTS
// ===================================================================

// Get all newsletters with format version (newest first) - supports v1 and v2
app.get("/api/newsletters", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const newsletters = newsletterDbService.getNewslettersWithFormat(limit);
    res.json({ newsletters, count: newsletters.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching newsletters:", errorMessage);
    res.status(500).json({ error: "Failed to fetch newsletters", details: errorMessage });
  }
});

// Get enhanced newsletter by ID (v2 format only) - must come before :id route
app.get("/api/newsletters/:id/enhanced", (req, res) => {
  try {
    const newsletter = newsletterDbService.getEnhancedNewsletterById(req.params.id);
    if (!newsletter) {
      return res.status(404).json({ error: "Enhanced newsletter not found or not v2 format" });
    }
    res.json(newsletter);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching enhanced newsletter:", errorMessage);
    res.status(500).json({ error: "Failed to fetch enhanced newsletter", details: errorMessage });
  }
});

// Get single newsletter by ID with format detection
app.get("/api/newsletters/:id", (req, res) => {
  try {
    const result = newsletterDbService.getNewsletterByIdWithFormat(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Newsletter not found" });
    }
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching newsletter:", errorMessage);
    res.status(500).json({ error: "Failed to fetch newsletter", details: errorMessage });
  }
});

// Save new newsletter
app.post("/api/newsletters", (req, res) => {
  try {
    const { newsletter, topics, settings } = req.body;

    if (!newsletter || !newsletter.id || !newsletter.subject) {
      return res.status(400).json({ error: "Newsletter with id and subject is required" });
    }

    const saved = newsletterDbService.saveNewsletter(newsletter, topics || [], settings);
    res.json(saved);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving newsletter:", errorMessage);
    res.status(500).json({ error: "Failed to save newsletter", details: errorMessage });
  }
});

// Delete newsletter by ID
app.delete("/api/newsletters/:id", (req, res) => {
  try {
    const success = newsletterDbService.deleteNewsletter(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Newsletter not found" });
    }
    res.json({ success: true, message: "Newsletter deleted" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting newsletter:", errorMessage);
    res.status(500).json({ error: "Failed to delete newsletter", details: errorMessage });
  }
});

// Update newsletter sections (to save imageUrls after client-side generation)
app.patch("/api/newsletters/:id/sections", (req, res) => {
  try {
    const { sections, audienceSections, formatVersion } = req.body;
    let success = false;

    if (formatVersion === 'v2' && audienceSections) {
      success = newsletterDbService.updateEnhancedNewsletterSections(req.params.id, audienceSections);
    } else if (sections) {
      success = newsletterDbService.updateNewsletterSections(req.params.id, sections);
    } else {
      return res.status(400).json({ error: "Missing sections or audienceSections" });
    }

    if (!success) {
      return res.status(404).json({ error: "Newsletter not found" });
    }

    res.json({ success: true, message: "Newsletter sections updated" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating newsletter sections:", errorMessage);
    res.status(500).json({ error: "Failed to update newsletter sections", details: errorMessage });
  }
});

// Log newsletter action
app.post("/api/newsletters/:id/log", (req, res) => {
  try {
    const { action, details } = req.body;

    if (!['created', 'saved_to_drive', 'sent_email'].includes(action)) {
      return res.status(400).json({ error: "Invalid action type" });
    }

    newsletterDbService.logAction(req.params.id, action, details);
    res.json({ success: true, message: `Action '${action}' logged` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error logging action:", errorMessage);
    res.status(500).json({ error: "Failed to log action", details: errorMessage });
  }
});

// Get newsletter logs
app.get("/api/newsletters/:id/logs", (req, res) => {
  try {
    const logs = newsletterDbService.getNewsletterLogs(req.params.id);
    res.json({ logs });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching logs:", errorMessage);
    res.status(500).json({ error: "Failed to fetch logs", details: errorMessage });
  }
});

// ===================================================================
// SAVED PROMPTS LIBRARY ENDPOINTS
// ===================================================================

// Get all saved prompts
app.get("/api/prompts", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const prompts = promptDbService.getPrompts(limit);
    const count = promptDbService.getPromptCount();
    res.json({ prompts, count });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching prompts:", errorMessage);
    res.status(500).json({ error: "Failed to fetch prompts", details: errorMessage });
  }
});

// Get single prompt by ID
app.get("/api/prompts/:id", (req, res) => {
  try {
    const prompt = promptDbService.getPromptById(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    res.json(prompt);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching prompt:", errorMessage);
    res.status(500).json({ error: "Failed to fetch prompt", details: errorMessage });
  }
});

// Save new prompt to library
app.post("/api/prompts", (req, res) => {
  try {
    const { title, summary, examplePrompts, promptCode } = req.body;

    if (!title || !promptCode) {
      return res.status(400).json({ error: "Title and promptCode are required" });
    }

    const savedPrompt = promptDbService.savePrompt({
      title,
      summary: summary || '',
      examplePrompts: examplePrompts || [],
      promptCode,
    });

    res.status(201).json(savedPrompt);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving prompt:", errorMessage);
    res.status(500).json({ error: "Failed to save prompt", details: errorMessage });
  }
});

// Delete prompt from library
app.delete("/api/prompts/:id", (req, res) => {
  try {
    const deleted = promptDbService.deletePrompt(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    res.json({ success: true, message: "Prompt deleted successfully" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting prompt:", errorMessage);
    res.status(500).json({ error: "Failed to delete prompt", details: errorMessage });
  }
});

// ===================================================================
// SUBSCRIBER MANAGEMENT ENDPOINTS
// ===================================================================

// Get all subscribers with optional filters
app.get("/api/subscribers", (req, res) => {
  try {
    const status = req.query.status as 'active' | 'inactive' | 'all' | undefined;
    const listId = req.query.listId as string | undefined;

    const subscribers = subscriberDbService.getSubscribers({ status, listId });
    res.json({ subscribers, count: subscribers.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching subscribers:", errorMessage);
    res.status(500).json({ error: "Failed to fetch subscribers", details: errorMessage });
  }
});

// Get single subscriber by email
app.get("/api/subscribers/:email", (req, res) => {
  try {
    const subscriber = subscriberDbService.getSubscriberByEmail(req.params.email);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    res.json(subscriber);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching subscriber:", errorMessage);
    res.status(500).json({ error: "Failed to fetch subscriber", details: errorMessage });
  }
});

// Add new subscriber
app.post("/api/subscribers", (req, res) => {
  try {
    const { email, name, status, lists, source } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const subscriber = subscriberDbService.addSubscriber({
      email,
      name,
      status: status || 'active',
      lists: lists || '',
      source: source || 'manual'
    });

    res.json(subscriber);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding subscriber:", errorMessage);
    res.status(500).json({ error: "Failed to add subscriber", details: errorMessage });
  }
});

// Update subscriber
app.put("/api/subscribers/:email", (req, res) => {
  try {
    const updates = req.body;
    const subscriber = subscriberDbService.updateSubscriber(req.params.email, updates);

    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    res.json(subscriber);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating subscriber:", errorMessage);
    res.status(500).json({ error: "Failed to update subscriber", details: errorMessage });
  }
});

// Delete subscriber (soft delete)
app.delete("/api/subscribers/:email", (req, res) => {
  try {
    const success = subscriberDbService.deleteSubscriber(req.params.email);
    if (!success) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    res.json({ success: true, message: "Subscriber deactivated" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting subscriber:", errorMessage);
    res.status(500).json({ error: "Failed to delete subscriber", details: errorMessage });
  }
});

// Bulk import subscribers
app.post("/api/subscribers/import", (req, res) => {
  try {
    const { subscribers } = req.body;

    if (!Array.isArray(subscribers)) {
      return res.status(400).json({ error: "subscribers array is required" });
    }

    const result = subscriberDbService.importSubscribers(subscribers);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error importing subscribers:", errorMessage);
    res.status(500).json({ error: "Failed to import subscribers", details: errorMessage });
  }
});

// ===================================================================
// SUBSCRIBER LIST ENDPOINTS
// ===================================================================

// Get all lists
app.get("/api/lists", (req, res) => {
  try {
    const lists = subscriberDbService.getLists();
    res.json({ lists, count: lists.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching lists:", errorMessage);
    res.status(500).json({ error: "Failed to fetch lists", details: errorMessage });
  }
});

// Get single list by ID
app.get("/api/lists/:id", (req, res) => {
  try {
    const list = subscriberDbService.getListById(req.params.id);
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }
    res.json(list);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching list:", errorMessage);
    res.status(500).json({ error: "Failed to fetch list", details: errorMessage });
  }
});

// Create new list
app.post("/api/lists", (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "List name is required" });
    }

    const list = subscriberDbService.createList(name, description);
    res.json(list);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating list:", errorMessage);
    res.status(500).json({ error: "Failed to create list", details: errorMessage });
  }
});

// Update list
app.put("/api/lists/:id", (req, res) => {
  try {
    const updates = req.body;
    const list = subscriberDbService.updateList(req.params.id, updates);

    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }

    res.json(list);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating list:", errorMessage);
    res.status(500).json({ error: "Failed to update list", details: errorMessage });
  }
});

// Delete list
app.delete("/api/lists/:id", (req, res) => {
  try {
    const success = subscriberDbService.deleteList(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "List not found" });
    }
    res.json({ success: true, message: "List deleted" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting list:", errorMessage);
    res.status(500).json({ error: "Failed to delete list", details: errorMessage });
  }
});

// Add subscriber to list
app.post("/api/lists/:id/subscribers", (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const success = subscriberDbService.addSubscriberToList(email, req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Subscriber or list not found" });
    }

    res.json({ success: true, message: "Subscriber added to list" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding subscriber to list:", errorMessage);
    res.status(500).json({ error: "Failed to add subscriber to list", details: errorMessage });
  }
});

// Remove subscriber from list
app.delete("/api/lists/:id/subscribers/:email", (req, res) => {
  try {
    const success = subscriberDbService.removeSubscriberFromList(req.params.email, req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    res.json({ success: true, message: "Subscriber removed from list" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error removing subscriber from list:", errorMessage);
    res.status(500).json({ error: "Failed to remove subscriber from list", details: errorMessage });
  }
});

// Get subscribers in a list
app.get("/api/lists/:id/subscribers", (req, res) => {
  try {
    const subscribers = subscriberDbService.getSubscribersByList(req.params.id);
    res.json({ subscribers, count: subscribers.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching list subscribers:", errorMessage);
    res.status(500).json({ error: "Failed to fetch list subscribers", details: errorMessage });
  }
});

// ===================================================================
// API KEY MANAGEMENT ENDPOINTS
// ===================================================================

// List all API key statuses for a user
app.get("/api/keys", (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const statuses = apiKeyDbService.listApiKeyStatuses(userEmail);
    res.json({ statuses });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error listing API key statuses:", errorMessage);
    res.status(500).json({ error: "Failed to list API key statuses", details: errorMessage });
  }
});

// Save an API key
app.post("/api/keys", async (req, res) => {
  try {
    const { userEmail, service, key } = req.body;

    if (!userEmail || !service || !key) {
      return res.status(400).json({ error: "userEmail, service, and key are required" });
    }

    const validServices = ['claude', 'stability', 'brave', 'google_api_key', 'google_client_id', 'google_client_secret'];
    if (!validServices.includes(service)) {
      return res.status(400).json({ error: `Invalid service. Must be one of: ${validServices.join(', ')}` });
    }

    const record = apiKeyDbService.saveApiKey(userEmail, service, key);
    res.json({ success: true, record: { service: record.service, isValid: record.isValid } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving API key:", errorMessage);
    res.status(500).json({ error: "Failed to save API key", details: errorMessage });
  }
});

// Delete an API key
app.delete("/api/keys/:service", (req, res) => {
  try {
    const { service } = req.params;
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const success = apiKeyDbService.deleteApiKey(userEmail, service as apiKeyDbService.ServiceType);

    if (!success) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ success: true, message: "API key deleted" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error deleting API key:", errorMessage);
    res.status(500).json({ error: "Failed to delete API key", details: errorMessage });
  }
});

// Validate an API key
app.post("/api/keys/:service/validate", async (req, res) => {
  try {
    const { service } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail is required" });
    }

    const apiKey = apiKeyDbService.getApiKey(userEmail, service as apiKeyDbService.ServiceType);

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found", isValid: false });
    }

    let isValid = false;

    // Validate based on service type
    switch (service) {
      case 'claude':
        isValid = await validateClaudeApiKey(apiKey);
        break;
      case 'stability':
        isValid = await validateStabilityApiKey(apiKey);
        break;
      case 'brave':
        isValid = await validateBraveApiKey(apiKey);
        break;
      case 'google_api_key':
        // Google API keys start with 'AIza'
        isValid = apiKey.startsWith('AIza');
        break;
      case 'google_client_id':
        // Google Client IDs contain '.apps.googleusercontent.com'
        isValid = apiKey.includes('.apps.googleusercontent.com');
        break;
      case 'google_client_secret':
        // Google Client Secrets start with 'GOCSPX-'
        isValid = apiKey.startsWith('GOCSPX-');
        break;
      default:
        return res.status(400).json({ error: "Invalid service type" });
    }

    // Update validation status in database
    apiKeyDbService.updateValidationStatus(userEmail, service as apiKeyDbService.ServiceType, isValid);

    res.json({ isValid });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error validating API key:", errorMessage);
    res.status(500).json({ error: "Failed to validate API key", details: errorMessage, isValid: false });
  }
});

// Get Google credentials for frontend initialization
// NOTE: This endpoint exposes Google API Key and Client ID which are semi-public
// (they're embedded in frontend code anyway). The actual OAuth flow still requires
// user consent and the redirect URI must match what's configured in Google Cloud Console.
app.get("/api/keys/google/credentials", (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const apiKey = apiKeyDbService.getApiKey(userEmail, 'google_api_key');
    const clientId = apiKeyDbService.getApiKey(userEmail, 'google_client_id');

    if (!apiKey && !clientId) {
      return res.json({ configured: false, apiKey: null, clientId: null });
    }

    res.json({
      configured: !!(apiKey && clientId),
      apiKey: apiKey || null,
      clientId: clientId || null
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching Google credentials:", errorMessage);
    res.status(500).json({ error: "Failed to fetch Google credentials", details: errorMessage });
  }
});

// Helper: Validate Claude API key
async function validateClaudeApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey });
    // Make a minimal API call to validate the key
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "Hi" }]
    });
    return true;
  } catch (error) {
    console.warn("[Validation] Claude API key validation failed:", error);
    return false;
  }
}

// Helper: Validate Stability API key
async function validateStabilityApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.stability.ai/v1/user/account", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    });
    return response.ok;
  } catch (error) {
    console.warn("[Validation] Stability API key validation failed:", error);
    return false;
  }
}

// Helper: Validate Brave API key
async function validateBraveApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.search.brave.com/res/v1/web/search?q=test&count=1", {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey
      }
    });
    return response.ok;
  } catch (error) {
    console.warn("[Validation] Brave API key validation failed:", error);
    return false;
  }
}

// ================== Google OAuth Routes ==================

// Get authorization URL for OAuth consent screen
app.get("/api/oauth/google/url", (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const url = googleOAuthService.getAuthorizationUrl(userEmail);

    if (!url) {
      return res.status(400).json({
        error: "Failed to generate authorization URL. Please configure Google Client ID and Client Secret in Settings."
      });
    }

    res.json({ url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[OAuth] Error generating auth URL:", errorMessage);
    res.status(500).json({ error: "Failed to generate authorization URL", details: errorMessage });
  }
});

// OAuth callback - handles redirect from Google consent screen
app.get("/api/oauth/google/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    // Handle user declining permissions
    if (error) {
      console.log("[OAuth] User declined permissions:", error);
      return res.redirect(`http://localhost:5173/?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect("http://localhost:5173/?oauth_error=missing_params");
    }

    // Parse state to get user email
    const stateData = googleOAuthService.parseState(state);
    if (!stateData) {
      return res.redirect("http://localhost:5173/?oauth_error=invalid_state");
    }

    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code, stateData.userEmail);

    if (!tokens) {
      return res.redirect("http://localhost:5173/?oauth_error=token_exchange_failed");
    }

    console.log("[OAuth] Successfully authenticated:", stateData.userEmail);

    // Redirect back to frontend with success
    res.redirect(`http://localhost:5173/?oauth_success=true&email=${encodeURIComponent(stateData.userEmail)}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[OAuth] Callback error:", errorMessage);
    res.redirect(`http://localhost:5173/?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
});

// Check OAuth status for a user
app.get("/api/oauth/google/status", async (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const hasValidTokens = googleOAuthService.hasValidTokens(userEmail);

    // Get user info if authenticated
    let userInfo = null;
    if (hasValidTokens) {
      userInfo = await googleOAuthService.getUserInfo(userEmail);
    }

    res.json({
      authenticated: hasValidTokens,
      userInfo
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[OAuth] Status check error:", errorMessage);
    res.status(500).json({ error: "Failed to check OAuth status", details: errorMessage });
  }
});

// Revoke OAuth tokens (sign out of Google)
app.post("/api/oauth/google/revoke", async (req, res) => {
  try {
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail is required" });
    }

    await googleOAuthService.revokeTokens(userEmail);
    res.json({ success: true, message: "Successfully disconnected from Google" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[OAuth] Revoke error:", errorMessage);
    res.status(500).json({ error: "Failed to revoke tokens", details: errorMessage });
  }
});

// ================== Google Drive Routes ==================

// Save newsletter to Drive
app.post("/api/drive/save", async (req, res) => {
  try {
    const { userEmail, content, filename } = req.body;

    if (!userEmail || !content || !filename) {
      return res.status(400).json({ error: "userEmail, content, and filename are required" });
    }

    const result = await googleDriveService.saveNewsletter(userEmail, content, filename);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Drive] Save error:", errorMessage);
    res.status(500).json({ error: "Failed to save to Drive", details: errorMessage });
  }
});

// Load newsletter from Drive
app.get("/api/drive/load/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const result = await googleDriveService.loadNewsletter(userEmail, fileId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Drive] Load error:", errorMessage);
    res.status(500).json({ error: "Failed to load from Drive", details: errorMessage });
  }
});

// List newsletters from Drive
app.get("/api/drive/list", async (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const pageToken = req.query.pageToken as string | undefined;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const result = await googleDriveService.listNewsletters(userEmail, pageSize, pageToken);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Drive] List error:", errorMessage);
    res.status(500).json({ error: "Failed to list newsletters", details: errorMessage });
  }
});

// Delete newsletter from Drive
app.delete("/api/drive/delete/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const result = await googleDriveService.deleteNewsletter(userEmail, fileId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Drive] Delete error:", errorMessage);
    res.status(500).json({ error: "Failed to delete from Drive", details: errorMessage });
  }
});

// ================== Gmail Routes ==================

// Send email via Gmail
app.post("/api/gmail/send", async (req, res) => {
  try {
    const { userEmail, to, subject, htmlBody } = req.body;

    if (!userEmail || !to || !subject || !htmlBody) {
      return res.status(400).json({ error: "userEmail, to, subject, and htmlBody are required" });
    }

    const result = await googleGmailService.sendEmail(userEmail, { to, subject, htmlBody });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Gmail] Send error:", errorMessage);
    res.status(500).json({ error: "Failed to send email", details: errorMessage });
  }
});

// Send bulk emails via Gmail
app.post("/api/gmail/send-bulk", async (req, res) => {
  try {
    const { userEmail, recipients, subject, htmlBody } = req.body;

    if (!userEmail || !recipients || !Array.isArray(recipients) || !subject || !htmlBody) {
      return res.status(400).json({ error: "userEmail, recipients (array), subject, and htmlBody are required" });
    }

    const result = await googleGmailService.sendBulkEmails(userEmail, recipients, subject, htmlBody);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Gmail] Bulk send error:", errorMessage);
    res.status(500).json({ error: "Failed to send bulk emails", details: errorMessage });
  }
});

// Get Gmail profile
app.get("/api/gmail/profile", async (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      return res.status(400).json({ error: "userEmail query parameter is required" });
    }

    const result = await googleGmailService.getProfile(userEmail);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Gmail] Profile error:", errorMessage);
    res.status(500).json({ error: "Failed to get Gmail profile", details: errorMessage });
  }
});

// ============================================================================
// UNIFIED LOGS ENDPOINTS
// ============================================================================

// Get unified logs with filtering
app.get("/api/logs", (req, res) => {
  try {
    const options: logDbService.LogFilterOptions = {
      source: req.query.source as logDbService.LogSource | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = logDbService.getUnifiedLogs(options);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Logs] Get logs error:", errorMessage);
    res.status(500).json({ error: "Failed to fetch logs", details: errorMessage });
  }
});

// Export logs to CSV
app.get("/api/logs/export", (req, res) => {
  try {
    const options: logDbService.LogFilterOptions = {
      source: req.query.source as logDbService.LogSource | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
    };

    const csvContent = logDbService.exportLogsToCsv(options);
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=system-logs-${timestamp}.csv`);
    res.send(csvContent);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Logs] Export error:", errorMessage);
    res.status(500).json({ error: "Failed to export logs", details: errorMessage });
  }
});

// Get log statistics
app.get("/api/logs/stats", (req, res) => {
  try {
    const stats = logDbService.getLogStats();
    res.json(stats);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Logs] Stats error:", errorMessage);
    res.status(500).json({ error: "Failed to fetch log stats", details: errorMessage });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
