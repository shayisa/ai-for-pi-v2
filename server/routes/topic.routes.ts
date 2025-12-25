/**
 * Topic Routes
 *
 * CRUD operations for saved topics.
 * Topics can be saved from suggestions, trending, or manually entered.
 *
 * @module routes/topic
 *
 * ## Endpoints
 * - GET    /api/topics              - List all topics
 * - GET    /api/topics/search/:query - Search topics by title
 * - GET    /api/topics/count        - Get topic count
 * - GET    /api/topics/category/:category - Get topics by category
 * - GET    /api/topics/:id          - Get topic by ID
 * - POST   /api/topics              - Create topic
 * - PUT    /api/topics/:id          - Update topic
 * - DELETE /api/topics/:id          - Delete topic
 * - POST   /api/topics/:id/favorite - Toggle favorite status
 *
 * ## Phase: Topic/Source Persistence
 */
import { Router, Request, Response } from 'express';
import * as topicDbService from '../services/topicDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/topics
 *
 * List all saved topics.
 * Optional query param: limit (default 100)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const topics = topicDbService.getAllTopics(limit);

    logger.info('topics', 'list', `Listed ${topics.length} topics`, { correlationId });
    sendSuccess(res, { topics });
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'list_error', `Failed to list topics: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch topics', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/topics/search/:query
 *
 * Search topics by title.
 * NOTE: This route MUST come before /:id to avoid conflicts.
 *
 * @param {string} query - Search query
 */
router.get('/search/:query', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const query = req.params.query;
    const limit = parseInt(req.query.limit as string) || 20;
    const topics = topicDbService.searchTopics(query, limit);

    logger.info('topics', 'search', `Searched topics for "${query}", found ${topics.length}`, { correlationId });
    sendSuccess(res, { topics });
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'search_error', `Failed to search topics: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to search topics', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/topics/count
 *
 * Get total count of saved topics.
 */
router.get('/count', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const count = topicDbService.getTopicCount();

    logger.info('topics', 'count', `Topic count: ${count}`, { correlationId });
    sendSuccess(res, { count });
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'count_error', `Failed to get topic count: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to get topic count', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/topics/category/:category
 *
 * Get topics by category.
 *
 * @param {string} category - One of: 'suggested', 'trending', 'manual'
 */
router.get('/category/:category', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const category = req.params.category as 'suggested' | 'trending' | 'manual';
    const limit = parseInt(req.query.limit as string) || 50;
    const topics = topicDbService.getTopicsByCategory(category, limit);

    logger.info('topics', 'list_by_category', `Listed ${topics.length} topics in category: ${category}`, { correlationId });
    sendSuccess(res, { topics });
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'list_by_category_error', `Failed to list topics by category: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch topics by category', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/topics/:id/favorite
 *
 * Toggle favorite status for a topic.
 *
 * @param {string} id - Topic ID
 */
router.post('/:id/favorite', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const topic = topicDbService.toggleTopicFavorite(req.params.id);

    if (!topic) {
      logger.warn('topics', 'favorite_not_found', `Topic not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Topic not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('topics', 'toggle_favorite', `Toggled favorite for topic: ${req.params.id}`, { correlationId, isFavorite: topic.isFavorite });
    sendSuccess(res, topic);
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'favorite_error', `Failed to toggle favorite: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to toggle favorite', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/topics/:id
 *
 * Get a topic by ID.
 *
 * @param {string} id - Topic ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const topic = topicDbService.getTopicById(req.params.id);

    if (!topic) {
      logger.warn('topics', 'not_found', `Topic not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Topic not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('topics', 'get', `Retrieved topic: ${req.params.id}`, { correlationId });
    sendSuccess(res, topic);
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'get_error', `Failed to get topic: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch topic', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/topics/batch
 *
 * Phase 15.5: Batch create topics.
 * Used for auto-saving suggested topics.
 * Skips duplicates by title (case-insensitive).
 *
 * @body {Array} topics - Array of topic objects
 * @body {string} topics[].title - Topic title (required)
 * @body {string} topics[].category - One of: 'suggested', 'trending', 'manual'
 * @body {string} topics[].sourceUrl - Optional source URL
 * @body {string} topics[].description - Optional description
 */
router.post('/batch', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { topics } = req.body;

    if (!topics || !Array.isArray(topics)) {
      logger.warn('topics', 'batch_validation_error', 'topics array is required', { correlationId });
      return sendError(res, 'topics array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (topics.length === 0) {
      logger.info('topics', 'batch_empty', 'Empty topics array provided', { correlationId });
      return sendSuccess(res, { created: [], duplicateCount: 0 });
    }

    // Validate that all topics have titles
    const invalidTopics = topics.filter((t: { title?: string }) => !t.title);
    if (invalidTopics.length > 0) {
      logger.warn('topics', 'batch_validation_error', `${invalidTopics.length} topics missing title`, { correlationId });
      return sendError(res, 'All topics must have a title', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = topicDbService.createTopicsBatch(topics);

    logger.info('topics', 'batch_create', `Batch created ${result.created.length} topics, ${result.duplicateCount} duplicates skipped`, {
      correlationId,
      createdCount: result.created.length,
      duplicateCount: result.duplicateCount,
    });

    sendSuccess(res, result, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'batch_create_error', `Failed to batch create topics: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to batch create topics', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/topics
 *
 * Create a new saved topic.
 *
 * @body {string} title - Topic title (required)
 * @body {string} description - Optional description
 * @body {string} category - One of: 'suggested', 'trending', 'manual'
 * @body {string} sourceUrl - Optional source URL
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { title, description, category, sourceUrl } = req.body;

    if (!title) {
      logger.warn('topics', 'validation_error', 'title is required', { correlationId });
      return sendError(res, 'title is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const topic = topicDbService.createTopic({
      title,
      description,
      category: category || 'manual',
      sourceUrl,
    });

    logger.info('topics', 'create', `Created topic: ${topic.id}`, { correlationId, topicTitle: title, category: topic.category });
    sendSuccess(res, topic, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'create_error', `Failed to create topic: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create topic', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * PUT /api/topics/:id
 *
 * Update a topic.
 *
 * @param {string} id - Topic ID
 * @body {object} updates - Fields to update (title, description, category, sourceUrl)
 */
router.put('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updates = req.body;
    const topic = topicDbService.updateTopic(req.params.id, updates);

    if (!topic) {
      logger.warn('topics', 'update_not_found', `Topic not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Topic not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('topics', 'update', `Updated topic: ${req.params.id}`, { correlationId });
    sendSuccess(res, topic);
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'update_error', `Failed to update topic: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update topic', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/topics/:id
 *
 * Delete a topic.
 *
 * @param {string} id - Topic ID
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = topicDbService.deleteTopic(req.params.id);

    if (!success) {
      logger.warn('topics', 'delete_not_found', `Topic not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Topic not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('topics', 'delete', `Deleted topic: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Topic deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('topics', 'delete_error', `Failed to delete topic: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete topic', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
