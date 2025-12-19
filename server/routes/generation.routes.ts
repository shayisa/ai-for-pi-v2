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

import type { AudienceConfig } from '../../types';

const router = Router();

// ============================================================================
// Trending Sources
// ============================================================================

/**
 * GET /api/fetchTrendingSources
 *
 * Fetch trending sources with caching (1 hour TTL).
 * Reduces external API calls from 67+ to 1 per hour.
 */
router.get('/fetchTrendingSources', async (_req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    // Check cache first (reduces 67+ API calls to 1 per hour)
    const cached = trendingCache.get();
    if (cached) {
      const metadata = trendingCache.getMetadata();
      logger.info('generation', 'fetch_trending_cached', 'Returned cached trending sources', {
        correlationId,
        count: cached.length,
      });
      return sendSuccess(res, {
        sources: cached,
        cachedAt: metadata?.cachedAt,
        ttl: metadata?.ttl,
      }, correlationId);
    }

    // Fetch fresh data
    console.log('[TrendingSources] Cache miss, fetching fresh data...');
    const sources = await fetchAllTrendingSources();

    // Store in cache
    trendingCache.set(sources);

    logger.info('generation', 'fetch_trending_fresh', 'Fetched fresh trending sources', {
      correlationId,
      count: sources.length,
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
      return sendError(res, result.error || 'Failed to generate newsletter', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
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
    };

    const result = await generateEnhancedNewsletter({ topics, audiences, imageStyle, promptOfTheDay, personaId, tone, flavors });

    if (!result.success) {
      return sendError(res, result.error || 'Failed to generate enhanced newsletter', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
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
// Persona Preview (Phase 12.0)
// ============================================================================

import { generatePersonaPreview } from '../domains/generation/services/previewGenerator';
import * as personaDbService from '../services/personaDbService';

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

export default router;
