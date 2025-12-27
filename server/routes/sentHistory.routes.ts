/**
 * Sent History Routes
 *
 * API endpoints for viewing sent newsletter history with stats.
 *
 * Phase 18: Enhanced Send Email with Recipient Selection & Sent History
 *
 * @module routes/sentHistory
 *
 * ## Endpoints
 * - GET  /api/sent-history              - List sent newsletters with stats
 * - GET  /api/sent-history/stats        - Get summary statistics
 * - GET  /api/sent-history/:id          - Get detailed sent info for a newsletter
 */
import { Router, Request, Response } from 'express';
import * as sentHistoryDbService from '../services/sentHistoryDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/sent-history
 *
 * List sent newsletters with stats and recipient info.
 * Supports pagination and filtering.
 *
 * @query {number} limit - Max results (default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 * @query {string} listId - Filter by subscriber list ID
 * @query {string} dateFrom - Filter from date (ISO string)
 * @query {string} dateTo - Filter to date (ISO string)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const options = {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      listId: req.query.listId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = sentHistoryDbService.getSentHistory(options);

    logger.info('sent_history', 'list', `Retrieved ${result.items.length} sent history items`, {
      correlationId,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });

    sendSuccess(res, result, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('sent_history', 'list_error', `Failed to get sent history: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch sent history', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/sent-history/stats
 *
 * Get summary statistics for sent newsletters.
 */
router.get('/stats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const stats = sentHistoryDbService.getSentHistoryStats();

    logger.info('sent_history', 'stats', 'Retrieved sent history stats', {
      correlationId,
      totalSent: stats.totalSent,
    });

    sendSuccess(res, stats, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('sent_history', 'stats_error', `Failed to get stats: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch stats', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/sent-history/:id
 *
 * Get detailed sent info for a specific newsletter.
 * Includes full newsletter content for preview.
 *
 * @param {string} id - Newsletter ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const { id } = req.params;

  try {
    const detail = sentHistoryDbService.getSentHistoryDetail(id);

    if (!detail) {
      logger.warn('sent_history', 'not_found', `Sent history not found for newsletter: ${id}`, { correlationId });
      return sendError(res, 'Sent history not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('sent_history', 'detail', `Retrieved sent history detail for: ${id}`, {
      correlationId,
      newsletterId: id,
    });

    sendSuccess(res, detail, correlationId);
  } catch (error) {
    const err = error as Error;
    logger.error('sent_history', 'detail_error', `Failed to get detail: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch sent history detail', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

export default router;
