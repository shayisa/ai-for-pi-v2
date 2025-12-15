/**
 * POC 6: End-to-End Pipeline
 *
 * Chains all POC components together:
 * 1. Generate audience config (POC 1)
 * 2. Fetch sources using generated config (POC 2)
 * 3. Extract article text from URLs (POC 3)
 * 4. Index in Gemini File Search (POC 4)
 * 5. Generate newsletter with RAG (POC 5)
 *
 * Outputs:
 * - poc/output/6-full-pipeline.json (complete results with metrics)
 * - poc/output/6-newsletter.md (human-readable newsletter)
 *
 * Run: npx ts-node poc/6-end-to-end.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { extract } from '@extractus/article-extractor';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// ============================================================================
// Types
// ============================================================================

interface AudienceConfig {
  id: string;
  name: string;
  description: string;
  generated?: {
    persona: string;
    relevance_keywords: string[];
    subreddits: string[];
    arxiv_categories: string[];
    search_templates: string[];
  };
}

interface SourceArticle {
  title: string;
  url: string;
  source: string;
  date?: string;
  snippet?: string;
}

interface ExtractedArticle extends SourceArticle {
  content?: string;
  content_length?: number;
  extraction_success: boolean;
  extraction_error?: string;
}

interface EnhancedNewsletter {
  editorsNote: { message: string };
  toolOfTheDay: {
    name: string;
    url: string;
    whyNow: string;
    quickStart: string;
  };
  audienceSections: Array<{
    audienceId: string;
    audienceName: string;
    title: string;
    whyItMatters: string;
    content: string;
    practicalPrompt: {
      scenario: string;
      prompt: string;
      isToolSpecific: boolean;
    };
    cta: { text: string; action: string };
    sources: Array<{ url: string; title: string }>;
  }>;
  conclusion: string;
}

interface StageResult {
  status: 'success' | 'partial' | 'failed';
  time_ms: number;
  details?: Record<string, unknown>;
  error?: string;
}

interface PipelineOutput {
  pipeline_run: {
    started_at: string;
    completed_at: string;
    total_time_ms: number;
  };
  stage_results: {
    audience_config: StageResult;
    source_fetching: StageResult;
    text_extraction: StageResult;
    rag_indexing: StageResult;
    newsletter_gen: StageResult;
  };
  costs: {
    audience_config: number;
    rag_indexing: number;
    newsletter_gen: number;
    total_usd: number;
  };
  output: {
    newsletter: EnhancedNewsletter;
  };
}

// ============================================================================
// API Key Helpers
// ============================================================================

function getClaudeApiKey(): string | null {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'archives.db');
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const stmt = db.prepare('SELECT api_key FROM api_keys WHERE user_email = ? AND service = ?');
        const row = stmt.get(adminEmail, 'claude') as { api_key: string } | undefined;
        db.close();
        if (row?.api_key) {
          console.log(`[Config] Loaded Claude API key from SQLite for ${adminEmail}`);
          return row.api_key;
        }
      }
    } catch (e) {
      console.log('[Config] Could not load Claude key from SQLite:', e);
    }
  }
  return process.env.VITE_ANTHROPIC_API_KEY || null;
}

function getGoogleApiKey(): string | null {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'archives.db');
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const stmt = db.prepare('SELECT api_key FROM api_keys WHERE user_email = ? AND service = ?');
        const row = stmt.get(adminEmail, 'google_api_key') as { api_key: string } | undefined;
        db.close();
        if (row?.api_key) {
          console.log(`[Config] Loaded Google API key from SQLite for ${adminEmail}`);
          return row.api_key;
        }
      }
    } catch (e) {
      console.log('[Config] Could not load Google key from SQLite:', e);
    }
  }
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

// ============================================================================
// Stage 1: Audience Config Generation
// ============================================================================

async function generateAudienceConfigs(
  client: Anthropic,
  audiences: AudienceConfig[]
): Promise<{ results: AudienceConfig[]; time_ms: number; cost_usd: number }> {
  console.log('\n=== STAGE 1: Audience Config Generation ===\n');
  const startTime = Date.now();
  let totalTokens = 0;
  const results: AudienceConfig[] = [];

  for (const audience of audiences) {
    console.log(`Generating config for: ${audience.name}`);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are an AI assistant that generates newsletter audience configuration.
Return ONLY valid JSON with no explanation.`,
      messages: [
        {
          role: 'user',
          content: `Generate a newsletter audience configuration for:
Name: ${audience.name}
Description: ${audience.description}

Return JSON with:
{
  "persona": "3-4 sentence expanded description",
  "relevance_keywords": ["5-8 keywords for content filtering"],
  "subreddits": ["3-5 relevant subreddits without r/ prefix"],
  "arxiv_categories": ["2-4 relevant arxiv category codes like cs.AI, q-bio.QM"],
  "search_templates": ["3-5 search query templates with {topic} placeholder"]
}`,
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );

    if (textBlock) {
      try {
        let jsonText = textBlock.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        const generated = JSON.parse(jsonText);
        results.push({ ...audience, generated });
        console.log(`  ✓ Generated config with ${generated.relevance_keywords?.length || 0} keywords`);
      } catch (e) {
        console.log(`  ✗ Failed to parse response`);
        results.push(audience);
      }
    }

    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  }

  const time_ms = Date.now() - startTime;
  // Haiku pricing: $0.25/1M input, $1.25/1M output (estimate avg)
  const cost_usd = (totalTokens / 1_000_000) * 0.75;

  console.log(`\nStage 1 complete: ${results.length} configs in ${time_ms}ms`);
  return { results, time_ms, cost_usd };
}

// ============================================================================
// Stage 2: Source Fetching
// ============================================================================

async function fetchSources(
  audiences: AudienceConfig[]
): Promise<{ articles: SourceArticle[]; time_ms: number }> {
  console.log('\n=== STAGE 2: Source Fetching ===\n');
  const startTime = Date.now();
  const articles: SourceArticle[] = [];

  // Collect keywords from generated configs
  const allKeywords: string[] = [];
  for (const audience of audiences) {
    if (audience.generated?.relevance_keywords) {
      allKeywords.push(...audience.generated.relevance_keywords.slice(0, 3));
    }
  }

  // Use first few keywords for search
  const searchTerms = allKeywords.length > 0 ? allKeywords : ['AI', 'automation', 'machine learning'];

  // Fetch from GDELT
  console.log('Fetching from GDELT...');
  try {
    const gdeltQuery = encodeURIComponent(`"${searchTerms[0]}"`);
    const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQuery}&mode=ArtList&format=json&maxrecords=10&timespan=7d`;
    const gdeltResponse = await fetch(gdeltUrl);
    const gdeltText = await gdeltResponse.text();

    if (gdeltText.startsWith('{')) {
      const gdeltData = JSON.parse(gdeltText);
      const gdeltArticles = gdeltData.articles || [];
      for (const article of gdeltArticles.slice(0, 5)) {
        articles.push({
          title: article.title || 'Untitled',
          url: article.url,
          source: 'gdelt',
          date: article.seendate,
        });
      }
      console.log(`  ✓ GDELT: ${Math.min(gdeltArticles.length, 5)} articles`);
    }
  } catch (e) {
    console.log(`  ✗ GDELT failed: ${e}`);
  }

  // Fetch from ArXiv
  console.log('Fetching from ArXiv...');
  try {
    const arxivCategories = audiences
      .flatMap((a) => a.generated?.arxiv_categories || [])
      .slice(0, 2);
    const categoryQuery = arxivCategories.length > 0 ? arxivCategories.join('+OR+') : 'cs.AI';
    const arxivUrl = `http://export.arxiv.org/api/query?search_query=cat:${categoryQuery}&sortBy=submittedDate&sortOrder=descending&max_results=5`;

    const arxivResponse = await fetch(arxivUrl);
    const arxivXml = await arxivResponse.text();

    // Simple XML parsing for entries
    const entries = arxivXml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entries.slice(0, 5)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      if (titleMatch && idMatch) {
        articles.push({
          title: titleMatch[1].replace(/\s+/g, ' ').trim(),
          url: idMatch[1].trim(),
          source: 'arxiv',
          snippet: summaryMatch?.[1]?.substring(0, 200),
        });
      }
    }
    console.log(`  ✓ ArXiv: ${Math.min(entries.length, 5)} papers`);
  } catch (e) {
    console.log(`  ✗ ArXiv failed: ${e}`);
  }

  // Fetch from HackerNews
  console.log('Fetching from HackerNews...');
  try {
    const hnUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const hnResponse = await fetch(hnUrl);
    const storyIds = (await hnResponse.json()) as number[];

    let hnCount = 0;
    for (const storyId of storyIds.slice(0, 10)) {
      if (hnCount >= 5) break;
      const storyUrl = `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`;
      const storyResponse = await fetch(storyUrl);
      const story = (await storyResponse.json()) as { title?: string; url?: string; time?: number };
      if (story.url && story.title) {
        articles.push({
          title: story.title,
          url: story.url,
          source: 'hackernews',
          date: story.time ? new Date(story.time * 1000).toISOString() : undefined,
        });
        hnCount++;
      }
    }
    console.log(`  ✓ HackerNews: ${hnCount} stories`);
  } catch (e) {
    console.log(`  ✗ HackerNews failed: ${e}`);
  }

  // Fetch from Reddit
  console.log('Fetching from Reddit...');
  try {
    const subreddits = audiences
      .flatMap((a) => a.generated?.subreddits || [])
      .slice(0, 2);
    const subreddit = subreddits.length > 0 ? subreddits[0] : 'MachineLearning';
    const redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=5`;

    const redditResponse = await fetch(redditUrl, {
      headers: { 'User-Agent': 'AI-Newsletter-POC/1.0' },
    });
    const redditData = (await redditResponse.json()) as {
      data?: { children?: Array<{ data: { title: string; url: string; created_utc: number } }> };
    };
    const posts = redditData.data?.children || [];

    for (const post of posts.slice(0, 5)) {
      if (post.data.url && !post.data.url.includes('reddit.com')) {
        articles.push({
          title: post.data.title,
          url: post.data.url,
          source: 'reddit',
          date: new Date(post.data.created_utc * 1000).toISOString(),
        });
      }
    }
    console.log(`  ✓ Reddit: ${Math.min(posts.length, 5)} posts`);
  } catch (e) {
    console.log(`  ✗ Reddit failed: ${e}`);
  }

  const time_ms = Date.now() - startTime;
  console.log(`\nStage 2 complete: ${articles.length} articles in ${time_ms}ms`);
  return { articles, time_ms };
}

// ============================================================================
// Stage 3: Article Extraction
// ============================================================================

async function extractArticles(
  articles: SourceArticle[]
): Promise<{ extracted: ExtractedArticle[]; time_ms: number }> {
  console.log('\n=== STAGE 3: Article Extraction ===\n');
  const startTime = Date.now();
  const extracted: ExtractedArticle[] = [];

  // Limit to first 10 articles for POC
  const toExtract = articles.slice(0, 10);

  for (const article of toExtract) {
    console.log(`Extracting: ${article.title.substring(0, 50)}...`);

    try {
      // Note: headers option works at runtime but isn't in type definitions
      const result = await extract(article.url);

      if (result && result.content) {
        // Strip HTML tags for plain text
        const plainText = result.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        extracted.push({
          ...article,
          content: plainText.substring(0, 5000), // Limit content length
          content_length: plainText.length,
          extraction_success: true,
        });
        console.log(`  ✓ Extracted ${plainText.length} chars`);
      } else {
        extracted.push({
          ...article,
          extraction_success: false,
          extraction_error: 'No content extracted',
        });
        console.log(`  ✗ No content`);
      }
    } catch (e) {
      extracted.push({
        ...article,
        extraction_success: false,
        extraction_error: e instanceof Error ? e.message : String(e),
      });
      console.log(`  ✗ Error: ${e}`);
    }

    // Small delay to be polite
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const time_ms = Date.now() - startTime;
  const successCount = extracted.filter((a) => a.extraction_success).length;
  console.log(`\nStage 3 complete: ${successCount}/${extracted.length} extracted in ${time_ms}ms`);
  return { extracted, time_ms };
}

// ============================================================================
// Stage 4: RAG Indexing
// ============================================================================

async function indexInRAG(
  ai: GoogleGenAI,
  articles: ExtractedArticle[]
): Promise<{ store_name: string; indexed_count: number; time_ms: number; cost_usd: number }> {
  console.log('\n=== STAGE 4: RAG Indexing (Gemini File Search) ===\n');
  const startTime = Date.now();

  // Filter to only successfully extracted articles
  const toIndex = articles.filter((a) => a.extraction_success && a.content);

  // Create FileSearchStore
  console.log('Creating FileSearchStore...');
  const store = await ai.fileSearchStores.create({
    config: { displayName: `poc6-pipeline-${Date.now()}` },
  });
  console.log(`  Store created: ${store.name}`);

  // Upload documents
  console.log('Uploading documents...');
  let indexedCount = 0;
  const tempDir = path.join(__dirname, 'output', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const article of toIndex.slice(0, 10)) {
    try {
      const tempPath = path.join(tempDir, `article-${indexedCount}.txt`);
      const docContent = `Title: ${article.title}\nSource: ${article.source}\nURL: ${article.url}\n\n${article.content}`;
      fs.writeFileSync(tempPath, docContent);

      await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: store.name,
        file: tempPath,
        config: { displayName: article.title.substring(0, 50) },
      });

      fs.unlinkSync(tempPath);
      indexedCount++;
      console.log(`  ✓ Indexed: ${article.title.substring(0, 40)}...`);
    } catch (e) {
      console.log(`  ✗ Failed to index: ${e}`);
    }
  }

  // Clean up temp dir
  try {
    fs.rmdirSync(tempDir);
  } catch {
    // Ignore cleanup errors
  }

  // Wait for indexing
  console.log('Waiting for indexing (10s)...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const time_ms = Date.now() - startTime;
  // Estimate: $0.15/1M tokens for indexing, assume ~1000 tokens per article
  const cost_usd = (indexedCount * 1000 / 1_000_000) * 0.15;

  console.log(`\nStage 4 complete: ${indexedCount} docs indexed in ${time_ms}ms`);
  return { store_name: store.name, indexed_count: indexedCount, time_ms, cost_usd };
}

// ============================================================================
// Stage 5: Newsletter Generation
// ============================================================================

async function generateNewsletter(
  client: Anthropic,
  ai: GoogleGenAI,
  storeName: string,
  audiences: AudienceConfig[],
  articles: ExtractedArticle[]
): Promise<{ newsletter: EnhancedNewsletter; time_ms: number; cost_usd: number }> {
  console.log('\n=== STAGE 5: Newsletter Generation ===\n');
  const startTime = Date.now();

  // Build source context from extracted articles
  const sourceContext = articles
    .filter((a) => a.extraction_success)
    .map(
      (a, i) =>
        `SOURCE ${i + 1}: ${a.title}\nURL: ${a.url}\nSource: ${a.source}\n${a.content?.substring(0, 1000) || a.snippet || ''}\n`
    )
    .join('\n---\n');

  // Query RAG for additional context
  console.log('Querying RAG for context...');
  let ragContext = '';
  try {
    for (const audience of audiences.slice(0, 2)) {
      const query = `What are the latest AI tools and developments relevant to ${audience.name}?`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: {
          tools: [{ fileSearch: { fileSearchStoreNames: [storeName] } }],
        },
      });
      ragContext += `\n\nRAG Context for ${audience.name}:\n${response.text?.substring(0, 500) || ''}`;
    }
  } catch (e) {
    console.log(`  RAG query failed: ${e}`);
  }

  // Generate newsletter with Claude
  console.log('Generating newsletter with Claude...');

  const systemPrompt = `You are an expert newsletter writer for "AI for PI" - a newsletter helping professionals leverage AI tools.

Generate a newsletter in the ENHANCED FORMAT with:
1. Editor's Note - Personal, conversational opening
2. Tool of the Day - One standout tool featured prominently
3. Audience Sections - ONE section per audience with specific relevance
4. Practical Prompts - Ready-to-use prompts for each section
5. CTAs - Clear calls to action

RULES:
- Every factual claim MUST cite its source URL
- Each audience section MUST have a "Why It Matters" explanation
- Practical prompts should be immediately usable
- Keep the tone authoritative but accessible
- NO hallucinated tools or statistics - use only what's in the sources

Return ONLY valid JSON matching this schema:
{
  "editorsNote": { "message": "string" },
  "toolOfTheDay": { "name": "string", "url": "string", "whyNow": "string", "quickStart": "string" },
  "audienceSections": [{
    "audienceId": "string",
    "audienceName": "string",
    "title": "string",
    "whyItMatters": "string",
    "content": "string",
    "practicalPrompt": { "scenario": "string", "prompt": "string", "isToolSpecific": boolean },
    "cta": { "text": "string", "action": "copy_prompt|visit_url" },
    "sources": [{ "url": "string", "title": "string" }]
  }],
  "conclusion": "string"
}`;

  const userPrompt = `Generate an enhanced newsletter for these audiences:

AUDIENCES:
${audiences.map((a) => `- ${a.name}: ${a.generated?.persona || a.description}`).join('\n')}

SOURCE CONTENT:
${sourceContext}

${ragContext}

Generate the newsletter JSON now. Remember:
- ONE section per audience (${audiences.length} sections total)
- Cite sources with URLs
- Include practical, ready-to-use prompts
- Make "Why It Matters" specific to each audience`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
  );

  if (!textBlock) {
    throw new Error('No text response from API');
  }

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  const newsletter = JSON.parse(jsonText) as EnhancedNewsletter;
  const time_ms = Date.now() - startTime;

  // Sonnet pricing: $3/1M input, $15/1M output
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const cost_usd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

  console.log(`\nStage 5 complete: Newsletter generated in ${time_ms}ms`);
  return { newsletter, time_ms, cost_usd };
}

// ============================================================================
// Newsletter to Markdown
// ============================================================================

function newsletterToMarkdown(newsletter: EnhancedNewsletter): string {
  let md = `# AI for PI Newsletter\n\n`;

  // Editor's Note
  md += `## 📝 Editor's Note\n\n`;
  md += `${newsletter.editorsNote.message}\n\n`;
  md += `---\n\n`;

  // Tool of the Day
  md += `## 🛠️ Tool of the Day: ${newsletter.toolOfTheDay.name}\n\n`;
  md += `**Why Now:** ${newsletter.toolOfTheDay.whyNow}\n\n`;
  md += `**Quick Start:** ${newsletter.toolOfTheDay.quickStart}\n\n`;
  md += `🔗 [Check it out](${newsletter.toolOfTheDay.url})\n\n`;
  md += `---\n\n`;

  // Audience Sections
  for (const section of newsletter.audienceSections) {
    md += `## 👥 For ${section.audienceName}\n\n`;
    md += `### ${section.title}\n\n`;
    md += `**Why It Matters:** ${section.whyItMatters}\n\n`;
    md += `${section.content}\n\n`;

    // Practical Prompt
    md += `### 💡 Practical Prompt\n\n`;
    md += `**Scenario:** ${section.practicalPrompt.scenario}\n\n`;
    md += `\`\`\`\n${section.practicalPrompt.prompt}\n\`\`\`\n\n`;

    // CTA
    md += `**${section.cta.text}**\n\n`;

    // Sources
    if (section.sources.length > 0) {
      md += `**Sources:**\n`;
      for (const source of section.sources) {
        md += `- [${source.title}](${source.url})\n`;
      }
      md += `\n`;
    }

    md += `---\n\n`;
  }

  // Conclusion
  md += `## 📬 Until Next Time\n\n`;
  md += `${newsletter.conclusion}\n`;

  return md;
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('POC 6: End-to-End Newsletter Generation Pipeline');
  console.log('='.repeat(60));

  const pipelineStartTime = Date.now();
  const startedAt = new Date().toISOString();

  // Initialize API clients
  const claudeKey = getClaudeApiKey();
  const googleKey = getGoogleApiKey();

  if (!claudeKey) {
    console.error('ERROR: Claude API key not found');
    process.exit(1);
  }
  if (!googleKey) {
    console.error('ERROR: Google API key not found');
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey: claudeKey });
  const genAI = new GoogleGenAI({ apiKey: googleKey });

  // Define test audiences
  const audiences: AudienceConfig[] = [
    {
      id: 'forensic',
      name: 'Forensic Anthropologists',
      description: 'Researchers analyzing skeletal remains using imaging technology and AI',
    },
    {
      id: 'supply_chain',
      name: 'Supply Chain Analysts',
      description: 'Professionals optimizing logistics with data analytics and AI forecasting',
    },
  ];

  // Initialize stage results
  const stageResults: PipelineOutput['stage_results'] = {
    audience_config: { status: 'failed', time_ms: 0 },
    source_fetching: { status: 'failed', time_ms: 0 },
    text_extraction: { status: 'failed', time_ms: 0 },
    rag_indexing: { status: 'failed', time_ms: 0 },
    newsletter_gen: { status: 'failed', time_ms: 0 },
  };

  const costs = {
    audience_config: 0,
    rag_indexing: 0,
    newsletter_gen: 0,
    total_usd: 0,
  };

  let configuredAudiences = audiences;
  let fetchedArticles: SourceArticle[] = [];
  let extractedArticles: ExtractedArticle[] = [];
  let storeName = '';
  let newsletter: EnhancedNewsletter | null = null;

  try {
    // Stage 1: Audience Config
    const stage1 = await generateAudienceConfigs(anthropic, audiences);
    configuredAudiences = stage1.results;
    stageResults.audience_config = {
      status: 'success',
      time_ms: stage1.time_ms,
      details: { audiences_configured: stage1.results.length },
    };
    costs.audience_config = stage1.cost_usd;

    // Stage 2: Source Fetching
    const stage2 = await fetchSources(configuredAudiences);
    fetchedArticles = stage2.articles;
    stageResults.source_fetching = {
      status: stage2.articles.length > 0 ? 'success' : 'failed',
      time_ms: stage2.time_ms,
      details: { articles_fetched: stage2.articles.length },
    };

    // Stage 3: Article Extraction
    const stage3 = await extractArticles(fetchedArticles);
    extractedArticles = stage3.extracted;
    const extractSuccess = extractedArticles.filter((a) => a.extraction_success).length;
    stageResults.text_extraction = {
      status: extractSuccess > 0 ? (extractSuccess === extractedArticles.length ? 'success' : 'partial') : 'failed',
      time_ms: stage3.time_ms,
      details: {
        extracted: extractSuccess,
        failed: extractedArticles.length - extractSuccess,
      },
    };

    // Stage 4: RAG Indexing
    const stage4 = await indexInRAG(genAI, extractedArticles);
    storeName = stage4.store_name;
    stageResults.rag_indexing = {
      status: stage4.indexed_count > 0 ? 'success' : 'failed',
      time_ms: stage4.time_ms,
      details: { indexed: stage4.indexed_count },
    };
    costs.rag_indexing = stage4.cost_usd;

    // Stage 5: Newsletter Generation
    const stage5 = await generateNewsletter(
      anthropic,
      genAI,
      storeName,
      configuredAudiences,
      extractedArticles
    );
    newsletter = stage5.newsletter;
    stageResults.newsletter_gen = {
      status: 'success',
      time_ms: stage5.time_ms,
      details: {
        sections: newsletter.audienceSections.length,
        has_tool_of_day: !!newsletter.toolOfTheDay.name,
      },
    };
    costs.newsletter_gen = stage5.cost_usd;

    // Cleanup RAG store
    console.log('\nCleaning up RAG store...');
    try {
      await genAI.fileSearchStores.delete({ name: storeName });
      console.log('  Store deleted');
    } catch (e) {
      console.log('  Could not delete store');
    }
  } catch (error) {
    console.error('\nPipeline error:', error);
  }

  // Calculate totals
  costs.total_usd = costs.audience_config + costs.rag_indexing + costs.newsletter_gen;
  const completedAt = new Date().toISOString();
  const totalTime = Date.now() - pipelineStartTime;

  // Build output
  const output: PipelineOutput = {
    pipeline_run: {
      started_at: startedAt,
      completed_at: completedAt,
      total_time_ms: totalTime,
    },
    stage_results: stageResults,
    costs,
    output: {
      newsletter: newsletter || {
        editorsNote: { message: 'Pipeline failed to generate newsletter' },
        toolOfTheDay: { name: '', url: '', whyNow: '', quickStart: '' },
        audienceSections: [],
        conclusion: '',
      },
    },
  };

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('PIPELINE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
  console.log(`\nStage Results:`);
  for (const [stage, result] of Object.entries(stageResults)) {
    console.log(`  ${stage}: ${result.status} (${result.time_ms}ms)`);
  }
  console.log(`\nCosts:`);
  console.log(`  Audience config: $${costs.audience_config.toFixed(4)}`);
  console.log(`  RAG indexing: $${costs.rag_indexing.toFixed(4)}`);
  console.log(`  Newsletter gen: $${costs.newsletter_gen.toFixed(4)}`);
  console.log(`  TOTAL: $${costs.total_usd.toFixed(4)}`);

  // Write outputs
  const jsonPath = path.join(__dirname, 'output', '6-full-pipeline.json');
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  console.log(`\nJSON written to: ${jsonPath}`);

  if (newsletter) {
    const mdPath = path.join(__dirname, 'output', '6-newsletter.md');
    fs.writeFileSync(mdPath, newsletterToMarkdown(newsletter));
    console.log(`Markdown written to: ${mdPath}`);
  }
}

main().catch(console.error);
