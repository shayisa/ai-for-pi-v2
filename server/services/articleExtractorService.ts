/**
 * Article Extractor Service
 *
 * Extracts full article text from URLs using @extractus/article-extractor.
 * Provides clean text content for RAG indexing and newsletter generation.
 */

import { extract } from '@extractus/article-extractor';
import type { SourceArticle } from './sourceFetchingService';

export interface ExtractedArticle extends SourceArticle {
  content?: string;
  contentLength?: number;
  extractionSuccess: boolean;
  extractionError?: string;
  extractionTimeMs?: number;
}

export interface ExtractionResult {
  extracted: ExtractedArticle[];
  successCount: number;
  failedCount: number;
  totalExtractionTimeMs: number;
}

/**
 * Transform URLs that can't be extracted directly into extractable alternatives
 * For example, arXiv PDF URLs are transformed to abstract pages
 */
function transformUrl(url: string): string {
  // arXiv PDF URLs: https://arxiv.org/pdf/2512.21338v1 -> https://arxiv.org/abs/2512.21338v1
  // arXiv HTML URLs: https://arxiv.org/html/2512.21338v1 -> https://arxiv.org/abs/2512.21338v1
  const arxivPdfMatch = url.match(/^https?:\/\/arxiv\.org\/(pdf|html)\/(.+?)(?:\.pdf)?$/);
  if (arxivPdfMatch) {
    const paperId = arxivPdfMatch[2];
    const transformedUrl = `https://arxiv.org/abs/${paperId}`;
    console.log(`[ArticleExtractor] Transformed arXiv URL: ${url} -> ${transformedUrl}`);
    return transformedUrl;
  }

  return url;
}

/**
 * Extract content from a single URL
 */
export async function extractArticle(url: string): Promise<{
  content?: string;
  title?: string;
  success: boolean;
  error?: string;
  timeMs: number;
}> {
  const startTime = Date.now();

  // Transform URLs that can't be extracted directly (e.g., PDFs)
  const extractableUrl = transformUrl(url);

  try {
    // Note: @extractus/article-extractor doesn't support custom headers in the extract options
    // The library handles User-Agent internally
    const result = await extract(extractableUrl);

    const timeMs = Date.now() - startTime;

    if (result && result.content) {
      // Strip HTML tags for plain text
      const plainText = result.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        content: plainText,
        title: result.title || undefined,
        success: true,
        timeMs,
      };
    }

    return {
      success: false,
      error: 'No content extracted',
      timeMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract content from multiple articles with rate limiting
 */
export async function extractMultipleArticles(
  articles: SourceArticle[],
  options: {
    maxArticles?: number;
    maxContentLength?: number;
    delayMs?: number;
  } = {}
): Promise<ExtractionResult> {
  const { maxArticles = 15, maxContentLength = 5000, delayMs = 300 } = options;

  const startTime = Date.now();
  const extracted: ExtractedArticle[] = [];

  // Limit the number of articles to process
  const toExtract = articles.slice(0, maxArticles);

  for (const article of toExtract) {
    const result = await extractArticle(article.url);

    if (result.success && result.content) {
      extracted.push({
        ...article,
        content: result.content.substring(0, maxContentLength),
        contentLength: result.content.length,
        extractionSuccess: true,
        extractionTimeMs: result.timeMs,
        // Update title if extraction found a better one
        title: result.title || article.title,
      });
    } else {
      extracted.push({
        ...article,
        extractionSuccess: false,
        extractionError: result.error,
        extractionTimeMs: result.timeMs,
      });
    }

    // Rate limiting between requests
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const successCount = extracted.filter((a) => a.extractionSuccess).length;
  const totalExtractionTimeMs = Date.now() - startTime;

  console.log(
    `[ArticleExtractor] Extracted ${successCount}/${extracted.length} articles in ${totalExtractionTimeMs}ms`
  );

  return {
    extracted,
    successCount,
    failedCount: extracted.length - successCount,
    totalExtractionTimeMs,
  };
}

/**
 * Build source context string from extracted articles for Claude prompt
 */
export function buildSourceContext(
  articles: ExtractedArticle[],
  options: {
    maxTotalLength?: number;
    maxPerArticle?: number;
    includeSnippetFallback?: boolean;
  } = {}
): string {
  const {
    maxTotalLength = 30000,
    maxPerArticle = 2000,
    includeSnippetFallback = true,
  } = options;

  const successfulArticles = articles.filter((a) => a.extractionSuccess || a.snippet);
  let context = '';
  let sourceIndex = 1;

  for (const article of successfulArticles) {
    // Use extracted content or fallback to snippet
    const content = article.content || (includeSnippetFallback ? article.snippet : '');
    if (!content) continue;

    const truncatedContent = content.substring(0, maxPerArticle);
    const sourceBlock = `
SOURCE ${sourceIndex}: ${article.title}
URL: ${article.url}
Source: ${article.source}
${article.author ? `Author: ${article.author}` : ''}
${article.date ? `Date: ${article.date}` : ''}

${truncatedContent}

---
`;

    // Check if adding this would exceed max length
    if (context.length + sourceBlock.length > maxTotalLength) {
      break;
    }

    context += sourceBlock;
    sourceIndex++;
  }

  return context.trim();
}

/**
 * Get unique source citations from articles
 */
export function getSourceCitations(
  articles: ExtractedArticle[]
): Array<{ url: string; title: string }> {
  const seen = new Set<string>();
  const citations: Array<{ url: string; title: string }> = [];

  for (const article of articles) {
    if (!seen.has(article.url)) {
      seen.add(article.url);
      citations.push({
        url: article.url,
        title: article.title,
      });
    }
  }

  return citations;
}

export default {
  extractArticle,
  extractMultipleArticles,
  buildSourceContext,
  getSourceCitations,
};
