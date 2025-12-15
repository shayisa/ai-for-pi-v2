/**
 * POC 3: Article Extraction
 *
 * Tests full-text extraction from article URLs using @extractus/article-extractor.
 * Tests various source types: news sites, ArXiv, GitHub, blogs, etc.
 *
 * Run: npx ts-node poc/3-article-extraction.ts
 */

import { extract } from '@extractus/article-extractor';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Types
interface ExtractionResult {
  url: string;
  source_type: string;
  success: boolean;
  title?: string;
  text_length?: number;
  text_preview?: string;
  author?: string;
  published?: string;
  ttr_seconds?: number;
  extraction_time_ms: number;
  error?: string;
  method: string;
}

// Test URLs from FRESH sources (from POC 2 results)
const testUrls = [
  // GDELT (fresh news)
  {
    url: 'https://www.posta.com.tr/dunya/yilin-kisisi-yapay-zeka-mimarlari-2943413',
    type: 'gdelt_news',
  },

  // ArXiv (fresh paper)
  {
    url: 'https://arxiv.org/abs/2512.11800',
    type: 'arxiv',
  },

  // GitHub (fresh repo)
  {
    url: 'https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk',
    type: 'github',
  },

  // Dev.to (fresh article)
  {
    url: 'https://dev.to/eleftheriabatsou/how-i-cut-my-debugging-time-in-half-as-a-front-end-developer-a-practical-guide-3kd0',
    type: 'devto',
  },

  // HackerNews linked article (fresh)
  {
    url: 'https://www.techpowerup.com/344075/microsoft-copilot-ai-comes-to-lg-tvs-and-cant-be-deleted',
    type: 'tech_news',
  },

  // Reddit discussion page
  {
    url: 'https://www.reddit.com/r/MachineLearning/comments/1phillh/d_does_this_neurips_2025_paper_look_familiar_to/',
    type: 'reddit',
  },

  // Additional ArXiv papers
  {
    url: 'https://arxiv.org/abs/2312.00752', // Mamba paper (older but classic)
    type: 'arxiv',
  },

  // Another GitHub repo (AI toolkit)
  {
    url: 'https://github.com/openai/openai-python',
    type: 'github',
  },

  // Ars Technica (tech news - generally scraper-friendly)
  {
    url: 'https://arstechnica.com/ai/2024/12/openai-promises-ai-agents-are-coming-soon/',
    type: 'tech_news',
  },

  // Wired (tech journalism)
  {
    url: 'https://www.wired.com/story/openai-just-gave-itself-the-regulatory-cover-to-sell-ai-agents/',
    type: 'tech_news',
  },
];

/**
 * Extract article content from a URL
 */
async function extractArticle(
  url: string,
  sourceType: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    console.log(`[Extract] ${sourceType}: ${url.substring(0, 60)}...`);

    // Note: headers option works at runtime but isn't in type definitions
    const article = await extract(url);

    const endTime = Date.now();

    if (!article || !article.content) {
      return {
        url,
        source_type: sourceType,
        success: false,
        extraction_time_ms: endTime - startTime,
        error: 'Extraction returned null or empty content',
        method: '@extractus/article-extractor',
      };
    }

    // Strip HTML tags for plain text length
    const plainText = article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    return {
      url,
      source_type: sourceType,
      success: true,
      title: article.title || undefined,
      text_length: plainText.length,
      text_preview: plainText.substring(0, 500),
      author: article.author || undefined,
      published: article.published || undefined,
      ttr_seconds: article.ttr || undefined,
      extraction_time_ms: endTime - startTime,
      method: '@extractus/article-extractor',
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      url,
      source_type: sourceType,
      success: false,
      extraction_time_ms: endTime - startTime,
      error: error instanceof Error ? error.message : String(error),
      method: '@extractus/article-extractor',
    };
  }
}

async function main() {
  console.log('=== POC 3: Article Extraction ===\n');

  const results: ExtractionResult[] = [];

  // Process URLs sequentially to avoid rate limiting
  for (const { url, type } of testUrls) {
    const result = await extractArticle(url, type);
    results.push(result);

    // Status indicator
    const status = result.success ? '✓' : '✗';
    const info = result.success
      ? `${result.text_length} chars, ${result.ttr_seconds || 0}s read time`
      : result.error?.substring(0, 50);
    console.log(`  ${status} ${info}`);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Results summary
  console.log('\n=== RESULTS BY SOURCE TYPE ===\n');

  const byType = results.reduce((acc, r) => {
    if (!acc[r.source_type]) {
      acc[r.source_type] = { success: 0, failed: 0, total_chars: 0 };
    }
    if (r.success) {
      acc[r.source_type].success++;
      acc[r.source_type].total_chars += r.text_length || 0;
    } else {
      acc[r.source_type].failed++;
    }
    return acc;
  }, {} as Record<string, { success: number; failed: number; total_chars: number }>);

  for (const [type, stats] of Object.entries(byType)) {
    const rate = ((stats.success / (stats.success + stats.failed)) * 100).toFixed(0);
    console.log(`${type}: ${stats.success}/${stats.success + stats.failed} (${rate}% success)`);
    if (stats.success > 0) {
      console.log(`  Avg chars: ${Math.round(stats.total_chars / stats.success)}`);
    }
  }

  // Overall summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalChars = successful.reduce((sum, r) => sum + (r.text_length || 0), 0);
  const avgTime = results.reduce((sum, r) => sum + r.extraction_time_ms, 0) / results.length;

  console.log('\n=== OVERALL SUMMARY ===');
  console.log(`Total URLs tested: ${results.length}`);
  console.log(`Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(0)}%)`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total chars extracted: ${totalChars}`);
  console.log(`Avg extraction time: ${Math.round(avgTime)}ms`);

  // Failed URLs
  if (failed.length > 0) {
    console.log('\n=== FAILED EXTRACTIONS ===');
    for (const f of failed) {
      console.log(`- ${f.source_type}: ${f.url.substring(0, 50)}...`);
      console.log(`  Error: ${f.error}`);
    }
  }

  // Sample successful extractions
  console.log('\n=== SAMPLE EXTRACTIONS ===');
  for (const s of successful.slice(0, 3)) {
    console.log(`\n[${s.source_type}] ${s.title}`);
    console.log(`Preview: ${s.text_preview?.substring(0, 200)}...`);
  }

  // Write output
  const output = {
    timestamp: new Date().toISOString(),
    results,
    by_source_type: byType,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      success_rate: ((successful.length / results.length) * 100).toFixed(1) + '%',
      total_chars_extracted: totalChars,
      avg_extraction_time_ms: Math.round(avgTime),
    },
  };

  const outputPath = path.join(__dirname, 'output', '3-extracted.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch(console.error);
