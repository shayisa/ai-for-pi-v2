/**
 * Source Allocation Service
 *
 * Allocates sources to specific topics and audiences to guarantee diversity.
 * Each audience section receives unique sources not shared with other audiences.
 *
 * @module services/sourceAllocationService
 *
 * ## Allocation Strategy
 * 1. Score all sources for each topic
 * 2. For each audience, select top sources not already allocated
 * 3. Mark allocated sources to prevent reuse
 * 4. Return explicit topic-audience-source mappings
 *
 * ## Diversity Guarantee
 * - Each audience section receives different sources
 * - Sources are prioritized by relevance score
 * - If sources run low, reuse is allowed with warning
 */

import type { SourceArticle } from './sourceFetchingService';
import type { ExtractedArticle } from './articleExtractorService';
import type { AudienceConfig } from '../../types';
import { calculateRelevanceScore, extractKeywords } from './sourceMatchingService';

/**
 * A single source allocation to a specific audience for a specific topic
 */
export interface SourceAllocation {
  /** The topic this allocation is for */
  topic: string;
  /** The audience receiving this source */
  audienceId: string;
  /** The audience name */
  audienceName: string;
  /** Sources allocated to this audience for this topic */
  sources: (SourceArticle | ExtractedArticle)[];
  /** The primary (highest relevance) source */
  primarySource: SourceArticle | ExtractedArticle | null;
  /** Relevance score of primary source */
  relevanceScore: number;
  /** Whether this allocation had to reuse sources from another audience */
  hasReusedSources: boolean;
}

/**
 * Result of allocating sources across all topics and audiences
 */
export interface AllocationResult {
  /** All allocations organized by topic and audience */
  allocations: SourceAllocation[];
  /** Sources that were allocated to multiple audiences (diversity violations) */
  reusedSources: string[];
  /** Diversity score: 100 = perfect diversity, 0 = all sources reused */
  diversityScore: number;
  /** Whether all topics have at least one allocated source */
  allTopicsHaveSources: boolean;
  /** Topics with no sources allocated */
  topicsWithoutSources: string[];
  /** Summary statistics */
  stats: {
    totalAllocations: number;
    totalUniqueSources: number;
    totalReusedSources: number;
    averageSourcesPerAllocation: number;
  };
}

/**
 * Scored source with relevance to a topic
 */
interface ScoredSource {
  source: SourceArticle | ExtractedArticle;
  score: number;
}

/**
 * Allocate sources to topics and audiences ensuring diversity
 *
 * @param topics - Topics to allocate sources for
 * @param audiences - Audience configurations
 * @param sources - Available sources to allocate from
 * @param sourcesPerAllocation - Number of sources to allocate per topic-audience pair (default: 2)
 * @returns Allocation result with diversity metrics
 */
export function allocateSourcesToAudiences(
  topics: string[],
  audiences: AudienceConfig[],
  sources: (SourceArticle | ExtractedArticle)[],
  sourcesPerAllocation: number = 2
): AllocationResult {
  console.log(`[SourceAllocation] Allocating ${sources.length} sources to ${topics.length} topics × ${audiences.length} audiences...`);

  const allocations: SourceAllocation[] = [];
  const allocatedUrls = new Set<string>(); // Track globally allocated URLs
  const audienceSourceUrls = new Map<string, Set<string>>(); // Track per-audience URLs
  const reusedSourceUrls = new Set<string>();

  // Initialize per-audience tracking
  for (const audience of audiences) {
    audienceSourceUrls.set(audience.id, new Set<string>());
  }

  // Score all sources for each topic
  const topicSourceScores = new Map<string, ScoredSource[]>();
  for (const topic of topics) {
    const scoredSources: ScoredSource[] = sources
      .map((source) => ({
        source,
        score: calculateRelevanceScore(topic, source),
      }))
      .sort((a, b) => b.score - a.score);
    topicSourceScores.set(topic, scoredSources);
  }

  // Allocate sources for each topic-audience pair
  for (const topic of topics) {
    const scoredSources = topicSourceScores.get(topic) || [];

    for (const audience of audiences) {
      const audienceUrls = audienceSourceUrls.get(audience.id)!;
      const allocatedForThisPair: (SourceArticle | ExtractedArticle)[] = [];
      let hasReusedSources = false;

      // First pass: try to find sources not already allocated to ANY audience
      for (const { source, score } of scoredSources) {
        if (allocatedForThisPair.length >= sourcesPerAllocation) break;
        if (score < 0.1) continue; // Skip very low relevance

        if (!allocatedUrls.has(source.url)) {
          allocatedForThisPair.push(source);
          allocatedUrls.add(source.url);
          audienceUrls.add(source.url);
        }
      }

      // Second pass: if not enough, allow reuse from other audiences but not this one
      if (allocatedForThisPair.length < sourcesPerAllocation) {
        for (const { source, score } of scoredSources) {
          if (allocatedForThisPair.length >= sourcesPerAllocation) break;
          if (score < 0.1) continue;

          // Allow if not already used by THIS audience
          if (!audienceUrls.has(source.url)) {
            allocatedForThisPair.push(source);
            audienceUrls.add(source.url);
            reusedSourceUrls.add(source.url);
            hasReusedSources = true;
          }
        }
      }

      // Third pass: if still not enough, just use any relevant source
      if (allocatedForThisPair.length < 1 && scoredSources.length > 0) {
        // Take the best source even if already used
        const best = scoredSources[0];
        if (best.score >= 0.1) {
          allocatedForThisPair.push(best.source);
          audienceUrls.add(best.source.url);
          reusedSourceUrls.add(best.source.url);
          hasReusedSources = true;
        }
      }

      // Create the allocation
      const allocation: SourceAllocation = {
        topic,
        audienceId: audience.id,
        audienceName: audience.name,
        sources: allocatedForThisPair,
        primarySource: allocatedForThisPair[0] || null,
        relevanceScore: allocatedForThisPair[0]
          ? scoredSources.find((s) => s.source.url === allocatedForThisPair[0].url)?.score || 0
          : 0,
        hasReusedSources,
      };

      allocations.push(allocation);
    }
  }

  // Calculate statistics
  const uniqueSourceUrls = new Set<string>();
  for (const allocation of allocations) {
    for (const source of allocation.sources) {
      uniqueSourceUrls.add(source.url);
    }
  }

  const topicsWithoutSources = topics.filter((topic) => {
    const topicAllocations = allocations.filter((a) => a.topic === topic);
    return topicAllocations.every((a) => a.sources.length === 0);
  });

  const totalAllocations = allocations.filter((a) => a.sources.length > 0).length;
  const diversityScore = reusedSourceUrls.size === 0
    ? 100
    : Math.max(0, 100 - (reusedSourceUrls.size / uniqueSourceUrls.size) * 100);

  const result: AllocationResult = {
    allocations,
    reusedSources: Array.from(reusedSourceUrls),
    diversityScore,
    allTopicsHaveSources: topicsWithoutSources.length === 0,
    topicsWithoutSources,
    stats: {
      totalAllocations,
      totalUniqueSources: uniqueSourceUrls.size,
      totalReusedSources: reusedSourceUrls.size,
      averageSourcesPerAllocation: totalAllocations > 0
        ? allocations.reduce((sum, a) => sum + a.sources.length, 0) / totalAllocations
        : 0,
    },
  };

  console.log(`[SourceAllocation] Complete. Allocations: ${totalAllocations}, Unique sources: ${uniqueSourceUrls.size}, Diversity: ${diversityScore.toFixed(0)}%`);

  return result;
}

/**
 * Get the allocation for a specific topic and audience
 *
 * @param topic - The topic to get allocation for
 * @param audienceId - The audience ID
 * @param allocations - All allocations
 * @returns The allocation or undefined
 */
export function getAllocationForTopicAudience(
  topic: string,
  audienceId: string,
  allocations: SourceAllocation[]
): SourceAllocation | undefined {
  return allocations.find((a) => a.topic === topic && a.audienceId === audienceId);
}

/**
 * Get all allocations for a specific audience
 *
 * @param audienceId - The audience ID
 * @param allocations - All allocations
 * @returns Array of allocations for this audience
 */
export function getAllocationsForAudience(
  audienceId: string,
  allocations: SourceAllocation[]
): SourceAllocation[] {
  return allocations.filter((a) => a.audienceId === audienceId);
}

/**
 * Build a formatted context string for Claude prompt showing per-audience source assignments
 *
 * @param allocations - All source allocations
 * @returns Formatted string for Claude prompt
 */
export function buildAllocationContext(allocations: SourceAllocation[]): string {
  const sections: string[] = [];

  // Group by audience
  const byAudience = new Map<string, SourceAllocation[]>();
  for (const allocation of allocations) {
    const key = `${allocation.audienceId}:${allocation.audienceName}`;
    const existing = byAudience.get(key) || [];
    existing.push(allocation);
    byAudience.set(key, existing);
  }

  for (const [audienceKey, audienceAllocations] of Array.from(byAudience.entries())) {
    const [audienceId, audienceName] = audienceKey.split(':');
    let section = `\n## ${audienceName.toUpperCase()} SECTION (${audienceId})\n`;
    section += `MANDATORY: Use ONLY the sources listed below for this audience section.\n\n`;

    for (const allocation of audienceAllocations) {
      section += `### Topic: "${allocation.topic}"\n`;

      if (allocation.sources.length > 0) {
        section += `ASSIGNED SOURCES (must cite at least one):\n`;
        for (let i = 0; i < allocation.sources.length; i++) {
          const source = allocation.sources[i];
          const content = 'content' in source ? source.content : source.snippet;
          section += `  ${i + 1}. [${source.source.toUpperCase()}] ${source.title}\n`;
          section += `     URL: ${source.url}\n`;
          if (content) {
            section += `     Excerpt: ${content.substring(0, 300)}...\n`;
          }
        }
      } else {
        section += `NO SOURCES ASSIGNED - Do not write about this topic for this audience.\n`;
      }
      section += '\n';
    }

    sections.push(section);
  }

  const header = `
## MANDATORY SOURCE ASSIGNMENTS

Each audience section MUST use ONLY its assigned sources. DO NOT reuse sources across sections.
If a topic has no assigned sources for an audience, do not write about that topic for that audience.

`;

  return header + sections.join('\n---\n');
}

/**
 * Validate that allocations maintain diversity
 *
 * @param allocations - Allocations to validate
 * @returns Validation result with any issues found
 */
export function validateAllocationDiversity(
  allocations: SourceAllocation[]
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for source reuse across audiences for the same topic
  const topicAudienceUrls = new Map<string, Map<string, Set<string>>>();

  for (const allocation of allocations) {
    if (!topicAudienceUrls.has(allocation.topic)) {
      topicAudienceUrls.set(allocation.topic, new Map());
    }
    const audienceUrls = topicAudienceUrls.get(allocation.topic)!;
    audienceUrls.set(allocation.audienceId, new Set(allocation.sources.map((s) => s.url)));
  }

  // For each topic, check if audiences share sources
  for (const [topic, audienceMap] of Array.from(topicAudienceUrls.entries())) {
    const audiences = Array.from(audienceMap.keys());
    for (let i = 0; i < audiences.length; i++) {
      for (let j = i + 1; j < audiences.length; j++) {
        const urlsA = audienceMap.get(audiences[i])!;
        const urlsB = audienceMap.get(audiences[j])!;
        const shared = [...urlsA].filter((url) => urlsB.has(url));
        if (shared.length > 0) {
          issues.push(
            `Topic "${topic}": Audiences ${audiences[i]} and ${audiences[j]} share ${shared.length} source(s)`
          );
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export default {
  allocateSourcesToAudiences,
  getAllocationForTopicAudience,
  getAllocationsForAudience,
  buildAllocationContext,
  validateAllocationDiversity,
};
