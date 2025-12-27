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
 * Topic with audience assignment for intelligent partitioning
 */
interface TopicWithAudience {
  title: string;
  audienceId: string;
}

/**
 * Allocate sources to topics and audiences ensuring diversity
 *
 * PHASE 18 FIX v2: Partition sources by TOPIC RELEVANCE, not just round-robin.
 * Each source goes to the audience whose topics it best matches.
 *
 * Algorithm:
 * 1. Score each source against each topic
 * 2. Group topics by audience
 * 3. Assign each source to the audience whose topics it matches best
 * 4. Allocate within each audience's pool
 * 5. Result: diversity + topic relevance
 *
 * @param topics - Topics with audience assignments (string[] for backwards compat, or TopicWithAudience[])
 * @param audiences - Audience configurations
 * @param sources - Available sources to allocate from
 * @param sourcesPerAllocation - Number of sources to allocate per topic-audience pair (default: 2)
 * @param topicAudienceMap - Optional map of topic title -> audienceId for better partitioning
 * @returns Allocation result with diversity metrics
 */
export function allocateSourcesToAudiences(
  topics: string[] | TopicWithAudience[],
  audiences: AudienceConfig[],
  sources: (SourceArticle | ExtractedArticle)[],
  sourcesPerAllocation: number = 2,
  topicAudienceMap?: Map<string, string>
): AllocationResult {
  console.log(`[SourceAllocation] Phase 18v2: Smart partitioning ${sources.length} sources for ${audiences.length} audiences...`);

  const allocations: SourceAllocation[] = [];
  const reusedSourceUrls = new Set<string>();

  // Normalize topics to strings for scoring
  const topicTitles = topics.map(t => typeof t === 'string' ? t : t.title);

  // Build topic-audience map from input or parameter
  const topicToAudience = new Map<string, string>();
  if (topicAudienceMap) {
    for (const [title, audienceId] of topicAudienceMap) {
      topicToAudience.set(title, audienceId);
    }
  } else if (topics.length > 0 && typeof topics[0] !== 'string') {
    // Topics are TopicWithAudience objects
    for (const topic of topics as TopicWithAudience[]) {
      topicToAudience.set(topic.title, topic.audienceId);
    }
  }

  // ===== PHASE 18v2: SMART PARTITIONING BY TOPIC RELEVANCE =====
  // Instead of round-robin, assign each source to the audience whose topics it matches best

  const audiencePartitions = new Map<string, (SourceArticle | ExtractedArticle)[]>();
  for (const audience of audiences) {
    audiencePartitions.set(audience.id, []);
  }

  // Group topics by audience
  const topicsByAudience = new Map<string, string[]>();
  for (const audience of audiences) {
    topicsByAudience.set(audience.id, []);
  }

  for (const topic of topicTitles) {
    const audienceId = topicToAudience.get(topic) || audiences[0]?.id;
    if (topicsByAudience.has(audienceId)) {
      topicsByAudience.get(audienceId)!.push(topic);
    }
  }

  // Log topic assignments
  for (const [audienceId, audTopics] of Array.from(topicsByAudience.entries())) {
    console.log(`[SourceAllocation] Audience "${audienceId}" has topics: [${audTopics.join(', ')}]`);
  }

  // For each source, find which audience's topics it matches best
  const assignedSources = new Set<string>();

  for (const source of sources) {
    let bestAudienceId = audiences[0]?.id;
    let bestScore = 0;

    for (const audience of audiences) {
      const audTopics = topicsByAudience.get(audience.id) || [];
      // Calculate max relevance score across this audience's topics
      let maxTopicScore = 0;
      for (const topic of audTopics) {
        const score = calculateRelevanceScore(topic, source);
        if (score > maxTopicScore) {
          maxTopicScore = score;
        }
      }

      if (maxTopicScore > bestScore) {
        bestScore = maxTopicScore;
        bestAudienceId = audience.id;
      }
    }

    // Assign source to best-matching audience (or round-robin if no match)
    if (bestScore >= 0.1) {
      audiencePartitions.get(bestAudienceId)!.push(source);
      console.log(`[SourceAllocation] "${source.title.substring(0, 40)}..." -> ${bestAudienceId} (score: ${bestScore.toFixed(2)})`);
    } else {
      // No good match - distribute round-robin to balance
      const audienceIndex = assignedSources.size % audiences.length;
      const fallbackAudienceId = audiences[audienceIndex].id;
      audiencePartitions.get(fallbackAudienceId)!.push(source);
      console.log(`[SourceAllocation] "${source.title.substring(0, 40)}..." -> ${fallbackAudienceId} (fallback, no topic match)`);
    }

    assignedSources.add(source.url);
  }

  // Log partition sizes
  for (const [audienceId, partition] of Array.from(audiencePartitions.entries())) {
    console.log(`[SourceAllocation] Audience "${audienceId}" partition: ${partition.length} sources`);
  }

  // ===== ALLOCATE WITHIN EACH AUDIENCE'S PARTITION =====
  // Each audience only uses sources from their partition

  for (const audience of audiences) {
    const partition = audiencePartitions.get(audience.id) || [];
    const audienceTopics = topicsByAudience.get(audience.id) || topicTitles;
    const usedInAudience = new Set<string>();

    // Only allocate for topics that belong to this audience
    for (const topic of audienceTopics) {
      const scoredSources: ScoredSource[] = partition
        .map((source) => ({
          source,
          score: calculateRelevanceScore(topic, source),
        }))
        .filter((s) => s.score >= 0.05) // Lower threshold - we already filtered during partitioning
        .sort((a, b) => b.score - a.score);

      const allocatedForThisPair: (SourceArticle | ExtractedArticle)[] = [];
      let hasReusedSources = false;

      // First pass: unique sources
      for (const { source } of scoredSources) {
        if (allocatedForThisPair.length >= sourcesPerAllocation) break;
        if (!usedInAudience.has(source.url)) {
          allocatedForThisPair.push(source);
          usedInAudience.add(source.url);
        }
      }

      // Second pass: allow reuse if needed
      if (allocatedForThisPair.length < sourcesPerAllocation && scoredSources.length > 0) {
        for (const { source } of scoredSources) {
          if (allocatedForThisPair.length >= sourcesPerAllocation) break;
          if (!allocatedForThisPair.includes(source)) {
            allocatedForThisPair.push(source);
            hasReusedSources = true;
            reusedSourceUrls.add(source.url);
          }
        }
      }

      // If still no sources, take anything from partition
      if (allocatedForThisPair.length === 0 && partition.length > 0) {
        allocatedForThisPair.push(partition[0]);
        usedInAudience.add(partition[0].url);
        console.log(`[SourceAllocation] Fallback: gave "${topic}" any source from partition`);
      }

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

  // ===== CALCULATE DIVERSITY METRICS =====
  // Diversity is now measured as: how many sources are shared across audiences?

  const audienceSourceSets = new Map<string, Set<string>>();
  for (const allocation of allocations) {
    if (!audienceSourceSets.has(allocation.audienceId)) {
      audienceSourceSets.set(allocation.audienceId, new Set());
    }
    for (const source of allocation.sources) {
      audienceSourceSets.get(allocation.audienceId)!.add(source.url);
    }
  }

  // Count sources that appear in multiple audiences (should be 0 with partitioning)
  const allSourceUrls = new Set<string>();
  let crossAudienceReuse = 0;

  for (const [, urlSet] of Array.from(audienceSourceSets.entries())) {
    for (const url of urlSet) {
      if (allSourceUrls.has(url)) {
        crossAudienceReuse++;
      }
      allSourceUrls.add(url);
    }
  }

  const topicsWithoutSources = topicTitles.filter((title) => {
    const topicAllocations = allocations.filter((a) => a.topic === title);
    return topicAllocations.every((a) => a.sources.length === 0);
  });

  const totalAllocations = allocations.filter((a) => a.sources.length > 0).length;

  // Diversity = 100% if no cross-audience reuse, decreases with more overlap
  const diversityScore = allSourceUrls.size > 0
    ? Math.max(0, 100 - (crossAudienceReuse / allSourceUrls.size) * 100)
    : 0;

  const result: AllocationResult = {
    allocations,
    reusedSources: Array.from(reusedSourceUrls),
    diversityScore,
    allTopicsHaveSources: topicsWithoutSources.length === 0,
    topicsWithoutSources,
    stats: {
      totalAllocations,
      totalUniqueSources: allSourceUrls.size,
      totalReusedSources: crossAudienceReuse,
      averageSourcesPerAllocation: totalAllocations > 0
        ? allocations.reduce((sum, a) => sum + a.sources.length, 0) / totalAllocations
        : 0,
    },
  };

  console.log(`[SourceAllocation] Phase 18 Complete. Allocations: ${totalAllocations}, Unique sources: ${allSourceUrls.size}, Cross-audience reuse: ${crossAudienceReuse}, Diversity: ${diversityScore.toFixed(0)}%`);

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
