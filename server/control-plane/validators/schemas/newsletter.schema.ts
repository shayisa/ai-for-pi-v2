/**
 * Newsletter Domain Schemas
 *
 * Zod schemas for newsletter generation and management endpoints.
 *
 * @module control-plane/validators/schemas/newsletter
 */

import { z } from 'zod';
import {
  NonEmptyString,
  TrendingSources,
  Newsletter,
  PromptOfTheDay,
} from './common.schema';

// =============================================================================
// GENERATION SCHEMAS
// =============================================================================

/**
 * POST /api/generateNewsletter request
 */
export const GenerateNewsletterRequest = z.object({
  topics: z
    .array(NonEmptyString)
    .min(1, 'At least 1 topic required')
    .max(5, 'Maximum 5 topics allowed'),
  audience: z
    .array(NonEmptyString)
    .min(1, 'At least 1 audience required'),
  tone: NonEmptyString,
  flavors: z.array(z.string()).default([]),
  imageStyle: NonEmptyString,
  trendingSources: TrendingSources.optional(),
});
export type GenerateNewsletterRequest = z.infer<typeof GenerateNewsletterRequest>;

/**
 * POST /api/generateNewsletter response
 */
export const GenerateNewsletterResponse = z.object({
  text: z.string(),
  metadata: z.object({
    tokensUsed: z.number(),
    searchQueries: z.array(z.string()),
    model: z.string(),
  }).optional(),
});
export type GenerateNewsletterResponse = z.infer<typeof GenerateNewsletterResponse>;

/**
 * POST /api/generateImage request
 */
export const GenerateImageRequest = z.object({
  prompt: NonEmptyString,
  imageStyle: NonEmptyString,
});
export type GenerateImageRequest = z.infer<typeof GenerateImageRequest>;

/**
 * POST /api/generateImage response
 */
export const GenerateImageResponse = z.object({
  imageUrl: z.string(),
});
export type GenerateImageResponse = z.infer<typeof GenerateImageResponse>;

/**
 * POST /api/generateTopicSuggestions request
 */
export const GenerateTopicSuggestionsRequest = z.object({
  audience: z.array(NonEmptyString).min(1),
  existingTopics: z.array(z.string()).optional(),
  trendingSources: TrendingSources.optional(),
});
export type GenerateTopicSuggestionsRequest = z.infer<typeof GenerateTopicSuggestionsRequest>;

/**
 * POST /api/generateTopicSuggestions response
 */
export const GenerateTopicSuggestionsResponse = z.object({
  text: z.string(),
  metadata: z.object({
    searchQueries: z.array(z.string()),
    tokensUsed: z.number(),
  }).optional(),
});
export type GenerateTopicSuggestionsResponse = z.infer<typeof GenerateTopicSuggestionsResponse>;

/**
 * POST /api/generateCompellingTrendingContent request
 */
export const GenerateCompellingContentRequest = z.object({
  audience: z.array(NonEmptyString).min(1),
  trendingSources: TrendingSources,
});
export type GenerateCompellingContentRequest = z.infer<typeof GenerateCompellingContentRequest>;

/**
 * POST /api/generateCompellingTrendingContent response
 */
export const GenerateCompellingContentResponse = z.object({
  text: z.string(),
});
export type GenerateCompellingContentResponse = z.infer<typeof GenerateCompellingContentResponse>;

// =============================================================================
// NEWSLETTER CRUD SCHEMAS
// =============================================================================

/**
 * POST /api/newsletters request - Create/save newsletter
 */
export const SaveNewsletterRequest = z.object({
  newsletter: Newsletter,
  topics: z.array(z.string()),
});
export type SaveNewsletterRequest = z.infer<typeof SaveNewsletterRequest>;

/**
 * GET /api/newsletters response
 */
export const GetNewslettersResponse = z.object({
  newsletters: z.array(z.object({
    id: z.string(),
    date: z.string(),
    subject: z.string(),
    newsletter: Newsletter,
    topics: z.array(z.string()),
  })),
  total: z.number(),
});
export type GetNewslettersResponse = z.infer<typeof GetNewslettersResponse>;

/**
 * PUT /api/newsletters/:id/sections request - Update sections
 */
export const UpdateNewsletterSectionsRequest = z.object({
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    imagePrompt: z.string(),
    imageUrl: z.string().optional(),
  })),
});
export type UpdateNewsletterSectionsRequest = z.infer<typeof UpdateNewsletterSectionsRequest>;

// =============================================================================
// TRENDING SOURCES SCHEMAS
// =============================================================================

/**
 * GET /api/fetchTrendingSources response
 */
export const FetchTrendingSourcesResponse = z.object({
  sources: TrendingSources,
  cachedAt: z.string().optional(),
  ttl: z.number().optional(),
});
export type FetchTrendingSourcesResponse = z.infer<typeof FetchTrendingSourcesResponse>;

// =============================================================================
// ENHANCED NEWSLETTER (V2) SCHEMAS
// =============================================================================

/**
 * Tool of the day schema
 */
export const ToolOfTheDay = z.object({
  name: NonEmptyString,
  url: z.string(),
  whyNow: z.string(),
  quickStart: z.string(),
});
export type ToolOfTheDay = z.infer<typeof ToolOfTheDay>;

/**
 * Practical prompt schema
 */
export const PracticalPrompt = z.object({
  scenario: z.string(),
  prompt: z.string(),
  isToolSpecific: z.boolean(),
});
export type PracticalPrompt = z.infer<typeof PracticalPrompt>;

/**
 * Section CTA schema
 */
export const SectionCTA = z.object({
  text: z.string(),
  action: z.enum(['copy_prompt', 'visit_url']),
});
export type SectionCTA = z.infer<typeof SectionCTA>;

/**
 * Enhanced audience section schema
 */
export const EnhancedAudienceSection = z.object({
  audienceId: z.string(),
  audienceName: z.string(),
  title: z.string(),
  whyItMatters: z.string(),
  content: z.string(),
  practicalPrompt: PracticalPrompt,
  cta: SectionCTA,
  sources: z.array(z.object({
    url: z.string(),
    title: z.string(),
  })),
  imagePrompt: z.string().optional(),
  imageUrl: z.string().optional(),
});
export type EnhancedAudienceSection = z.infer<typeof EnhancedAudienceSection>;

/**
 * Enhanced newsletter schema (v2)
 */
export const EnhancedNewsletter = z.object({
  id: z.string().optional(),
  editorsNote: z.object({
    message: z.string(),
  }),
  toolOfTheDay: ToolOfTheDay,
  audienceSections: z.array(EnhancedAudienceSection),
  conclusion: z.string(),
  subject: z.string().optional(),
  promptOfTheDay: PromptOfTheDay.optional(),
});
export type EnhancedNewsletter = z.infer<typeof EnhancedNewsletter>;

/**
 * POST /api/generateEnhancedNewsletter request
 */
export const GenerateEnhancedNewsletterRequest = z.object({
  topics: z.array(NonEmptyString).min(1).max(5),
  audiences: z.array(NonEmptyString).min(1),
  tone: NonEmptyString,
  flavors: z.array(z.string()).default([]),
  imageStyle: NonEmptyString,
  trendingSources: TrendingSources.optional(),
  personaId: z.string().nullable().optional(),
});
export type GenerateEnhancedNewsletterRequest = z.infer<typeof GenerateEnhancedNewsletterRequest>;
