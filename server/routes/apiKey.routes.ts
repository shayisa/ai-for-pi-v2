/**
 * API Key Routes
 *
 * Management endpoints for API keys (Claude, Stability, Brave, Google).
 * Includes validation for each service type.
 *
 * @module routes/apiKey
 *
 * ## Endpoints
 * - GET    /api/keys                        - List API key statuses for user
 * - POST   /api/keys                        - Save an API key
 * - DELETE /api/keys/:service               - Delete an API key
 * - POST   /api/keys/:service/validate      - Validate an API key
 * - GET    /api/keys/google/credentials     - Get Google credentials for frontend
 *
 * ## Migration Notes
 * - Original location: server.ts:2135-2337
 * - Service: apiKeyDbService
 * - External: Claude API, Stability AI API, Brave API for validation
 */
import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import * as apiKeyDbService from '../services/apiKeyDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

// Valid service types for API keys
const VALID_SERVICES = ['claude', 'stability', 'brave', 'google_api_key', 'google_client_id', 'google_client_secret'];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate Claude API key by making a minimal API call.
 */
async function validateClaudeApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    return true;
  } catch (error) {
    logger.warn('api_keys', 'validate_claude_failed', 'Claude API key validation failed', { error });
    return false;
  }
}

/**
 * Validate Stability API key by checking account endpoint.
 */
async function validateStabilityApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.stability.ai/v1/user/account', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    logger.warn('api_keys', 'validate_stability_failed', 'Stability API key validation failed', { error });
    return false;
  }
}

/**
 * Validate Brave API key by making a test search.
 */
async function validateBraveApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.search.brave.com/res/v1/web/search?q=test&count=1', {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
    return response.ok;
  } catch (error) {
    logger.warn('api_keys', 'validate_brave_failed', 'Brave API key validation failed', { error });
    return false;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/keys
 *
 * List all API key statuses for a user.
 *
 * @query {string} userEmail - User's email address (required)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('api_keys', 'list_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const statuses = apiKeyDbService.listApiKeyStatuses(userEmail);

    logger.info('api_keys', 'list', `Listed API key statuses for: ${userEmail}`, { correlationId });
    sendSuccess(res, { statuses });
  } catch (error) {
    const err = error as Error;
    logger.error('api_keys', 'list_error', `Failed to list API key statuses: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to list API key statuses', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/keys
 *
 * Save an API key.
 *
 * @body {string} userEmail - User's email address (required)
 * @body {string} service - Service type (required)
 * @body {string} key - API key value (required)
 */
router.post('/', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { userEmail, service, key } = req.body;

    if (!userEmail || !service || !key) {
      logger.warn('api_keys', 'save_validation_error', 'userEmail, service, and key are required', { correlationId });
      return sendError(res, 'userEmail, service, and key are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (!VALID_SERVICES.includes(service)) {
      logger.warn('api_keys', 'save_invalid_service', `Invalid service: ${service}`, { correlationId });
      return sendError(
        res,
        `Invalid service. Must be one of: ${VALID_SERVICES.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR,
        correlationId
      );
    }

    const record = apiKeyDbService.saveApiKey(userEmail, service, key);

    logger.info('api_keys', 'save', `Saved API key for service: ${service}`, { correlationId, userEmail });
    sendSuccess(res, { success: true, record: { service: record.service, isValid: record.isValid } });
  } catch (error) {
    const err = error as Error;
    logger.error('api_keys', 'save_error', `Failed to save API key: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to save API key', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/keys/:service
 *
 * Delete an API key.
 *
 * @param {string} service - Service type
 * @query {string} userEmail - User's email address (required)
 */
router.delete('/:service', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { service } = req.params;
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('api_keys', 'delete_validation_error', 'userEmail query parameter is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const success = apiKeyDbService.deleteApiKey(userEmail, service as apiKeyDbService.ServiceType);

    if (!success) {
      logger.warn('api_keys', 'delete_not_found', `API key not found for service: ${service}`, { correlationId });
      return sendError(res, 'API key not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('api_keys', 'delete', `Deleted API key for service: ${service}`, { correlationId, userEmail });
    sendSuccess(res, { success: true, message: 'API key deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('api_keys', 'delete_error', `Failed to delete API key: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete API key', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/keys/:service/validate
 *
 * Validate an API key for a specific service.
 *
 * @param {string} service - Service type
 * @body {string} userEmail - User's email address (required)
 */
router.post('/:service/validate', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { service } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      logger.warn('api_keys', 'validate_validation_error', 'userEmail is required', { correlationId });
      return sendError(res, 'userEmail is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const apiKey = apiKeyDbService.getApiKey(userEmail, service as apiKeyDbService.ServiceType);

    if (!apiKey) {
      logger.warn('api_keys', 'validate_not_found', `API key not found for service: ${service}`, { correlationId });
      return sendError(res, 'API key not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    let isValid = false;

    // Validate based on service type
    switch (service) {
      case 'claude':
        isValid = await validateClaudeApiKey(apiKey);
        break;
      case 'stability':
        isValid = await validateStabilityApiKey(apiKey);
        break;
      case 'brave':
        isValid = await validateBraveApiKey(apiKey);
        break;
      case 'google_api_key':
        // Google API keys start with 'AIza'
        isValid = apiKey.startsWith('AIza');
        break;
      case 'google_client_id':
        // Google Client IDs contain '.apps.googleusercontent.com'
        isValid = apiKey.includes('.apps.googleusercontent.com');
        break;
      case 'google_client_secret':
        // Google Client Secrets start with 'GOCSPX-'
        isValid = apiKey.startsWith('GOCSPX-');
        break;
      default:
        logger.warn('api_keys', 'validate_invalid_service', `Invalid service type: ${service}`, { correlationId });
        return sendError(res, 'Invalid service type', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Update validation status in database
    apiKeyDbService.updateValidationStatus(userEmail, service as apiKeyDbService.ServiceType, isValid);

    logger.info('api_keys', 'validate', `Validated API key for service: ${service}`, { correlationId, isValid });
    sendSuccess(res, { isValid });
  } catch (error) {
    const err = error as Error;
    logger.error('api_keys', 'validate_error', `Failed to validate API key: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to validate API key', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/keys/google/credentials
 *
 * Get Google credentials for frontend initialization.
 * NOTE: This endpoint exposes Google API Key and Client ID which are semi-public
 * (they're embedded in frontend code anyway). The actual OAuth flow still requires
 * user consent and the redirect URI must match what's configured in Google Cloud Console.
 *
 * @query {string} userEmail - User's email address (required)
 */
router.get('/google/credentials', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const userEmail = req.query.userEmail as string;

    if (!userEmail) {
      logger.warn('api_keys', 'google_credentials_validation_error', 'userEmail query parameter is required', {
        correlationId,
      });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const apiKey = apiKeyDbService.getApiKey(userEmail, 'google_api_key');
    const clientId = apiKeyDbService.getApiKey(userEmail, 'google_client_id');

    if (!apiKey && !clientId) {
      logger.info('api_keys', 'google_credentials_not_configured', `No Google credentials for: ${userEmail}`, {
        correlationId,
      });
      return sendSuccess(res, { configured: false, apiKey: null, clientId: null });
    }

    logger.info('api_keys', 'google_credentials', `Retrieved Google credentials for: ${userEmail}`, { correlationId });
    sendSuccess(res, {
      configured: !!(apiKey && clientId),
      apiKey: apiKey || null,
      clientId: clientId || null,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('api_keys', 'google_credentials_error', `Failed to fetch Google credentials: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch Google credentials', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
