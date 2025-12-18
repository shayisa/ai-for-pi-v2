/**
 * Common Zod Schemas
 *
 * Shared schemas used across multiple domains.
 *
 * @module control-plane/validators/schemas/common
 */

import { z } from 'zod';

// =============================================================================
// PRIMITIVE SCHEMAS
// =============================================================================

/**
 * Non-empty string schema
 */
export const NonEmptyString = z.string().min(1, 'Cannot be empty');

/**
 * Email schema
 */
export const Email = z.string().email('Invalid email format');

/**
 * URL schema
 */
export const Url = z.string().url('Invalid URL format');

/**
 * UUID schema
 */
export const Uuid = z.string().uuid('Invalid UUID format');

/**
 * ISO date string schema
 */
export const IsoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  'Invalid ISO date string'
);

// =============================================================================
// PAGINATION SCHEMAS
// =============================================================================

/**
 * Pagination query parameters
 */
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

// =============================================================================
// SOURCE CATEGORY ENUM
// =============================================================================

/**
 * Trending source categories
 */
export const SourceCategory = z.enum([
  'hackernews',
  'arxiv',
  'github',
  'reddit',
  'dev',
]);
export type SourceCategory = z.infer<typeof SourceCategory>;

// =============================================================================
// TRENDING SOURCE SCHEMAS
// =============================================================================

/**
 * Trending source schema
 */
export const TrendingSource = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  url: Url,
  author: z.string().optional(),
  publication: z.string().optional(),
  date: z.string().optional(),
  category: SourceCategory,
  summary: z.string().optional(),
});
export type TrendingSource = z.infer<typeof TrendingSource>;

/**
 * Array of trending sources
 */
export const TrendingSources = z.array(TrendingSource);
export type TrendingSources = z.infer<typeof TrendingSources>;

// =============================================================================
// NEWSLETTER SECTION SCHEMAS
// =============================================================================

/**
 * Newsletter section source
 */
export const SectionSource = z.object({
  url: Url,
  title: NonEmptyString,
  lastVerified: z.string().optional(),
});
export type SectionSource = z.infer<typeof SectionSource>;

/**
 * Section actionability (v2)
 */
export const SectionActionability = z.object({
  implementationTime: z.string(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  prerequisites: z.array(z.string()),
  steps: z.array(z.string()),
  expectedOutcome: z.string(),
  estimatedCost: z.string().optional(),
});
export type SectionActionability = z.infer<typeof SectionActionability>;

/**
 * Newsletter section schema
 */
export const NewsletterSection = z.object({
  title: NonEmptyString,
  content: NonEmptyString,
  imagePrompt: z.string(),
  imageUrl: z.string().optional(),
  actionability: SectionActionability.optional(),
  sources: z.array(SectionSource).optional(),
});
export type NewsletterSection = z.infer<typeof NewsletterSection>;

// =============================================================================
// PROMPT OF THE DAY SCHEMA
// =============================================================================

/**
 * Prompt of the day schema
 */
export const PromptOfTheDay = z.object({
  title: NonEmptyString,
  summary: NonEmptyString,
  examplePrompts: z.array(z.string()),
  promptCode: z.string(),
});
export type PromptOfTheDay = z.infer<typeof PromptOfTheDay>;

// =============================================================================
// NEWSLETTER SCHEMA
// =============================================================================

/**
 * Newsletter schema (v1)
 */
export const Newsletter = z.object({
  id: z.string().optional(),
  subject: NonEmptyString,
  introduction: NonEmptyString,
  sections: z.array(NewsletterSection),
  conclusion: NonEmptyString,
  promptOfTheDay: PromptOfTheDay.optional(),
});
export type Newsletter = z.infer<typeof Newsletter>;

// =============================================================================
// API SERVICE ENUM
// =============================================================================

/**
 * API service types
 */
export const ApiService = z.enum(['claude', 'gemini', 'stability', 'brave']);
export type ApiService = z.infer<typeof ApiService>;

// =============================================================================
// STANDARD API RESPONSE SCHEMAS
// =============================================================================

/**
 * Standard success response
 */
export const SuccessResponse = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});
export type SuccessResponse = z.infer<typeof SuccessResponse>;

/**
 * Standard error response
 */
export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;

/**
 * API response wrapper
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    meta: z.object({
      correlationId: z.string(),
      duration: z.number(),
      timestamp: z.string(),
    }).optional(),
  });
}
