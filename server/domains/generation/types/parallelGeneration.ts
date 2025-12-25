/**
 * Parallel Generation Types
 *
 * Phase 15.3: Types for parallel per-audience topic generation
 *
 * Provides scalable configuration for spawning parallel agents
 * without hardcoded limits. User can configure mode, max agents,
 * and view trade-offs before generation.
 *
 * @module domains/generation/types/parallelGeneration
 */

import type { TrendingTopic, AudienceJsonExample } from '../../../../types';
import type { ResolvedAudience } from '../helpers/audienceHelpers';

/**
 * Generation mode for parallel agents
 *
 * - 'per-category': One agent per parent category (Academic, Business, etc.)
 *   Fastest, fewer API calls, less granular control
 *
 * - 'per-audience': One agent per individual audience/specialization
 *   More API calls, better representation per audience
 *
 * - 'hybrid': Per-category for defaults, per-audience for custom audiences
 *   Balanced approach for mixed audience selections
 */
export type ParallelGenerationMode = 'per-category' | 'per-audience' | 'hybrid';

/**
 * User-configurable parameters for parallel generation
 *
 * No hardcoded limits - user controls scaling behavior.
 * Trade-offs are displayed before generation begins.
 */
export interface ParallelGenerationConfig {
  /**
   * How to group audiences into parallel agents
   * @default 'per-category'
   */
  mode: ParallelGenerationMode;

  /**
   * Maximum number of parallel API calls
   * undefined = no limit (spawn one agent per group)
   * If set and exceeded, overflow audiences are grouped into the last batch
   */
  maxParallelAgents?: number;

  /**
   * Number of topics each agent should generate
   * Distributed across its assigned audiences
   * @default 4
   */
  topicsPerAgent: number;

  /**
   * Show cost/time estimate before generation starts
   * If true, first call returns tradeoffs with needsConfirmation=true
   * @default true
   */
  showTradeoffs: boolean;
}

/**
 * Default configuration for parallel generation
 * Conservative defaults prioritizing speed over granularity
 */
export const DEFAULT_PARALLEL_CONFIG: ParallelGenerationConfig = {
  mode: 'per-category',
  topicsPerAgent: 4,
  showTradeoffs: true,
};

/**
 * A batch of audiences to be processed by a single agent
 *
 * In per-category mode, each batch contains all audiences from one parent category.
 * In per-audience mode, each batch contains a single audience.
 * In hybrid mode, default audiences are batched by category, custom audiences get individual batches.
 */
export interface AgentBatch {
  /**
   * Unique identifier for this batch (e.g., "academic", "business", "custom_1")
   */
  batchId: string;

  /**
   * Human-readable name for the batch
   */
  batchName: string;

  /**
   * Audiences assigned to this batch
   */
  audiences: ResolvedAudience[];

  /**
   * Parent category ID if all audiences share one, undefined for mixed
   */
  parentCategory?: string;
}

/**
 * Result from a single agent processing one batch of audiences
 */
export interface PerAudienceResult {
  /**
   * Batch this result belongs to
   */
  batchId: string;

  /**
   * Audiences that were processed
   */
  audienceIds: string[];

  /**
   * Generated trending topics for these audiences
   */
  topics: TrendingTopic[];

  /**
   * Per-audience topic breakdown (for merging with equal representation)
   */
  topicsByAudience: Map<string, TrendingTopic[]>;

  /**
   * Whether generation succeeded
   */
  success: boolean;

  /**
   * Error message if generation failed
   */
  error?: string;

  /**
   * Processing time in milliseconds
   */
  durationMs: number;

  /**
   * Token usage for this agent
   */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Trade-off information displayed to user before generation
 */
export interface GenerationTradeoffs {
  /**
   * Number of audiences selected
   */
  audienceCount: number;

  /**
   * Breakdown by type (default vs custom)
   */
  audienceBreakdown: {
    defaultCount: number;
    customCount: number;
    byCategory: Record<string, number>;
  };

  /**
   * Current mode
   */
  mode: ParallelGenerationMode;

  /**
   * Number of parallel agents that will be spawned
   */
  agentCount: number;

  /**
   * Estimated total topics to be generated
   */
  estimatedTopics: number;

  /**
   * Estimated time in seconds
   */
  estimatedTimeSeconds: number;

  /**
   * Estimated API calls
   */
  estimatedApiCalls: number;

  /**
   * Alternative mode suggestions with their trade-offs
   */
  alternatives: {
    mode: ParallelGenerationMode;
    agentCount: number;
    estimatedTimeSeconds: number;
    description: string;
  }[];
}

/**
 * Complete result from parallel trending topic generation
 */
export interface ParallelTrendingResult {
  /**
   * Whether generation needs user confirmation (trade-offs displayed)
   */
  needsConfirmation?: boolean;

  /**
   * Trade-off information if needsConfirmation is true
   */
  tradeoffs?: GenerationTradeoffs;

  /**
   * Whether overall generation succeeded
   */
  success: boolean;

  /**
   * Merged topics with equal representation across all audiences
   */
  topics?: TrendingTopic[];

  /**
   * Per-audience results for debugging/analytics
   */
  perAudienceResults?: PerAudienceResult[];

  /**
   * Error message if generation failed
   */
  error?: string;

  /**
   * Total processing time in milliseconds
   */
  totalDurationMs?: number;

  /**
   * Aggregated token usage
   */
  totalTokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };

  /**
   * Cache key for storing these results
   */
  cacheKey?: string;
}

/**
 * Input parameters for single audience agent
 */
export interface SingleAudienceAgentParams {
  /**
   * Audience ID
   */
  audienceId: string;

  /**
   * Human-readable audience name
   */
  audienceName: string;

  /**
   * Full audience description for prompt context
   */
  audienceDescription: string;

  /**
   * Domain-specific examples for this audience
   */
  domainExamples: string;

  /**
   * JSON format examples for structured output
   */
  jsonExamples: AudienceJsonExample[];

  /**
   * Example topic titles to guide generation
   */
  topicTitles: string[];

  /**
   * Number of topics to generate
   * @default 3
   */
  topicsToGenerate?: number;
}

/**
 * Input parameters for batch agent (multiple audiences)
 */
export interface BatchAgentParams {
  /**
   * Batch configuration
   */
  batch: AgentBatch;

  /**
   * Total topics to generate for this batch
   * Distributed across audiences in the batch
   */
  topicsToGenerate: number;
}

/**
 * Configuration for topic merging
 */
export interface TopicMergerConfig {
  /**
   * Target total number of topics in final result
   * @default 10
   */
  targetCount: number;

  /**
   * Minimum topics per audience to ensure representation
   * @default 2
   */
  minPerAudience: number;

  /**
   * Whether to strictly enforce equal representation
   * If true, uses round-robin selection
   * If false, allows some audiences to have more topics
   * @default true
   */
  strictBalance: boolean;

  /**
   * Whether to shuffle final result to avoid order bias
   * @default true
   */
  shuffleFinal: boolean;
}

/**
 * Default merging configuration
 */
export const DEFAULT_MERGER_CONFIG: TopicMergerConfig = {
  targetCount: 10,
  minPerAudience: 2,
  strictBalance: true,
  shuffleFinal: true,
};

/**
 * Result from topic merging operation
 */
export interface MergerResult {
  /**
   * Merged topics with balanced representation
   */
  topics: TrendingTopic[];

  /**
   * Statistics about the merge operation
   */
  stats: {
    /** Total topics before merge */
    totalBeforeMerge: number;
    /** Total topics after merge */
    totalAfterMerge: number;
    /** Topics per audience in final result */
    perAudience: Record<string, number>;
    /** Audiences with fewer topics than minPerAudience */
    underrepresented: string[];
  };
}

/**
 * Cache entry for per-audience topic results
 */
export interface AudienceTopicCacheEntry {
  /**
   * Audience ID this cache entry is for
   */
  audienceId: string;

  /**
   * Cached topics
   */
  topics: TrendingTopic[];

  /**
   * Timestamp when cached
   */
  cachedAt: number;

  /**
   * TTL in milliseconds
   */
  ttlMs: number;

  /**
   * Whether this entry is still valid
   */
  isValid: () => boolean;
}

/**
 * Cache entry for merged results
 */
export interface MergedTopicCacheEntry {
  /**
   * Sorted audience IDs used as cache key
   */
  audienceKey: string;

  /**
   * Cached merged result
   */
  result: ParallelTrendingResult;

  /**
   * Timestamp when cached
   */
  cachedAt: number;

  /**
   * TTL in milliseconds
   */
  ttlMs: number;

  /**
   * Whether this entry is still valid
   */
  isValid: () => boolean;
}
