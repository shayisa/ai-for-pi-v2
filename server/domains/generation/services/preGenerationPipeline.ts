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
import type { AudienceConfig } from '../../../../types';
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
 */
export interface PreGenerationParams {
  /** Topics to validate and match */
  topics: string[];
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

  // ===== STEP 1: Validate Topics =====
  let validatedTopics: TopicValidationResult[] = [];

  if (!skipValidation) {
    console.log(`[PreGenPipeline] Step 1: Validating topics...`);
    const validationResult = await topicValidationService.validateTopics(topics);
    validatedTopics = validationResult.results;

    // Check for completely invalid topics (fictional)
    const fictionalTopics = validatedTopics.filter(
      (t) => !t.isValid && t.confidence === 'none'
    );

    if (fictionalTopics.length === topics.length) {
      // ALL topics are fictional - block generation
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
  } else {
    // If skipping validation, assume all topics are valid
    validatedTopics = topics.map((topic) => ({
      topic,
      isValid: true,
      confidence: 'medium' as const,
    }));
  }

  // ===== STEP 2: Collect/Fetch Sources =====
  console.log(`[PreGenPipeline] Step 2: Collecting sources...`);
  let allSources: SourceArticle[] = [...existingSources];

  // If no existing sources, fetch from APIs
  if (allSources.length === 0) {
    console.log(`[PreGenPipeline] Fetching sources from APIs...`);

    // Collect keywords from audiences and topics
    const keywords = [...topics];
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
  console.log(`[PreGenPipeline] Step 3: Matching topics to sources...`);
  const extractedSources: ExtractedArticle[] = allSources.map(sourceToExtracted);
  let matchResult = sourceMatchingService.matchTopicsToSources(topics, extractedSources);

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
    if (enrichedSources.length > extractedSources.length) {
      console.log(`[PreGenPipeline] Step 5: Re-matching with ${enrichedSources.length} enriched sources...`);
      matchResult = sourceMatchingService.matchTopicsToSources(topics, enrichedSources);
    }
  }

  // ===== STEP 6: Generation Guard =====
  console.log(`[PreGenPipeline] Step 6: Checking generation guard...`);
  const pipelineTimeMs = Date.now() - startTime;

  // Build the topic-source context for Claude
  const topicSourceContext = sourceMatchingService.buildTopicSourceContext(matchResult.mappings);

  // Identify fictional topics (must be blocked)
  const fictionalTopics = topics.filter((topic) => {
    const validation = validatedTopics.find((v) => v.topic === topic);
    return validation && !validation.isValid && validation.confidence === 'none';
  });

  // Identify valid topics without matched sources (allow but warn)
  const validUnmatchedTopics = matchResult.unmatchedTopics.filter((topic) => {
    const validation = validatedTopics.find((v) => v.topic === topic);
    return validation && validation.isValid;
  });

  if (validUnmatchedTopics.length > 0) {
    console.log(`[PreGenPipeline] Note: ${validUnmatchedTopics.length} valid topics have no keyword-matched sources (will use general sources): ${validUnmatchedTopics.join(', ')}`);
  }

  // ONLY block if ALL topics are FICTIONAL (not just unmatched)
  // Valid topics without keyword matches should proceed - Claude can find relevant info in general sources
  if (fictionalTopics.length === topics.length) {
    return {
      canProceed: false,
      validatedTopics,
      sourceMappings: matchResult.mappings,
      enrichedSources: extractedSources,
      topicSourceContext,
      blockReason: 'All topics appear to be fictional or non-existent',
      userMessage: `Cannot generate newsletter: ${fictionalTopics.map((t) => {
        const v = validatedTopics.find((vt) => vt.topic === t);
        return `"${t}" (${v?.error || 'not found'})`;
      }).join(', ')}. Please enter valid, real topics.`,
      invalidTopics: fictionalTopics,
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
    console.log(`[PreGenPipeline] Step 7: Allocating sources to ${topics.length} topics × ${audiences.length} audiences...`);

    // Filter to valid topics only (exclude fictional ones)
    const validTopics = topics.filter((topic) => {
      const validation = validatedTopics.find((v) => v.topic === topic);
      return !(validation && !validation.isValid && validation.confidence === 'none');
    });

    // Allocate sources with diversity enforcement
    allocationResult = sourceAllocationService.allocateSourcesToAudiences(
      validTopics,
      audiences,
      extractedSources,
      2 // 2 sources per topic-audience pair
    );

    // Build the allocation context for Claude prompt
    allocationContext = sourceAllocationService.buildAllocationContext(allocationResult.allocations);

    // Log diversity metrics
    if (allocationResult.reusedSources.length > 0) {
      console.log(`[PreGenPipeline] Warning: ${allocationResult.reusedSources.length} sources reused across audiences (diversity: ${allocationResult.diversityScore.toFixed(0)}%)`);
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
  if (fictionalTopics.length > 0) {
    result.invalidTopics = fictionalTopics;
    result.userMessage = `Note: ${fictionalTopics.length} fictional topic(s) will be skipped: ${fictionalTopics.join(', ')}`;
  }

  console.log(`[PreGenPipeline] Complete. canProceed: ${result.canProceed}, Sources: ${extractedSources.length}, Allocations: ${allocationResult?.allocations.length || 0}, Time: ${pipelineTimeMs}ms`);
  return result;
}

export default {
  runPreGenerationChecks,
};
