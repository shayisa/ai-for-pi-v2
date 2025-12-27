/**
 * Per-Audience Newsletter Generator
 *
 * Phase 16: Main orchestrator for per-audience newsletter generation.
 * Implements a 5-phase pipeline that generates completely isolated
 * content for each audience with parallel processing.
 *
 * @module domains/generation/services/perAudienceNewsletterGenerator
 *
 * ## Pipeline Phases
 *
 * Phase 0: Topic-Audience Balancing
 *   - Analyze selected topics against audiences
 *   - Identify orphaned audiences (no topics)
 *   - Handle mismatched topics (via user decisions)
 *
 * Phase 1: Parallel Topic Generation
 *   - Generate fresh topics for orphaned audiences
 *   - Run topic agents in parallel
 *
 * Phase 2: Strategic Overlap Detection
 *   - Detect platform equivalents (Claude ↔ Gemini, etc.)
 *   - Suggest complementary topics for other audiences
 *
 * Phase 3: Parallel Source Allocation
 *   - Fetch sources per audience
 *   - Allocate unique sources to each audience
 *
 * Phase 4: Parallel Article Generation
 *   - Generate sections with separate Claude calls per audience
 *   - Run all generations in parallel
 *
 * Phase 5: Merge & Finalize
 *   - Combine sections into final newsletter
 *   - Generate shared subject line and metadata
 */

import type {
  AudienceConfig,
  EnhancedNewsletter,
  EnhancedAudienceSection,
  TopicWithAudienceId,
  PerAudienceGenerationParams,
  PerAudienceNewsletterResult,
  TopicAudienceBalanceResult,
  MismatchResolution,
  StrategicOverlap,
  AudienceSectionResult,
  PromptOfTheDay,
  ToolOfTheDay,
  EditorsNote,
  SourceWithContent,
} from '../../../../types';

// Import sub-services
import {
  analyzeTopicAudienceMatch,
  applyMismatchResolutions,
  autoBalanceTopics,
  serializeBalancedMap,
} from './topicAudienceBalancer';

import { detectStrategicOverlaps } from './strategicOverlapDetector';

import {
  generateAudienceSection,
  generateAudienceSectionsParallel,
  type SingleAudienceGenerationParams,
} from './singleAudienceSectionGenerator';

// Import existing services
import * as sourceFetchingService from '../../../services/sourceFetchingService';
import * as sourceAllocationService from '../../../services/sourceAllocationService';
import { generateTrendingTopicsForAudience } from './singleAudienceAgent';
import { resolveAllAudiences, SPECIALIZATIONS } from '../helpers/audienceHelpers';
import type { SingleAudienceAgentParams } from '../types/parallelGeneration';

// =============================================================================
// Types
// =============================================================================

export interface OrchestratorConfig {
  /** Number of topics to generate per orphaned audience */
  topicsPerAudience: number;
  /** Number of sources to allocate per topic-audience pair */
  sourcesPerAllocation: number;
  /** Whether to skip strategic overlap detection */
  skipOverlapDetection: boolean;
  /** Whether to auto-balance without user interaction */
  autoBalance: boolean;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  topicsPerAudience: 3,
  sourcesPerAllocation: 2,
  skipOverlapDetection: false,
  autoBalance: false,
};

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Generate a newsletter with per-audience topic and content isolation.
 * This is the main entry point for V4 generation.
 */
export async function generateNewsletterPerAudience(
  params: PerAudienceGenerationParams,
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
  mismatchResolutions?: MismatchResolution[]
): Promise<PerAudienceNewsletterResult> {
  const startTime = Date.now();
  const metrics = {
    totalTimeMs: 0,
    topicGenerationTimeMs: 0,
    sourceAllocationTimeMs: 0,
    contentGenerationTimeMs: 0,
    parallelEfficiency: 0,
  };

  console.log('[PerAudienceGenerator] ========================================');
  console.log('[PerAudienceGenerator] Starting V4 generation');
  console.log(`[PerAudienceGenerator] Audiences: ${params.audiences.map(a => a.name).join(', ')}`);
  console.log(`[PerAudienceGenerator] Selected topics: ${params.selectedTopics?.length || 0}`);
  console.log('[PerAudienceGenerator] ========================================');

  try {
    // =========================================================================
    // PHASE 0: Topic-Audience Balancing
    // =========================================================================
    console.log('[PerAudienceGenerator] Phase 0: Topic-Audience Balancing');

    let balanceResult: TopicAudienceBalanceResult;

    if (!params.selectedTopics || params.selectedTopics.length === 0) {
      // No topics selected - all audiences are orphaned
      console.log('[PerAudienceGenerator] No topics selected - will generate fresh for all audiences');
      balanceResult = {
        balancedMap: new Map(),
        orphanedAudiences: params.audiences,
        unmatchedTopics: [],
        reassignedTopics: [],
        hasMismatches: false,
        stats: {
          totalTopics: 0,
          matchedTopics: 0,
          orphanedAudienceCount: params.audiences.length,
          mismatchCount: 0,
        },
      };
    } else if (config.autoBalance || !mismatchResolutions) {
      // Auto-balance without user interaction
      console.log('[PerAudienceGenerator] Auto-balancing topics');
      balanceResult = autoBalanceTopics(params.selectedTopics, params.audiences);
    } else {
      // Apply user's mismatch resolutions
      console.log('[PerAudienceGenerator] Applying user mismatch resolutions');
      const analysis = analyzeTopicAudienceMatch(params.selectedTopics, params.audiences);
      balanceResult = applyMismatchResolutions(analysis, mismatchResolutions);
    }

    console.log(`[PerAudienceGenerator] Balance result: ${balanceResult.stats.matchedTopics} matched, ${balanceResult.stats.orphanedAudienceCount} orphaned audiences`);

    // =========================================================================
    // PHASE 1: Parallel Topic Generation (for orphaned audiences)
    // =========================================================================
    console.log('[PerAudienceGenerator] Phase 1: Parallel Topic Generation');
    const topicGenStart = Date.now();

    if (balanceResult.orphanedAudiences.length > 0) {
      console.log(`[PerAudienceGenerator] Generating fresh topics for ${balanceResult.orphanedAudiences.length} orphaned audiences`);

      // Resolve audiences to get full details
      const resolvedOrphans = resolveAllAudiences(
        balanceResult.orphanedAudiences.map(a => a.id),
        []
      );

      // Generate topics in parallel
      const topicResults = await Promise.all(
        resolvedOrphans.map(async (audience) => {
          try {
            console.log(`[PerAudienceGenerator] Generating topics for orphaned audience: ${audience.name}`);
            // Build params for single audience agent
            const agentParams: SingleAudienceAgentParams = {
              audienceId: audience.id,
              audienceName: audience.name,
              audienceDescription: audience.description,
              domainExamples: audience.domainExamples,
              jsonExamples: audience.jsonExamples,
              topicTitles: audience.topicTitles,
              topicsToGenerate: config.topicsPerAudience,
            };

            const result = await generateTrendingTopicsForAudience(agentParams);
            console.log(`[PerAudienceGenerator] Generated ${result.topics.length} topics for ${audience.name}`);
            return { audienceId: audience.id, topics: result.topics };
          } catch (error) {
            console.error(`[PerAudienceGenerator] Failed to generate topics for ${audience.id}:`, error);
            return { audienceId: audience.id, topics: [] };
          }
        })
      );

      // Add generated topics to the balanced map
      for (const result of topicResults) {
        const topicsWithAudience: TopicWithAudienceId[] = result.topics.map((t) => ({
          title: t.title,
          audienceId: result.audienceId,
          summary: t.summary,
          resource: t.resource,
        }));

        balanceResult.balancedMap.set(result.audienceId, topicsWithAudience);
      }

      // Clear orphaned audiences since we generated topics for them
      balanceResult.orphanedAudiences = [];
    }

    metrics.topicGenerationTimeMs = Date.now() - topicGenStart;
    console.log(`[PerAudienceGenerator] Phase 1 complete in ${metrics.topicGenerationTimeMs}ms`);

    // =========================================================================
    // PHASE 2: Strategic Overlap Detection
    // =========================================================================
    console.log('[PerAudienceGenerator] Phase 2: Strategic Overlap Detection');

    let appliedOverlaps: StrategicOverlap[] = [];

    if (!config.skipOverlapDetection) {
      appliedOverlaps = detectStrategicOverlaps(balanceResult.balancedMap, params.audiences);
      console.log(`[PerAudienceGenerator] Found ${appliedOverlaps.length} strategic overlaps`);

      // Note: We don't automatically apply overlaps - they're informational
      // The orchestrator returns them for potential future use or display
    }

    // =========================================================================
    // PHASE 3: Parallel Source Allocation
    // =========================================================================
    console.log('[PerAudienceGenerator] Phase 3: Parallel Source Allocation');
    const sourceAllocStart = Date.now();

    // Collect all unique topics across all audiences
    const allTopics: string[] = [];
    for (const topics of balanceResult.balancedMap.values()) {
      for (const topic of topics) {
        if (!allTopics.includes(topic.title)) {
          allTopics.push(topic.title);
        }
      }
    }

    console.log(`[PerAudienceGenerator] Fetching sources for ${allTopics.length} unique topics`);

    // Fetch sources using topic titles as keywords
    const sourceResult = await sourceFetchingService.fetchAllSources({
      keywords: allTopics,
      limit: config.sourcesPerAllocation * params.audiences.length,
    });
    console.log(`[PerAudienceGenerator] Fetched ${sourceResult.articles.length} articles`);

    // Allocate sources to each audience
    const allocatedSources = new Map<string, SourceWithContent[]>();

    for (const audience of params.audiences) {
      const audienceTopics = balanceResult.balancedMap.get(audience.id) || [];
      const topicTitles = audienceTopics.map(t => t.title);

      if (topicTitles.length === 0) {
        allocatedSources.set(audience.id, []);
        continue;
      }

      // Allocate sources for this audience
      const allocation = sourceAllocationService.allocateSourcesToAudiences(
        topicTitles,
        [audience], // Just this audience
        sourceResult.articles,
        config.sourcesPerAllocation
      );

      // Convert to SourceWithContent format
      const audienceSources: SourceWithContent[] = allocation.allocations
        .flatMap(a => a.sources)
        .map(s => ({
          url: s.url || '',
          title: s.title,
          content: undefined, // Will be fetched if needed
          snippet: s.snippet,
          publication: s.source, // Use source type as publication
          category: s.source, // Use source type as category
        }));

      allocatedSources.set(audience.id, audienceSources);
      console.log(`[PerAudienceGenerator] Allocated ${audienceSources.length} sources to ${audience.name}`);
    }

    metrics.sourceAllocationTimeMs = Date.now() - sourceAllocStart;
    console.log(`[PerAudienceGenerator] Phase 3 complete in ${metrics.sourceAllocationTimeMs}ms`);

    // =========================================================================
    // PHASE 4: Parallel Article Generation
    // =========================================================================
    console.log('[PerAudienceGenerator] Phase 4: Parallel Article Generation');
    const contentGenStart = Date.now();

    // Build generation params for each audience
    const sectionParams: SingleAudienceGenerationParams[] = params.audiences.map(audience => ({
      audience,
      topics: balanceResult.balancedMap.get(audience.id) || [],
      sources: allocatedSources.get(audience.id) || [],
      tone: params.tone,
      flavors: params.flavors,
      personaId: params.personaId,
    }));

    // Filter out audiences with no topics
    const validParams = sectionParams.filter(p => p.topics.length > 0);

    if (validParams.length === 0) {
      throw new Error('No valid audience-topic combinations to generate');
    }

    console.log(`[PerAudienceGenerator] Generating ${validParams.length} audience sections in parallel`);

    // Generate all sections in parallel
    const sectionResults = await generateAudienceSectionsParallel(validParams);

    metrics.contentGenerationTimeMs = Date.now() - contentGenStart;
    console.log(`[PerAudienceGenerator] Phase 4 complete in ${metrics.contentGenerationTimeMs}ms`);

    // Calculate parallel efficiency
    const totalSequentialTime = sectionResults.reduce((sum, r) => sum + r.generationTimeMs, 0);
    metrics.parallelEfficiency = totalSequentialTime > 0
      ? metrics.contentGenerationTimeMs / totalSequentialTime
      : 1;

    // =========================================================================
    // PHASE 5: Merge & Finalize
    // =========================================================================
    console.log('[PerAudienceGenerator] Phase 5: Merge & Finalize');

    // Build the final newsletter
    const newsletter = await buildFinalNewsletter(
      sectionResults,
      params.promptOfTheDay,
      allocatedSources
    );

    console.log('[PerAudienceGenerator] Newsletter built successfully');

    metrics.totalTimeMs = Date.now() - startTime;

    console.log('[PerAudienceGenerator] ========================================');
    console.log(`[PerAudienceGenerator] Generation complete in ${metrics.totalTimeMs}ms`);
    console.log(`[PerAudienceGenerator] Parallel efficiency: ${(metrics.parallelEfficiency * 100).toFixed(1)}%`);
    console.log('[PerAudienceGenerator] ========================================');

    return {
      success: true,
      newsletter,
      sectionResults,
      appliedOverlaps,
      balanceResult,
      metrics,
    };

  } catch (error) {
    console.error('[PerAudienceGenerator] Generation failed:', error);
    metrics.totalTimeMs = Date.now() - startTime;

    return {
      success: false,
      sectionResults: [],
      appliedOverlaps: [],
      balanceResult: {
        balancedMap: new Map(),
        orphanedAudiences: [],
        unmatchedTopics: [],
        reassignedTopics: [],
        hasMismatches: false,
        stats: {
          totalTopics: 0,
          matchedTopics: 0,
          orphanedAudienceCount: 0,
          mismatchCount: 0,
        },
      },
      metrics,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build the final EnhancedNewsletter from section results
 */
async function buildFinalNewsletter(
  sectionResults: AudienceSectionResult[],
  promptOfTheDay?: PromptOfTheDay,
  allocatedSources?: Map<string, SourceWithContent[]>
): Promise<EnhancedNewsletter> {
  console.log('[PerAudienceGenerator] Building final newsletter');

  // Extract sections
  const audienceSections: EnhancedAudienceSection[] = sectionResults.map(r => r.section);

  // Generate editors note
  const editorsNote: EditorsNote = {
    message: generateEditorsNote(sectionResults),
  };

  // Pick tool of the day from sources
  const toolOfTheDay = pickToolOfTheDay(allocatedSources);

  // Generate conclusion
  const conclusion = generateConclusion(sectionResults);

  // Generate subject line
  const subject = generateSubjectLine(sectionResults);

  return {
    editorsNote,
    toolOfTheDay,
    audienceSections,
    conclusion,
    subject,
    promptOfTheDay,
  };
}

/**
 * Generate a simple editors note
 */
function generateEditorsNote(sectionResults: AudienceSectionResult[]): string {
  const audienceNames = sectionResults.map(r => r.audienceName);
  const topicCount = sectionResults.reduce((sum, r) => sum + r.topics.length, 0);

  return `Welcome to this week's AI for PI newsletter! We've curated ${topicCount} actionable insights ` +
    `tailored specifically for our ${audienceNames.join(' and ')} readers. ` +
    `Each section below contains practical guidance you can implement today. ` +
    `Let's dive into what's new in the world of AI-powered professional tools.`;
}

/**
 * Pick a tool of the day from available sources
 */
function pickToolOfTheDay(allocatedSources?: Map<string, SourceWithContent[]>): ToolOfTheDay {
  // Default tool if no sources available
  let tool: ToolOfTheDay = {
    name: 'Claude API',
    url: 'https://docs.anthropic.com',
    whyNow: 'Claude continues to be the most capable AI assistant for professional workflows, ' +
      'with recent updates improving code generation and analysis capabilities.',
    quickStart: '1. Sign up at console.anthropic.com\n2. Create an API key\n3. Install the SDK: pip install anthropic\n4. Start building!',
  };

  // Try to find a better tool from sources
  if (allocatedSources) {
    for (const sources of allocatedSources.values()) {
      for (const source of sources) {
        if (source.url && source.title) {
          // Prefer GitHub or documentation sources
          if (source.url.includes('github.com') || source.category === 'github') {
            tool = {
              name: source.title.split(':')[0] || source.title,
              url: source.url,
              whyNow: `Recently featured as a top AI tool for professional workflows. ` +
                (source.snippet || source.content?.substring(0, 200) || ''),
              quickStart: '1. Visit the repository\n2. Follow installation instructions\n3. Check examples directory\n4. Integrate into your workflow',
            };
            return tool;
          }
        }
      }
    }
  }

  return tool;
}

/**
 * Generate a conclusion summarizing the newsletter
 */
function generateConclusion(sectionResults: AudienceSectionResult[]): string {
  const audienceNames = sectionResults.map(r => r.audienceName);

  return `That's a wrap for this edition of AI for PI! We've explored cutting-edge tools and techniques ` +
    `tailored for ${audienceNames.join(', ')}. The common thread? AI is making professional workflows ` +
    `faster, more accurate, and more accessible than ever. Pick one technique from above and try it this week. ` +
    `Small experiments lead to big transformations. Until next time, keep building!`;
}

/**
 * Generate a universal subject line that appeals to all audiences
 */
function generateSubjectLine(sectionResults: AudienceSectionResult[]): string {
  // Extract key themes from topics
  const allTopics = sectionResults.flatMap(r => r.topics.map(t => t.title));

  // Simple heuristic - find common themes
  const themes: string[] = [];

  const topicText = allTopics.join(' ').toLowerCase();

  if (topicText.includes('automat') || topicText.includes('workflow')) themes.push('Automation');
  if (topicText.includes('analys') || topicText.includes('data')) themes.push('Analysis');
  if (topicText.includes('ai') || topicText.includes('claude') || topicText.includes('gpt')) themes.push('AI');
  if (topicText.includes('build') || topicText.includes('creat')) themes.push('Building');
  if (topicText.includes('optim') || topicText.includes('improve')) themes.push('Optimization');

  if (themes.length === 0) {
    themes.push('Professional AI Tools');
  }

  // Create subject line
  const themeStr = themes.slice(0, 2).join(' & ');
  return `${themeStr}: This Week's Actionable AI Insights`;
}
