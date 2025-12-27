/**
 * Subscriber Routes
 *
 * CRUD operations for subscribers and mailing lists.
 *
 * @module routes/subscriber
 *
 * ## Subscriber Endpoints
 * - GET    /api/subscribers              - List subscribers with filters
 * - GET    /api/subscribers/:email       - Get subscriber by email
 * - POST   /api/subscribers              - Add new subscriber
 * - PUT    /api/subscribers/:email       - Update subscriber
 * - DELETE /api/subscribers/:email       - Delete (soft) subscriber
 * - DELETE /api/subscribers/:email/hard  - Hard delete (permanent) subscriber
 * - POST   /api/subscribers/import       - Bulk import subscribers
 *
 * ## List Endpoints
 * - GET    /api/lists                    - List all mailing lists
 * - GET    /api/lists/:id                - Get list by ID
 * - POST   /api/lists                    - Create new list
 * - PUT    /api/lists/:id                - Update list
 * - DELETE /api/lists/:id                - Delete list
 * - POST   /api/lists/:id/subscribers    - Add subscriber to list
 * - DELETE /api/lists/:id/subscribers/:email - Remove subscriber from list
 * - GET    /api/lists/:id/subscribers    - Get subscribers in list
 *
 * ## Migration Notes
 * - Original location: server.ts:2125-2365
 * - Service: subscriberDbService
 */
import { Router, Request, Response } from 'express';
import * as subscriberDbService from '../services/subscriberDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const subscriberRouter = Router();
const listRouter = Router();

// =============================================================================
// SUBSCRIBER ROUTES
// =============================================================================

/**
 * GET /api/subscribers
 *
 * List all subscribers with optional filters.
 *
 * @query {string} status - Filter by status ('active' | 'inactive' | 'all')
 * @query {string} listId - Filter by list ID
 */
subscriberRouter.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const status = req.query.status as 'active' | 'inactive' | 'all' | undefined;
    const listId = req.query.listId as string | undefined;

    const subscribers = subscriberDbService.getSubscribers({ status, listId });

    logger.info('subscribers', 'list', `Listed ${subscribers.length} subscribers`, { correlationId, status, listId });
    sendSuccess(res, { subscribers, count: subscribers.length });
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'list_error', `Failed to list subscribers: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch subscribers', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/subscribers/import
 *
 * Bulk import subscribers from CSV or array.
 * NOTE: Must be before /:email route to avoid conflict.
 *
 * @body {object[]} subscribers - Array of subscriber objects
 */
subscriberRouter.post('/import', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { subscribers } = req.body;

    if (!Array.isArray(subscribers)) {
      logger.warn('subscribers', 'import_validation_error', 'subscribers array is required', { correlationId });
      return sendError(res, 'subscribers array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = subscriberDbService.importSubscribers(subscribers);

    logger.info('subscribers', 'import', `Imported subscribers`, {
      correlationId,
      added: result.added,
      skipped: result.skipped,
    });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'import_error', `Failed to import subscribers: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to import subscribers', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/subscribers/:email/hard
 *
 * Hard delete (permanently remove) a subscriber.
 * NOTE: Must be before /:email route to avoid conflict.
 *
 * @param {string} email - Subscriber email
 */
subscriberRouter.delete('/:email/hard', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = subscriberDbService.hardDeleteSubscriber(req.params.email);

    if (!success) {
      logger.warn('subscribers', 'hard_delete_not_found', `Subscriber not found: ${req.params.email}`, { correlationId });
      return sendError(res, 'Subscriber not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('subscribers', 'hard_delete', `Permanently deleted subscriber: ${req.params.email}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Subscriber permanently deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'hard_delete_error', `Failed to hard delete subscriber: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete subscriber', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/subscribers/:email
 *
 * Get a subscriber by email.
 *
 * @param {string} email - Subscriber email
 */
subscriberRouter.get('/:email', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const subscriber = subscriberDbService.getSubscriberByEmail(req.params.email);

    if (!subscriber) {
      logger.warn('subscribers', 'not_found', `Subscriber not found: ${req.params.email}`, { correlationId });
      return sendError(res, 'Subscriber not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('subscribers', 'get', `Retrieved subscriber: ${req.params.email}`, { correlationId });
    sendSuccess(res, subscriber);
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'get_error', `Failed to get subscriber: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch subscriber', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/subscribers
 *
 * Add a new subscriber.
 *
 * @body {string} email - Subscriber email (required)
 * @body {string} name - Subscriber name
 * @body {string} status - Status ('active' | 'inactive')
 * @body {string} lists - Comma-separated list IDs
 * @body {string} source - Subscription source
 */
subscriberRouter.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { email, name, status, lists, source } = req.body;

    if (!email) {
      logger.warn('subscribers', 'validation_error', 'Email is required', { correlationId });
      return sendError(res, 'Email is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const subscriber = subscriberDbService.addSubscriber({
      email,
      name,
      status: status || 'active',
      lists: lists || '',
      source: source || 'manual',
    });

    logger.info('subscribers', 'create', `Created subscriber: ${email}`, { correlationId });
    sendSuccess(res, subscriber, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'create_error', `Failed to add subscriber: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to add subscriber', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * PUT /api/subscribers/:email
 *
 * Update a subscriber.
 *
 * @param {string} email - Subscriber email
 * @body {object} updates - Fields to update
 */
subscriberRouter.put('/:email', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updates = req.body;
    const subscriber = subscriberDbService.updateSubscriber(req.params.email, updates);

    if (!subscriber) {
      logger.warn('subscribers', 'update_not_found', `Subscriber not found: ${req.params.email}`, { correlationId });
      return sendError(res, 'Subscriber not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('subscribers', 'update', `Updated subscriber: ${req.params.email}`, { correlationId });
    sendSuccess(res, subscriber);
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'update_error', `Failed to update subscriber: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update subscriber', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/subscribers/:email
 *
 * Delete (soft delete/deactivate) a subscriber.
 *
 * @param {string} email - Subscriber email
 */
subscriberRouter.delete('/:email', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = subscriberDbService.deleteSubscriber(req.params.email);

    if (!success) {
      logger.warn('subscribers', 'delete_not_found', `Subscriber not found: ${req.params.email}`, { correlationId });
      return sendError(res, 'Subscriber not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('subscribers', 'delete', `Deactivated subscriber: ${req.params.email}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Subscriber deactivated' });
  } catch (error) {
    const err = error as Error;
    logger.error('subscribers', 'delete_error', `Failed to delete subscriber: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete subscriber', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

// =============================================================================
// LIST ROUTES
// =============================================================================

/**
 * GET /api/lists
 *
 * List all mailing lists.
 */
listRouter.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const lists = subscriberDbService.getLists();

    logger.info('lists', 'list', `Listed ${lists.length} lists`, { correlationId });
    sendSuccess(res, { lists, count: lists.length });
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'list_error', `Failed to list lists: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch lists', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/lists/:id/subscribers
 *
 * Get subscribers in a list.
 * NOTE: Must be before /:id route to avoid conflict.
 *
 * @param {string} id - List ID
 */
listRouter.get('/:id/subscribers', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const subscribers = subscriberDbService.getSubscribersByList(req.params.id);

    logger.info('lists', 'get_subscribers', `Got ${subscribers.length} subscribers for list: ${req.params.id}`, {
      correlationId,
    });
    sendSuccess(res, { subscribers, count: subscribers.length });
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'get_subscribers_error', `Failed to get list subscribers: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch list subscribers', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * GET /api/lists/:id
 *
 * Get a list by ID.
 *
 * @param {string} id - List ID
 */
listRouter.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const list = subscriberDbService.getListById(req.params.id);

    if (!list) {
      logger.warn('lists', 'not_found', `List not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'List not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('lists', 'get', `Retrieved list: ${req.params.id}`, { correlationId });
    sendSuccess(res, list);
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'get_error', `Failed to get list: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch list', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/lists
 *
 * Create a new mailing list.
 *
 * @body {string} name - List name (required)
 * @body {string} description - List description
 */
listRouter.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { name, description } = req.body;

    if (!name) {
      logger.warn('lists', 'validation_error', 'List name is required', { correlationId });
      return sendError(res, 'List name is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const list = subscriberDbService.createList(name, description);

    logger.info('lists', 'create', `Created list: ${list.id}`, { correlationId, listName: name });
    sendSuccess(res, list, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'create_error', `Failed to create list: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create list', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * PUT /api/lists/:id
 *
 * Update a list.
 *
 * @param {string} id - List ID
 * @body {object} updates - Fields to update
 */
listRouter.put('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updates = req.body;
    const list = subscriberDbService.updateList(req.params.id, updates);

    if (!list) {
      logger.warn('lists', 'update_not_found', `List not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'List not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('lists', 'update', `Updated list: ${req.params.id}`, { correlationId });
    sendSuccess(res, list);
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'update_error', `Failed to update list: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update list', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/lists/:id
 *
 * Delete a list.
 *
 * @param {string} id - List ID
 */
listRouter.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = subscriberDbService.deleteList(req.params.id);

    if (!success) {
      logger.warn('lists', 'delete_not_found', `List not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'List not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('lists', 'delete', `Deleted list: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'List deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'delete_error', `Failed to delete list: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete list', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/lists/:id/subscribers
 *
 * Add a subscriber to a list.
 *
 * @param {string} id - List ID
 * @body {string} email - Subscriber email
 */
listRouter.post('/:id/subscribers', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { email } = req.body;

    if (!email) {
      logger.warn('lists', 'add_subscriber_validation_error', 'Email is required', { correlationId });
      return sendError(res, 'Email is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const success = subscriberDbService.addSubscriberToList(email, req.params.id);

    if (!success) {
      logger.warn('lists', 'add_subscriber_not_found', 'Subscriber or list not found', { correlationId });
      return sendError(res, 'Subscriber or list not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('lists', 'add_subscriber', `Added ${email} to list: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Subscriber added to list' });
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'add_subscriber_error', `Failed to add subscriber to list: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to add subscriber to list', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * DELETE /api/lists/:id/subscribers/:email
 *
 * Remove a subscriber from a list.
 *
 * @param {string} id - List ID
 * @param {string} email - Subscriber email
 */
listRouter.delete('/:id/subscribers/:email', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = subscriberDbService.removeSubscriberFromList(req.params.email, req.params.id);

    if (!success) {
      logger.warn('lists', 'remove_subscriber_not_found', `Subscriber not found in list`, { correlationId });
      return sendError(res, 'Subscriber not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('lists', 'remove_subscriber', `Removed ${req.params.email} from list: ${req.params.id}`, {
      correlationId,
    });
    sendSuccess(res, { success: true, message: 'Subscriber removed from list' });
  } catch (error) {
    const err = error as Error;
    logger.error('lists', 'remove_subscriber_error', `Failed to remove subscriber from list: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to remove subscriber from list', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

export { subscriberRouter, listRouter };
