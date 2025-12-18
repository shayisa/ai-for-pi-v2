/**
 * Auth Resolver
 *
 * Resolves authentication requirements and validates credentials.
 * Supports API key authentication and OAuth tokens.
 *
 * ## Purpose
 * - Determine authentication requirements for requests
 * - Validate API keys and OAuth tokens
 * - Provide authentication context to tool handlers
 *
 * ## Usage
 * ```typescript
 * import { resolveAuth, validateApiKey, validateOAuthToken } from './authResolver';
 *
 * const auth = await resolveAuth(req.headers, 'api_key');
 * if (!auth.valid) {
 *   return res.status(401).json({ error: auth.error });
 * }
 * ```
 *
 * @module control-plane/resolver/authResolver
 */

import { logger } from '../feedback';
import { auditTrail } from '../feedback';

// =============================================================================
// AUTH TYPES
// =============================================================================

/**
 * Authentication type
 */
export type AuthType = 'api_key' | 'oauth' | 'none';

/**
 * Authentication result
 */
export interface AuthResult {
  valid: boolean;
  type: AuthType;
  userId?: string;
  userEmail?: string;
  service?: string;
  scopes?: string[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API key validation result
 */
export interface ApiKeyValidation {
  valid: boolean;
  service: string;
  userEmail?: string;
  error?: string;
}

/**
 * OAuth token validation result
 */
export interface OAuthValidation {
  valid: boolean;
  accessToken: string;
  userEmail?: string;
  userName?: string;
  scopes?: string[];
  expiresAt?: Date;
  error?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Auth resolver configuration
 */
interface AuthConfig {
  /** Header name for API key */
  apiKeyHeader: string;
  /** Header name for OAuth token */
  oauthHeader: string;
  /** Custom API key validator */
  apiKeyValidator?: (key: string, service: string) => Promise<ApiKeyValidation>;
  /** Custom OAuth token validator */
  oauthValidator?: (token: string) => Promise<OAuthValidation>;
}

const DEFAULT_CONFIG: AuthConfig = {
  apiKeyHeader: 'x-api-key',
  oauthHeader: 'authorization',
};

let config: AuthConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// HEADER PARSING
// =============================================================================

/**
 * Extract API key from headers
 */
function extractApiKey(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const key = headers[config.apiKeyHeader] || headers[config.apiKeyHeader.toLowerCase()];
  if (typeof key === 'string') {
    return key;
  }
  if (Array.isArray(key) && key.length > 0) {
    return key[0];
  }
  return null;
}

/**
 * Extract OAuth token from headers
 */
function extractOAuthToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const auth = headers[config.oauthHeader] || headers['authorization'];
  if (typeof auth === 'string') {
    // Support "Bearer <token>" format
    if (auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7);
    }
    return auth;
  }
  if (Array.isArray(auth) && auth.length > 0) {
    const token = auth[0];
    if (token.toLowerCase().startsWith('bearer ')) {
      return token.slice(7);
    }
    return token;
  }
  return null;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Default API key validator (stub - should be replaced with actual implementation)
 */
async function defaultApiKeyValidator(
  key: string,
  service: string
): Promise<ApiKeyValidation> {
  // This is a stub - actual validation should be injected via configuration
  // The real validator would check against the database

  if (!key) {
    return {
      valid: false,
      service,
      error: 'API key is required',
    };
  }

  // Basic format validation
  if (key.length < 10) {
    return {
      valid: false,
      service,
      error: 'Invalid API key format',
    };
  }

  // Stub: In production, this would validate against the database
  logger.debug(
    'authResolver',
    'api_key_validate',
    `API key validation (stub) for service: ${service}`,
    { service, keyLength: key.length }
  );

  return {
    valid: true,
    service,
  };
}

/**
 * Default OAuth token validator (stub - should be replaced with actual implementation)
 */
async function defaultOAuthValidator(token: string): Promise<OAuthValidation> {
  // This is a stub - actual validation should be injected via configuration
  // The real validator would verify with Google

  if (!token) {
    return {
      valid: false,
      accessToken: '',
      error: 'OAuth token is required',
    };
  }

  // Stub: In production, this would validate with the OAuth provider
  logger.debug(
    'authResolver',
    'oauth_validate',
    'OAuth token validation (stub)',
    { tokenLength: token.length }
  );

  return {
    valid: true,
    accessToken: token,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Configure the auth resolver
 */
export function configureAuthResolver(options: Partial<AuthConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset auth resolver configuration to defaults
 */
export function resetAuthResolverConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

/**
 * Resolve authentication from request headers
 *
 * @param headers - Request headers
 * @param requiredType - Required authentication type
 * @param options - Additional options
 */
export async function resolveAuth(
  headers: Record<string, string | string[] | undefined>,
  requiredType: AuthType,
  options?: {
    correlationId?: string;
    service?: string;
    ipAddress?: string;
  }
): Promise<AuthResult> {
  // No auth required
  if (requiredType === 'none') {
    return {
      valid: true,
      type: 'none',
    };
  }

  // API key authentication
  if (requiredType === 'api_key') {
    const apiKey = extractApiKey(headers);
    if (!apiKey) {
      logger.warn(
        'authResolver',
        'missing_api_key',
        'API key required but not provided',
        { correlationId: options?.correlationId }
      );

      // Audit the failed auth attempt
      await auditTrail.logAuthFailure({
        correlationId: options?.correlationId,
        authMethod: 'api_key',
        reason: 'Missing API key',
        ipAddress: options?.ipAddress,
      });

      return {
        valid: false,
        type: 'api_key',
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required for this operation',
        },
      };
    }

    const validator = config.apiKeyValidator || defaultApiKeyValidator;
    const validation = await validator(apiKey, options?.service || 'unknown');

    if (!validation.valid) {
      logger.warn(
        'authResolver',
        'invalid_api_key',
        `API key validation failed: ${validation.error}`,
        { correlationId: options?.correlationId, service: validation.service }
      );

      await auditTrail.logAuthFailure({
        correlationId: options?.correlationId,
        userEmail: validation.userEmail,
        authMethod: 'api_key',
        reason: validation.error || 'Invalid API key',
        ipAddress: options?.ipAddress,
      });

      return {
        valid: false,
        type: 'api_key',
        error: {
          code: 'INVALID_API_KEY',
          message: validation.error || 'Invalid API key',
        },
      };
    }

    // Log successful auth
    await auditTrail.logApiKeyValidation({
      correlationId: options?.correlationId,
      userEmail: validation.userEmail,
      service: validation.service,
      success: true,
      ipAddress: options?.ipAddress,
    });

    return {
      valid: true,
      type: 'api_key',
      userEmail: validation.userEmail,
      service: validation.service,
    };
  }

  // OAuth authentication
  if (requiredType === 'oauth') {
    const token = extractOAuthToken(headers);
    if (!token) {
      logger.warn(
        'authResolver',
        'missing_oauth_token',
        'OAuth token required but not provided',
        { correlationId: options?.correlationId }
      );

      await auditTrail.logAuthFailure({
        correlationId: options?.correlationId,
        authMethod: 'oauth',
        reason: 'Missing OAuth token',
        ipAddress: options?.ipAddress,
      });

      return {
        valid: false,
        type: 'oauth',
        error: {
          code: 'MISSING_OAUTH_TOKEN',
          message: 'OAuth authentication is required for this operation',
        },
      };
    }

    const validator = config.oauthValidator || defaultOAuthValidator;
    const validation = await validator(token);

    if (!validation.valid) {
      logger.warn(
        'authResolver',
        'invalid_oauth_token',
        `OAuth token validation failed: ${validation.error}`,
        { correlationId: options?.correlationId }
      );

      await auditTrail.logAuthFailure({
        correlationId: options?.correlationId,
        userEmail: validation.userEmail,
        authMethod: 'oauth',
        reason: validation.error || 'Invalid OAuth token',
        ipAddress: options?.ipAddress,
      });

      return {
        valid: false,
        type: 'oauth',
        error: {
          code: 'INVALID_OAUTH_TOKEN',
          message: validation.error || 'Invalid or expired OAuth token',
        },
      };
    }

    // Log successful auth
    await auditTrail.logAuthSuccess({
      correlationId: options?.correlationId,
      userEmail: validation.userEmail,
      authMethod: 'oauth',
      ipAddress: options?.ipAddress,
    });

    return {
      valid: true,
      type: 'oauth',
      userEmail: validation.userEmail,
      scopes: validation.scopes,
    };
  }

  // Unknown auth type
  return {
    valid: false,
    type: requiredType,
    error: {
      code: 'UNKNOWN_AUTH_TYPE',
      message: `Unknown authentication type: ${requiredType}`,
    },
  };
}

/**
 * Validate an API key for a specific service
 */
export async function validateApiKey(
  apiKey: string,
  service: string,
  options?: { correlationId?: string; ipAddress?: string }
): Promise<ApiKeyValidation> {
  const validator = config.apiKeyValidator || defaultApiKeyValidator;
  const result = await validator(apiKey, service);

  // Audit the validation
  await auditTrail.logApiKeyValidation({
    correlationId: options?.correlationId,
    userEmail: result.userEmail,
    service,
    success: result.valid,
    reason: result.error,
    ipAddress: options?.ipAddress,
  });

  return result;
}

/**
 * Validate an OAuth token
 */
export async function validateOAuthToken(
  token: string,
  options?: { correlationId?: string; ipAddress?: string }
): Promise<OAuthValidation> {
  const validator = config.oauthValidator || defaultOAuthValidator;
  const result = await validator(token);

  if (result.valid) {
    await auditTrail.logAuthSuccess({
      correlationId: options?.correlationId,
      userEmail: result.userEmail,
      authMethod: 'oauth',
      ipAddress: options?.ipAddress,
    });
  } else {
    await auditTrail.logAuthFailure({
      correlationId: options?.correlationId,
      userEmail: result.userEmail,
      authMethod: 'oauth',
      reason: result.error || 'Token validation failed',
      ipAddress: options?.ipAddress,
    });
  }

  return result;
}
