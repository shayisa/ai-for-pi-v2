/**
 * Topic Merger Service
 *
 * Phase 15.3: Merges topics from multiple per-audience agents with equal representation
 *
 * Uses round-robin selection to guarantee that each audience gets equal representation
 * in the final topic list, eliminating the archaeology bias caused by order-based selection.
 *
 * @module domains/generation/services/topicMerger
 */

import type { TrendingTopic } from '../../../../types';
import type {
  PerAudienceResult,
  TopicMergerConfig,
  MergerResult,
  DEFAULT_MERGER_CONFIG,
} from '../types/parallelGeneration';
import { shuffleArray } from '../helpers/audienceHelpers';

/**
 * Default merger configuration
 */
const DEFAULT_CONFIG: TopicMergerConfig = {
  targetCount: 10,
  minPerAudience: 2,
  strictBalance: true,
  shuffleFinal: true,
};

/**
 * Merge topics from per-audience results with configurable balance
 *
 * @param results - Array of per-audience generation results
 * @param config - Optional merger configuration
 * @returns Merged topics with statistics
 */
export function mergeTopicsWithBalance(
  results: PerAudienceResult[],
  config: Partial<TopicMergerConfig> = {}
): MergerResult {
  const fullConfig: TopicMergerConfig = { ...DEFAULT_CONFIG, ...config };

  // Collect all topics grouped by audience
  const topicsByAudience = new Map<string, TrendingTopic[]>();
  let totalBeforeMerge = 0;

  for (const result of results) {
    if (!result.success) continue;

    for (const [audienceId, topics] of result.topicsByAudience) {
      const existing = topicsByAudience.get(audienceId) || [];
      existing.push(...topics);
      topicsByAudience.set(audienceId, existing);
      totalBeforeMerge += topics.length;
    }
  }

  // If no topics, return empty result
  if (topicsByAudience.size === 0) {
    return {
      topics: [],
      stats: {
        totalBeforeMerge: 0,
        totalAfterMerge: 0,
        perAudience: {},
        underrepresented: [],
      },
    };
  }

  // Shuffle audience order to eliminate position bias
  const audienceIds = shuffleArray([...topicsByAudience.keys()]);

  // Calculate ideal topics per audience for strict balance
  const audienceCount = audienceIds.length;
  const idealPerAudience = Math.floor(fullConfig.targetCount / audienceCount);
  const remainder = fullConfig.targetCount % audienceCount;

  // Track indices for round-robin selection
  const indices = new Map<string, number>();
  for (const id of audienceIds) {
    indices.set(id, 0);
  }

  const merged: TrendingTopic[] = [];
  const perAudienceCount: Record<string, number> = {};

  // Initialize counts
  for (const id of audienceIds) {
    perAudienceCount[id] = 0;
  }

  if (fullConfig.strictBalance) {
    // Strict balance: ensure equal representation, distribute remainder fairly

    // First pass: give each audience their minimum allocation
    for (const audienceId of audienceIds) {
      const topics = topicsByAudience.get(audienceId) || [];
      const minRequired = Math.max(
        fullConfig.minPerAudience,
        idealPerAudience
      );

      for (let i = 0; i < minRequired && i < topics.length; i++) {
        merged.push(topics[i]);
        perAudienceCount[audienceId]++;
      }
      indices.set(audienceId, Math.min(minRequired, topics.length));
    }

    // Second pass: distribute remainder via round-robin until target reached
    let round = 0;
    while (merged.length < fullConfig.targetCount && round < audienceCount) {
      for (const audienceId of audienceIds) {
        if (merged.length >= fullConfig.targetCount) break;

        const topics = topicsByAudience.get(audienceId) || [];
        const currentIndex = indices.get(audienceId) || 0;

        if (currentIndex < topics.length) {
          merged.push(topics[currentIndex]);
          perAudienceCount[audienceId]++;
          indices.set(audienceId, currentIndex + 1);
        }
      }
      round++;
    }
  } else {
    // Non-strict: round-robin until target reached, some audiences may have more

    let exhausted = false;
    while (merged.length < fullConfig.targetCount && !exhausted) {
      exhausted = true;

      for (const audienceId of audienceIds) {
        if (merged.length >= fullConfig.targetCount) break;

        const topics = topicsByAudience.get(audienceId) || [];
        const currentIndex = indices.get(audienceId) || 0;

        if (currentIndex < topics.length) {
          merged.push(topics[currentIndex]);
          perAudienceCount[audienceId]++;
          indices.set(audienceId, currentIndex + 1);
          exhausted = false;
        }
      }
    }
  }

  // Identify underrepresented audiences
  const underrepresented: string[] = [];
  for (const [audienceId, count] of Object.entries(perAudienceCount)) {
    if (count < fullConfig.minPerAudience) {
      underrepresented.push(audienceId);
    }
  }

  // Final shuffle if configured
  const finalTopics = fullConfig.shuffleFinal ? shuffleArray(merged) : merged;

  return {
    topics: finalTopics,
    stats: {
      totalBeforeMerge,
      totalAfterMerge: finalTopics.length,
      perAudience: perAudienceCount,
      underrepresented,
    },
  };
}

/**
 * Merge with priority weighting
 *
 * Allows certain audiences to have higher representation in final output.
 * Useful when some audiences are more important for a given context.
 *
 * @param results - Per-audience generation results
 * @param weights - Map of audience ID to weight (default 1.0)
 * @param targetCount - Target number of topics
 */
export function mergeWithPriority(
  results: PerAudienceResult[],
  weights: Map<string, number>,
  targetCount: number = 10
): MergerResult {
  // Collect topics by audience
  const topicsByAudience = new Map<string, TrendingTopic[]>();
  let totalBeforeMerge = 0;

  for (const result of results) {
    if (!result.success) continue;

    for (const [audienceId, topics] of result.topicsByAudience) {
      const existing = topicsByAudience.get(audienceId) || [];
      existing.push(...topics);
      topicsByAudience.set(audienceId, existing);
      totalBeforeMerge += topics.length;
    }
  }

  if (topicsByAudience.size === 0) {
    return {
      topics: [],
      stats: {
        totalBeforeMerge: 0,
        totalAfterMerge: 0,
        perAudience: {},
        underrepresented: [],
      },
    };
  }

  // Calculate total weight
  let totalWeight = 0;
  for (const audienceId of topicsByAudience.keys()) {
    totalWeight += weights.get(audienceId) ?? 1.0;
  }

  // Calculate allocation per audience based on weight
  const allocations = new Map<string, number>();
  let allocated = 0;

  for (const audienceId of topicsByAudience.keys()) {
    const weight = weights.get(audienceId) ?? 1.0;
    const proportion = weight / totalWeight;
    const alloc = Math.floor(targetCount * proportion);
    allocations.set(audienceId, alloc);
    allocated += alloc;
  }

  // Distribute remainder to highest-weighted audiences
  const sortedByWeight = [...topicsByAudience.keys()].sort(
    (a, b) => (weights.get(b) ?? 1.0) - (weights.get(a) ?? 1.0)
  );

  let idx = 0;
  while (allocated < targetCount) {
    const audienceId = sortedByWeight[idx % sortedByWeight.length];
    allocations.set(audienceId, (allocations.get(audienceId) || 0) + 1);
    allocated++;
    idx++;
  }

  // Select topics based on allocations
  const merged: TrendingTopic[] = [];
  const perAudienceCount: Record<string, number> = {};

  for (const [audienceId, alloc] of allocations) {
    const topics = topicsByAudience.get(audienceId) || [];
    const toTake = Math.min(alloc, topics.length);

    for (let i = 0; i < toTake; i++) {
      merged.push(topics[i]);
    }

    perAudienceCount[audienceId] = toTake;
  }

  // Shuffle final result
  const finalTopics = shuffleArray(merged);

  return {
    topics: finalTopics,
    stats: {
      totalBeforeMerge,
      totalAfterMerge: finalTopics.length,
      perAudience: perAudienceCount,
      underrepresented: [],
    },
  };
}

/**
 * Deduplicate topics that are too similar across audiences
 *
 * Uses simple title similarity to remove duplicates while maintaining
 * audience balance.
 *
 * @param topics - Array of topics to deduplicate
 * @param similarityThreshold - Threshold for considering titles similar (0-1)
 */
export function deduplicateSimilarTopics(
  topics: TrendingTopic[],
  similarityThreshold: number = 0.8
): TrendingTopic[] {
  const unique: TrendingTopic[] = [];
  const seenTitles: string[] = [];

  for (const topic of topics) {
    const normalizedTitle = normalizeTitle(topic.title);
    let isDuplicate = false;

    for (const seen of seenTitles) {
      if (calculateSimilarity(normalizedTitle, seen) >= similarityThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(topic);
      seenTitles.push(normalizedTitle);
    }
  }

  return unique;
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/how to /gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Calculate simple word-based Jaccard similarity
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Analyze topic distribution across audiences
 *
 * Returns statistics about how topics are distributed, useful for debugging
 * and monitoring balance.
 */
export function analyzeTopicDistribution(
  topics: TrendingTopic[]
): {
  total: number;
  perAudience: Record<string, number>;
  percentages: Record<string, string>;
  isBalanced: boolean;
  imbalanceRatio: number;
} {
  const perAudience: Record<string, number> = {};

  for (const topic of topics) {
    const audienceId = topic.audienceId || 'unknown';
    perAudience[audienceId] = (perAudience[audienceId] || 0) + 1;
  }

  const total = topics.length;
  const counts = Object.values(perAudience);
  const maxCount = Math.max(...counts, 0);
  const minCount = Math.min(...counts, 0);

  const percentages: Record<string, string> = {};
  for (const [id, count] of Object.entries(perAudience)) {
    percentages[id] = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
  }

  // Calculate imbalance ratio (1.0 = perfectly balanced)
  const imbalanceRatio = minCount > 0 ? maxCount / minCount : maxCount > 0 ? Infinity : 1;

  // Consider balanced if no audience has more than 2x the topics of another
  const isBalanced = imbalanceRatio <= 2;

  return {
    total,
    perAudience,
    percentages,
    isBalanced,
    imbalanceRatio,
  };
}
