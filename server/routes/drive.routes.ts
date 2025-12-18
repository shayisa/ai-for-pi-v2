/**
 * Google Drive Routes
 *
 * File management endpoints for Google Drive integration.
 * Save, load, list, and delete newsletter files.
 *
 * @module routes/drive
 *
 * ## Endpoints
 * - POST   /api/drive/save              - Save newsletter to Drive
 * - GET    /api/drive/load/:fileId      - Load newsletter from Drive
 * - GET    /api/drive/list              - List newsletters from Drive
 * - DELETE /api/drive/delete/:fileId    - Delete newsletter from Drive
 *
 * ## Migration Notes
 * - Original location: server.ts:2253-2349
 * - Service: googleDriveService
 */
import { Router, Request, Response } from 'express';
import * as googleDriveService from '../services/googleDriveService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * POST /api/drive/save
 *
 * Save newsletter content to Google Drive.
 *
 * @body {string} userEmail - User's email address (required)
 * @body {string} content - Newsletter content to save (required)
 * @body {string} filename - Filename for the saved file (required)
 */
router.post('/save', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { userEmail, content, filename } = req.body;

    if (!userEmail || !content || !filename) {
      logger.warn('drive', 'save_validation_error', 'userEmail, content, and filename are required', { correlationId });
      return sendError(res, 'userEmail, content, and filename are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await googleDriveService.saveNewsletter(userEmail, content, filename);

    if (!result.success) {
      logger.warn('drive', 'save_failed', `Save failed: ${result.error}`, { correlationId });
      return sendError(res, result.error || 'Failed to save to Drive', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('drive', 'save_success', `Saved newsletter to Drive: ${filename}`, { correlationId, userEmail });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('drive', 'save_error', `Failed to save to Drive: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to save to Drive', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * GET /api/drive/load/:fileId
 *
 * Load newsletter content from Google Drive.
 *
 * @param {string} fileId - Drive file ID
 * @query {string} userEmail - User's email address (required)
 */
router.get('/load/:fileId', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { fileId } = req.params;
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('drive', 'load_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await googleDriveService.loadNewsletter(userEmail, fileId);

    if (!result.success) {
      logger.warn('drive', 'load_failed', `Load failed: ${result.error}`, { correlationId, fileId });
      return sendError(res, result.error || 'Failed to load from Drive', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('drive', 'load_success', `Loaded newsletter from Drive: ${fileId}`, { correlationId, userEmail });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('drive', 'load_error', `Failed to load from Drive: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to load from Drive', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * GET /api/drive/list
 *
 * List newsletters from Google Drive.
 *
 * @query {string} userEmail - User's email address (required)
 * @query {number} pageSize - Number of items per page (default: 20)
 * @query {string} pageToken - Token for pagination
 */
router.get('/list', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const userEmail = req.query.userEmail as string;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const pageToken = req.query.pageToken as string | undefined;

    if (!userEmail) {
      logger.warn('drive', 'list_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await googleDriveService.listNewsletters(userEmail, pageSize, pageToken);

    if (!result.success) {
      logger.warn('drive', 'list_failed', `List failed: ${result.error}`, { correlationId });
      return sendError(res, result.error || 'Failed to list newsletters', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('drive', 'list_success', `Listed newsletters from Drive`, { correlationId, userEmail, pageSize });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('drive', 'list_error', `Failed to list newsletters: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to list newsletters', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * DELETE /api/drive/delete/:fileId
 *
 * Delete newsletter from Google Drive.
 *
 * @param {string} fileId - Drive file ID
 * @query {string} userEmail - User's email address (required)
 */
router.delete('/delete/:fileId', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { fileId } = req.params;
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('drive', 'delete_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await googleDriveService.deleteNewsletter(userEmail, fileId);

    if (!result.success) {
      logger.warn('drive', 'delete_failed', `Delete failed: ${result.error}`, { correlationId, fileId });
      return sendError(res, result.error || 'Failed to delete from Drive', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('drive', 'delete_success', `Deleted newsletter from Drive: ${fileId}`, { correlationId, userEmail });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('drive', 'delete_error', `Failed to delete from Drive: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete from Drive', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

export default router;
