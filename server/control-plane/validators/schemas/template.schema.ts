/**
 * Template & Draft Domain Schemas
 *
 * Zod schemas for newsletter templates and draft auto-save endpoints.
 *
 * @module control-plane/validators/schemas/template
 */

import { z } from 'zod';
import {
  NonEmptyString,
  Email,
  IsoDateString,
  PromptOfTheDay,
} from './common.schema';

// =============================================================================
// TEMPLATE SCHEMAS
// =============================================================================

/**
 * Template structure schema
 */
export const TemplateStructure = z.object({
  introduction: z.string().default(''),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    imagePrompt: z.string().optional(),
  })),
  conclusion: z.string().default(''),
  includePromptOfDay: z.boolean().default(false),
  promptOfTheDay: PromptOfTheDay.optional(),
});
export type TemplateStructure = z.infer<typeof TemplateStructure>;

/**
 * Template settings schema
 */
export const TemplateSettings = z.object({
  tone: z.string().optional(),
  imageStyle: z.string().optional(),
  audiences: z.array(z.string()).optional(),
  personaId: z.string().optional(),
});
export type TemplateSettings = z.infer<typeof TemplateSettings>;

/**
 * Newsletter template schema
 */
export const NewsletterTemplate = z.object({
  id: z.string(),
  name: NonEmptyString,
  description: z.string().default(''),
  structure: TemplateStructure,
  defaultSettings: TemplateSettings.optional(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type NewsletterTemplate = z.infer<typeof NewsletterTemplate>;

/**
 * POST /api/templates request - Create template
 */
export const CreateTemplateRequest = z.object({
  name: NonEmptyString,
  description: z.string().optional(),
  structure: TemplateStructure,
  defaultSettings: TemplateSettings.optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequest>;

/**
 * POST /api/templates/from-newsletter request
 */
export const CreateFromNewsletterRequest = z.object({
  name: NonEmptyString,
  description: z.string().optional(),
  newsletter: z.object({
    introduction: z.string().optional(),
    sections: z.array(z.object({
      title: z.string(),
      content: z.string(),
      imagePrompt: z.string().optional(),
    })).min(1),
    conclusion: z.string().optional(),
  }),
  settings: TemplateSettings.optional(),
});
export type CreateFromNewsletterRequest = z.infer<typeof CreateFromNewsletterRequest>;

/**
 * PUT /api/templates/:id request - Update template
 */
export const UpdateTemplateRequest = z.object({
  name: NonEmptyString.optional(),
  description: z.string().optional(),
  structure: TemplateStructure.optional(),
  defaultSettings: TemplateSettings.optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequest>;

/**
 * GET /api/templates query parameters
 */
export const GetTemplatesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});
export type GetTemplatesQuery = z.infer<typeof GetTemplatesQuery>;

/**
 * GET /api/templates response
 */
export const GetTemplatesResponse = z.object({
  templates: z.array(NewsletterTemplate),
  count: z.number(),
});
export type GetTemplatesResponse = z.infer<typeof GetTemplatesResponse>;

// =============================================================================
// DRAFT SCHEMAS
// =============================================================================

/**
 * Draft content schema
 */
export const DraftContent = z.object({
  newsletter: z.object({
    subject: z.string().optional(),
    introduction: z.string().optional(),
    sections: z.array(z.object({
      title: z.string(),
      content: z.string(),
      imagePrompt: z.string().optional(),
    })).optional(),
    conclusion: z.string().optional(),
  }).optional(),
  enhancedNewsletter: z.record(z.string(), z.unknown()).optional(), // Complex nested type
  formatVersion: z.enum(['v1', 'v2']),
});
export type DraftContent = z.infer<typeof DraftContent>;

/**
 * Draft settings schema
 */
export const DraftSettings = z.object({
  selectedTone: z.string().optional(),
  selectedImageStyle: z.string().optional(),
  selectedAudiences: z.array(z.string()).optional(),
  personaId: z.string().nullable().optional(),
  promptOfTheDay: PromptOfTheDay.optional(),
});
export type DraftSettings = z.infer<typeof DraftSettings>;

/**
 * Newsletter draft schema
 */
export const NewsletterDraft = z.object({
  id: z.string(),
  userEmail: Email,
  content: DraftContent,
  topics: z.array(z.string()),
  settings: DraftSettings,
  lastSavedAt: IsoDateString,
});
export type NewsletterDraft = z.infer<typeof NewsletterDraft>;

/**
 * POST /api/drafts request - Save draft
 */
export const SaveDraftRequest = z.object({
  userEmail: Email,
  content: DraftContent,
  topics: z.array(z.string()).optional(),
  settings: DraftSettings.optional(),
});
export type SaveDraftRequest = z.infer<typeof SaveDraftRequest>;

/**
 * GET /api/drafts/:userEmail/exists response
 */
export const DraftExistsResponse = z.object({
  exists: z.boolean(),
});
export type DraftExistsResponse = z.infer<typeof DraftExistsResponse>;
