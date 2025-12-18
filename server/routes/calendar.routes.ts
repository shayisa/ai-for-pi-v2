/**
 * Calendar Routes
 *
 * CRUD operations for content calendar entries.
 * Used for planning newsletter publication schedules.
 *
 * @module routes/calendar
 *
 * ## Endpoints
 * - GET    /api/calendar                  - List entries with date filters
 * - GET    /api/calendar/month/:year/:month - Get entries by month
 * - GET    /api/calendar/upcoming         - Get upcoming entries
 * - GET    /api/calendar/:id              - Get entry by ID
 * - POST   /api/calendar                  - Create entry
 * - PUT    /api/calendar/:id              - Update entry
 * - POST   /api/calendar/:id/link         - Link newsletter to entry
 * - POST   /api/calendar/:id/unlink       - Unlink newsletter from entry
 * - DELETE /api/calendar/:id              - Delete entry
 *
 * ## Migration Notes
 * - Original location: server.ts:2684-2846
 * - Service: calendarDbService
 */
import { Router, Request, Response } from 'express';
import * as calendarDbService from '../services/calendarDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/calendar
 *
 * List calendar entries with optional date range filter.
 *
 * @query {string} startDate - Filter start date
 * @query {string} endDate - Filter end date
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { startDate, endDate } = req.query;
    const entries = calendarDbService.getEntries(
      startDate as string | undefined,
      endDate as string | undefined
    );

    logger.info('calendar', 'list', `Listed ${entries.length} entries`, { correlationId });
    sendSuccess(res, { entries, count: entries.length });
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'list_error', `Failed to list entries: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to get calendar entries', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/calendar/month/:year/:month
 *
 * Get entries for a specific month.
 *
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1-12)
 */
router.get('/month/:year/:month', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      logger.warn('calendar', 'month_validation_error', 'Invalid year or month', { correlationId, year, month });
      return sendError(res, 'Invalid year or month', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const entries = calendarDbService.getEntriesByMonth(year, month);

    logger.info('calendar', 'get_month', `Got ${entries.length} entries for ${year}-${month}`, { correlationId });
    sendSuccess(res, { entries, count: entries.length });
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'get_month_error', `Failed to get month entries: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to get calendar entries', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/calendar/upcoming
 *
 * Get upcoming entries within specified days.
 *
 * @query {number} days - Number of days to look ahead (default: 7)
 */
router.get('/upcoming', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const entries = calendarDbService.getUpcomingEntries(days);

    logger.info('calendar', 'get_upcoming', `Got ${entries.length} upcoming entries`, { correlationId, days });
    sendSuccess(res, { entries, count: entries.length });
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'get_upcoming_error', `Failed to get upcoming entries: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to get upcoming entries', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/calendar/:id/link
 *
 * Link a newsletter to a calendar entry.
 *
 * @param {string} id - Calendar entry ID
 * @body {string} newsletterId - Newsletter ID to link
 */
router.post('/:id/link', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { newsletterId } = req.body;

    if (!newsletterId) {
      logger.warn('calendar', 'link_validation_error', 'newsletterId is required', { correlationId });
      return sendError(res, 'newsletterId is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const updated = calendarDbService.linkNewsletter(req.params.id, newsletterId);

    if (!updated) {
      logger.warn('calendar', 'link_not_found', `Entry not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Calendar entry not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('calendar', 'link', `Linked newsletter ${newsletterId} to entry ${req.params.id}`, { correlationId });
    sendSuccess(res, updated);
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'link_error', `Failed to link newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to link newsletter', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/calendar/:id/unlink
 *
 * Unlink newsletter from a calendar entry.
 *
 * @param {string} id - Calendar entry ID
 */
router.post('/:id/unlink', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updated = calendarDbService.unlinkNewsletter(req.params.id);

    if (!updated) {
      logger.warn('calendar', 'unlink_not_found', `Entry not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Calendar entry not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('calendar', 'unlink', `Unlinked newsletter from entry ${req.params.id}`, { correlationId });
    sendSuccess(res, updated);
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'unlink_error', `Failed to unlink newsletter: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to unlink newsletter', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/calendar/:id
 *
 * Get a calendar entry by ID.
 *
 * @param {string} id - Calendar entry ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const entry = calendarDbService.getEntryById(req.params.id);

    if (!entry) {
      logger.warn('calendar', 'not_found', `Entry not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Calendar entry not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('calendar', 'get', `Retrieved entry: ${req.params.id}`, { correlationId });
    sendSuccess(res, entry);
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'get_error', `Failed to get entry: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to get calendar entry', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/calendar
 *
 * Create a new calendar entry.
 *
 * @body {string} title - Entry title (required)
 * @body {string} scheduledDate - Scheduled date (required)
 * @body {string} description - Entry description
 * @body {string[]} topics - Topics for this entry
 * @body {string} status - Entry status ('planned' | 'in_progress' | 'completed')
 * @body {object} settings - Additional settings
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { title, scheduledDate, description, topics, status, settings } = req.body;

    if (!title || !scheduledDate) {
      logger.warn('calendar', 'validation_error', 'title and scheduledDate are required', { correlationId });
      return sendError(res, 'title and scheduledDate are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const entry = calendarDbService.createEntry(
      title,
      scheduledDate,
      description || '',
      topics || [],
      status || 'planned',
      settings || null
    );

    logger.info('calendar', 'create', `Created entry: ${entry.id}`, { correlationId });
    sendSuccess(res, entry, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'create_error', `Failed to create entry: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create calendar entry', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * PUT /api/calendar/:id
 *
 * Update a calendar entry.
 *
 * @param {string} id - Calendar entry ID
 * @body {object} updates - Fields to update
 */
router.put('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { title, scheduledDate, description, topics, status, settings } = req.body;

    const updated = calendarDbService.updateEntry(req.params.id, {
      title,
      scheduledDate,
      description,
      topics,
      status,
      settings,
    });

    if (!updated) {
      logger.warn('calendar', 'update_not_found', `Entry not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Calendar entry not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('calendar', 'update', `Updated entry: ${req.params.id}`, { correlationId });
    sendSuccess(res, updated);
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'update_error', `Failed to update entry: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update calendar entry', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/calendar/:id
 *
 * Delete a calendar entry.
 *
 * @param {string} id - Calendar entry ID
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = calendarDbService.deleteEntry(req.params.id);

    if (!success) {
      logger.warn('calendar', 'delete_not_found', `Entry not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Calendar entry not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('calendar', 'delete', `Deleted entry: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Calendar entry deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('calendar', 'delete_error', `Failed to delete entry: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete calendar entry', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
