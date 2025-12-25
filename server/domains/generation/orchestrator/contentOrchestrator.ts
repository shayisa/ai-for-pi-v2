/**
 * Content Orchestrator Service
 *
 * Control plane for coordinating newsletter content generation across
 * multiple services. Provides a higher-level API that orchestrates:
 *
 * 1. Pre-generation validation (topic checking, source fetching)
 * 2. Source allocation (diversity enforcement)
 * 3. Content generation (enhanced newsletter)
 * 4. Post-generation verification (citation checking)
 *
 * @module domains/generation/orchestrator/contentOrchestrator
 *
 * ## Architecture
 * This orchestrator sits above the individual services and provides:
 * - Progress tracking via callbacks
 * - Error handling with recovery options
 * - Metrics collection for debugging
 * - Configuration for enabling/disabling features
 */

import type { AudienceConfig, EnhancedNewsletter, PromptOfTheDay, WriterPersona } from '../../../../types';
import type { PreGenerationResult } from '../services/preGenerationPipeline';
import type { AllocationResult, SourceAllocation } from '../../../services/sourceAllocationService';
import type { NewsletterVerificationResult } from '../../../services/citationVerificationService';
import type { TopicValidationResult } from '../../../services/topicValidationService';
import type { FetchSourcesResult } from '../../../services/sourceFetchingService';

import { runPreGenerationChecks } from '../services/preGenerationPipeline';
import { generateEnhancedNewsletter } from '../services/enhancedGenerator';
import { verifyNewsletter, quickVerify } from '../../../services/citationVerificationService';
import * as personaDbService from '../../../services/personaDbService';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorConfig {
  /** Enable post-generation citation verification */
  enableVerification: boolean;
  /** Enable source diversity enforcement */
  enableSourceDiversity: boolean;
  /** Skip topic validation (for testing) */
  skipTopicValidation: boolean;
  /** Skip web search enrichment */
  skipEnrichment: boolean;
  /** Maximum retries for failed generation */
  maxRetries: number;
  /** Callback for progress updates */
  onProgress?: (stage: OrchestratorStage, message: string) => void;
}

/**
 * Default configuration
 */
export const defaultConfig: OrchestratorConfig = {
  enableVerification: true,
  enableSourceDiversity: true,
  skipTopicValidation: false,
  skipEnrichment: false,
  maxRetries: 1,
};

/**
 * Stages of orchestration
 */
export type OrchestratorStage =
  | 'init'
  | 'pre-generation'
  | 'source-allocation'
  | 'generation'
  | 'verification'
  | 'complete'
  | 'error';

/**
 * Input parameters for orchestrated generation
 */
export interface OrchestratedGenerationParams {
  topics: string[];
  audiences: AudienceConfig[];
  imageStyle?: string;
  promptOfTheDay?: PromptOfTheDay | null;
  personaId?: string;
  tone?: string;
  flavors?: string[];
}

/**
 * Metrics collected during orchestration
 */
export interface OrchestrationMetrics {
  /** Total time from start to finish (ms) */
  totalTimeMs: number;
  /** Time spent in pre-generation (ms) */
  preGenerationTimeMs: number;
  /** Time spent in content generation (ms) */
  generationTimeMs: number;
  /** Time spent in verification (ms) */
  verificationTimeMs: number;
  /** Number of sources fetched */
  sourcesFetched: number;
  /** Number of sources allocated */
  sourcesAllocated: number;
  /** Source diversity score (0-100) */
  diversityScore: number;
  /** Number of valid topics */
  validTopicsCount: number;
  /** Number of invalid/filtered topics */
  filteredTopicsCount: number;
  /** Retry count if generation was retried */
  retryCount: number;
}

/**
 * Result of orchestrated generation
 */
export interface OrchestratedResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated newsletter (if successful) */
  newsletter?: EnhancedNewsletter;
  /** Source allocations used */
  allocations?: SourceAllocation[];
  /** Pre-generation pipeline result */
  preGenerationResult?: PreGenerationResult;
  /** Verification result (if verification enabled) */
  verification?: NewsletterVerificationResult;
  /** Orchestration metrics */
  metrics: OrchestrationMetrics;
  /** Error message (if failed) */
  error?: string;
  /** Validation results for topics */
  validationResults?: TopicValidationResult[];
  /** Topics that were filtered out */
  filteredTopics?: string[];
  /** Suggested alternative topics */
  suggestions?: string[];
}

/**
 * Report progress to callback if configured
 */
function reportProgress(
  config: OrchestratorConfig,
  stage: OrchestratorStage,
  message: string
): void {
  if (config.onProgress) {
    config.onProgress(stage, message);
  }
  console.log(`[Orchestrator:${stage}] ${message}`);
}

/**
 * Orchestrate newsletter generation with full pipeline
 *
 * This is the main entry point for the V3 generation API. It coordinates:
 * 1. Pre-generation validation and source fetching
 * 2. Source allocation with diversity enforcement
 * 3. Content generation with Claude
 * 4. Post-generation citation verification
 *
 * @param params - Generation parameters
 * @param config - Orchestration configuration
 * @returns Orchestrated result with newsletter, metrics, and verification
 */
export async function orchestrateGeneration(
  params: OrchestratedGenerationParams,
  config: Partial<OrchestratorConfig> = {}
): Promise<OrchestratedResult> {
  const startTime = Date.now();
  const fullConfig: OrchestratorConfig = { ...defaultConfig, ...config };

  const metrics: OrchestrationMetrics = {
    totalTimeMs: 0,
    preGenerationTimeMs: 0,
    generationTimeMs: 0,
    verificationTimeMs: 0,
    sourcesFetched: 0,
    sourcesAllocated: 0,
    diversityScore: 0,
    validTopicsCount: 0,
    filteredTopicsCount: 0,
    retryCount: 0,
  };

  try {
    reportProgress(fullConfig, 'init', `Starting orchestrated generation for ${params.topics.length} topics, ${params.audiences.length} audiences`);

    // ===== PHASE 1: Pre-Generation Pipeline =====
    reportProgress(fullConfig, 'pre-generation', 'Running pre-generation checks...');
    const preGenStartTime = Date.now();

    const preGenResult = await runPreGenerationChecks({
      topics: params.topics,
      audiences: params.audiences,
      skipValidation: fullConfig.skipTopicValidation,
      skipEnrichment: fullConfig.skipEnrichment,
    });

    metrics.preGenerationTimeMs = Date.now() - preGenStartTime;
    metrics.sourcesFetched = preGenResult.enrichedSources?.length || 0;
    metrics.validTopicsCount = preGenResult.validatedTopics.filter(t => t.isValid).length;
    metrics.filteredTopicsCount = params.topics.length - metrics.validTopicsCount;

    if (!preGenResult.canProceed) {
      reportProgress(fullConfig, 'error', `Pre-generation blocked: ${preGenResult.blockReason}`);
      metrics.totalTimeMs = Date.now() - startTime;

      return {
        success: false,
        error: preGenResult.blockReason || 'Pre-generation checks failed',
        preGenerationResult: preGenResult,
        validationResults: preGenResult.validatedTopics,
        filteredTopics: preGenResult.invalidTopics,
        suggestions: preGenResult.suggestions,
        metrics,
      };
    }

    // ===== PHASE 2: Source Allocation =====
    reportProgress(fullConfig, 'source-allocation', 'Processing source allocations...');

    // Source allocation is already done in pre-generation pipeline
    const allocations = preGenResult.sourceAllocations || [];
    metrics.sourcesAllocated = allocations.reduce((sum, a) => sum + a.sources.length, 0);
    metrics.diversityScore = preGenResult.allocationResult?.diversityScore || 100;

    reportProgress(fullConfig, 'source-allocation',
      `Allocated ${metrics.sourcesAllocated} sources with ${metrics.diversityScore.toFixed(0)}% diversity`
    );

    // ===== PHASE 3: Content Generation =====
    reportProgress(fullConfig, 'generation', 'Generating newsletter content...');
    const genStartTime = Date.now();

    let retryCount = 0;
    let generationResult = await generateEnhancedNewsletter({
      topics: params.topics,
      audiences: params.audiences,
      imageStyle: params.imageStyle,
      promptOfTheDay: params.promptOfTheDay,
      personaId: params.personaId,
      tone: params.tone,
      flavors: params.flavors,
    });

    metrics.generationTimeMs = Date.now() - genStartTime;

    // Retry if generation failed and retries are enabled
    while (!generationResult.success && retryCount < fullConfig.maxRetries) {
      retryCount++;
      reportProgress(fullConfig, 'generation', `Retrying generation (attempt ${retryCount + 1})...`);

      generationResult = await generateEnhancedNewsletter({
        topics: params.topics,
        audiences: params.audiences,
        imageStyle: params.imageStyle,
        promptOfTheDay: params.promptOfTheDay,
        personaId: params.personaId,
        tone: params.tone,
        flavors: params.flavors,
      });
    }
    metrics.retryCount = retryCount;

    if (!generationResult.success || !generationResult.newsletter) {
      reportProgress(fullConfig, 'error', `Generation failed: ${generationResult.error}`);
      metrics.totalTimeMs = Date.now() - startTime;

      return {
        success: false,
        error: generationResult.error || 'Content generation failed',
        preGenerationResult: preGenResult,
        allocations,
        metrics,
      };
    }

    // ===== PHASE 4: Post-Generation Verification =====
    let verification: NewsletterVerificationResult | undefined;

    if (fullConfig.enableVerification && allocations.length > 0) {
      reportProgress(fullConfig, 'verification', 'Verifying citations and source diversity...');
      const verifyStartTime = Date.now();

      verification = verifyNewsletter(generationResult.newsletter, allocations);
      metrics.verificationTimeMs = Date.now() - verifyStartTime;

      if (!verification.isValid) {
        reportProgress(fullConfig, 'verification',
          `Verification found ${verification.allIssues.length} issues (not blocking)`
        );
      } else {
        reportProgress(fullConfig, 'verification', 'Verification passed');
      }
    }

    // ===== COMPLETE =====
    metrics.totalTimeMs = Date.now() - startTime;
    reportProgress(fullConfig, 'complete',
      `Generation complete in ${metrics.totalTimeMs}ms (preGen: ${metrics.preGenerationTimeMs}ms, gen: ${metrics.generationTimeMs}ms, verify: ${metrics.verificationTimeMs}ms)`
    );

    return {
      success: true,
      newsletter: generationResult.newsletter,
      allocations,
      preGenerationResult: preGenResult,
      verification,
      metrics,
      validationResults: preGenResult.validatedTopics,
      filteredTopics: preGenResult.invalidTopics,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    reportProgress(fullConfig, 'error', `Orchestration failed: ${errorMessage}`);
    metrics.totalTimeMs = Date.now() - startTime;

    return {
      success: false,
      error: errorMessage,
      metrics,
    };
  }
}

/**
 * Quick orchestration for testing/development
 * Skips validation and verification for faster iteration
 */
export async function orchestrateQuick(
  params: OrchestratedGenerationParams
): Promise<OrchestratedResult> {
  return orchestrateGeneration(params, {
    skipTopicValidation: true,
    skipEnrichment: true,
    enableVerification: false,
    maxRetries: 0,
  });
}

/**
 * Full orchestration with all checks enabled
 * Best for production use
 */
export async function orchestrateFull(
  params: OrchestratedGenerationParams,
  onProgress?: (stage: OrchestratorStage, message: string) => void
): Promise<OrchestratedResult> {
  return orchestrateGeneration(params, {
    enableVerification: true,
    enableSourceDiversity: true,
    skipTopicValidation: false,
    skipEnrichment: false,
    maxRetries: 1,
    onProgress,
  });
}

export default {
  orchestrateGeneration,
  orchestrateQuick,
  orchestrateFull,
  defaultConfig,
};
