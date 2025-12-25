/**
 * Parallel Trending Orchestrator
 *
 * Phase 15.3: Coordinates parallel per-audience topic generation
 *
 * This orchestrator spawns multiple agents in parallel, each focused on
 * specific audiences. Results are merged with equal representation to
 * eliminate the archaeology bias caused by order-based selection.
 *
 * Features:
 * - Configurable modes: per-category, per-audience, hybrid
 * - No hardcoded agent limits (user-configurable)
 * - Trade-off display before generation
 * - Fault-tolerant parallel execution
 * - Equal-weight topic merging
 *
 * @module domains/generation/services/parallelTrendingOrchestrator
 */

import type { TrendingTopic } from '../../../../types';
import type {
  ParallelGenerationConfig,
  ParallelGenerationMode,
  AgentBatch,
  PerAudienceResult,
  ParallelTrendingResult,
  GenerationTradeoffs,
  DEFAULT_PARALLEL_CONFIG,
} from '../types/parallelGeneration';
import {
  resolveAllAudiences,
  groupAudiencesByCategory,
  shuffleArray,
} from '../helpers/audienceHelpers';
import type { ResolvedAudience } from '../helpers/audienceHelpers';
import {
  generateTrendingTopicsForAudience,
  generateTrendingTopicsForBatch,
} from './singleAudienceAgent';

/**
 * Default configuration for parallel generation
 */
const DEFAULT_CONFIG: ParallelGenerationConfig = {
  mode: 'per-category',
  topicsPerAgent: 4,
  showTradeoffs: true,
};

/**
 * Estimated time per agent in seconds
 * Based on observed API latency with web search tool
 */
const ESTIMATED_SECONDS_PER_AGENT = 15;

/**
 * Create agent batches based on configuration mode
 *
 * @param audiences - All resolved audiences to process
 * @param config - Parallel generation configuration
 * @returns Array of agent batches
 */
function createAgentBatches(
  audiences: ResolvedAudience[],
  config: ParallelGenerationConfig
): AgentBatch[] {
  const batches: AgentBatch[] = [];

  if (config.mode === 'per-audience') {
    // One agent per audience (respects maxParallelAgents if set)
    const max = config.maxParallelAgents ?? audiences.length;

    if (audiences.length <= max) {
      // Each audience gets its own batch
      for (const audience of audiences) {
        batches.push({
          batchId: audience.id,
          batchName: audience.name,
          audiences: [audience],
          parentCategory: audience.parentId,
        });
      }
    } else {
      // Overflow: group remaining audiences into last batch
      const grouped = groupWithOverflow(audiences, max);
      for (const group of grouped) {
        if (group.length === 1) {
          batches.push({
            batchId: group[0].id,
            batchName: group[0].name,
            audiences: group,
            parentCategory: group[0].parentId,
          });
        } else {
          batches.push({
            batchId: `overflow-${group.map((a) => a.id).join('-')}`,
            batchName: `Mixed: ${group.map((a) => a.name).join(', ')}`,
            audiences: group,
          });
        }
      }
    }
  } else if (config.mode === 'per-category') {
    // One agent per parent category
    const byCategory = groupAudiencesByCategory(audiences);

    for (const [categoryId, categoryAudiences] of byCategory) {
      if (categoryId === 'custom') {
        // Custom audiences: each gets its own batch
        for (const audience of categoryAudiences) {
          batches.push({
            batchId: audience.id,
            batchName: audience.name,
            audiences: [audience],
            parentCategory: undefined,
          });
        }
      } else {
        // Built-in category: batch all audiences together
        batches.push({
          batchId: categoryId,
          batchName: getCategoryDisplayName(categoryId),
          audiences: categoryAudiences,
          parentCategory: categoryId,
        });
      }
    }
  } else {
    // Hybrid mode: per-category for defaults, per-audience for custom
    const byCategory = groupAudiencesByCategory(audiences);

    for (const [categoryId, categoryAudiences] of byCategory) {
      if (categoryId === 'custom') {
        // Custom audiences: each gets its own batch
        for (const audience of categoryAudiences) {
          batches.push({
            batchId: audience.id,
            batchName: audience.name,
            audiences: [audience],
            parentCategory: undefined,
          });
        }
      } else {
        // Built-in category: batch all audiences together
        batches.push({
          batchId: categoryId,
          batchName: getCategoryDisplayName(categoryId),
          audiences: categoryAudiences,
          parentCategory: categoryId,
        });
      }
    }
  }

  return batches;
}

/**
 * Group audiences with overflow handling
 * First N audiences get individual batches, remaining go into last batch
 */
function groupWithOverflow(
  audiences: ResolvedAudience[],
  maxBatches: number
): ResolvedAudience[][] {
  if (audiences.length <= maxBatches) {
    return audiences.map((a) => [a]);
  }

  const result: ResolvedAudience[][] = [];

  // First (maxBatches - 1) get individual batches
  for (let i = 0; i < maxBatches - 1; i++) {
    result.push([audiences[i]]);
  }

  // Remaining audiences go into overflow batch
  const overflow = audiences.slice(maxBatches - 1);
  result.push(overflow);

  return result;
}

/**
 * Get display name for a category
 */
function getCategoryDisplayName(categoryId: string): string {
  const names: Record<string, string> = {
    academic: 'Academic Researchers',
    business: 'Business Professionals',
  };
  return names[categoryId] || categoryId;
}

/**
 * Calculate trade-offs for user display
 */
function calculateTradeoffs(
  audiences: ResolvedAudience[],
  batches: AgentBatch[],
  config: ParallelGenerationConfig
): GenerationTradeoffs {
  // Count by type
  const defaultAudiences = audiences.filter((a) => !a.isCustom);
  const customAudiences = audiences.filter((a) => a.isCustom);

  // Count by category
  const byCategory: Record<string, number> = {};
  for (const audience of audiences) {
    const category = audience.parentId || 'custom';
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  // Calculate estimates
  const agentCount = batches.length;
  const estimatedTopics = agentCount * config.topicsPerAgent;
  // Parallel execution: time is based on slowest agent, not sum
  const estimatedTimeSeconds = ESTIMATED_SECONDS_PER_AGENT;
  const estimatedApiCalls = agentCount;

  // Generate alternatives
  const alternatives: GenerationTradeoffs['alternatives'] = [];

  if (config.mode !== 'per-category') {
    const categoryBatches = createAgentBatches(audiences, { ...config, mode: 'per-category' });
    alternatives.push({
      mode: 'per-category',
      agentCount: categoryBatches.length,
      estimatedTimeSeconds: ESTIMATED_SECONDS_PER_AGENT,
      description: `Faster: ${categoryBatches.length} agents (one per category)`,
    });
  }

  if (config.mode !== 'per-audience' && audiences.length <= 10) {
    alternatives.push({
      mode: 'per-audience',
      agentCount: audiences.length,
      estimatedTimeSeconds: ESTIMATED_SECONDS_PER_AGENT,
      description: `More granular: ${audiences.length} agents (one per audience)`,
    });
  }

  if (config.mode !== 'hybrid') {
    const hybridBatches = createAgentBatches(audiences, { ...config, mode: 'hybrid' });
    alternatives.push({
      mode: 'hybrid',
      agentCount: hybridBatches.length,
      estimatedTimeSeconds: ESTIMATED_SECONDS_PER_AGENT,
      description: `Balanced: ${hybridBatches.length} agents (category + custom)`,
    });
  }

  return {
    audienceCount: audiences.length,
    audienceBreakdown: {
      defaultCount: defaultAudiences.length,
      customCount: customAudiences.length,
      byCategory,
    },
    mode: config.mode,
    agentCount,
    estimatedTopics,
    estimatedTimeSeconds,
    estimatedApiCalls,
    alternatives,
  };
}

/**
 * Merge topics from all agents with equal representation
 */
function mergeTopicsWithBalance(
  results: PerAudienceResult[],
  targetCount: number = 10
): TrendingTopic[] {
  // Collect all topics grouped by audience
  const topicsByAudience = new Map<string, TrendingTopic[]>();

  for (const result of results) {
    if (!result.success) continue;

    for (const [audienceId, topics] of result.topicsByAudience) {
      const existing = topicsByAudience.get(audienceId) || [];
      existing.push(...topics);
      topicsByAudience.set(audienceId, existing);
    }
  }

  // Round-robin selection for equal representation
  const merged: TrendingTopic[] = [];
  const audienceIds = shuffleArray([...topicsByAudience.keys()]);
  const indices = new Map<string, number>();

  for (const id of audienceIds) {
    indices.set(id, 0);
  }

  // Round-robin until we reach target or exhaust topics
  let exhausted = false;
  while (merged.length < targetCount && !exhausted) {
    exhausted = true;

    for (const audienceId of audienceIds) {
      if (merged.length >= targetCount) break;

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
 * Generate cache key from audience IDs
 */
function generateCacheKey(audienceIds: string[]): string {
  return [...audienceIds].sort().join(':');
}

/**
 * Main orchestrator function for parallel trending topic generation
 *
 * @param audienceIds - Array of audience IDs to generate topics for
 * @param config - Parallel generation configuration
 * @param customAudiences - Optional array of custom audience definitions
 * @param confirmed - Whether user has confirmed after seeing trade-offs
 */
export async function generateTrendingTopicsParallel(
  audienceIds: string[],
  config: ParallelGenerationConfig = DEFAULT_CONFIG,
  customAudiences?: Array<{
    id: string;
    name: string;
    description: string;
    domainExamples: string;
    topicTitles: string[];
  }>,
  confirmed: boolean = false
): Promise<ParallelTrendingResult> {
  const startTime = Date.now();

  console.log(
    `[ParallelOrchestrator] Starting with ${audienceIds.length} audiences, mode: ${config.mode}`
  );

  // Step 1: Resolve all audiences (including custom)
  const audiences = resolveAllAudiences(audienceIds, customAudiences);

  if (audiences.length === 0) {
    return {
      success: false,
      error: 'No valid audiences provided',
    };
  }

  // Step 2: Create agent batches based on configuration
  const batches = createAgentBatches(audiences, config);

  console.log(`[ParallelOrchestrator] Created ${batches.length} agent batches`);
  for (const batch of batches) {
    console.log(`  - ${batch.batchId}: ${batch.audiences.map((a) => a.name).join(', ')}`);
  }

  // Step 3: Calculate trade-offs
  const tradeoffs = calculateTradeoffs(audiences, batches, config);

  // Step 4: If showTradeoffs and not confirmed, return for user confirmation
  if (config.showTradeoffs && !confirmed) {
    return {
      needsConfirmation: true,
      tradeoffs,
      success: false,
    };
  }

  // Step 5: Execute agents in parallel
  console.log(`[ParallelOrchestrator] Spawning ${batches.length} parallel agents`);

  const topicsPerAgent = config.topicsPerAgent;

  const agentPromises = batches.map((batch) =>
    generateTrendingTopicsForBatch({
      batch,
      topicsToGenerate: topicsPerAgent,
    })
  );

  // Use Promise.allSettled for fault tolerance
  const settledResults = await Promise.allSettled(agentPromises);

  // Step 6: Process results
  const successfulResults: PerAudienceResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < settledResults.length; i++) {
    const result = settledResults[i];
    const batch = batches[i];

    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successfulResults.push(result.value);
        console.log(
          `[ParallelOrchestrator] Batch ${batch.batchId}: ${result.value.topics.length} topics`
        );
      } else {
        errors.push(`Batch ${batch.batchId}: ${result.value.error}`);
        console.error(`[ParallelOrchestrator] Batch ${batch.batchId} failed: ${result.value.error}`);
      }
    } else {
      errors.push(`Batch ${batch.batchId}: ${result.reason}`);
      console.error(`[ParallelOrchestrator] Batch ${batch.batchId} rejected: ${result.reason}`);
    }
  }

  // Step 7: Check if we have any successful results
  if (successfulResults.length === 0) {
    return {
      success: false,
      error: `All agents failed: ${errors.join('; ')}`,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // Step 8: Merge topics with equal representation
  const targetTopics = Math.min(12, audiences.length * 3);
  const mergedTopics = mergeTopicsWithBalance(successfulResults, targetTopics);

  // Step 9: Calculate total token usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  for (const result of successfulResults) {
    if (result.tokenUsage) {
      totalInputTokens += result.tokenUsage.inputTokens;
      totalOutputTokens += result.tokenUsage.outputTokens;
    }
  }

  const totalDurationMs = Date.now() - startTime;

  console.log(
    `[ParallelOrchestrator] Complete: ${mergedTopics.length} merged topics in ${totalDurationMs}ms`
  );

  // Log per-audience representation
  const audienceRepresentation: Record<string, number> = {};
  for (const topic of mergedTopics) {
    const aid = topic.audienceId || 'unknown';
    audienceRepresentation[aid] = (audienceRepresentation[aid] || 0) + 1;
  }
  console.log('[ParallelOrchestrator] Topic distribution:', audienceRepresentation);

  return {
    success: true,
    topics: mergedTopics,
    perAudienceResults: successfulResults,
    tradeoffs,
    totalDurationMs,
    totalTokenUsage:
      totalInputTokens > 0
        ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
        : undefined,
    cacheKey: generateCacheKey(audienceIds),
  };
}

/**
 * Generate trending topics with trade-off confirmation flow
 *
 * This is a convenience wrapper that handles the two-step confirmation flow:
 * 1. First call returns trade-offs for UI display
 * 2. Second call (with confirmed=true) executes generation
 */
export async function generateTrendingTopicsWithConfirmation(
  audienceIds: string[],
  config?: Partial<ParallelGenerationConfig>,
  customAudiences?: Array<{
    id: string;
    name: string;
    description: string;
    domainExamples: string;
    topicTitles: string[];
  }>
): Promise<ParallelTrendingResult> {
  const fullConfig: ParallelGenerationConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    showTradeoffs: true,
  };

  return generateTrendingTopicsParallel(audienceIds, fullConfig, customAudiences, false);
}

/**
 * Execute confirmed parallel generation (skip trade-off display)
 */
export async function executeConfirmedParallelGeneration(
  audienceIds: string[],
  config?: Partial<ParallelGenerationConfig>,
  customAudiences?: Array<{
    id: string;
    name: string;
    description: string;
    domainExamples: string;
    topicTitles: string[];
  }>
): Promise<ParallelTrendingResult> {
  const fullConfig: ParallelGenerationConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    showTradeoffs: false,
  };

  return generateTrendingTopicsParallel(audienceIds, fullConfig, customAudiences, true);
}
