/**
 * Streaming Trending Orchestrator
 *
 * Phase 17: SSE-based streaming variant of the parallel orchestrator.
 * Emits results as each agent completes instead of waiting for all.
 *
 * This enables progressive UI updates where users see first topics in ~5s
 * instead of waiting ~15s for all agents to complete.
 *
 * Rollback: Set VITE_ENABLE_STREAMING=false on frontend
 *
 * @module domains/generation/services/streamingTrendingOrchestrator
 */

import type { TrendingTopic } from '../../../../types';
import type {
  ParallelGenerationConfig,
  AgentBatch,
  PerAudienceResult,
} from '../types/parallelGeneration';
import {
  resolveAllAudiences,
  groupAudiencesByCategory,
} from '../helpers/audienceHelpers';
import type { ResolvedAudience } from '../helpers/audienceHelpers';
import {
  generateTrendingTopicsForBatch,
} from './singleAudienceAgent';

/**
 * Default configuration for streaming generation
 */
const DEFAULT_CONFIG: ParallelGenerationConfig = {
  mode: 'per-audience',
  topicsPerAgent: 3,
  showTradeoffs: false,
};

/**
 * Event types for SSE streaming
 */
export interface StreamingEvent {
  type: 'agent_start' | 'agent_complete' | 'agent_error' | 'complete';
  batchId: string;
  batchName?: string;
  topics?: TrendingTopic[];
  error?: string;
  completedCount: number;
  totalCount: number;
  durationMs?: number;
}

/**
 * Create agent batches based on configuration mode
 * (Simplified version from parallelTrendingOrchestrator)
 */
function createAgentBatches(
  audiences: ResolvedAudience[],
  config: ParallelGenerationConfig
): AgentBatch[] {
  const batches: AgentBatch[] = [];

  if (config.mode === 'per-audience') {
    // One agent per audience
    for (const audience of audiences) {
      batches.push({
        batchId: audience.id,
        batchName: audience.name,
        audiences: [audience],
        parentCategory: audience.parentId,
      });
    }
  } else {
    // Per-category mode
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
        const categoryNames: Record<string, string> = {
          academic: 'Academic Researchers',
          business: 'Business Professionals',
        };
        batches.push({
          batchId: categoryId,
          batchName: categoryNames[categoryId] || categoryId,
          audiences: categoryAudiences,
          parentCategory: categoryId,
        });
      }
    }
  }

  return batches;
}

/**
 * Generate trending topics with streaming output
 *
 * Spawns agents in parallel but emits events as each completes,
 * enabling progressive UI updates.
 *
 * @param audienceIds - Array of audience IDs
 * @param config - Generation configuration
 * @param customAudiences - Optional custom audience definitions
 * @param onEvent - Callback for streaming events
 */
export async function generateTrendingTopicsStreaming(
  audienceIds: string[],
  config: ParallelGenerationConfig = DEFAULT_CONFIG,
  customAudiences?: Array<{
    id: string;
    name: string;
    description: string;
    domainExamples: string;
    topicTitles: string[];
  }>,
  onEvent: (event: StreamingEvent) => void = () => {}
): Promise<void> {
  const startTime = Date.now();

  console.log(
    `[StreamingOrchestrator] Starting with ${audienceIds.length} audiences, mode: ${config.mode}`
  );

  // Resolve all audiences
  const audiences = resolveAllAudiences(audienceIds, customAudiences);

  if (audiences.length === 0) {
    onEvent({
      type: 'complete',
      batchId: 'error',
      error: 'No valid audiences provided',
      completedCount: 0,
      totalCount: 0,
    });
    return;
  }

  // Create agent batches
  const batches = createAgentBatches(audiences, config);
  const totalCount = batches.length;

  console.log(`[StreamingOrchestrator] Created ${totalCount} agent batches`);

  // Track completed count
  let completedCount = 0;
  const completedResults: PerAudienceResult[] = [];

  // Emit start events for all batches
  for (const batch of batches) {
    onEvent({
      type: 'agent_start',
      batchId: batch.batchId,
      batchName: batch.batchName,
      completedCount,
      totalCount,
    });
  }

  // Launch all agents but emit as each completes
  const agentPromises = batches.map(async (batch) => {
    const agentStart = Date.now();

    try {
      const result = await generateTrendingTopicsForBatch({
        batch,
        topicsToGenerate: config.topicsPerAgent,
      });

      completedCount++;
      const durationMs = Date.now() - agentStart;

      if (result.success) {
        completedResults.push(result);

        console.log(
          `[StreamingOrchestrator] Batch ${batch.batchId} complete: ${result.topics.length} topics in ${durationMs}ms`
        );

        // Emit topics immediately
        onEvent({
          type: 'agent_complete',
          batchId: batch.batchId,
          batchName: batch.batchName,
          topics: result.topics,
          completedCount,
          totalCount,
          durationMs,
        });
      } else {
        console.error(
          `[StreamingOrchestrator] Batch ${batch.batchId} failed: ${result.error}`
        );

        onEvent({
          type: 'agent_error',
          batchId: batch.batchId,
          batchName: batch.batchName,
          error: result.error,
          completedCount,
          totalCount,
          durationMs,
        });
      }
    } catch (err) {
      completedCount++;
      const errorMsg = err instanceof Error ? err.message : String(err);

      console.error(
        `[StreamingOrchestrator] Batch ${batch.batchId} threw: ${errorMsg}`
      );

      onEvent({
        type: 'agent_error',
        batchId: batch.batchId,
        batchName: batch.batchName,
        error: errorMsg,
        completedCount,
        totalCount,
        durationMs: Date.now() - agentStart,
      });
    }
  });

  // Wait for all agents to complete
  await Promise.allSettled(agentPromises);

  const totalDuration = Date.now() - startTime;

  console.log(
    `[StreamingOrchestrator] Complete: ${completedResults.length}/${totalCount} agents succeeded in ${totalDuration}ms`
  );

  // Emit completion event
  onEvent({
    type: 'complete',
    batchId: 'all',
    completedCount: totalCount,
    totalCount,
    durationMs: totalDuration,
  });
}
