/**
 * Output Validator
 *
 * Validates and sanitizes outgoing response data.
 * Ensures consistent response format and removes sensitive information.
 *
 * ## Purpose
 * - Validate response data before sending
 * - Remove sensitive fields from responses
 * - Ensure consistent response format
 * - Log malformed responses for debugging
 *
 * ## Usage
 * ```typescript
 * import { validateOutput, sanitizeResponse, buildApiResponse } from './outputValidator';
 * import { GetNewslettersResponse } from './schemas/newsletter.schema';
 *
 * app.get('/api/newsletters', async (req, res) => {
 *   const data = await getNewsletters();
 *   const validated = validateOutput(data, GetNewslettersResponse);
 *   res.json(buildApiResponse(validated.data, req.correlationId));
 * });
 * ```
 *
 * @module control-plane/validators/outputValidator
 */

import { z, ZodSchema, ZodError } from 'zod';
import { ApiResponse } from '../types';
import { logger } from '../feedback';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Output validator configuration
 */
interface OutputValidatorConfig {
  /** Whether to validate output (can disable in production for performance) */
  enabled: boolean;
  /** Whether to log validation errors */
  logErrors: boolean;
  /** Fields to always remove from responses */
  sensitiveFields: string[];
  /** Whether to strip unknown fields */
  stripUnknown: boolean;
}

const DEFAULT_CONFIG: OutputValidatorConfig = {
  enabled: true,
  logErrors: true,
  sensitiveFields: [
    'password',
    'apiKey',
    'api_key',
    'secret',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'privateKey',
    'private_key',
    'credential',
    'encryptedKey',
  ],
  stripUnknown: false,
};

let config: OutputValidatorConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// SENSITIVE DATA REMOVAL
// =============================================================================

/**
 * Recursively remove sensitive fields from an object
 */
function removeSensitiveFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeSensitiveFields) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = config.sensitiveFields.some((sf) =>
      key.toLowerCase().includes(sf.toLowerCase())
    );

    if (!isSensitive) {
      result[key] = removeSensitiveFields(value);
    }
    // Sensitive fields are completely removed (not redacted in output)
  }

  return result as T;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Output validation result
 */
interface OutputValidationResult<T> {
  success: boolean;
  data: T;
  warnings?: string[];
}

/**
 * Validate output data against a schema
 *
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 */
export function validateOutput<T extends ZodSchema>(
  data: unknown,
  schema: T,
  options?: { correlationId?: string; skipSanitization?: boolean }
): OutputValidationResult<z.infer<T>> {
  // Sanitize first (remove sensitive fields)
  const sanitized = options?.skipSanitization ? data : removeSensitiveFields(data);

  if (!config.enabled) {
    return {
      success: true,
      data: sanitized as z.infer<T>,
    };
  }

  const result = schema.safeParse(sanitized);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Log validation warning (don't fail - this shouldn't happen with correct code)
  if (config.logErrors) {
    logger.warn(
      'validator',
      'output_validation_warning',
      `Output validation failed: ${result.error.issues.length} issues`,
      {
        correlationId: options?.correlationId,
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }
    );
  }

  // Return the sanitized data anyway (with warnings)
  return {
    success: false,
    data: sanitized as z.infer<T>,
    warnings: result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    ),
  };
}

/**
 * Sanitize response data without schema validation
 */
export function sanitizeResponse<T>(data: T): T {
  return removeSensitiveFields(data);
}

// =============================================================================
// API RESPONSE BUILDERS
// =============================================================================

/**
 * Build a standardized success response
 */
export function buildSuccessResponse<T>(
  data: T,
  correlationId?: string,
  duration?: number
): ApiResponse<T> {
  const sanitized = removeSensitiveFields(data);

  return {
    success: true,
    data: sanitized,
    meta: {
      correlationId: correlationId || 'unknown',
      duration: duration || 0,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build a standardized error response
 */
export function buildErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  correlationId?: string
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details: details ? removeSensitiveFields(details) : undefined,
    },
    meta: {
      correlationId: correlationId || 'unknown',
      duration: 0,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build API response with automatic duration calculation
 *
 * @example
 * const startTime = Date.now();
 * // ... do work ...
 * res.json(buildApiResponse(data, req.correlationId, startTime));
 */
export function buildApiResponse<T>(
  data: T,
  correlationId?: string,
  startTime?: number
): ApiResponse<T> {
  const duration = startTime ? Date.now() - startTime : 0;
  return buildSuccessResponse(data, correlationId, duration);
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware to wrap response.json with automatic sanitization
 */
export function responseInterceptor() {
  return (
    req: { correlationId?: string; startTime?: number },
    res: {
      json: (body: unknown) => void;
      locals?: { startTime?: number };
    },
    next: () => void
  ) => {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      // If body is already in ApiResponse format, just sanitize
      if (
        body &&
        typeof body === 'object' &&
        'success' in body &&
        typeof (body as { success: unknown }).success === 'boolean'
      ) {
        return originalJson(sanitizeResponse(body));
      }

      // Wrap in standard API response format
      const startTime = req.startTime || res.locals?.startTime || Date.now();
      const response = buildApiResponse(body, req.correlationId, startTime);
      return originalJson(response);
    };

    next();
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configure the output validator
 */
export function configureOutputValidator(options: Partial<OutputValidatorConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset output validator configuration to defaults
 */
export function resetOutputValidatorConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

/**
 * Add additional sensitive fields to remove
 */
export function addSensitiveFields(fields: string[]): void {
  config.sensitiveFields = [...new Set([...config.sensitiveFields, ...fields])];
}
