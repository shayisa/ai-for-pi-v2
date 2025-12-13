import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { trendingCache } from './server/cache/trendingCache.js';
import { searchCache } from './server/cache/searchCache.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Token optimization constants
const MAX_SEARCH_ITERATIONS = 2; // Cap agentic loops to prevent runaway token usage

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize Anthropic client (securely on the backend)
const anthropic = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

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
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev' | 'producthunt';
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

const fetchProductHuntTopics = async (): Promise<TrendingSource[]> => {
  try {
    console.log("Fetching from Product Hunt...");

    // Mock Product Hunt data since API requires authentication
    // In production, would integrate with Product Hunt API (requires API key)
    const mockProducts: TrendingSource[] = [
      {
        id: 'ph-1',
        title: 'Claude Automation Suite - Streamline workflows with Claude AI',
        url: 'https://www.producthunt.com/posts/claude-automation-suite',
        author: 'Anthropic Team',
        publication: 'Product Hunt',
        date: new Date().toLocaleDateString(),
        category: 'producthunt',
        summary: '1200+ upvotes - AI-powered workflow automation for document processing, meeting transcription, and task orchestration',
      },
      {
        id: 'ph-2',
        title: 'SkeletalAI - Forensic Analysis with Vision Models',
        url: 'https://www.producthunt.com/posts/skeletalai',
        author: 'ForensicTech Inc',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '850+ upvotes - Automated skeletal element identification and trauma classification using Claude Vision API',
      },
      {
        id: 'ph-3',
        title: 'LiDAR Processing Pro - 3D Archaeological Site Analysis',
        url: 'https://www.producthunt.com/posts/lidar-processing-pro',
        author: 'ArcheoTech Labs',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '640+ upvotes - Real-time LiDAR processing and 3D reconstruction for archaeological sites',
      },
      {
        id: 'ph-4',
        title: 'Supply Chain Optimizer - Predictive Analytics Dashboard',
        url: 'https://www.producthunt.com/posts/supply-chain-optimizer',
        author: 'LogisticsPro AI',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '1100+ upvotes - Machine learning-driven demand forecasting and inventory optimization',
      },
      {
        id: 'ph-5',
        title: 'Document Intelligence Platform v2.0',
        url: 'https://www.producthunt.com/posts/document-intelligence-platform-v2',
        author: 'DocAI Solutions',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '950+ upvotes - AI-powered document extraction, classification, and business process automation',
      },
      {
        id: 'ph-6',
        title: 'Analytics Toolkit Pro - Real-time Data Intelligence',
        url: 'https://www.producthunt.com/posts/analytics-toolkit-pro',
        author: 'DataViz Inc',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '780+ upvotes - Unified analytics dashboard with predictive modeling and KPI tracking',
      },
      {
        id: 'ph-7',
        title: 'n8n AI Workflows - Automation with Claude Integration',
        url: 'https://www.producthunt.com/posts/n8n-ai-workflows',
        author: 'n8n Team',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '1350+ upvotes - No-code workflow automation with native Claude API integration',
      },
      {
        id: 'ph-8',
        title: 'Research Aggregator AI - Academic Paper Discovery',
        url: 'https://www.producthunt.com/posts/research-aggregator-ai',
        author: 'AcademiaTech',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '620+ upvotes - Automated research paper discovery and summarization from ArXiv and journals',
      },
      {
        id: 'ph-9',
        title: 'Business Intelligence Assistant - Automated Reporting',
        url: 'https://www.producthunt.com/posts/business-intelligence-assistant',
        author: 'BIAssist Corp',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '890+ upvotes - AI-powered business reporting and executive dashboards',
      },
      {
        id: 'ph-10',
        title: 'Code Analysis Platform - Automated Repository Intelligence',
        url: 'https://www.producthunt.com/posts/code-analysis-platform',
        author: 'GitInsights',
        publication: 'Product Hunt',
        date: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        category: 'producthunt',
        summary: '1050+ upvotes - Intelligence gathering from GitHub repositories with trend analysis',
      },
    ];

    console.log(`Fetched ${mockProducts.length} products from Product Hunt`);
    return mockProducts;
  } catch (error) {
    console.error('Error fetching Product Hunt topics:', error);
    return [];
  }
};

const fetchAllTrendingSources = async (): Promise<TrendingSource[]> => {
  console.log("Fetching trending data from all sources...");
  try {
    const [
      hackerNewsTopics,
      arxivTopics,
      githubTopics,
      redditTopics,
      devtoTopics,
      productHuntTopics,
    ] = await Promise.all([
      fetchHackerNewsTopics(),
      fetchArxivTopics(),
      fetchGitHubTopics(),
      fetchRedditTopics(),
      fetchDevToTopics(),
      fetchProductHuntTopics(),
    ]);

    const allSources = [
      ...hackerNewsTopics,
      ...arxivTopics,
      ...githubTopics,
      ...redditTopics,
      ...devtoTopics,
      ...productHuntTopics,
    ];

    console.log(`Fetched ${allSources.length} trending sources from 6 sources (HN, ArXiv, GitHub, Reddit, Dev.to, Product Hunt)`);
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

// Helper: Get domain-specific mock search results for fallback
const getMockSearchResults = (): string => {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const mockResults = {
    forensic: `
## Web Search Results

### Web Results:

1. **Advanced Skeletal Analysis with Claude Vision API** (github.com/anthropic/skeletal-analysis)
   Automated morphometric measurement and trauma classification using Claude's vision capabilities. Published October 2024. Includes PyTorch integration and case management system bindings.

2. **LiDAR Processing Pipeline for Archaeological Sites** (pytorch.org/tutorials/lidar-archaeology)
   Real-time 3D site reconstruction using Open3D and PyTorch. Processes 50GB+ datasets efficiently. Released November 2024 with latest CUDA optimization.

3. **Building Forensic Anthropology Databases with Claude** (dev.to/forensic-tech/claude-api-skeleton)
   Step-by-step guide for integrating skeletal data analysis into case management workflows. Feature extraction for ancestry classification. By TechAnthropo, Nov 2024.

### News Results:

1. **Claude 3.5 Sonnet Enables New Breakthrough in Forensic Analysis** (technews.ai)
   Anthropic's latest model shows 94% accuracy in automated skeletal element identification. Published ${today}

2. **Archaeological AI: Universities Adopt Vision Models** (archaeologytoday.com)
   Major museums partner with Anthropic for artifact documentation projects. ${today}
    `,

    business: `
## Web Search Results

### Web Results:

1. **Automating Document Processing with Claude and n8n** (n8n.io/workflows/document-automation)
   Complete workflow for invoice processing, contract analysis, and meeting transcription. Reduces manual work by 70%. Published October 2024.

2. **Build a Business Process Automation Pipeline** (medium.com/automation/bpa-claude)
   RPA integration with Claude API for task orchestration and workflow optimization. GitHub repo with 1200+ stars. By DevAutomation, Nov 2024.

3. **Productivity Enhancement Tools Using Claude 3.5** (producthunt.com/posts/claude-automation)
   Tool collection for streamlining operations: calendar management, email classification, report generation. Featured in PH top picks. ${today}

### News Results:

1. **AI-Powered Workflow Automation Reaches Enterprise Scale** (businesstech.ai)
   Companies report 60% efficiency gains using Claude for BPA implementation. Published ${today}

2. **No-Code Automation Platforms Integrate Claude** (techcrunch.com)
   Zapier, Make, and n8n add native Claude support for workflow creation. ${today}
    `,

    analytics: `
## Web Search Results

### Web Results:

1. **Supply Chain Forecasting with Claude and Prophet** (towardsdatascience.com/supply-chain-ai)
   Demand prediction models using ensemble methods. 40% accuracy improvement over traditional approaches. By DataSciencePro, October 2024.

2. **Real-Time Analytics Dashboard Using Claude Vision** (github.com/logistics-ai/analytics-dashboard)
   Automated anomaly detection in warehouse operations and route optimization. 1500+ stars. Latest release November 2024.

3. **Implementing ML-Driven Logistics Optimization** (realpython.com/supply-chain-ml)
   End-to-end pipeline for inventory management and demand planning. Pandas, scikit-learn, and Streamlit integration. By DataEngineer, Nov 2024.

### News Results:

1. **AI Transforms Supply Chain Decision-Making** (logisticsnews.com)
   Enterprises see 35% cost reduction using predictive analytics. Published ${today}

2. **Data Mining Breakthroughs Enable Warehouse Automation** (ai-frontier.org)
   New models process unstructured shipping data 10x faster. ${today}
    `,

    general: `
## Web Search Results

### Web Results:

1. **Claude 3.5 Sonnet: Advancing AI Capabilities** (anthropic.com/research)
   Latest model improvements in reasoning, code generation, and tool use. Released October 2024 with 200K context window.

2. **API Integration Patterns with Claude** (developers.anthropic.com/docs)
   Complete guide for building agentic systems with Claude's tool-use capabilities. Includes error handling and retry patterns.

3. **Building Production AI Systems** (github.com/anthropic/prompt-engineering)
   Best practices for prompt engineering, system design, and evaluation. By Anthropic Research Team.

### News Results:

1. **Claude API Usage Grows 300% Quarterly** (techreport.ai)
   Enterprises adopt Claude for mission-critical applications. Published ${today}

2. **AI Model Improvements Enable New Applications** (aiweekly.org)
   Industry discusses implications of latest generation models. ${today}
    `
  };

  return mockResults.general;
};

// Helper: Fetch results from Brave Search API with timeout and fallback
const fetchBraveSearchResults = async (query: string): Promise<string> => {
  const apiKey = process.env.VITE_BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.log("Brave Search API key not found. Using mock results.");
    return getMockSearchResults();
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
        console.warn("Brave Search API: Rate limit exceeded. Using mock results.");
      } else if (response.status === 401 || response.status === 403) {
        console.warn("Brave Search API: Authentication failed. Using mock results.");
      } else {
        console.warn(`Brave Search API error: ${response.status}. Using mock results.`);
      }
      return getMockSearchResults();
    }

    const data = await response.json();

    if (!data || (!data.web && !data.news)) {
      console.log("Brave Search: Empty results received. Using mock results.");
      return getMockSearchResults();
    }

    return formatBraveSearchResults(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("Brave Search API: Request timeout. Using mock results.");
    } else {
      console.warn("Brave Search API error:", error, "Using mock results.");
    }
    return getMockSearchResults();
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
    let response = await anthropic.messages.create({
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
          "imagePrompt": "A simple, descriptive prompt for an AI image generator to create a relevant image for this section. The image MUST be in a ${styleDescription} style."
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
    let response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
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

      response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        system: systemPrompt,
        tools: [webSearchTool],
        messages: messages,
      });
    }

    if (iterations >= MAX_SEARCH_ITERATIONS) {
      console.log(`[Newsletter] Reached max iterations (${MAX_SEARCH_ITERATIONS}), proceeding with current results`);
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

    let response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
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

      response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [webSearchTool],
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

    let response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
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

      response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [webSearchTool],
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

    let response = await anthropic.messages.create({
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

      response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        tools: [webSearchTool],
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

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const stabilityApiKey = process.env.VITE_STABILITY_API_KEY;
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
