/**
 * Parallel Suggestion Orchestrator
 *
 * Phase 15.4: Coordinates parallel per-audience topic suggestion generation
 *
 * This orchestrator spawns multiple agents in parallel, each focused on
 * a single audience. Results are merged with equal representation to
 * guarantee balanced topic suggestions across all selected audiences.
 *
 * Unlike parallelTrendingOrchestrator (which uses per-category batching),
 * this orchestrator uses per-audience agents for maximum granularity
 * since topic suggestions are quick to generate.
 *
 * @module domains/generation/services/parallelSuggestionOrchestrator
 */

import type { SuggestedTopic } from '../../../../types';
import {
  resolveAllAudiences,
  shuffleArray,
} from '../helpers/audienceHelpers';
import type { ResolvedAudience } from '../helpers/audienceHelpers';
import {
  generateSuggestionsForAudience,
  type TopicSuggestionResult,
} from './topicSuggestionAgent';

/**
 * Configuration for parallel suggestion generation
 */
export interface ParallelSuggestionConfig {
  /** Number of topics to generate per audience (default: 3) */
  topicsPerAudience: number;
}

/**
 * Result from parallel suggestion orchestrator
 */
export interface ParallelSuggestionResult {
  success: boolean;
  topics?: SuggestedTopic[];
  perAudienceResults?: TopicSuggestionResult[];
  totalDurationMs?: number;
  error?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ParallelSuggestionConfig = {
  topicsPerAudience: 3,
};

/**
 * Merge topics from all agents with equal representation
 *
 * Uses round-robin selection to ensure balanced representation
 * across all audiences, then shuffles to avoid predictable ordering.
 */
function mergeTopicsWithBalance(
  results: TopicSuggestionResult[],
  maxTopicsPerAudience: number = 3
): SuggestedTopic[] {
  // Collect topics by audience
  const topicsByAudience = new Map<string, SuggestedTopic[]>();

  for (const result of results) {
    if (!result.success) continue;

    const existing = topicsByAudience.get(result.audienceId) || [];
    existing.push(...result.topics.slice(0, maxTopicsPerAudience));
    topicsByAudience.set(result.audienceId, existing);
  }

  // Round-robin selection for equal representation
  const merged: SuggestedTopic[] = [];
  const audienceIds = shuffleArray([...topicsByAudience.keys()]);
  const indices = new Map<string, number>();

  for (const id of audienceIds) {
    indices.set(id, 0);
  }

  // Round-robin until we exhaust topics
  let exhausted = false;
  while (!exhausted) {
    exhausted = true;

    for (const audienceId of audienceIds) {
      const topics = topicsByAudience.get(audienceId) || [];
      const index = indices.get(audienceId) || 0;

      if (index < topics.length) {
        merged.push(topics[index]);
        indices.set(audienceId, index + 1);
        exhausted = false;
      }
    }
  }

  // Final shuffle to avoid audience order bias in output
  return shuffleArray(merged);
}

/**
 * Main orchestrator function for parallel topic suggestion generation
 *
 * @param audienceIds - Array of audience IDs to generate suggestions for
 * @param config - Optional generation configuration
 * @param customAudiences - Optional array of custom audience definitions
 */
export async function generateSuggestionsParallel(
  audienceIds: string[],
  config: Partial<ParallelSuggestionConfig> = {},
  customAudiences?: Array<{
    id: string;
    name: string;
    description: string;
    domainExamples?: string;
    topicTitles?: string[];
  }>
): Promise<ParallelSuggestionResult> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  console.log(
    `[ParallelSuggestionOrchestrator] Starting with ${audienceIds.length} audiences, ${fullConfig.topicsPerAudience} topics per audience`
  );

  // Step 1: Resolve all audiences (including custom)
  const audiences = resolveAllAudiences(audienceIds, customAudiences);

  if (audiences.length === 0) {
    console.error('[ParallelSuggestionOrchestrator] No valid audiences provided');
    return {
      success: false,
      error: 'No valid audiences provided',
    };
  }

  console.log(`[ParallelSuggestionOrchestrator] Resolved ${audiences.length} audiences:`);
  for (const audience of audiences) {
    console.log(`  - ${audience.id}: ${audience.name}`);
  }

  // Step 2: Spawn parallel agents (one per audience)
  console.log(`[ParallelSuggestionOrchestrator] Spawning ${audiences.length} parallel agents`);

  const agentPromises = audiences.map((audience) =>
    generateSuggestionsForAudience({
      audienceId: audience.id,
      audienceName: audience.name,
      audienceDescription: audience.description,
      domainExamples: audience.domainExamples,
      topicsToGenerate: fullConfig.topicsPerAudience,
    })
  );

  // Use Promise.allSettled for fault tolerance
  const settledResults = await Promise.allSettled(agentPromises);

  // Step 3: Process results
  const successfulResults: TopicSuggestionResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < settledResults.length; i++) {
    const result = settledResults[i];
    const audience = audiences[i];

    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successfulResults.push(result.value);
        console.log(
          `[ParallelSuggestionOrchestrator] Agent ${audience.id}: ${result.value.topics.length} topics`
        );
      } else {
        errors.push(`${audience.id}: ${result.value.error}`);
        console.error(
          `[ParallelSuggestionOrchestrator] Agent ${audience.id} failed: ${result.value.error}`
        );
      }
    } else {
      errors.push(`${audience.id}: ${result.reason}`);
      console.error(
        `[ParallelSuggestionOrchestrator] Agent ${audience.id} rejected: ${result.reason}`
      );
    }
  }

  // Step 4: Check if we have any successful results
  if (successfulResults.length === 0) {
    return {
      success: false,
      error: `All agents failed: ${errors.join('; ')}`,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // Step 5: Merge topics with equal representation
  const mergedTopics = mergeTopicsWithBalance(
    successfulResults,
    fullConfig.topicsPerAudience
  );

  const totalDurationMs = Date.now() - startTime;

  console.log(
    `[ParallelSuggestionOrchestrator] Complete: ${mergedTopics.length} merged topics in ${totalDurationMs}ms`
  );

  // Log per-audience representation
  const audienceRepresentation: Record<string, number> = {};
  for (const topic of mergedTopics) {
    audienceRepresentation[topic.audienceId] = (audienceRepresentation[topic.audienceId] || 0) + 1;
  }
  console.log('[ParallelSuggestionOrchestrator] Topic distribution:', audienceRepresentation);

  return {
    success: true,
    topics: mergedTopics,
    perAudienceResults: successfulResults,
    totalDurationMs,
  };
}
