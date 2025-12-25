/**
 * Source Routes
 *
 * CRUD operations for saved inspiration sources.
 * Sources can be saved from various platforms (HackerNews, ArXiv, GitHub, etc.)
 *
 * @module routes/source
 *
 * ## Endpoints
 * - GET    /api/sources               - List all sources
 * - GET    /api/sources/search/:query - Search sources by title
 * - GET    /api/sources/count         - Get source count
 * - GET    /api/sources/category/:category - Get sources by category
 * - GET    /api/sources/favorites     - Get favorite sources
 * - GET    /api/sources/:id           - Get source by ID
 * - POST   /api/sources               - Create source
 * - PUT    /api/sources/:id           - Update source
 * - DELETE /api/sources/:id           - Delete source
 * - POST   /api/sources/:id/favorite  - Toggle favorite status
 * - POST   /api/sources/:id/use       - Increment usage count
 *
 * ## Phase: Topic/Source Persistence
 */
import { Router, Request, Response } from 'express';
import * as sourceDbService from '../services/sourceDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/sources
 *
 * List all saved sources.
 * Optional query param: limit (default 100)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const sources = sourceDbService.getAllSources(limit);

    logger.info('sources', 'list', `Listed ${sources.length} sources`, { correlationId });
    sendSuccess(res, { sources });
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'list_error', `Failed to list sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch sources', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/sources/search/:query
 *
 * Search sources by title.
 * NOTE: This route MUST come before /:id to avoid conflicts.
 *
 * @param {string} query - Search query
 */
router.get('/search/:query', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const query = req.params.query;
    const limit = parseInt(req.query.limit as string) || 20;
    const sources = sourceDbService.searchSources(query, limit);

    logger.info('sources', 'search', `Searched sources for "${query}", found ${sources.length}`, { correlationId });
    sendSuccess(res, { sources });
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'search_error', `Failed to search sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to search sources', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/sources/count
 *
 * Get total count of saved sources.
 */
router.get('/count', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const count = sourceDbService.getSourceCount();

    logger.info('sources', 'count', `Source count: ${count}`, { correlationId });
    sendSuccess(res, { count });
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'count_error', `Failed to get source count: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to get source count', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/sources/category/:category
 *
 * Get sources by category.
 *
 * @param {string} category - One of: 'hackernews', 'arxiv', 'github', 'reddit', 'dev'
 */
router.get('/category/:category', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const category = req.params.category as 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
    const limit = parseInt(req.query.limit as string) || 50;
    const sources = sourceDbService.getSourcesByCategory(category, limit);

    logger.info('sources', 'list_by_category', `Listed ${sources.length} sources in category: ${category}`, { correlationId });
    sendSuccess(res, { sources });
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'list_by_category_error', `Failed to list sources by category: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch sources by category', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/sources/favorites
 *
 * Get favorite sources.
 */
router.get('/favorites', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sources = sourceDbService.getFavoriteSources(limit);

    logger.info('sources', 'list_favorites', `Listed ${sources.length} favorite sources`, { correlationId });
    sendSuccess(res, { sources });
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'list_favorites_error', `Failed to list favorite sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch favorite sources', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/sources/batch
 *
 * Phase 15.6: Batch create sources.
 * Used for auto-saving trending sources.
 * Skips duplicates by URL (case-insensitive).
 *
 * @body {Array} sources - Array of source objects
 * @body {string} sources[].title - Source title (required)
 * @body {string} sources[].url - Source URL (required)
 * @body {string} sources[].author - Optional author name
 * @body {string} sources[].publication - Optional publication name
 * @body {string} sources[].date - Optional date string
 * @body {string} sources[].category - One of: 'hackernews', 'arxiv', 'github', 'reddit', 'dev'
 * @body {string} sources[].summary - Optional summary
 */
router.post('/batch', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { sources } = req.body;

    if (!sources || !Array.isArray(sources)) {
      logger.warn('sources', 'batch_validation_error', 'sources array is required', { correlationId });
      return sendError(res, 'sources array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (sources.length === 0) {
      logger.info('sources', 'batch_empty', 'Empty sources array provided', { correlationId });
      return sendSuccess(res, { created: [], duplicateCount: 0 });
    }

    // Validate that all sources have title and url
    const invalidSources = sources.filter((s: { title?: string; url?: string }) => !s.title || !s.url);
    if (invalidSources.length > 0) {
      logger.warn('sources', 'batch_validation_error', `${invalidSources.length} sources missing title or url`, { correlationId });
      return sendError(res, 'All sources must have title and url', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = sourceDbService.createSourcesBatch(sources);

    logger.info('sources', 'batch_create', `Batch created ${result.created.length} sources, ${result.duplicateCount} duplicates skipped`, {
      correlationId,
      createdCount: result.created.length,
      duplicateCount: result.duplicateCount,
    });

    sendSuccess(res, result, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'batch_create_error', `Failed to batch create sources: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to batch create sources', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/sources/:id/favorite
 *
 * Toggle favorite status for a source.
 *
 * @param {string} id - Source ID
 */
router.post('/:id/favorite', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const source = sourceDbService.toggleSourceFavorite(req.params.id);

    if (!source) {
      logger.warn('sources', 'favorite_not_found', `Source not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Source not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('sources', 'toggle_favorite', `Toggled favorite for source: ${req.params.id}`, { correlationId, isFavorite: source.isFavorite });
    sendSuccess(res, source);
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'favorite_error', `Failed to toggle favorite: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to toggle favorite', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/sources/:id/use
 *
 * Increment usage count for a source.
 *
 * @param {string} id - Source ID
 */
router.post('/:id/use', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const source = sourceDbService.incrementUsageCount(req.params.id);

    if (!source) {
      logger.warn('sources', 'use_not_found', `Source not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Source not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('sources', 'increment_usage', `Incremented usage for source: ${req.params.id}`, { correlationId, usageCount: source.usageCount });
    sendSuccess(res, source);
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'use_error', `Failed to increment usage: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to increment usage', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/sources/:id
 *
 * Get a source by ID.
 *
 * @param {string} id - Source ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const source = sourceDbService.getSourceById(req.params.id);

    if (!source) {
      logger.warn('sources', 'not_found', `Source not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Source not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('sources', 'get', `Retrieved source: ${req.params.id}`, { correlationId });
    sendSuccess(res, source);
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'get_error', `Failed to get source: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch source', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/sources
 *
 * Create a new saved source.
 *
 * @body {string} title - Source title (required)
 * @body {string} url - Source URL (required)
 * @body {string} author - Optional author name
 * @body {string} publication - Optional publication name
 * @body {string} date - Optional publication date
 * @body {string} category - One of: 'hackernews', 'arxiv', 'github', 'reddit', 'dev' (required)
 * @body {string} summary - Optional summary
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { title, url, author, publication, date, category, summary } = req.body;

    if (!title) {
      logger.warn('sources', 'validation_error', 'title is required', { correlationId });
      return sendError(res, 'title is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (!url) {
      logger.warn('sources', 'validation_error', 'url is required', { correlationId });
      return sendError(res, 'url is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (!category) {
      logger.warn('sources', 'validation_error', 'category is required', { correlationId });
      return sendError(res, 'category is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Check for duplicate URL
    const existing = sourceDbService.getSourceByUrl(url);
    if (existing) {
      logger.warn('sources', 'duplicate', `Source with URL already exists: ${url}`, { correlationId });
      return sendError(res, 'Source with this URL already exists', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const source = sourceDbService.createSource({
      title,
      url,
      author,
      publication,
      date,
      category,
      summary,
    });

    logger.info('sources', 'create', `Created source: ${source.id}`, { correlationId, sourceTitle: title, category });
    sendSuccess(res, source, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'create_error', `Failed to create source: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create source', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * PUT /api/sources/:id
 *
 * Update a source.
 *
 * @param {string} id - Source ID
 * @body {object} updates - Fields to update
 */
router.put('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updates = req.body;
    const source = sourceDbService.updateSource(req.params.id, updates);

    if (!source) {
      logger.warn('sources', 'update_not_found', `Source not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Source not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('sources', 'update', `Updated source: ${req.params.id}`, { correlationId });
    sendSuccess(res, source);
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'update_error', `Failed to update source: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update source', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/sources/:id
 *
 * Delete a source.
 *
 * @param {string} id - Source ID
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = sourceDbService.deleteSource(req.params.id);

    if (!success) {
      logger.warn('sources', 'delete_not_found', `Source not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Source not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('sources', 'delete', `Deleted source: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Source deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('sources', 'delete_error', `Failed to delete source: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete source', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
