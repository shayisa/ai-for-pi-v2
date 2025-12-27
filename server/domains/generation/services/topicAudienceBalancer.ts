/**
 * Topic-Audience Balancer
 *
 * Handles the matching, balancing, and reallocation of topics to audiences
 * for Phase 16 per-audience newsletter generation.
 *
 * @module domains/generation/services/topicAudienceBalancer
 *
 * ## Scenarios Handled
 *
 * A. Fewer topics than audiences -> Generate fresh for orphaned audiences
 * B. More topics than audiences -> Each audience gets multiple topics (ideal)
 * C. Topics tagged for non-selected audiences -> User decides: reassign or generate fresh
 * D. Zero topics selected -> Full fresh generation for all audiences
 */

import type {
  AudienceConfig,
  TopicWithAudienceId,
  TopicAudienceBalanceResult,
  MismatchResolution,
  MismatchResolutionAction,
  BalancedTopicMap,
} from '../../../../types';

import { SPECIALIZATIONS } from '../helpers/audienceHelpers';

// =============================================================================
// Types
// =============================================================================

export interface BalancerConfig {
  /** Minimum topics per audience (will generate fresh if below) */
  minTopicsPerAudience: number;
  /** Maximum topics per audience (will truncate if above) */
  maxTopicsPerAudience: number;
  /** Whether to allow cross-category reassignment */
  allowCrossCategoryReassign: boolean;
}

export const DEFAULT_BALANCER_CONFIG: BalancerConfig = {
  minTopicsPerAudience: 1,
  maxTopicsPerAudience: 5,
  allowCrossCategoryReassign: false,
};

export interface MismatchInfo {
  topic: TopicWithAudienceId;
  originalAudienceId: string;
  originalAudienceName: string;
  suggestedAudienceId: string | null;
  suggestedAudienceName: string | null;
  sameCategoryOptions: AudienceConfig[];
}

// =============================================================================
// Core Balancing Functions
// =============================================================================

/**
 * Analyze topics against selected audiences and identify mismatches.
 * This is the first step before user decisions are applied.
 */
export function analyzeTopicAudienceMatch(
  selectedTopics: TopicWithAudienceId[],
  selectedAudiences: AudienceConfig[],
  config: BalancerConfig = DEFAULT_BALANCER_CONFIG
): {
  matched: Map<string, TopicWithAudienceId[]>;
  mismatched: MismatchInfo[];
  orphanedAudiences: AudienceConfig[];
} {
  console.log('[TopicAudienceBalancer] analyzeTopicAudienceMatch START', {
    topicCount: selectedTopics.length,
    audienceCount: selectedAudiences.length,
  });

  const selectedAudienceIds = new Set(selectedAudiences.map((a) => a.id));
  const matched: Map<string, TopicWithAudienceId[]> = new Map();
  const mismatched: MismatchInfo[] = [];

  // Initialize map for all selected audiences
  for (const audience of selectedAudiences) {
    matched.set(audience.id, []);
  }

  // Categorize each topic
  for (const topic of selectedTopics) {
    if (selectedAudienceIds.has(topic.audienceId)) {
      // Direct match - topic's audience is selected
      matched.get(topic.audienceId)!.push(topic);
      console.log(`[TopicAudienceBalancer] Topic "${topic.title}" matched to ${topic.audienceId}`);
    } else {
      // Mismatch - topic's audience is NOT selected
      const mismatchInfo = buildMismatchInfo(topic, selectedAudiences, config);
      mismatched.push(mismatchInfo);
      console.log(`[TopicAudienceBalancer] Topic "${topic.title}" MISMATCHED - was for ${topic.audienceId}`);
    }
  }

  // Find orphaned audiences (no topics assigned)
  const orphanedAudiences = selectedAudiences.filter(
    (audience) => matched.get(audience.id)!.length === 0
  );

  console.log('[TopicAudienceBalancer] analyzeTopicAudienceMatch END', {
    matchedCount: selectedTopics.length - mismatched.length,
    mismatchedCount: mismatched.length,
    orphanedCount: orphanedAudiences.length,
  });

  return { matched, mismatched, orphanedAudiences };
}

/**
 * Build detailed mismatch information for a topic
 */
function buildMismatchInfo(
  topic: TopicWithAudienceId,
  selectedAudiences: AudienceConfig[],
  config: BalancerConfig
): MismatchInfo {
  const originalSpec = SPECIALIZATIONS[topic.audienceId];
  const originalCategoryId = originalSpec?.parentId;
  const originalAudienceName = originalSpec?.name || topic.audienceId;

  // Find audiences in the same category
  const sameCategoryOptions = selectedAudiences.filter((audience) => {
    const spec = SPECIALIZATIONS[audience.id];
    return spec?.parentId === originalCategoryId;
  });

  // Suggest the first same-category option, if available
  let suggestedAudienceId: string | null = null;
  let suggestedAudienceName: string | null = null;

  if (sameCategoryOptions.length > 0) {
    suggestedAudienceId = sameCategoryOptions[0].id;
    suggestedAudienceName = sameCategoryOptions[0].name;
  } else if (config.allowCrossCategoryReassign && selectedAudiences.length > 0) {
    // If no same-category options and cross-category is allowed, suggest first available
    suggestedAudienceId = selectedAudiences[0].id;
    suggestedAudienceName = selectedAudiences[0].name;
  }

  return {
    topic,
    originalAudienceId: topic.audienceId,
    originalAudienceName,
    suggestedAudienceId,
    suggestedAudienceName,
    sameCategoryOptions,
  };
}

/**
 * Apply user's mismatch resolutions to the topic assignments.
 * Call this after user has made decisions for each mismatch.
 */
export function applyMismatchResolutions(
  analysisResult: {
    matched: Map<string, TopicWithAudienceId[]>;
    mismatched: MismatchInfo[];
    orphanedAudiences: AudienceConfig[];
  },
  resolutions: MismatchResolution[]
): TopicAudienceBalanceResult {
  console.log('[TopicAudienceBalancer] applyMismatchResolutions START', {
    mismatchCount: analysisResult.mismatched.length,
    resolutionCount: resolutions.length,
  });

  const balancedMap: BalancedTopicMap = new Map(analysisResult.matched);
  const reassignedTopics: TopicWithAudienceId[] = [];
  const unmatchedTopics: TopicWithAudienceId[] = [];

  // Create a map of resolutions by topic title for quick lookup
  const resolutionMap = new Map<string, MismatchResolution>();
  for (const resolution of resolutions) {
    resolutionMap.set(resolution.topic.title, resolution);
  }

  // Process each mismatch according to user's resolution
  for (const mismatch of analysisResult.mismatched) {
    const resolution = resolutionMap.get(mismatch.topic.title);

    if (!resolution) {
      // No resolution provided - skip the topic
      unmatchedTopics.push(mismatch.topic);
      console.log(`[TopicAudienceBalancer] No resolution for "${mismatch.topic.title}" - skipping`);
      continue;
    }

    switch (resolution.action) {
      case 'reassign': {
        if (resolution.targetAudienceId) {
          // Reassign to target audience
          const reassignedTopic: TopicWithAudienceId = {
            ...mismatch.topic,
            reassignedFrom: mismatch.topic.audienceId,
            audienceId: resolution.targetAudienceId,
          };
          const audienceTopics = balancedMap.get(resolution.targetAudienceId) || [];
          audienceTopics.push(reassignedTopic);
          balancedMap.set(resolution.targetAudienceId, audienceTopics);
          reassignedTopics.push(reassignedTopic);
          console.log(`[TopicAudienceBalancer] Reassigned "${mismatch.topic.title}" to ${resolution.targetAudienceId}`);
        } else {
          unmatchedTopics.push(mismatch.topic);
        }
        break;
      }

      case 'generate_fresh':
        // Topic is discarded - the orchestrator will generate fresh topics
        // We track it as unmatched so the caller knows
        unmatchedTopics.push(mismatch.topic);
        console.log(`[TopicAudienceBalancer] Will generate fresh instead of "${mismatch.topic.title}"`);
        break;

      case 'skip':
        // Simply skip this topic
        unmatchedTopics.push(mismatch.topic);
        console.log(`[TopicAudienceBalancer] Skipping "${mismatch.topic.title}"`);
        break;
    }
  }

  // Recalculate orphaned audiences after applying resolutions
  const orphanedAudiences: AudienceConfig[] = [];
  for (const [audienceId, topics] of balancedMap) {
    if (topics.length === 0) {
      // Find the audience config
      const spec = SPECIALIZATIONS[audienceId];
      if (spec) {
        orphanedAudiences.push({
          id: spec.id,
          name: spec.name,
          description: spec.description,
        });
      }
    }
  }

  // Build statistics
  let totalMatched = 0;
  for (const topics of balancedMap.values()) {
    totalMatched += topics.length;
  }

  console.log('[TopicAudienceBalancer] applyMismatchResolutions END', {
    matchedTopics: totalMatched,
    reassignedCount: reassignedTopics.length,
    orphanedCount: orphanedAudiences.length,
  });

  return {
    balancedMap,
    orphanedAudiences,
    unmatchedTopics,
    reassignedTopics,
    hasMismatches: analysisResult.mismatched.length > 0 || orphanedAudiences.length > 0,
    stats: {
      totalTopics: analysisResult.mismatched.length + totalMatched,
      matchedTopics: totalMatched,
      orphanedAudienceCount: orphanedAudiences.length,
      mismatchCount: analysisResult.mismatched.length,
    },
  };
}

/**
 * Quick balance without user interaction.
 * Uses automatic reassignment based on category matching.
 * Useful for programmatic calls where no UI is available.
 */
export function autoBalanceTopics(
  selectedTopics: TopicWithAudienceId[],
  selectedAudiences: AudienceConfig[],
  config: BalancerConfig = DEFAULT_BALANCER_CONFIG
): TopicAudienceBalanceResult {
  console.log('[TopicAudienceBalancer] autoBalanceTopics START');

  const analysis = analyzeTopicAudienceMatch(selectedTopics, selectedAudiences, config);

  // Auto-generate resolutions: reassign to same-category if available, else skip
  const resolutions: MismatchResolution[] = analysis.mismatched.map((mismatch) => {
    if (mismatch.suggestedAudienceId) {
      return {
        topic: mismatch.topic,
        action: 'reassign' as MismatchResolutionAction,
        targetAudienceId: mismatch.suggestedAudienceId,
      };
    } else {
      return {
        topic: mismatch.topic,
        action: 'generate_fresh' as MismatchResolutionAction,
      };
    }
  });

  const result = applyMismatchResolutions(analysis, resolutions);
  console.log('[TopicAudienceBalancer] autoBalanceTopics END');
  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the parent category for an audience ID
 */
export function getParentCategory(audienceId: string): 'academic' | 'business' | null {
  const spec = SPECIALIZATIONS[audienceId];
  return spec?.parentId || null;
}

/**
 * Find all audiences in the same category as the given audience
 */
export function getSameCategoryAudiences(
  audienceId: string,
  fromAudiences: AudienceConfig[]
): AudienceConfig[] {
  const parentCategory = getParentCategory(audienceId);
  if (!parentCategory) return [];

  return fromAudiences.filter((audience) => {
    const spec = SPECIALIZATIONS[audience.id];
    return spec?.parentId === parentCategory;
  });
}

/**
 * Check if two audiences are in the same category
 */
export function areSameCategory(audienceId1: string, audienceId2: string): boolean {
  const cat1 = getParentCategory(audienceId1);
  const cat2 = getParentCategory(audienceId2);
  return cat1 !== null && cat1 === cat2;
}

/**
 * Convert a BalancedTopicMap to a serializable object
 */
export function serializeBalancedMap(
  map: BalancedTopicMap
): Record<string, TopicWithAudienceId[]> {
  const result: Record<string, TopicWithAudienceId[]> = {};
  for (const [key, value] of map) {
    result[key] = value;
  }
  return result;
}

/**
 * Convert a serialized object back to a BalancedTopicMap
 */
export function deserializeBalancedMap(
  obj: Record<string, TopicWithAudienceId[]>
): BalancedTopicMap {
  return new Map(Object.entries(obj));
}

/**
 * Get a summary of the balance result for logging/display
 */
export function getBalanceSummary(result: TopicAudienceBalanceResult): string {
  const lines: string[] = [
    `Topic-Audience Balance Summary:`,
    `  Total topics: ${result.stats.totalTopics}`,
    `  Matched topics: ${result.stats.matchedTopics}`,
    `  Mismatched topics: ${result.stats.mismatchCount}`,
    `  Orphaned audiences: ${result.stats.orphanedAudienceCount}`,
  ];

  if (result.reassignedTopics.length > 0) {
    lines.push(`  Reassigned topics:`);
    for (const topic of result.reassignedTopics) {
      lines.push(`    - "${topic.title}": ${topic.reassignedFrom} -> ${topic.audienceId}`);
    }
  }

  if (result.orphanedAudiences.length > 0) {
    lines.push(`  Audiences needing fresh topics:`);
    for (const audience of result.orphanedAudiences) {
      lines.push(`    - ${audience.name} (${audience.id})`);
    }
  }

  return lines.join('\n');
}
