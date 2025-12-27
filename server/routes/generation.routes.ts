/**
 * Generation Routes
 *
 * AI content generation endpoints for newsletters, topics, and images.
 *
 * @module routes/generation
 *
 * ## Endpoints
 * - GET    /api/fetchTrendingSources          - Get cached trending sources
 * - POST   /api/generateCompellingTrendingContent - Extract actionable insights
 * - POST   /api/generateNewsletter            - Generate newsletter (v1)
 * - POST   /api/generateEnhancedNewsletter    - Generate enhanced newsletter (v2)
 * - POST   /api/generateAudienceConfig        - Generate audience configuration
 * - GET    /api/fetchMultiSources             - Fetch from multiple APIs
 * - GET    /api/defaultAudiences              - Get default audience configs
 * - POST   /api/generateTopicSuggestions      - Generate HOW-TO topics
 * - POST   /api/generateTrendingTopics        - Identify trending developments
 * - POST   /api/generateTrendingTopicsWithSources - Analyze real sources
 * - POST   /api/generateImage                 - Generate image via Stability AI
 *
 * ## PRESERVATION NOTE
 * These routes delegate to services that contain EXACT prompts from server.ts.
 * The services handle all AI generation logic - routes are thin controllers only.
 *
 * ## Migration Notes
 * - Original location: server.ts lines 656-1885
 * - Services: domains/generation/services/*
 */
import { Router, Request, Response } from 'express';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

// Generation services
import {
  generateNewsletter,
  generateEnhancedNewsletter,
  generateTopicSuggestions,
  generateTrendingTopics,
  generateTrendingTopicsWithSources,
  generateCompellingTrendingContent,
} from '../domains/generation/services';

// External clients
import { generateImage } from '../external/stability';

// Helpers and sources
import { fetchAllTrendingSources } from '../domains/generation/sources/aggregator';
import { trendingCache } from '../cache/trendingCache';

// Other services
import * as sourceFetchingService from '../services/sourceFetchingService';
import * as audienceGenerationService from '../services/audienceGenerationService';
import * as apiKeyDbService from '../services/apiKeyDbService';
import * as personaDbService from '../services/personaDbService';

import type { AudienceConfig } from '../../types';

const router = Router();

// ============================================================================
// Trending Sources
// ============================================================================

/**
 * GET /api/fetchTrendingSources
 *
 * Fetch trending sources with audience-aware caching (1 hour TTL).
 * Different audience selections get separate cached results.
 *
 * Query params:
 * - audiences: comma-separated list of audience IDs (e.g., "business-administration,business-intelligence")
 */
router.get('/fetchTrendingSources', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    // Parse audience IDs from query string
    const audienceParam = req.query.audiences as string | undefined;
    const audienceIds = audienceParam ? audienceParam.split(',').filter(Boolean) : [];

    // Check audience-specific cache first (reduces 67+ API calls to 1 per hour per audience combo)
    const cached = trendingCache.get(audienceIds);
    if (cached) {
      const metadata = trendingCache.getMetadata(audienceIds);
      logger.info('generation', 'fetch_trending_cached', 'Returned cached trending sources', {
        correlationId,
        count: cached.length,
        audienceKey: metadata?.audienceKey,
      });
      return sendSuccess(res, {
        sources: cached,
        cachedAt: metadata?.cachedAt,
        ttl: metadata?.ttl,
        audienceKey: metadata?.audienceKey,
      }, correlationId);
    }

    // Fetch fresh data (TODO: pass audienceIds to fetchAllTrendingSources for filtering)
    console.log(`[TrendingSources] Cache miss for audiences: ${audienceIds.join(',') || '_all_'}, fetching fresh data...`);
    const sources = await fetchAllTrendingSources();

    // Store in audience-specific cache
    trendingCache.set(audienceIds, sources);

    logger.info('generation', 'fetch_trending_fresh', 'Fetched fresh trending sources', {
      correlationId,
      count: sources.length,
      audienceIds,
    });
    sendSuccess(res, { sources }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'fetch_trending_error', `Failed to fetch trending sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch trending sources', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/generateCompellingTrendingContent
 *
 * Extract actionable insights and tools from trending sources.
 */
router.post('/generateCompellingTrendingContent', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { audience, sources } = req.body;

    const result = await generateCompellingTrendingContent({ audience, sources });

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate content', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('generation', 'compelling_content_generated', 'Generated compelling trending content', { correlationId });
    sendSuccess(res, { text: result.text }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'compelling_content_error', `Failed to generate compelling content: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate compelling trending content', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Newsletter Generation
// ============================================================================

/**
 * POST /api/generateNewsletter
 *
 * Generate newsletter content (v1 format) with web search capability.
 */
router.post('/generateNewsletter', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { topics, audience, tone, flavors, imageStyle, personaId } = req.body;

    const result = await generateNewsletter({ topics, audience, tone, flavors, imageStyle, personaId });

    if (!result.success) {
      // Phase 15: Include validation results in error response
      const errorCode = result.validationResults ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.EXTERNAL_SERVICE_ERROR;
      return sendError(res, result.error || 'Failed to generate newsletter', errorCode, correlationId, {
        validationResults: result.validationResults,
        invalidTopics: result.invalidTopics,
        suggestions: result.suggestions,
      });
    }

    logger.info('generation', 'newsletter_generated', 'Generated newsletter', {
      correlationId,
      id: result.newsletter?.id,
    });
    sendSuccess(res, { text: result.text, newsletter: result.newsletter }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'newsletter_error', `Failed to generate newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate newsletter', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/generateEnhancedNewsletter
 *
 * Generate enhanced newsletter (v2 format) with multi-source fetching.
 */
router.post('/generateEnhancedNewsletter', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    // Phase 14: Extract tone and flavors for quality fix
    const { topics, audiences, imageStyle, promptOfTheDay, personaId, tone, flavors } = req.body as {
      topics: (string | TopicWithAudienceId)[];  // Phase 17: Accept full topic objects with resource URLs
      audiences: AudienceConfig[];
      imageStyle?: string;
      promptOfTheDay?: {
        title: string;
        summary: string;
        examplePrompts: string[];
        promptCode: string;
      } | null;
      personaId?: string;
      tone?: string;
      flavors?: string[];
    };

    const result = await generateEnhancedNewsletter({ topics, audiences, imageStyle, promptOfTheDay, personaId, tone, flavors });

    if (!result.success) {
      // Phase 15: Include validation results in error response
      const errorCode = result.validationResults ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.EXTERNAL_SERVICE_ERROR;
      return sendError(res, result.error || 'Failed to generate enhanced newsletter', errorCode, correlationId, {
        validationResults: result.validationResults,
        invalidTopics: result.invalidTopics,
        suggestions: result.suggestions,
      });
    }

    logger.info('generation', 'enhanced_newsletter_generated', 'Generated enhanced newsletter', {
      correlationId,
      id: result.newsletter?.id,
    });
    sendSuccess(res, { newsletter: result.newsletter, sources: result.sources }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'enhanced_newsletter_error', `Failed to generate enhanced newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate enhanced newsletter', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Audience Configuration
// ============================================================================

/**
 * POST /api/generateAudienceConfig
 *
 * Generate audience configuration using AI.
 */
router.post('/generateAudienceConfig', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { name, description } = req.body as { name: string; description: string };

    if (!name || !description) {
      return sendError(res, 'Name and description are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Get API key
    const adminEmail = process.env.ADMIN_EMAIL;
    let apiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'claude') : null;
    if (!apiKey) {
      apiKey = process.env.VITE_ANTHROPIC_API_KEY || null;
    }

    if (!apiKey) {
      return sendError(res, 'Claude API key not configured', ErrorCodes.MISSING_API_KEY, correlationId);
    }

    const result = await audienceGenerationService.generateAudienceConfig(apiKey, name, description);

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate config', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('generation', 'audience_config_generated', 'Generated audience configuration', {
      correlationId,
      audienceId: result.config?.id,
    });
    sendSuccess(res, {
      config: result.config,
      timeMs: result.timeMs,
      tokensUsed: result.tokensUsed,
    }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'audience_config_error', `Failed to generate audience config: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate audience config', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/fetchMultiSources
 *
 * Fetch sources from multiple APIs for enhanced newsletter.
 */
router.get('/fetchMultiSources', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const keywords = (req.query.keywords as string)?.split(',') || ['artificial intelligence'];
    const subreddits = (req.query.subreddits as string)?.split(',') || ['MachineLearning'];
    const arxivCategories = (req.query.arxiv as string)?.split(',') || ['cs.AI'];
    const limit = parseInt(req.query.limit as string) || 5;

    const result = await sourceFetchingService.fetchAllSources({
      keywords,
      subreddits,
      arxivCategories,
      limit,
    });

    logger.info('generation', 'multi_sources_fetched', 'Fetched multi-sources', {
      correlationId,
      count: result.totalCount,
    });
    sendSuccess(res, result, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'multi_sources_error', `Failed to fetch sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch sources', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/defaultAudiences
 *
 * Get default audiences with their generated configs.
 */
router.get('/defaultAudiences', (_req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const audiences = audienceGenerationService.getDefaultAudiences();
  sendSuccess(res, { audiences }, correlationId);
});

// ============================================================================
// Topic Generation
// ============================================================================

/**
 * POST /api/generateTopicSuggestions
 *
 * Generate 10 HOW-TO tutorial topic suggestions.
 */
router.post('/generateTopicSuggestions', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { audience, sources } = req.body;

    const result = await generateTopicSuggestions({ audience, sources });

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate topic suggestions', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('generation', 'topics_generated', 'Generated topic suggestions', { correlationId });
    sendSuccess(res, { text: result.text }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'topics_error', `Failed to generate topic suggestions: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate topic suggestions', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/generateTopicSuggestionsV2
 *
 * Phase 15.4: Parallel per-audience topic suggestion generation.
 *
 * Generates topic suggestions with equal representation per audience.
 * Each suggestion includes its audienceId for display with audience badges.
 *
 * Request body:
 * - audience: string[] - Array of audience IDs
 * - topicsPerAudience?: number - Topics to generate per audience (default: 3)
 * - customAudiences?: Array - Optional custom audience definitions
 */
router.post('/generateTopicSuggestionsV2', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const {
      audience,
      topicsPerAudience = 3,
      customAudiences,
    } = req.body as {
      audience: string[];
      topicsPerAudience?: number;
      customAudiences?: Array<{
        id: string;
        name: string;
        description: string;
        domainExamples?: string;
        topicTitles?: string[];
      }>;
    };

    if (!audience || !Array.isArray(audience) || audience.length === 0) {
      return sendError(res, 'Audience array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    logger.info('generation', 'topics_v2_start', `Starting V2 topic suggestions for ${audience.length} audiences`, {
      correlationId,
      audiences: audience,
      topicsPerAudience,
    });

    const result = await generateSuggestionsParallel(
      audience,
      { topicsPerAudience },
      customAudiences
    );

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate topic suggestions V2', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('generation', 'topics_v2_complete', 'Generated parallel topic suggestions', {
      correlationId,
      topicCount: result.topics?.length,
      durationMs: result.totalDurationMs,
    });

    sendSuccess(res, {
      success: true,
      topics: result.topics,
      perAudienceResults: result.perAudienceResults?.map(r => ({
        audienceId: r.audienceId,
        topicCount: r.topics.length,
        success: r.success,
        error: r.error,
        durationMs: r.durationMs,
      })),
      totalDurationMs: result.totalDurationMs,
    }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'topics_v2_error', `Failed to generate topic suggestions V2: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate topic suggestions V2', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/generateTrendingTopics
 *
 * Identify 2-3 most actionable AI developments.
 */
router.post('/generateTrendingTopics', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { audience } = req.body;

    const result = await generateTrendingTopics({ audience });

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate trending topics', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('generation', 'trending_topics_generated', 'Generated trending topics', { correlationId });
    sendSuccess(res, { text: result.text }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'trending_topics_error', `Failed to generate trending topics: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate trending topics', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/generateTrendingTopicsWithSources
 *
 * Identify trends from provided real sources.
 */
router.post('/generateTrendingTopicsWithSources', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { audience, sources } = req.body;

    const result = await generateTrendingTopicsWithSources({ audience, sources });

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate trending topics with sources', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('generation', 'trending_with_sources_generated', 'Generated trending topics with sources', { correlationId });
    sendSuccess(res, { text: result.text }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'trending_with_sources_error', `Failed to generate trending topics with sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate trending topics with sources', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Parallel Trending Topics (Phase 15.3)
// ============================================================================

import {
  generateTrendingTopicsParallel,
  executeConfirmedParallelGeneration,
} from '../domains/generation/services/parallelTrendingOrchestrator';
import type { ParallelGenerationConfig } from '../domains/generation/types/parallelGeneration';

// Phase 15.4: Parallel topic suggestions
import { generateSuggestionsParallel } from '../domains/generation/services/parallelSuggestionOrchestrator';

/**
 * POST /api/generateTrendingTopicsV2
 *
 * Phase 15.3: Parallel per-audience trending topic generation.
 *
 * Eliminates archaeology bias by generating topics for each audience
 * in parallel, then merging with equal representation.
 *
 * Request body:
 * - audience: string[] - Array of audience IDs
 * - config?: Partial<ParallelGenerationConfig> - Optional generation config
 * - customAudiences?: Array - Optional custom audience definitions
 * - confirmed?: boolean - Whether user has confirmed after seeing trade-offs
 *
 * If config.showTradeoffs is true (default), first call returns trade-offs
 * for user confirmation. Call again with confirmed=true to execute.
 */
router.post('/generateTrendingTopicsV2', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const {
      audience,
      config,
      customAudiences,
      confirmed = false,
      clearCache = false,
    } = req.body as {
      audience: string[];
      config?: Partial<ParallelGenerationConfig>;
      customAudiences?: Array<{
        id: string;
        name: string;
        description: string;
        domainExamples: string;
        topicTitles: string[];
      }>;
      confirmed?: boolean;
      clearCache?: boolean;
    };

    if (!audience || !Array.isArray(audience) || audience.length === 0) {
      return sendError(res, 'Audience array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Clear cache if requested (for testing or force refresh)
    if (clearCache) {
      trendingCache.clearMergedTopics(audience);
      trendingCache.clearPerAudienceTopics(); // Clear all per-audience to force regeneration
      logger.info('generation', 'trending_v2_cache_cleared', 'Cache cleared for regeneration', { correlationId });
    }

    logger.info('generation', 'trending_v2_start', `Starting V2 trending generation for ${audience.length} audiences`, {
      correlationId,
      audiences: audience,
      mode: config?.mode || 'per-category',
      confirmed,
    });

    // Check cache first for confirmed requests (skip if cache was just cleared)
    if (confirmed && !clearCache) {
      const cached = trendingCache.getMergedTopics(audience);
      if (cached && cached.success && cached.topics) {
        logger.info('generation', 'trending_v2_cached', 'Returning cached parallel trending topics', {
          correlationId,
          topicCount: cached.topics.length,
        });
        return sendSuccess(res, {
          success: true,
          topics: cached.topics,
          tradeoffs: cached.tradeoffs,
          cached: true,
          cacheKey: cached.cacheKey,
        }, correlationId);
      }
    }

    // Generate topics
    // Phase 15.3: Ensure required config fields have defaults
    const fullConfig = {
      mode: config?.mode || 'per-category' as const,
      topicsPerAgent: config?.topicsPerAgent || 4,
      maxParallelAgents: config?.maxParallelAgents,
      showTradeoffs: true,
    };

    const result = confirmed
      ? await executeConfirmedParallelGeneration(audience, config, customAudiences)
      : await generateTrendingTopicsParallel(audience, fullConfig, customAudiences, false);

    // Handle trade-off confirmation flow
    if (result.needsConfirmation) {
      logger.info('generation', 'trending_v2_tradeoffs', 'Returning trade-offs for confirmation', {
        correlationId,
        agentCount: result.tradeoffs?.agentCount,
        estimatedTime: result.tradeoffs?.estimatedTimeSeconds,
      });
      return sendSuccess(res, {
        needsConfirmation: true,
        tradeoffs: result.tradeoffs,
      }, correlationId);
    }

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate trending topics V2', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, {
        tradeoffs: result.tradeoffs,
      });
    }

    // Cache successful results
    if (result.success && result.topics) {
      trendingCache.setMergedTopics(audience, result);
    }

    logger.info('generation', 'trending_v2_complete', 'Generated parallel trending topics', {
      correlationId,
      topicCount: result.topics?.length,
      durationMs: result.totalDurationMs,
    });

    sendSuccess(res, {
      success: true,
      topics: result.topics,
      tradeoffs: result.tradeoffs,
      perAudienceResults: result.perAudienceResults?.map(r => ({
        batchId: r.batchId,
        audienceIds: r.audienceIds,
        topicCount: r.topics.length,
        success: r.success,
        error: r.error,
        durationMs: r.durationMs,
      })),
      totalDurationMs: result.totalDurationMs,
      cacheKey: result.cacheKey,
    }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'trending_v2_error', `Failed to generate trending topics V2: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate trending topics V2', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Image Generation
// ============================================================================

/**
 * POST /api/generateImage
 *
 * Generate image using Stability AI.
 */
router.post('/generateImage', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { prompt, imageStyle } = req.body;

    if (!prompt) {
      return sendError(res, 'Prompt is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await generateImage(prompt, imageStyle);

    if (!result.success) {
      logger.warn('generation', 'image_generation_failed', result.error || 'Image generation failed', { correlationId });
      return sendError(res, result.error || 'Failed to generate image', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: result.details });
    }

    logger.info('generation', 'image_generated', 'Generated image via Stability AI', { correlationId });
    sendSuccess(res, { image: result.image }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'image_error', `Failed to generate image: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate image', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Orchestrated Newsletter Generation (Phase 15.1)
// ============================================================================

import { orchestrateGeneration, orchestrateFull } from '../domains/generation/orchestrator/contentOrchestrator';

/**
 * POST /api/generateNewsletterV3
 *
 * Generate newsletter with full orchestration pipeline:
 * - Pre-generation validation
 * - Source diversity enforcement
 * - Post-generation citation verification
 *
 * This endpoint provides better source diversity and verification
 * compared to V2 (/api/generateEnhancedNewsletter).
 */
router.post('/generateNewsletterV3', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const {
      topics,
      audiences,
      imageStyle,
      promptOfTheDay,
      personaId,
      tone,
      flavors,
      skipValidation = false,
      skipEnrichment = false,
      enableVerification = true,
    } = req.body as {
      topics: string[];
      audiences: AudienceConfig[];
      imageStyle?: string;
      promptOfTheDay?: {
        title: string;
        summary: string;
        examplePrompts: string[];
        promptCode: string;
      } | null;
      personaId?: string;
      tone?: string;
      flavors?: string[];
      skipValidation?: boolean;
      skipEnrichment?: boolean;
      enableVerification?: boolean;
    };

    if (!topics || !topics.length) {
      return sendError(res, 'Topics array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (!audiences || !audiences.length) {
      return sendError(res, 'Audiences array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    logger.info('generation', 'v3_start', `Starting V3 generation for ${topics.length} topics, ${audiences.length} audiences`, { correlationId });

    const result = await orchestrateGeneration(
      {
        topics,
        audiences,
        imageStyle,
        promptOfTheDay,
        personaId,
        tone,
        flavors,
      },
      {
        skipTopicValidation: skipValidation,
        skipEnrichment,
        enableVerification,
        enableSourceDiversity: true,
        maxRetries: 1,
      }
    );

    if (!result.success) {
      const errorCode = result.validationResults ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.EXTERNAL_SERVICE_ERROR;
      return sendError(res, result.error || 'Failed to generate newsletter V3', errorCode, correlationId, {
        validationResults: result.validationResults,
        filteredTopics: result.filteredTopics,
        suggestions: result.suggestions,
        metrics: result.metrics,
      });
    }

    logger.info('generation', 'v3_complete', 'Generated newsletter V3', {
      correlationId,
      id: result.newsletter?.id,
      diversityScore: result.metrics.diversityScore,
      totalTimeMs: result.metrics.totalTimeMs,
    });

    sendSuccess(res, {
      newsletter: result.newsletter,
      allocations: result.allocations,
      verification: result.verification,
      metrics: result.metrics,
      preGeneration: {
        validatedTopics: result.validationResults,
        filteredTopics: result.filteredTopics,
        pipelineTimeMs: result.preGenerationResult?.pipelineTimeMs,
      },
    }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'v3_error', `Failed to generate newsletter V3: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate newsletter V3', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Persona Preview (Phase 12.0)
// ============================================================================

import { generatePersonaPreview } from '../domains/generation/services/previewGenerator';

/**
 * POST /api/generatePersonaPreview
 *
 * Generate a short preview paragraph in a persona's voice.
 * Used for A/B persona comparison feature.
 */
router.post('/generatePersonaPreview', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { personaId, sampleTopic } = req.body;

    if (!personaId || !sampleTopic) {
      return sendError(res, 'personaId and sampleTopic are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const persona = personaDbService.getPersonaById(personaId);
    if (!persona) {
      return sendError(res, 'Persona not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    const preview = await generatePersonaPreview(persona, sampleTopic);

    logger.info('generation', 'persona_preview_generated', `Generated preview for ${persona.name}`, { correlationId });
    sendSuccess(res, { preview, personaName: persona.name }, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('generation', 'persona_preview_error', `Failed to generate persona preview: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate persona preview', ErrorCodes.INTERNAL_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Phase 16: Per-Audience Newsletter Generation (V4)
// ============================================================================

import {
  generateNewsletterPerAudience,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from '../domains/generation/services/perAudienceNewsletterGenerator';

import {
  analyzeTopicAudienceMatch,
  serializeBalancedMap,
} from '../domains/generation/services/topicAudienceBalancer';

import type {
  TopicWithAudienceId,
  MismatchResolution,
  PerAudienceGenerationParams,
} from '../../types';

/**
 * POST /api/analyzeTopicAudienceMatch
 *
 * Phase 16: Analyze topic-audience matches before V4 generation.
 * Returns matched topics, mismatched topics, and orphaned audiences.
 * Frontend uses this to show the TopicMismatchModal if needed.
 */
router.post('/analyzeTopicAudienceMatch', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  console.log('[V4Route] analyzeTopicAudienceMatch START', { correlationId });

  try {
    const { selectedTopics, selectedAudiences } = req.body as {
      selectedTopics: TopicWithAudienceId[];
      selectedAudiences: AudienceConfig[];
    };

    if (!selectedAudiences || !Array.isArray(selectedAudiences)) {
      return sendError(res, 'selectedAudiences array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    console.log('[V4Route] Analyzing matches', {
      topicCount: selectedTopics?.length || 0,
      audienceCount: selectedAudiences.length,
    });

    const analysis = analyzeTopicAudienceMatch(
      selectedTopics || [],
      selectedAudiences
    );

    console.log('[V4Route] Analysis result', {
      matchedCount: analysis.matched.size,
      mismatchedCount: analysis.mismatched.length,
      orphanedCount: analysis.orphanedAudiences.length,
    });

    // Convert Map to serializable object for JSON response
    const matchedObj: Record<string, TopicWithAudienceId[]> = {};
    for (const [key, value] of analysis.matched) {
      matchedObj[key] = value;
    }

    logger.info('generation', 'topic_audience_analysis', 'Analyzed topic-audience matches', {
      correlationId,
      matched: Object.keys(matchedObj).length,
      mismatched: analysis.mismatched.length,
      orphaned: analysis.orphanedAudiences.length,
    });

    sendSuccess(res, {
      matched: matchedObj,
      mismatched: analysis.mismatched,
      orphanedAudiences: analysis.orphanedAudiences,
    }, correlationId);
  } catch (error) {
    const err = error as Error;
    console.error('[V4Route] analyzeTopicAudienceMatch ERROR', error);
    logger.error('generation', 'topic_audience_analysis_error', `Analysis failed: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to analyze topic-audience matches', ErrorCodes.INTERNAL_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/generateNewsletterV4
 *
 * Phase 16: Generate newsletter with per-audience topic isolation.
 *
 * This is the V4 pipeline that generates DIFFERENT topics for each audience:
 * - Phase 0: Topic-Audience Balancing
 * - Phase 1: Parallel Topic Generation (for orphaned audiences)
 * - Phase 2: Strategic Overlap Detection
 * - Phase 3: Parallel Source Allocation
 * - Phase 4: Parallel Article Generation
 * - Phase 5: Merge & Finalize
 *
 * Request body:
 * - audiences: AudienceConfig[] - Selected audiences
 * - selectedTopics?: TopicWithAudienceId[] - Pre-selected topics with audience tags
 * - topicsPerAudience?: number - Topics to generate per audience (default: 3)
 * - tone: string - Writing tone
 * - flavors: string[] - Additional style flavors
 * - imageStyle?: string - Image generation style
 * - personaId?: string - Writer persona ID
 * - promptOfTheDay?: PromptOfTheDay - Optional prompt of the day
 * - mismatchResolutions?: MismatchResolution[] - User decisions for mismatched topics
 */
router.post('/generateNewsletterV4', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  console.log('[V4Route] generateNewsletterV4 START', { correlationId });

  try {
    const {
      audiences,
      selectedTopics,
      topicsPerAudience,
      tone,
      flavors,
      imageStyle,
      personaId,
      promptOfTheDay,
      mismatchResolutions,
    } = req.body as {
      audiences: AudienceConfig[];
      selectedTopics?: TopicWithAudienceId[];
      topicsPerAudience?: number;
      tone?: string;
      flavors?: string[];
      imageStyle?: string;
      personaId?: string;
      promptOfTheDay?: {
        title: string;
        summary: string;
        examplePrompts: string[];
        promptCode: string;
      };
      mismatchResolutions?: MismatchResolution[];
    };

    if (!audiences || !Array.isArray(audiences) || audiences.length === 0) {
      return sendError(res, 'audiences array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    console.log('[V4Route] V4 generation params', {
      audienceCount: audiences.length,
      topicCount: selectedTopics?.length || 0,
      hasMismatchResolutions: !!mismatchResolutions?.length,
      tone,
      flavors,
    });

    logger.info('generation', 'v4_start', `Starting V4 generation for ${audiences.length} audiences`, {
      correlationId,
      audiences: audiences.map(a => a.id),
      topicCount: selectedTopics?.length || 0,
    });

    const params: PerAudienceGenerationParams = {
      audiences,
      selectedTopics,
      topicsPerAudience: topicsPerAudience || DEFAULT_ORCHESTRATOR_CONFIG.topicsPerAudience,
      tone: tone || 'confident',
      flavors: flavors || [],
      imageStyle,
      personaId,
      promptOfTheDay,
    };

    const result = await generateNewsletterPerAudience(
      params,
      DEFAULT_ORCHESTRATOR_CONFIG,
      mismatchResolutions
    );

    console.log('[V4Route] V4 generation result', {
      success: result.success,
      sectionCount: result.sectionResults?.length,
      hasError: !!result.error,
      totalTimeMs: result.metrics?.totalTimeMs,
    });

    if (!result.success) {
      logger.error('generation', 'v4_failed', result.error || 'V4 generation failed', undefined, { correlationId });
      return sendError(res, result.error || 'Failed to generate newsletter V4', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, {
        metrics: result.metrics,
      });
    }

    logger.info('generation', 'v4_complete', 'Generated newsletter V4', {
      correlationId,
      id: result.newsletter?.id,
      sectionCount: result.sectionResults.length,
      overlapsFound: result.appliedOverlaps.length,
      totalTimeMs: result.metrics.totalTimeMs,
    });

    // Serialize the balancedMap for JSON response
    const serializedBalanceResult = {
      ...result.balanceResult,
      balancedMap: serializeBalancedMap(result.balanceResult.balancedMap),
    };

    sendSuccess(res, {
      success: true,
      newsletter: result.newsletter,
      sectionResults: result.sectionResults.map(sr => ({
        audienceId: sr.audienceId,
        audienceName: sr.audienceName,
        topicCount: sr.topics.length,
        sourceCount: sr.sources.length,
        generationTimeMs: sr.generationTimeMs,
      })),
      appliedOverlaps: result.appliedOverlaps,
      balanceResult: serializedBalanceResult,
      metrics: result.metrics,
    }, correlationId);
  } catch (error) {
    const err = error as Error;
    console.error('[V4Route] generateNewsletterV4 ERROR', error);
    logger.error('generation', 'v4_error', `Failed to generate newsletter V4: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate newsletter V4', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, { details: err.message });
  }
});

export default router;
