/**
 * Gmail Routes
 *
 * Email sending endpoints via Gmail API.
 * Send individual emails, bulk emails, and check profile.
 *
 * @module routes/gmail
 *
 * ## Endpoints
 * - POST /api/gmail/send        - Send single email
 * - POST /api/gmail/send-bulk   - Send bulk emails
 * - GET  /api/gmail/profile     - Get Gmail profile
 *
 * ## Migration Notes
 * - Original location: server.ts:2351-2415
 * - Service: googleGmailService
 */
import { Router, Request, Response } from 'express';
import * as googleGmailService from '../services/googleGmailService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * POST /api/gmail/send
 *
 * Send a single email via Gmail.
 *
 * @body {string} userEmail - User's email address (required)
 * @body {string} to - Recipient email address (required)
 * @body {string} subject - Email subject (required)
 * @body {string} htmlBody - HTML body content (required)
 */
router.post('/send', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { userEmail, to, subject, htmlBody } = req.body;

    if (!userEmail || !to || !subject || !htmlBody) {
      logger.warn('gmail', 'send_validation_error', 'userEmail, to, subject, and htmlBody are required', {
        correlationId,
      });
      return sendError(
        res,
        'userEmail, to, subject, and htmlBody are required',
        ErrorCodes.VALIDATION_ERROR,
        correlationId
      );
    }

    const result = await googleGmailService.sendEmail(userEmail, { to, subject, htmlBody });

    if (!result.success) {
      logger.warn('gmail', 'send_failed', `Send failed: ${result.error}`, { correlationId, to });
      return sendError(res, result.error || 'Failed to send email', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('gmail', 'send_success', `Sent email to: ${to}`, { correlationId, userEmail });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('gmail', 'send_error', `Failed to send email: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to send email', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * POST /api/gmail/send-bulk
 *
 * Send bulk emails via Gmail.
 *
 * @body {string} userEmail - User's email address (required)
 * @body {string[]} recipients - Array of recipient email addresses (required)
 * @body {string} subject - Email subject (required)
 * @body {string} htmlBody - HTML body content (required)
 */
router.post('/send-bulk', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { userEmail, recipients, subject, htmlBody } = req.body;

    if (!userEmail || !recipients || !Array.isArray(recipients) || !subject || !htmlBody) {
      logger.warn('gmail', 'send_bulk_validation_error', 'userEmail, recipients (array), subject, and htmlBody are required', {
        correlationId,
      });
      return sendError(
        res,
        'userEmail, recipients (array), subject, and htmlBody are required',
        ErrorCodes.VALIDATION_ERROR,
        correlationId
      );
    }

    const result = await googleGmailService.sendBulkEmails(userEmail, recipients, subject, htmlBody);

    logger.info('gmail', 'send_bulk_complete', `Bulk email complete: ${recipients.length} recipients`, {
      correlationId,
      userEmail,
      recipientCount: recipients.length,
    });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('gmail', 'send_bulk_error', `Failed to send bulk emails: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to send bulk emails', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * GET /api/gmail/profile
 *
 * Get Gmail profile for authenticated user.
 *
 * @query {string} userEmail - User's email address (required)
 */
router.get('/profile', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('gmail', 'profile_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await googleGmailService.getProfile(userEmail);

    if (!result.success) {
      logger.warn('gmail', 'profile_failed', `Profile fetch failed: ${result.error}`, { correlationId });
      return sendError(res, result.error || 'Failed to get Gmail profile', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('gmail', 'profile_success', `Retrieved Gmail profile for: ${userEmail}`, { correlationId });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('gmail', 'profile_error', `Failed to get Gmail profile: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to get Gmail profile', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

export default router;
