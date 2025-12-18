/**
 * Draft Routes
 *
 * CRUD operations for newsletter drafts.
 * Drafts provide auto-save functionality for in-progress newsletter work.
 *
 * @module routes/draft
 *
 * ## Endpoints
 * - GET    /api/drafts/:userEmail         - Get draft for user
 * - GET    /api/drafts/:userEmail/exists  - Check if draft exists
 * - POST   /api/drafts                    - Save or update draft
 * - DELETE /api/drafts/:userEmail         - Delete draft
 *
 * ## Migration Notes
 * - Original location: server.ts:2965-3031
 * - Service: draftDbService
 */
import { Router, Request, Response } from 'express';
import * as draftDbService from '../services/draftDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/drafts/:userEmail
 *
 * Get the draft for a specific user.
 *
 * @param {string} userEmail - User's email address
 */
router.get('/:userEmail', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const draft = draftDbService.getDraft(req.params.userEmail);

    if (!draft) {
      // Return 200 with null draft - "no draft exists" is a valid answer, not an error
      // This eliminates browser console 404 noise while maintaining clear semantics
      logger.info('drafts', 'not_found', `No draft found for: ${req.params.userEmail}`, { correlationId });
      return sendSuccess(res, { draft: null });
    }

    logger.info('drafts', 'get', `Retrieved draft for: ${req.params.userEmail}`, { correlationId });
    sendSuccess(res, { draft });
  } catch (error) {
    const err = error as Error;
    logger.error('drafts', 'get_error', `Failed to get draft: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch draft', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/drafts/:userEmail/exists
 *
 * Check if a draft exists for a specific user.
 *
 * @param {string} userEmail - User's email address
 */
router.get('/:userEmail/exists', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const exists = draftDbService.hasDraft(req.params.userEmail);

    logger.info('drafts', 'check_exists', `Draft exists check for ${req.params.userEmail}: ${exists}`, { correlationId });
    sendSuccess(res, { exists });
  } catch (error) {
    const err = error as Error;
    logger.error('drafts', 'check_exists_error', `Failed to check draft: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to check draft', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/drafts
 *
 * Save or update a draft.
 *
 * @body {string} userEmail - User's email address (required)
 * @body {object} content - Draft content (required)
 * @body {string[]} topics - Topics for this draft
 * @body {object} settings - Draft settings
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { userEmail, content, topics, settings } = req.body;

    if (!userEmail || !content) {
      logger.warn('drafts', 'validation_error', 'userEmail and content are required', { correlationId });
      return sendError(res, 'userEmail and content are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const draft = draftDbService.saveDraft(
      userEmail,
      content,
      topics || [],
      settings || {}
    );

    logger.info('drafts', 'save', `Saved draft for: ${userEmail}`, { correlationId });
    sendSuccess(res, draft);
  } catch (error) {
    const err = error as Error;
    logger.error('drafts', 'save_error', `Failed to save draft: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to save draft', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/drafts/:userEmail
 *
 * Delete a draft for a specific user.
 *
 * @param {string} userEmail - User's email address
 */
router.delete('/:userEmail', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = draftDbService.deleteDraft(req.params.userEmail);

    if (!success) {
      logger.warn('drafts', 'delete_not_found', `Draft not found for: ${req.params.userEmail}`, { correlationId });
      return sendError(res, 'Draft not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('drafts', 'delete', `Deleted draft for: ${req.params.userEmail}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Draft deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('drafts', 'delete_error', `Failed to delete draft: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete draft', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
