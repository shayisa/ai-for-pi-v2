/**
 * Pre-Generation Pipeline Service
 *
 * Orchestrates topic validation, source matching, web search enrichment,
 * and source allocation before newsletter generation begins. This prevents
 * hallucination by ensuring all topics have supporting sources, and guarantees
 * source diversity across audience sections.
 *
 * @module domains/generation/services/preGenerationPipeline
 *
 * ## Pipeline Flow
 * 1. Validate topics (check if they're real/current)
 * 2. Fetch initial sources from APIs
 * 3. Match topics to sources
 * 4. For unmatched topics: enrich with web search
 * 5. Final match attempt
 * 6. Generation guard: block if still unmatched
 * 7. Source allocation: assign unique sources per topic-audience pair (Phase 15)
 */

import * as topicValidationService from '../../../services/topicValidationService';
import * as sourceMatchingService from '../../../services/sourceMatchingService';
import * as sourceFetchingService from '../../../services/sourceFetchingService';
import * as sourceAllocationService from '../../../services/sourceAllocationService';
import { performWebSearch } from '../../../external/brave/client';
import type { AudienceConfig, TopicWithAudienceId } from '../../../../types';
import type { TopicValidationResult } from '../../../services/topicValidationService';
import type { TopicSourceMapping } from '../../../services/sourceMatchingService';
import type { SourceArticle, FetchSourcesResult } from '../../../services/sourceFetchingService';
import type { ExtractedArticle } from '../../../services/articleExtractorService';
import type { SourceAllocation, AllocationResult } from '../../../services/sourceAllocationService';

/**
 * Result of pre-generation checks
 */
export interface PreGenerationResult {
  /** Whether generation should proceed */
  canProceed: boolean;
  /** Validation results for each topic */
  validatedTopics: TopicValidationResult[];
  /** Topic-source mappings for Claude prompt */
  sourceMappings: TopicSourceMapping[];
  /** All sources including enriched ones from web search */
  enrichedSources: ExtractedArticle[];
  /** Formatted topic-source context for Claude */
  topicSourceContext: string;
  /** Reason generation was blocked (if canProceed=false) */
  blockReason?: string;
  /** User-friendly message explaining the issue */
  userMessage?: string;
  /** Topics that couldn't be sourced */
  invalidTopics?: string[];
  /** Suggested alternative topics */
  suggestions?: string[];
  /** Total pipeline execution time in ms */
  pipelineTimeMs: number;
  /** Source allocations per topic-audience pair (Phase 15) */
  sourceAllocations?: SourceAllocation[];
  /** Allocation result with diversity metrics (Phase 15) */
  allocationResult?: AllocationResult;
  /** Formatted allocation context for Claude prompt (Phase 15) */
  allocationContext?: string;
}

/**
 * Parameters for pre-generation checks
 * Phase 17: Updated to accept topics with pre-existing resource URLs
 */
export interface PreGenerationParams {
  /**
   * Topics to validate and match
   * Phase 17: Can be either string[] (legacy) or TopicWithAudienceId[]
   * Topics with a 'resource' field will skip Brave validation
   */
  topics: (string | TopicWithAudienceId)[];
  /** Audience configurations for source fetching */
  audiences?: AudienceConfig[];
  /** Pre-existing sources (for V2 enhanced generator) */
  existingSources?: SourceArticle[];
  /** Skip topic validation (for testing) */
  skipValidation?: boolean;
  /** Skip web search enrichment */
  skipEnrichment?: boolean;
}

/**
 * Parse Brave web search results into SourceArticle format
 *
 * @param searchResults - Raw search results string from Brave
 * @param topic - The topic that was searched for
 * @returns Array of SourceArticle objects
 */
function parseWebSearchToSources(searchResults: string, topic: string): SourceArticle[] {
  const sources: SourceArticle[] = [];

  // Match numbered results pattern: "1. **Title** (URL)"
  const resultPattern = /\d+\.\s+\*\*([^*]+)\*\*\s+\(([^)]+)\)\s*\n\s*(.+?)(?=\n\d+\.|$)/gs;

  let match;
  while ((match = resultPattern.exec(searchResults)) !== null) {
    const [, title, url, description] = match;

    if (title && url && url.startsWith('http')) {
      sources.push({
        title: title.trim(),
        url: url.trim(),
        source: 'gdelt', // Use gdelt as generic "web" source type
        snippet: description?.trim() || `Search result for "${topic}"`,
      });
    }
  }

  // If regex didn't match, try simpler pattern for URLs
  if (sources.length === 0) {
    const urlPattern = /https?:\/\/[^\s)]+/g;
    const urls = searchResults.match(urlPattern) || [];
    for (const url of urls.slice(0, 5)) {
      sources.push({
        title: `Web result for ${topic}`,
        url,
        source: 'gdelt',
        snippet: `Search result for "${topic}"`,
      });
    }
  }

  return sources;
}

/**
 * Convert SourceArticle to ExtractedArticle format
 */
function sourceToExtracted(source: SourceArticle): ExtractedArticle {
  return {
    ...source,
    content: source.snippet,
    contentLength: source.snippet?.length || 0,
    extractionSuccess: true,
  };
}

/**
 * Run pre-generation checks to validate topics and match sources
 *
 * @param params - Pre-generation parameters
 * @returns Pre-generation result with validation and matching data
 */
export async function runPreGenerationChecks(
  params: PreGenerationParams
): Promise<PreGenerationResult> {
  const startTime = Date.now();
  const { topics, audiences = [], existingSources = [], skipValidation = false, skipEnrichment = false } = params;

  console.log(`[PreGenPipeline] Starting pre-generation checks for ${topics.length} topics...`);

  // ===== PHASE 17: Normalize topics and extract pre-existing sources =====
  // This enables skipping Brave validation for topics that already have verified resource URLs
  const normalizedTopics: TopicWithAudienceId[] = topics.map((topic) => {
    if (typeof topic === 'string') {
      // Legacy format: just a title string
      return { title: topic, audienceId: audiences[0]?.id || 'unknown' };
    }
    // Full object format: already has rich context
    return topic;
  });

  // Extract topic titles for validation and matching
  const topicTitles = normalizedTopics.map((t) => t.title);

  // Phase 17: Separate topics with pre-existing sources from those needing validation
  const topicsWithSources = normalizedTopics.filter((t) => t.resource);
  const topicsWithoutSources = normalizedTopics.filter((t) => !t.resource);

  console.log(`[PreGenPipeline] Phase 17: ${topicsWithSources.length} topics have pre-existing sources (skipping validation)`);
  console.log(`[PreGenPipeline] Phase 17: ${topicsWithoutSources.length} topics need validation`);

  // ===== STEP 1: Validate Topics =====
  let validatedTopics: TopicValidationResult[] = [];

  // Phase 17: First, add pre-sourced topics as automatically valid (high confidence)
  for (const topic of topicsWithSources) {
    validatedTopics.push({
      topic: topic.title,
      isValid: true,
      confidence: 'high',  // Pre-sourced by Claude = high confidence
      webSearchResults: `Pre-existing source: ${topic.resource}`,
    });
    console.log(`[PreGenPipeline] Phase 17: Topic "${topic.title}" has source ${topic.resource} - marked valid (skipped Brave)`);
  }

  // Phase 17: Only validate topics WITHOUT pre-existing sources
  if (!skipValidation && topicsWithoutSources.length > 0) {
    console.log(`[PreGenPipeline] Step 1: Validating ${topicsWithoutSources.length} topics without sources...`);
    const topicTitlesToValidate = topicsWithoutSources.map((t) => t.title);
    const validationResult = await topicValidationService.validateTopics(topicTitlesToValidate);
    validatedTopics.push(...validationResult.results);

    // Check for completely invalid topics (fictional)
    // IMPORTANT: 'unknown' confidence means validation was unavailable (rate limit, API error)
    // Only 'none' confidence with isValid=false indicates truly fictional topics
    const fictionalTopics = validatedTopics.filter(
      (t) => !t.isValid && t.confidence === 'none'
    );

    // Count topics where validation was unavailable (not fictional, just couldn't verify)
    const unavailableValidations = validatedTopics.filter(
      (t) => t.confidence === 'unknown'
    );
    if (unavailableValidations.length > 0) {
      console.log(`[PreGenPipeline] ${unavailableValidations.length} topic(s) could not be validated (API unavailable) - treating as valid`);
    }

    // Phase 17: Only block if ALL validated topics are fictional (pre-sourced topics are never fictional)
    if (fictionalTopics.length === topicsWithoutSources.length && topicsWithSources.length === 0) {
      // ALL topics are fictional (and no pre-sourced topics) - block generation
      const pipelineTimeMs = Date.now() - startTime;
      return {
        canProceed: false,
        validatedTopics,
        sourceMappings: [],
        enrichedSources: [],
        topicSourceContext: '',
        blockReason: 'All topics appear to be fictional or non-existent',
        userMessage: `Cannot generate newsletter: ${fictionalTopics.map((t) => `"${t.topic}" (${t.error || 'not found'})`).join(', ')}. Please enter valid, real topics.`,
        invalidTopics: fictionalTopics.map((t) => t.topic),
        suggestions: fictionalTopics
          .filter((t) => t.suggestedAlternative)
          .map((t) => t.suggestedAlternative!),
        pipelineTimeMs,
      };
    }
  } else if (skipValidation && topicsWithoutSources.length > 0) {
    // If skipping validation for topics without sources, assume they're valid
    for (const topic of topicsWithoutSources) {
      validatedTopics.push({
        topic: topic.title,
        isValid: true,
        confidence: 'medium' as const,
      });
    }
  }

  // ===== STEP 2: Collect/Fetch Sources =====
  console.log(`[PreGenPipeline] Step 2: Collecting sources...`);
  let allSources: SourceArticle[] = [...existingSources];

  // Phase 18: Extract ACTUAL content from pre-existing resource URLs
  // Previously we just used topic.summary as snippet - now we fetch the real page content
  const topicsWithResources = topicsWithSources.filter((t) => t.resource);

  if (topicsWithResources.length > 0) {
    console.log(`[PreGenPipeline] Phase 18: Extracting content from ${topicsWithResources.length} pre-existing resource URLs`);

    // Import article extractor if not already available
    const articleExtractor = await import('../../../services/articleExtractorService');

    // Create SourceArticle objects for extraction
    const urlsToExtract: SourceArticle[] = topicsWithResources.map((t) => ({
      title: t.title,
      url: t.resource!,
      source: 'gdelt' as const,
      snippet: t.summary || t.whatItIs || `Source for "${t.title}"`,
    }));

    // Actually fetch and extract content from the URLs
    const extractionResult = await articleExtractor.extractMultipleArticles(urlsToExtract, {
      maxArticles: topicsWithResources.length,
      maxContentLength: 3000,
      delayMs: 200,
    });

    console.log(`[PreGenPipeline] Phase 18: Extracted ${extractionResult.successCount}/${topicsWithResources.length} articles`);

    // Add extracted articles to allSources
    // For failed extractions, fall back to using the summary as snippet
    for (const extracted of extractionResult.extracted) {
      if (extracted.extractionSuccess && extracted.content) {
        allSources.push({
          ...extracted,
          snippet: extracted.content.substring(0, 500), // Use extracted content as snippet
        });
        console.log(`[PreGenPipeline] Phase 18: Successfully extracted "${extracted.title}" (${extracted.contentLength} chars)`);
      } else {
        // Fall back to using topic summary as snippet
        allSources.push({
          title: extracted.title,
          url: extracted.url,
          source: extracted.source,
          snippet: extracted.snippet || `Source for "${extracted.title}"`,
        });
        console.log(`[PreGenPipeline] Phase 18: Extraction failed for "${extracted.title}", using summary as fallback`);
      }
    }
  }

  // If still no sources (or need more), fetch from APIs
  if (allSources.length === 0) {
    console.log(`[PreGenPipeline] Fetching sources from APIs...`);

    // Collect keywords from audiences and topics (Phase 17: use topicTitles)
    const keywords = [...topicTitles];
    for (const audience of audiences) {
      if (audience.generated?.relevance_keywords) {
        keywords.push(...audience.generated.relevance_keywords);
      }
    }
    const uniqueKeywords = [...new Set(keywords)].slice(0, 10);

    // Collect subreddits
    const subreddits: string[] = [];
    for (const audience of audiences) {
      if (audience.generated?.subreddits) {
        subreddits.push(...audience.generated.subreddits);
      }
    }
    const uniqueSubreddits = [...new Set(subreddits)].slice(0, 5);

    // Collect ArXiv categories
    const arxivCategories: string[] = [];
    for (const audience of audiences) {
      if (audience.generated?.arxiv_categories) {
        arxivCategories.push(...audience.generated.arxiv_categories);
      }
    }
    const uniqueArxivCategories = [...new Set(arxivCategories)].slice(0, 4);

    // Fetch from all sources
    const fetchResult = await sourceFetchingService.fetchAllSources({
      keywords: uniqueKeywords,
      subreddits: uniqueSubreddits.length > 0 ? uniqueSubreddits : undefined,
      arxivCategories: uniqueArxivCategories.length > 0 ? uniqueArxivCategories : undefined,
      limit: 5,
    });

    allSources = fetchResult.articles;
    console.log(`[PreGenPipeline] Fetched ${allSources.length} sources from APIs`);
  }

  // ===== STEP 3: Initial Topic-Source Matching =====
  // Phase 19: Pass full topic objects (with resource) to enable PRIMARY SOURCE enforcement
  console.log(`[PreGenPipeline] Step 3: Matching topics to sources...`);
  const extractedSources: ExtractedArticle[] = allSources.map(sourceToExtracted);
  let matchResult = sourceMatchingService.matchTopicsToSources(normalizedTopics, extractedSources);  // Phase 19: pass full objects for PRIMARY source

  // ===== STEP 4: Web Search Enrichment for Unmatched Topics =====
  if (!skipEnrichment && matchResult.unmatchedTopics.length > 0) {
    console.log(`[PreGenPipeline] Step 4: Enriching ${matchResult.unmatchedTopics.length} unmatched topics via web search...`);

    const enrichedSources: ExtractedArticle[] = [...extractedSources];

    for (const topic of matchResult.unmatchedTopics) {
      // Skip topics that were validated as fictional
      const validation = validatedTopics.find((v) => v.topic === topic);
      if (validation && !validation.isValid && validation.confidence === 'none') {
        console.log(`[PreGenPipeline] Skipping fictional topic: "${topic}"`);
        continue;
      }

      // Perform targeted web search
      const searchQuery = `${topic} AI tools tutorial guide 2024`;
      console.log(`[PreGenPipeline] Web search for: "${topic}"`);

      try {
        const searchResults = await performWebSearch(searchQuery);
        const parsedSources = parseWebSearchToSources(searchResults, topic);

        if (parsedSources.length > 0) {
          console.log(`[PreGenPipeline] Found ${parsedSources.length} web sources for "${topic}"`);
          enrichedSources.push(...parsedSources.map(sourceToExtracted));
        }
      } catch (error) {
        console.error(`[PreGenPipeline] Web search failed for "${topic}":`, error);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // ===== STEP 5: Re-match with enriched sources =====
    // Phase 19: Pass full topic objects to preserve PRIMARY source information
    if (enrichedSources.length > extractedSources.length) {
      console.log(`[PreGenPipeline] Step 5: Re-matching with ${enrichedSources.length} enriched sources...`);
      matchResult = sourceMatchingService.matchTopicsToSources(normalizedTopics, enrichedSources);  // Phase 19: pass full objects for PRIMARY source
    }
  }

  // ===== STEP 6: Generation Guard =====
  console.log(`[PreGenPipeline] Step 6: Checking generation guard...`);
  const pipelineTimeMs = Date.now() - startTime;

  // Build the topic-source context for Claude
  const topicSourceContext = sourceMatchingService.buildTopicSourceContext(matchResult.mappings);

  // Identify fictional topics (must be blocked)
  // IMPORTANT: Only topics with confidence === 'none' are fictional
  // Topics with confidence === 'unknown' (rate limited/API error) should NOT be blocked
  // Phase 17: Topics with pre-existing sources are never fictional
  const fictionalTopicTitles = topicTitles.filter((title) => {
    const validation = validatedTopics.find((v) => v.topic === title);
    return validation && !validation.isValid && validation.confidence === 'none';
  });

  // Count topics where validation was unavailable
  const unavailableCount = validatedTopics.filter((v) => v.confidence === 'unknown').length;
  if (unavailableCount > 0) {
    console.log(`[PreGenPipeline] Step 6: ${unavailableCount}/${topicTitles.length} topic(s) had unavailable validation - proceeding anyway`);
  }

  // Identify valid topics without matched sources (allow but warn)
  const validUnmatchedTopics = matchResult.unmatchedTopics.filter((topic) => {
    const validation = validatedTopics.find((v) => v.topic === topic);
    return validation && validation.isValid;
  });

  if (validUnmatchedTopics.length > 0) {
    console.log(`[PreGenPipeline] Note: ${validUnmatchedTopics.length} valid topics have no keyword-matched sources (will use general sources): ${validUnmatchedTopics.join(', ')}`);
  }

  // ONLY block if ALL topics are FICTIONAL (not just unmatched or unavailable)
  // Valid topics without keyword matches should proceed - Claude can find relevant info in general sources
  // Topics with unavailable validation (rate limited) should also proceed
  // Phase 17: Pre-sourced topics are never fictional, so check topicTitles.length
  if (fictionalTopicTitles.length === topicTitles.length && unavailableCount === 0) {
    return {
      canProceed: false,
      validatedTopics,
      sourceMappings: matchResult.mappings,
      enrichedSources: extractedSources,
      topicSourceContext,
      blockReason: 'All topics appear to be fictional or non-existent',
      userMessage: `Cannot generate newsletter: ${fictionalTopicTitles.map((t) => {
        const v = validatedTopics.find((vt) => vt.topic === t);
        return `"${t}" (${v?.error || 'not found'})`;
      }).join(', ')}. Please enter valid, real topics.`,
      invalidTopics: fictionalTopicTitles,
      suggestions: validatedTopics
        .filter((v) => v.suggestedAlternative)
        .map((v) => v.suggestedAlternative!),
      pipelineTimeMs,
    };
  }

  // Also block if we have NO sources at all (API failure)
  if (extractedSources.length === 0) {
    return {
      canProceed: false,
      validatedTopics,
      sourceMappings: matchResult.mappings,
      enrichedSources: extractedSources,
      topicSourceContext,
      blockReason: 'No sources available from any API',
      userMessage: 'Cannot generate newsletter: Failed to fetch sources from external APIs. Please try again later.',
      pipelineTimeMs,
    };
  }

  // ===== STEP 7: Source Allocation (Phase 15 - Source Diversity) =====
  // Allocate sources to specific topic-audience pairs to ensure diversity
  let allocationResult: AllocationResult | undefined;
  let allocationContext: string | undefined;

  // Only allocate if we have audiences
  if (audiences.length > 0) {
    console.log(`[PreGenPipeline] Step 7: Allocating sources to ${topicTitles.length} topics × ${audiences.length} audiences...`);

    // Filter to valid topics only (exclude fictional ones) - Phase 17: use topicTitles
    const validTopicTitlesList = topicTitles.filter((title) => {
      const validation = validatedTopics.find((v) => v.topic === title);
      return !(validation && !validation.isValid && validation.confidence === 'none');
    });

    // Phase 18v2: Build topic-audience mapping for smart partitioning
    // This allows the allocator to give each audience sources that match THEIR topics
    const topicAudienceMap = new Map<string, string>();
    for (const topic of normalizedTopics) {
      if (validTopicTitlesList.includes(topic.title)) {
        topicAudienceMap.set(topic.title, topic.audienceId);
      }
    }
    console.log(`[PreGenPipeline] Phase 18v2: Topic-audience mapping:`, Object.fromEntries(topicAudienceMap));

    // Allocate sources with diversity enforcement AND topic-audience awareness
    allocationResult = sourceAllocationService.allocateSourcesToAudiences(
      validTopicTitlesList,
      audiences,
      extractedSources,
      2, // 2 sources per topic-audience pair
      topicAudienceMap // Phase 18v2: Pass topic-audience mapping
    );

    // Build the allocation context for Claude prompt
    allocationContext = sourceAllocationService.buildAllocationContext(allocationResult.allocations);

    // Phase 18: ENFORCE diversity - block generation if diversity is too low
    // With the new partitioning algorithm, diversity should be 100% (no cross-audience reuse)
    // Setting threshold to 50% to allow some flexibility while still enforcing diversity
    const MIN_DIVERSITY_THRESHOLD = 50;

    if (allocationResult.diversityScore < MIN_DIVERSITY_THRESHOLD && audiences.length > 1) {
      console.log(`[PreGenPipeline] BLOCKING: Diversity ${allocationResult.diversityScore.toFixed(0)}% is below minimum ${MIN_DIVERSITY_THRESHOLD}%`);
      console.log(`[PreGenPipeline] Reused sources: ${allocationResult.reusedSources.length}`);
      console.log(`[PreGenPipeline] Unique sources: ${allocationResult.stats.totalUniqueSources}`);

      return {
        canProceed: false,
        validatedTopics,
        sourceMappings: matchResult.mappings,
        enrichedSources: extractedSources,
        topicSourceContext,
        blockReason: `Source diversity too low (${allocationResult.diversityScore.toFixed(0)}%). Each audience section needs unique sources.`,
        userMessage: `Cannot generate newsletter: Source diversity is only ${allocationResult.diversityScore.toFixed(0)}%. ` +
          `This means all audience sections would cite the same sources. ` +
          `Please try again - the system will fetch more diverse sources, or select topics that have different sources.`,
        pipelineTimeMs,
        allocationResult,
      };
    }

    // Log diversity metrics (for successful cases)
    if (allocationResult.reusedSources.length > 0) {
      console.log(`[PreGenPipeline] Diversity: ${allocationResult.diversityScore.toFixed(0)}% (above ${MIN_DIVERSITY_THRESHOLD}% threshold)`);
      console.log(`[PreGenPipeline] Note: ${allocationResult.reusedSources.length} sources reused across audiences`);
    } else {
      console.log(`[PreGenPipeline] Perfect diversity achieved - no source reuse across audiences`);
    }
  }

  // Allow generation - we have valid topics and sources
  const result: PreGenerationResult = {
    canProceed: true,
    validatedTopics,
    sourceMappings: matchResult.mappings,
    enrichedSources: extractedSources,
    topicSourceContext,
    pipelineTimeMs,
    // Phase 15: Add allocation data
    sourceAllocations: allocationResult?.allocations,
    allocationResult,
    allocationContext,
  };

  // Only report fictional topics as invalid (not valid topics without keyword matches)
  // Phase 17: Use fictionalTopicTitles (the filtered list)
  if (fictionalTopicTitles.length > 0) {
    result.invalidTopics = fictionalTopicTitles;
    result.userMessage = `Note: ${fictionalTopicTitles.length} fictional topic(s) will be skipped: ${fictionalTopicTitles.join(', ')}`;
  }

  console.log(`[PreGenPipeline] Complete. canProceed: ${result.canProceed}, Sources: ${extractedSources.length}, Allocations: ${allocationResult?.allocations.length || 0}, Time: ${pipelineTimeMs}ms`);
  return result;
}

export default {
  runPreGenerationChecks,
};
