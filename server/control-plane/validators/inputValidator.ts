/**
 * Input Validator
 *
 * Validates incoming request data against Zod schemas.
 * Provides sanitization and detailed error messages.
 *
 * ## Purpose
 * - Validate request bodies, query parameters, and path parameters
 * - Sanitize input to prevent XSS and injection attacks
 * - Provide user-friendly validation error messages
 *
 * ## Usage
 * ```typescript
 * import { validateInput, validateQuery, validateParams } from './inputValidator';
 * import { GenerateNewsletterRequest } from './schemas/newsletter.schema';
 *
 * app.post('/api/generate', async (req, res) => {
 *   const result = validateInput(req.body, GenerateNewsletterRequest);
 *   if (!result.success) {
 *     return res.status(400).json({ error: result.error });
 *   }
 *   const data = result.data; // Type-safe validated data
 * });
 * ```
 *
 * @module control-plane/validators/inputValidator
 */

import { z, ZodSchema, ZodError } from 'zod';
import { ValidationResult, ValidationError } from '../types';
import { logger } from '../feedback';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Input validator configuration
 */
interface ValidatorConfig {
  /** Strip unknown fields from validated objects */
  stripUnknown: boolean;
  /** Whether to sanitize strings */
  sanitizeStrings: boolean;
  /** Maximum string length (0 = no limit) */
  maxStringLength: number;
  /** Whether to log validation errors */
  logErrors: boolean;
}

const DEFAULT_CONFIG: ValidatorConfig = {
  stripUnknown: true,
  sanitizeStrings: true,
  maxStringLength: 100000,
  logErrors: true,
};

let config: ValidatorConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// STRING SANITIZATION
// =============================================================================

/**
 * Sanitize a string to prevent XSS and injection
 */
function sanitizeString(str: string): string {
  if (!config.sanitizeStrings) {
    return str;
  }

  // Limit length
  if (config.maxStringLength > 0 && str.length > config.maxStringLength) {
    str = str.slice(0, config.maxStringLength);
  }

  // Basic XSS prevention for user-displayed strings
  // Note: This is a simple sanitization - use a library like DOMPurify for HTML content
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Recursively sanitize an object's string values
 */
function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }

  return obj;
}

// =============================================================================
// ERROR FORMATTING
// =============================================================================

/**
 * Convert Zod error to ValidationError array
 */
function formatZodError(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? String(issue.received) : undefined,
  }));
}

/**
 * Create a user-friendly error message from validation errors
 */
function createErrorMessage(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'Validation failed';
  }

  if (errors.length === 1) {
    const err = errors[0];
    return err.field ? `${err.field}: ${err.message}` : err.message;
  }

  return `${errors.length} validation errors: ${errors
    .slice(0, 3)
    .map((e) => e.field || 'unknown')
    .join(', ')}${errors.length > 3 ? '...' : ''}`;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validation success result
 */
interface ValidationSuccess<T> {
  success: true;
  data: T;
}

/**
 * Validation failure result
 */
interface ValidationFailure {
  success: false;
  error: {
    message: string;
    errors: ValidationError[];
  };
}

/**
 * Validation result type
 */
type InputValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate input against a Zod schema
 *
 * @param input - Raw input data
 * @param schema - Zod schema to validate against
 * @param options - Optional validation options
 */
export function validateInput<T extends ZodSchema>(
  input: unknown,
  schema: T,
  options?: { correlationId?: string; skipSanitization?: boolean }
): InputValidationResult<z.infer<T>> {
  try {
    // Parse with Zod
    const parsed = schema.parse(input);

    // Sanitize output unless skipped
    const sanitized = options?.skipSanitization
      ? parsed
      : sanitizeObject(parsed);

    return {
      success: true,
      data: sanitized,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatZodError(error);
      const message = createErrorMessage(errors);

      // Log validation error
      if (config.logErrors) {
        logger.warn(
          'validator',
          'input_validation_failed',
          message,
          {
            correlationId: options?.correlationId,
            errorCount: errors.length,
            fields: errors.map((e) => e.field),
          }
        );
      }

      return {
        success: false,
        error: {
          message,
          errors,
        },
      };
    }

    // Unexpected error
    logger.error(
      'validator',
      'unexpected_error',
      'Unexpected validation error',
      error instanceof Error ? error : new Error(String(error))
    );

    return {
      success: false,
      error: {
        message: 'Validation failed due to unexpected error',
        errors: [],
      },
    };
  }
}

/**
 * Validate query parameters
 * Coerces string values to appropriate types
 */
export function validateQuery<T extends ZodSchema>(
  query: Record<string, string | string[] | undefined>,
  schema: T,
  options?: { correlationId?: string }
): InputValidationResult<z.infer<T>> {
  return validateInput(query, schema, {
    ...options,
    skipSanitization: true, // Query params don't need HTML sanitization
  });
}

/**
 * Validate path parameters
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string>,
  schema: T,
  options?: { correlationId?: string }
): InputValidationResult<z.infer<T>> {
  return validateInput(params, schema, {
    ...options,
    skipSanitization: true,
  });
}

/**
 * Validate with safe parse (doesn't throw)
 */
export function safeValidate<T extends ZodSchema>(
  input: unknown,
  schema: T
): { success: boolean; data?: z.infer<T>; error?: ZodError } {
  const result = schema.safeParse(input);
  return result;
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware factory for request body validation
 *
 * @example
 * app.post('/api/generate',
 *   validateBody(GenerateNewsletterRequest),
 *   async (req, res) => {
 *     // req.body is validated and typed
 *   }
 * );
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (
    req: { body: unknown; correlationId?: string },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    const result = validateInput(req.body, schema, {
      correlationId: req.correlationId,
    });

    if (!result.success) {
      const failure = result as ValidationFailure;
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: failure.error.message,
          details: failure.error.errors,
        },
      });
    }

    req.body = result.data;
    next();
  };
}

/**
 * Express middleware factory for query parameter validation
 */
export function validateQueryMiddleware<T extends ZodSchema>(schema: T) {
  return (
    req: { query: Record<string, string | string[] | undefined>; correlationId?: string },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    const result = validateQuery(req.query, schema, {
      correlationId: req.correlationId,
    });

    if (!result.success) {
      const failure = result as ValidationFailure;
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: failure.error.message,
          details: failure.error.errors,
        },
      });
    }

    (req as { query: z.infer<T> }).query = result.data;
    next();
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configure the input validator
 */
export function configureInputValidator(options: Partial<ValidatorConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset input validator configuration to defaults
 */
export function resetInputValidatorConfig(): void {
  config = { ...DEFAULT_CONFIG };
}
