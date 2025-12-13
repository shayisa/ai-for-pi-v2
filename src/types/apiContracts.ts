/**
 * API Contracts for AI Newsletter Generator v2
 *
 * This file defines all request/response schemas using Zod for runtime validation
 * and TypeScript interfaces for compile-time type safety.
 */

import { z } from 'zod';

// =============================================================================
// COMMON TYPES
// =============================================================================

/**
 * Skill level for actionable content
 */
export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

/**
 * Trending source category
 */
export const TrendingCategorySchema = z.enum([
  'hackernews',
  'arxiv',
  'github',
  'reddit',
  'dev',
]);
export type TrendingCategory = z.infer<typeof TrendingCategorySchema>;

/**
 * Newsletter tone options
 */
export const ToneSchema = z.enum([
  'professional',
  'casual',
  'technical',
  'educational',
  'conversational',
]);
export type Tone = z.infer<typeof ToneSchema>;

/**
 * Image style options
 */
export const ImageStyleSchema = z.enum([
  'photorealistic',
  'digital-art',
  'illustration',
  'minimalist',
  '3d-render',
]);
export type ImageStyle = z.infer<typeof ImageStyleSchema>;

// =============================================================================
// TRENDING SOURCES
// =============================================================================

export const TrendingSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  author: z.string().optional(),
  publication: z.string().optional(),
  date: z.string().optional(),
  category: TrendingCategorySchema,
  summary: z.string().optional(),
});
export type TrendingSource = z.infer<typeof TrendingSourceSchema>;

// =============================================================================
// NEWSLETTER TYPES
// =============================================================================

/**
 * Source reference for content verification
 */
export const SourceReferenceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  lastVerified: z.string().optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

/**
 * Actionability information for a section
 */
export const ActionabilitySchema = z.object({
  implementationTime: z.string(),
  skillLevel: SkillLevelSchema,
  prerequisites: z.array(z.string()),
  steps: z.array(z.string()),
  expectedOutcome: z.string(),
  estimatedCost: z.string().optional(),
});
export type Actionability = z.infer<typeof ActionabilitySchema>;

/**
 * Newsletter section
 */
export const NewsletterSectionSchema = z.object({
  title: z.string(),
  content: z.string(), // HTML content with inline links
  imagePrompt: z.string(),
  imageUrl: z.string().optional(),
  actionability: ActionabilitySchema.optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});
export type NewsletterSection = z.infer<typeof NewsletterSectionSchema>;

/**
 * Prompt of the day
 */
export const PromptOfTheDaySchema = z.object({
  title: z.string(),
  prompt: z.string(),
  useCase: z.string(),
  expectedOutput: z.string(),
});
export type PromptOfTheDay = z.infer<typeof PromptOfTheDaySchema>;

/**
 * Complete newsletter
 */
export const NewsletterSchema = z.object({
  subject: z.string(),
  introduction: z.string(),
  sections: z.array(NewsletterSectionSchema),
  conclusion: z.string(),
  promptOfTheDay: PromptOfTheDaySchema.optional(),
});
export type Newsletter = z.infer<typeof NewsletterSchema>;

// =============================================================================
// API REQUESTS
// =============================================================================

/**
 * POST /api/generateNewsletter
 */
export const GenerateNewsletterRequestSchema = z.object({
  topics: z.array(z.string()).min(1).max(5),
  audience: z.array(z.string()).min(1),
  tone: z.string(),
  flavors: z.array(z.string()),
  imageStyle: z.string(),
  trendingSources: z.array(TrendingSourceSchema).optional(),
});
export type GenerateNewsletterRequest = z.infer<typeof GenerateNewsletterRequestSchema>;

/**
 * POST /api/generateImage
 */
export const GenerateImageRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  imageStyle: z.string(),
});
export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>;

/**
 * POST /api/generateTopicSuggestions
 */
export const GenerateTopicSuggestionsRequestSchema = z.object({
  audience: z.array(z.string()).min(1),
  existingTopics: z.array(z.string()).optional(),
  trendingSources: z.array(TrendingSourceSchema).optional(),
});
export type GenerateTopicSuggestionsRequest = z.infer<typeof GenerateTopicSuggestionsRequestSchema>;

/**
 * POST /api/generateCompellingTrendingContent
 */
export const GenerateCompellingContentRequestSchema = z.object({
  audience: z.array(z.string()).min(1),
  trendingSources: z.array(TrendingSourceSchema).min(1),
});
export type GenerateCompellingContentRequest = z.infer<typeof GenerateCompellingContentRequestSchema>;

// =============================================================================
// API RESPONSES
// =============================================================================

/**
 * Newsletter generation metadata
 */
export const GenerationMetadataSchema = z.object({
  tokensUsed: z.number(),
  searchQueries: z.array(z.string()),
  model: z.string(),
  sourcesVerified: z.boolean().optional(),
});
export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

/**
 * Response from /api/generateNewsletter
 */
export const GenerateNewsletterResponseSchema = z.object({
  text: z.string(), // JSON string containing Newsletter
  metadata: GenerationMetadataSchema.optional(),
});
export type GenerateNewsletterResponse = z.infer<typeof GenerateNewsletterResponseSchema>;

/**
 * Response from /api/generateImage
 */
export const GenerateImageResponseSchema = z.object({
  imageUrl: z.string(), // Base64 data URL or hosted URL
});
export type GenerateImageResponse = z.infer<typeof GenerateImageResponseSchema>;

/**
 * Response from /api/fetchTrendingSources
 */
export const FetchTrendingSourcesResponseSchema = z.object({
  sources: z.array(TrendingSourceSchema),
  cachedAt: z.string().optional(),
  ttl: z.number().optional(), // Time to live in ms
});
export type FetchTrendingSourcesResponse = z.infer<typeof FetchTrendingSourcesResponseSchema>;

/**
 * Response from /api/generateTopicSuggestions
 */
export const GenerateTopicSuggestionsResponseSchema = z.object({
  text: z.string(), // JSON array of topic strings
  metadata: z.object({
    searchQueries: z.array(z.string()),
    tokensUsed: z.number(),
  }).optional(),
});
export type GenerateTopicSuggestionsResponse = z.infer<typeof GenerateTopicSuggestionsResponseSchema>;

/**
 * Actionable capability from compelling content
 */
export const ActionableCapabilitySchema = z.object({
  title: z.string(),
  description: z.string(),
  implementationGuide: z.string().optional(),
  relevantTools: z.array(z.string()).optional(),
});
export type ActionableCapability = z.infer<typeof ActionableCapabilitySchema>;

/**
 * Essential tool from compelling content
 */
export const EssentialToolSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  url: z.string().url(),
});
export type EssentialTool = z.infer<typeof EssentialToolSchema>;

/**
 * Parsed compelling content structure
 */
export const CompellingContentSchema = z.object({
  actionableCapabilities: z.array(ActionableCapabilitySchema),
  essentialTools: z.array(EssentialToolSchema).optional(),
});
export type CompellingContent = z.infer<typeof CompellingContentSchema>;

// =============================================================================
// PRESETS
// =============================================================================

export const PresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  topics: z.array(z.string()),
  audience: z.array(z.string()),
  tone: z.string(),
  flavors: z.array(z.string()),
  imageStyle: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Preset = z.infer<typeof PresetSchema>;

export const SavePresetsRequestSchema = z.object({
  presets: z.array(PresetSchema),
});
export type SavePresetsRequest = z.infer<typeof SavePresetsRequestSchema>;

export const SavePresetsResponseSchema = z.object({
  success: z.boolean(),
  savedCount: z.number(),
});
export type SavePresetsResponse = z.infer<typeof SavePresetsResponseSchema>;

export const LoadPresetsResponseSchema = z.object({
  presets: z.array(PresetSchema),
});
export type LoadPresetsResponse = z.infer<typeof LoadPresetsResponseSchema>;

// =============================================================================
// SUPABASE EDGE FUNCTIONS
// =============================================================================

export const ApiServiceSchema = z.enum(['claude', 'gemini', 'stability']);
export type ApiService = z.infer<typeof ApiServiceSchema>;

/**
 * POST /functions/v1/save-api-key
 */
export const SaveApiKeyRequestSchema = z.object({
  service: ApiServiceSchema,
  key: z.string().min(1),
  userEmail: z.string().email(),
});
export type SaveApiKeyRequest = z.infer<typeof SaveApiKeyRequestSchema>;

export const SaveApiKeyResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type SaveApiKeyResponse = z.infer<typeof SaveApiKeyResponseSchema>;

/**
 * POST /functions/v1/validate-api-key
 */
export const ValidateApiKeyRequestSchema = z.object({
  service: ApiServiceSchema,
  userEmail: z.string().email(),
});
export type ValidateApiKeyRequest = z.infer<typeof ValidateApiKeyRequestSchema>;

export const ValidateApiKeyResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string(),
  lastValidated: z.string(),
});
export type ValidateApiKeyResponse = z.infer<typeof ValidateApiKeyResponseSchema>;

/**
 * GET /functions/v1/get-api-key-statuses
 */
export const ApiKeyStatusSchema = z.object({
  service: z.string(),
  isValid: z.boolean(),
  lastValidated: z.string().nullable(),
});
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

export const GetApiKeyStatusesResponseSchema = z.object({
  statuses: z.array(ApiKeyStatusSchema),
});
export type GetApiKeyStatusesResponse = z.infer<typeof GetApiKeyStatusesResponseSchema>;

// =============================================================================
// ERROR RESPONSES
// =============================================================================

export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.array(z.object({
    path: z.array(z.string()),
    message: z.string(),
  })).optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate a request body against a schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): ApiErrorResponse {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: error.issues.map(issue => ({
      path: issue.path.map(String),
      message: issue.message,
    })),
  };
}
