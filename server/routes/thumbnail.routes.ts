/**
 * Thumbnail Routes
 *
 * CRUD operations for image style thumbnails.
 * Thumbnails provide preview images for different image generation styles.
 *
 * @module routes/thumbnail
 *
 * ## Endpoints
 * - GET    /api/thumbnails                      - Get all thumbnails
 * - GET    /api/thumbnails/status               - Get thumbnail generation status
 * - POST   /api/thumbnails/:styleName/generate  - Generate thumbnail for a style
 * - DELETE /api/thumbnails/:styleName           - Delete a thumbnail
 *
 * ## Migration Notes
 * - Original location: server.ts:2690-2833
 * - Service: thumbnailDbService, apiKeyDbService
 * - External: Stability AI API for image generation
 */
import { Router, Request, Response } from 'express';
import * as thumbnailDbService from '../services/thumbnailDbService';
import * as apiKeyDbService from '../services/apiKeyDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * All available image styles (must match App.tsx IMAGE_STYLES)
 */
const ALL_IMAGE_STYLES = [
  'photorealistic',
  'vector',
  'watercolor',
  'pixel',
  'minimalist',
  'cyberpunk',
  'abstract',
  'oilPainting',
  'isometric',
];

/**
 * Style to description mapping for prompt generation
 */
const THUMBNAIL_STYLE_MAP: Record<string, string> = {
  photorealistic: 'photorealistic',
  vector: 'vector illustration',
  watercolor: 'watercolor painting',
  pixel: 'pixel art',
  minimalist: 'minimalist line art',
  oilPainting: 'oil painting',
  cyberpunk: 'cyberpunk neon-lit futuristic',
  abstract: 'abstract non-representational art',
  isometric: 'isometric 3D perspective',
};

/**
 * GET /api/thumbnails
 *
 * Get all thumbnails.
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const thumbnails = thumbnailDbService.getAllThumbnails();

    logger.info('thumbnails', 'list', `Listed ${thumbnails.length} thumbnails`, { correlationId });
    sendSuccess(res, { thumbnails });
  } catch (error) {
    const err = error as Error;
    logger.error('thumbnails', 'list_error', `Failed to list thumbnails: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch thumbnails', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/thumbnails/status
 *
 * Get thumbnail generation status (which styles have/need thumbnails).
 */
router.get('/status', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const missing = thumbnailDbService.getMissingStyles(ALL_IMAGE_STYLES);
    const count = thumbnailDbService.getThumbnailCount();

    const result = {
      total: ALL_IMAGE_STYLES.length,
      generated: count,
      missing,
    };

    logger.info('thumbnails', 'status', `Thumbnail status: ${count}/${ALL_IMAGE_STYLES.length} generated`, {
      correlationId,
    });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('thumbnails', 'status_error', `Failed to get thumbnail status: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch thumbnail status', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/thumbnails/:styleName/generate
 *
 * Generate a thumbnail for a specific image style.
 * Uses Stability AI API for image generation.
 *
 * @param {string} styleName - Name of the image style
 */
router.post('/:styleName/generate', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { styleName } = req.params;

    // Validate style name
    if (!ALL_IMAGE_STYLES.includes(styleName)) {
      logger.warn('thumbnails', 'generate_validation_error', `Invalid style name: ${styleName}`, { correlationId });
      return sendError(res, `Invalid style name: ${styleName}`, ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Check if already exists
    const existing = thumbnailDbService.getThumbnailByStyle(styleName);
    if (existing) {
      logger.info('thumbnails', 'generate_cached', `Thumbnail already exists for: ${styleName}`, { correlationId });
      return sendSuccess(res, { thumbnail: existing, cached: true });
    }

    // Get Stability API key
    const adminEmail = process.env.ADMIN_EMAIL;
    let stabilityApiKey = adminEmail ? apiKeyDbService.getApiKey(adminEmail, 'stability') : null;
    if (!stabilityApiKey) {
      stabilityApiKey = process.env.VITE_STABILITY_API_KEY || null;
    }
    if (!stabilityApiKey) {
      logger.error('thumbnails', 'generate_no_api_key', 'Stability AI API key not configured', undefined, {
        correlationId,
      });
      return sendError(res, 'Stability AI API key not configured', ErrorCodes.MISSING_API_KEY, correlationId);
    }

    // Build prompt
    const styleDescription = THUMBNAIL_STYLE_MAP[styleName] || styleName;
    const prompt = `${styleDescription} style: A beautiful abstract composition showcasing the ${styleDescription} aesthetic, professional quality, visually striking, modern design`;

    logger.info('thumbnails', 'generate_start', `Generating thumbnail for: ${styleName}`, { correlationId });

    // Generate image via Stability AI
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', 'png');
    formData.append('aspect_ratio', '1:1');

    const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stabilityApiKey}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('thumbnails', 'generate_api_error', `Stability AI error: ${response.status}`, undefined, {
        correlationId,
        status: response.status,
        error: errorText,
      });
      return sendError(res, 'Image generation failed', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    const responseJson = (await response.json()) as { image?: string; errors?: string[] };

    if (responseJson.errors && responseJson.errors.length > 0) {
      logger.error('thumbnails', 'generate_api_errors', `Stability AI errors: ${responseJson.errors.join(', ')}`, undefined, {
        correlationId,
      });
      return sendError(res, `Image generation failed: ${responseJson.errors.join(', ')}`, ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    if (!responseJson.image) {
      logger.error('thumbnails', 'generate_no_image', 'No image in Stability AI response', undefined, { correlationId });
      return sendError(res, 'No image in Stability AI response', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    // Save to SQLite
    const thumbnail = thumbnailDbService.saveThumbnail(styleName, responseJson.image, prompt);

    logger.info('thumbnails', 'generate_success', `Generated and saved thumbnail for: ${styleName}`, { correlationId });
    sendSuccess(res, { thumbnail, cached: false });
  } catch (error) {
    const err = error as Error;
    logger.error('thumbnails', 'generate_error', `Failed to generate thumbnail: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate thumbnail', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * DELETE /api/thumbnails/:styleName
 *
 * Delete a thumbnail.
 *
 * @param {string} styleName - Name of the image style
 */
router.delete('/:styleName', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = thumbnailDbService.deleteThumbnail(req.params.styleName);

    if (!success) {
      logger.warn('thumbnails', 'delete_not_found', `Thumbnail not found: ${req.params.styleName}`, { correlationId });
      return sendError(res, 'Thumbnail not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('thumbnails', 'delete', `Deleted thumbnail: ${req.params.styleName}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Thumbnail deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('thumbnails', 'delete_error', `Failed to delete thumbnail: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete thumbnail', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
