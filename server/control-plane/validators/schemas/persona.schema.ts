/**
 * Persona Domain Schemas
 *
 * Zod schemas for writer persona management endpoints.
 *
 * @module control-plane/validators/schemas/persona
 */

import { z } from 'zod';
import { NonEmptyString, IsoDateString } from './common.schema';

// =============================================================================
// PERSONA SCHEMAS
// =============================================================================

/**
 * Writer persona schema
 */
export const WriterPersona = z.object({
  id: z.string(),
  name: NonEmptyString,
  tagline: z.string().nullable(),
  expertise: z.string().nullable(),
  values: z.string().nullable(),
  writingStyle: z.string().nullable(),
  signatureElements: z.array(z.string()),
  sampleWriting: z.string().nullable(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  isFavorite: z.boolean(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type WriterPersona = z.infer<typeof WriterPersona>;

/**
 * POST /api/personas request - Create persona
 */
export const CreatePersonaRequest = z.object({
  name: NonEmptyString,
  tagline: z.string().nullable().optional(),
  expertise: z.string().nullable().optional(),
  values: z.string().nullable().optional(),
  writingStyle: z.string().nullable().optional(),
  signatureElements: z.array(z.string()).default([]),
  sampleWriting: z.string().nullable().optional(),
});
export type CreatePersonaRequest = z.infer<typeof CreatePersonaRequest>;

/**
 * PUT /api/personas/:id request - Update persona
 */
export const UpdatePersonaRequest = z.object({
  name: NonEmptyString.optional(),
  tagline: z.string().nullable().optional(),
  expertise: z.string().nullable().optional(),
  values: z.string().nullable().optional(),
  writingStyle: z.string().nullable().optional(),
  signatureElements: z.array(z.string()).optional(),
  sampleWriting: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});
export type UpdatePersonaRequest = z.infer<typeof UpdatePersonaRequest>;

/**
 * POST /api/personas/:id/activate request
 */
export const ActivatePersonaRequest = z.object({
  // No body required - persona ID is in URL
});
export type ActivatePersonaRequest = z.infer<typeof ActivatePersonaRequest>;

/**
 * POST /api/personas/:id/favorite request
 */
export const ToggleFavoriteRequest = z.object({
  isFavorite: z.boolean(),
});
export type ToggleFavoriteRequest = z.infer<typeof ToggleFavoriteRequest>;

/**
 * GET /api/personas response
 */
export const GetPersonasResponse = z.object({
  personas: z.array(WriterPersona),
  stats: z.object({
    total: z.number(),
    default: z.number(),
    custom: z.number(),
    active: z.string().nullable(),
  }),
});
export type GetPersonasResponse = z.infer<typeof GetPersonasResponse>;

/**
 * GET /api/personas/active response
 */
export const GetActivePersonaResponse = z.object({
  persona: WriterPersona.nullable(),
});
export type GetActivePersonaResponse = z.infer<typeof GetActivePersonaResponse>;
