/**
 * Newsletter Routes
 *
 * CRUD operations for saved newsletters.
 * Supports both v1 (basic) and v2 (enhanced with audience versions) formats.
 *
 * @module routes/newsletter
 *
 * ## Endpoints
 * - GET    /api/newsletters              - List all newsletters
 * - GET    /api/newsletters/:id          - Get newsletter by ID
 * - GET    /api/newsletters/:id/enhanced - Get enhanced (v2) newsletter
 * - POST   /api/newsletters              - Create newsletter
 * - DELETE /api/newsletters/:id          - Delete newsletter
 * - PATCH  /api/newsletters/:id/sections - Update sections (after image generation)
 * - POST   /api/newsletters/:id/log      - Log newsletter action
 * - GET    /api/newsletters/:id/logs     - Get newsletter logs
 *
 * ## Format Versions
 * - v1: Basic newsletter with sections array
 * - v2: Enhanced newsletter with audienceVersions map
 *
 * ## Migration Notes
 * - Original location: server.ts:2106-2240
 * - Service: newsletterDbService
 */
import { Router, Request, Response } from 'express';
import * as newsletterDbService from '../services/newsletterDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/newsletters
 *
 * List all newsletters with format version (newest first).
 * Supports both v1 and v2 formats.
 *
 * @query {number} limit - Maximum number of newsletters (default: 50)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const newsletters = newsletterDbService.getNewslettersWithFormat(limit);

    logger.info('newsletters', 'list', `Listed ${newsletters.length} newsletters`, { correlationId, limit });

    sendSuccess(res, { newsletters, count: newsletters.length });
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'list_error', `Failed to list newsletters: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch newsletters', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/newsletters/by-prompt/:promptId
 *
 * Phase 9c: Get newsletters that used a specific saved prompt.
 * Uses SQLite json_extract to find newsletters where prompt_of_day.savedPromptId matches.
 *
 * @param {string} promptId - Saved prompt ID
 */
router.get('/by-prompt/:promptId', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const newsletters = newsletterDbService.getNewslettersBySavedPromptId(req.params.promptId);

    logger.info('newsletters', 'get_by_prompt', `Found ${newsletters.length} newsletters using prompt: ${req.params.promptId}`, {
      correlationId,
      promptId: req.params.promptId,
      count: newsletters.length,
    });

    sendSuccess(res, { newsletters, count: newsletters.length });
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'get_by_prompt_error', `Failed to get newsletters by prompt: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch newsletters by prompt', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/newsletters/:id/enhanced
 *
 * Get enhanced newsletter by ID (v2 format only).
 * NOTE: Must be defined BEFORE /:id route to avoid route conflict.
 *
 * @param {string} id - Newsletter ID
 */
router.get('/:id/enhanced', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const newsletter = newsletterDbService.getEnhancedNewsletterById(req.params.id);

    if (!newsletter) {
      logger.warn('newsletters', 'enhanced_not_found', `Enhanced newsletter not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Enhanced newsletter not found or not v2 format', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('newsletters', 'get_enhanced', `Retrieved enhanced newsletter: ${req.params.id}`, { correlationId });
    sendSuccess(res, newsletter);
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'get_enhanced_error', `Failed to get enhanced newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch enhanced newsletter', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/newsletters/:id/logs
 *
 * Get newsletter action logs.
 *
 * @param {string} id - Newsletter ID
 */
router.get('/:id/logs', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const logs = newsletterDbService.getNewsletterLogs(req.params.id);

    logger.info('newsletters', 'get_logs', `Retrieved logs for newsletter: ${req.params.id}`, { correlationId, logCount: logs.length });
    sendSuccess(res, { logs });
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'get_logs_error', `Failed to get newsletter logs: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch logs', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/newsletters/:id
 *
 * Get single newsletter by ID with format detection.
 *
 * @param {string} id - Newsletter ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const result = newsletterDbService.getNewsletterByIdWithFormat(req.params.id);

    if (!result) {
      logger.warn('newsletters', 'not_found', `Newsletter not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Newsletter not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('newsletters', 'get', `Retrieved newsletter: ${req.params.id}`, { correlationId });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'get_error', `Failed to get newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch newsletter', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/newsletters
 *
 * Create a new newsletter.
 *
 * @body {object} newsletter - Newsletter content (must have id and subject)
 * @body {string[]} topics - Topics covered in the newsletter
 * @body {object} settings - Newsletter settings
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { newsletter, topics, settings } = req.body;

    if (!newsletter || !newsletter.id || !newsletter.subject) {
      logger.warn('newsletters', 'validation_error', 'Newsletter with id and subject is required', { correlationId });
      return sendError(res, 'Newsletter with id and subject is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const saved = newsletterDbService.saveNewsletter(newsletter, topics || [], settings);

    logger.info('newsletters', 'create', `Created newsletter: ${newsletter.id}`, { correlationId, newsletterId: newsletter.id });
    sendSuccess(res, saved, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'create_error', `Failed to create newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to save newsletter', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/newsletters/:id
 *
 * Delete a newsletter by ID.
 *
 * @param {string} id - Newsletter ID to delete
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = newsletterDbService.deleteNewsletter(req.params.id);

    if (!success) {
      logger.warn('newsletters', 'delete_not_found', `Newsletter not found for deletion: ${req.params.id}`, { correlationId });
      return sendError(res, 'Newsletter not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('newsletters', 'delete', `Deleted newsletter: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Newsletter deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'delete_error', `Failed to delete newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete newsletter', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * PATCH /api/newsletters/:id/sections
 *
 * Update newsletter sections (after client-side image generation).
 * Supports both v1 (sections array) and v2 (audienceSections map).
 *
 * @param {string} id - Newsletter ID
 * @body {object[]} sections - Section array (for v1)
 * @body {object} audienceSections - Audience sections map (for v2)
 * @body {string} formatVersion - 'v1' or 'v2'
 */
router.patch('/:id/sections', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { sections, audienceSections, formatVersion } = req.body;
    let success = false;

    if (formatVersion === 'v2' && audienceSections) {
      success = newsletterDbService.updateEnhancedNewsletterSections(req.params.id, audienceSections);
    } else if (sections) {
      success = newsletterDbService.updateNewsletterSections(req.params.id, sections);
    } else {
      logger.warn('newsletters', 'update_validation_error', 'Missing sections or audienceSections', { correlationId });
      return sendError(res, 'Missing sections or audienceSections', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (!success) {
      logger.warn('newsletters', 'update_not_found', `Newsletter not found for section update: ${req.params.id}`, { correlationId });
      return sendError(res, 'Newsletter not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('newsletters', 'update_sections', `Updated sections for newsletter: ${req.params.id}`, {
      correlationId,
      formatVersion: formatVersion || 'v1',
    });
    sendSuccess(res, { success: true, message: 'Newsletter sections updated' });
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'update_sections_error', `Failed to update newsletter sections: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update newsletter sections', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/newsletters/:id/log
 *
 * Log a newsletter action (created, saved_to_drive, sent_email).
 *
 * @param {string} id - Newsletter ID
 * @body {string} action - Action type ('created' | 'saved_to_drive' | 'sent_email')
 * @body {object} details - Optional action details
 */
router.post('/:id/log', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { action, details } = req.body;
    const validActions = ['created', 'saved_to_drive', 'sent_email'];

    if (!validActions.includes(action)) {
      logger.warn('newsletters', 'log_validation_error', `Invalid action type: ${action}`, { correlationId, action });
      return sendError(res, 'Invalid action type', ErrorCodes.VALIDATION_ERROR, correlationId, {
        validActions,
        received: action,
      });
    }

    newsletterDbService.logAction(req.params.id, action, details);

    logger.info('newsletters', 'log_action', `Logged action '${action}' for newsletter: ${req.params.id}`, {
      correlationId,
      action,
    });
    sendSuccess(res, { success: true, message: `Action '${action}' logged` });
  } catch (error) {
    const err = error as Error;
    logger.error('newsletters', 'log_action_error', `Failed to log newsletter action: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to log action', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

export default router;
