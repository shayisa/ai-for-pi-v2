/**
 * OAuth Routes
 *
 * Google OAuth flow management endpoints.
 * Handles authorization, token exchange, and session management.
 *
 * @module routes/oauth
 *
 * ## Endpoints
 * - GET  /api/oauth/google/url      - Get authorization URL
 * - GET  /api/oauth/google/callback - Handle OAuth callback
 * - GET  /api/oauth/google/status   - Check authentication status
 * - POST /api/oauth/google/revoke   - Revoke tokens (sign out)
 *
 * ## Migration Notes
 * - Original location: server.ts:2139-2251
 * - Service: googleOAuthService
 */
import { Router, Request, Response } from 'express';
import * as googleOAuthService from '../services/googleOAuthService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/oauth/google/url
 *
 * Get authorization URL for OAuth consent screen.
 *
 * @query {string} userEmail - User's email address (required)
 */
router.get('/google/url', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('oauth', 'url_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const url = googleOAuthService.getAuthorizationUrl(userEmail);

    if (!url) {
      logger.warn('oauth', 'url_generation_failed', 'Failed to generate authorization URL', { correlationId });
      return sendError(
        res,
        'Failed to generate authorization URL. Please configure Google Client ID and Client Secret in Settings.',
        ErrorCodes.MISSING_API_KEY,
        correlationId
      );
    }

    logger.info('oauth', 'url_generated', `Generated OAuth URL for: ${userEmail}`, { correlationId });
    sendSuccess(res, { url });
  } catch (error) {
    const err = error as Error;
    logger.error('oauth', 'url_error', `Failed to generate authorization URL: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to generate authorization URL', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * GET /api/oauth/google/callback
 *
 * Handle OAuth callback redirect from Google consent screen.
 * Exchanges authorization code for tokens and redirects to frontend.
 *
 * @query {string} code - Authorization code from Google
 * @query {string} state - State parameter containing user email
 * @query {string} error - Error from Google (if user declined)
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    // Handle user declining permissions
    if (error) {
      logger.info('oauth', 'callback_declined', `User declined permissions: ${error}`, { correlationId });
      return res.redirect(`http://localhost:5173/?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      logger.warn('oauth', 'callback_missing_params', 'Missing code or state parameter', { correlationId });
      return res.redirect('http://localhost:5173/?oauth_error=missing_params');
    }

    // Parse state to get user email
    const stateData = googleOAuthService.parseState(state);
    if (!stateData) {
      logger.warn('oauth', 'callback_invalid_state', 'Invalid state parameter', { correlationId });
      return res.redirect('http://localhost:5173/?oauth_error=invalid_state');
    }

    // Exchange code for tokens
    const tokens = await googleOAuthService.exchangeCodeForTokens(code, stateData.userEmail);

    if (!tokens) {
      logger.error('oauth', 'callback_token_exchange_failed', 'Token exchange failed', undefined, { correlationId });
      return res.redirect('http://localhost:5173/?oauth_error=token_exchange_failed');
    }

    logger.info('oauth', 'callback_success', `Successfully authenticated: ${stateData.userEmail}`, { correlationId });

    // Redirect back to frontend with success
    res.redirect(`http://localhost:5173/?oauth_success=true&email=${encodeURIComponent(stateData.userEmail)}`);
  } catch (error) {
    const err = error as Error;
    logger.error('oauth', 'callback_error', `Callback error: ${err.message}`, err, { correlationId });
    res.redirect(`http://localhost:5173/?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * GET /api/oauth/google/status
 *
 * Check OAuth authentication status for a user.
 *
 * @query {string} userEmail - User's email address (required)
 */
router.get('/google/status', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('oauth', 'status_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const hasValidTokens = googleOAuthService.hasValidTokens(userEmail);

    // Get user info if authenticated
    let userInfo = null;
    if (hasValidTokens) {
      userInfo = await googleOAuthService.getUserInfo(userEmail);
    }

    logger.info('oauth', 'status', `OAuth status check for ${userEmail}`, { correlationId, authenticated: hasValidTokens });
    sendSuccess(res, { authenticated: hasValidTokens, userInfo });
  } catch (error) {
    const err = error as Error;
    logger.error('oauth', 'status_error', `Failed to check OAuth status: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to check OAuth status', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * POST /api/oauth/google/revoke
 *
 * Revoke OAuth tokens (sign out of Google).
 *
 * @body {string} userEmail - User's email address (required)
 */
router.post('/google/revoke', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { userEmail } = req.body;

    if (!userEmail) {
      logger.warn('oauth', 'revoke_validation_error', 'userEmail is required', { correlationId });
      return sendError(res, 'userEmail is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    await googleOAuthService.revokeTokens(userEmail);

    logger.info('oauth', 'revoke_success', `Successfully revoked tokens for: ${userEmail}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Successfully disconnected from Google' });
  } catch (error) {
    const err = error as Error;
    logger.error('oauth', 'revoke_error', `Failed to revoke tokens: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to revoke tokens', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

export default router;
