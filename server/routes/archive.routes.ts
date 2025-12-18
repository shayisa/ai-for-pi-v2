/**
 * Archive Routes
 *
 * CRUD operations for newsletter archives.
 * Archives store generated newsletters for later reference.
 *
 * @module routes/archive
 *
 * ## Endpoints
 * - GET    /api/archives              - List all archives
 * - GET    /api/archives/:id          - Get archive by ID
 * - POST   /api/archives              - Create new archive
 * - DELETE /api/archives/:id          - Delete archive
 * - GET    /api/archives/search/:query - Search archives by name
 *
 * ## Migration Notes
 * - Original location: server.ts:2104-2175
 * - Service: archiveService
 * - Response format updated to Control Plane standard
 */
import { Router, Request, Response } from 'express';
import * as archiveService from '../services/archiveService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/archives
 *
 * List all archives with optional limit.
 *
 * @query {number} limit - Maximum number of archives to return (default: 50)
 *
 * @example
 * GET /api/archives?limit=20
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const archives = archiveService.getArchives(limit);

    logger.info('archives', 'list', `Listed ${archives.length} archives`, { correlationId, limit });

    sendSuccess(res, { archives, count: archives.length });
  } catch (error) {
    const err = error as Error;
    logger.error('archives', 'list_error', `Failed to list archives: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch archives', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/archives/search/:query
 *
 * Search archives by name.
 * NOTE: This route must be defined BEFORE /:id to avoid route conflict.
 *
 * @param {string} query - Search query string
 * @query {number} limit - Maximum results (default: 20)
 */
router.get('/search/:query', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const archives = archiveService.searchArchives(req.params.query, limit);

    logger.info('archives', 'search', `Search "${req.params.query}" returned ${archives.length} results`, {
      correlationId,
      query: req.params.query,
      limit,
    });

    sendSuccess(res, { archives, count: archives.length });
  } catch (error) {
    const err = error as Error;
    logger.error('archives', 'search_error', `Failed to search archives: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to search archives', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/archives/:id
 *
 * Get a single archive by ID.
 *
 * @param {string} id - Archive ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const archive = archiveService.getArchiveById(req.params.id);

    if (!archive) {
      logger.warn('archives', 'not_found', `Archive not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Archive not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('archives', 'get', `Retrieved archive: ${req.params.id}`, { correlationId });
    sendSuccess(res, archive);
  } catch (error) {
    const err = error as Error;
    logger.error('archives', 'get_error', `Failed to get archive: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch archive', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/archives
 *
 * Create a new archive.
 *
 * @body {object} content - Newsletter content to archive
 * @body {string[]} audience - Target audience tags
 * @body {string} name - Optional archive name
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { content, audience, name } = req.body;

    if (!content) {
      logger.warn('archives', 'validation_error', 'Content is required', { correlationId });
      return sendError(res, 'Content is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const archive = archiveService.saveArchive(content, audience || [], name);

    logger.info('archives', 'create', `Created archive: ${archive.id}`, { correlationId, archiveId: archive.id });
    sendSuccess(res, archive, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('archives', 'create_error', `Failed to create archive: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to save archive', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/archives/:id
 *
 * Delete an archive by ID.
 *
 * @param {string} id - Archive ID to delete
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = archiveService.deleteArchive(req.params.id);

    if (!success) {
      logger.warn('archives', 'delete_not_found', `Archive not found for deletion: ${req.params.id}`, { correlationId });
      return sendError(res, 'Archive not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('archives', 'delete', `Deleted archive: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Archive deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('archives', 'delete_error', `Failed to delete archive: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete archive', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

export default router;
