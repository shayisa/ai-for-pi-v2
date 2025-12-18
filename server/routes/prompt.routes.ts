/**
 * Prompt Routes
 *
 * CRUD operations for saved prompts library.
 * Prompts can be reused as "Prompt of the Day" in newsletters.
 *
 * @module routes/prompt
 *
 * ## Endpoints
 * - GET    /api/prompts      - List all saved prompts
 * - GET    /api/prompts/:id  - Get prompt by ID
 * - POST   /api/prompts      - Create new prompt
 * - DELETE /api/prompts/:id  - Delete prompt
 *
 * ## Migration Notes
 * - Original location: server.ts:2119-2189
 * - Service: promptDbService
 */
import { Router, Request, Response } from 'express';
import * as promptDbService from '../services/promptDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/prompts
 *
 * List all saved prompts.
 *
 * @query {number} limit - Maximum number of prompts (default: 50)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const prompts = promptDbService.getPrompts(limit);
    const count = promptDbService.getPromptCount();

    logger.info('prompts', 'list', `Listed ${prompts.length} prompts`, { correlationId, limit });

    sendSuccess(res, { prompts, count });
  } catch (error) {
    const err = error as Error;
    logger.error('prompts', 'list_error', `Failed to list prompts: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch prompts', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/prompts/:id
 *
 * Get a single prompt by ID.
 *
 * @param {string} id - Prompt ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const prompt = promptDbService.getPromptById(req.params.id);

    if (!prompt) {
      logger.warn('prompts', 'not_found', `Prompt not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Prompt not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('prompts', 'get', `Retrieved prompt: ${req.params.id}`, { correlationId });
    sendSuccess(res, prompt);
  } catch (error) {
    const err = error as Error;
    logger.error('prompts', 'get_error', `Failed to get prompt: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch prompt', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/prompts
 *
 * Create a new prompt in the library.
 *
 * @body {string} title - Prompt title (required)
 * @body {string} summary - Prompt summary
 * @body {string[]} examplePrompts - Example usage prompts
 * @body {string} promptCode - The actual prompt code (required)
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { title, summary, examplePrompts, promptCode } = req.body;

    if (!title || !promptCode) {
      logger.warn('prompts', 'validation_error', 'Title and promptCode are required', { correlationId });
      return sendError(res, 'Title and promptCode are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const savedPrompt = promptDbService.savePrompt({
      title,
      summary: summary || '',
      examplePrompts: examplePrompts || [],
      promptCode,
    });

    logger.info('prompts', 'create', `Created prompt: ${savedPrompt.id}`, { correlationId, promptId: savedPrompt.id });
    sendSuccess(res, savedPrompt, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('prompts', 'create_error', `Failed to create prompt: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to save prompt', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/prompts/:id
 *
 * Delete a prompt from the library.
 *
 * @param {string} id - Prompt ID to delete
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const deleted = promptDbService.deletePrompt(req.params.id);

    if (!deleted) {
      logger.warn('prompts', 'delete_not_found', `Prompt not found for deletion: ${req.params.id}`, { correlationId });
      return sendError(res, 'Prompt not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('prompts', 'delete', `Deleted prompt: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Prompt deleted successfully' });
  } catch (error) {
    const err = error as Error;
    logger.error('prompts', 'delete_error', `Failed to delete prompt: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete prompt', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

export default router;
