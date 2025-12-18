/**
 * Subscriber Domain Schemas
 *
 * Zod schemas for subscriber and list management endpoints.
 *
 * @module control-plane/validators/schemas/subscriber
 */

import { z } from 'zod';
import { NonEmptyString, Email, IsoDateString } from './common.schema';

// =============================================================================
// SUBSCRIBER SCHEMAS
// =============================================================================

/**
 * Subscriber status enum
 */
export const SubscriberStatus = z.enum(['active', 'inactive']);
export type SubscriberStatus = z.infer<typeof SubscriberStatus>;

/**
 * Subscriber schema
 */
export const Subscriber = z.object({
  email: Email,
  name: z.string().optional(),
  status: SubscriberStatus,
  lists: z.string(), // Comma-separated list IDs
  dateAdded: IsoDateString,
  dateRemoved: IsoDateString.optional(),
  source: z.string().optional(),
});
export type Subscriber = z.infer<typeof Subscriber>;

/**
 * POST /api/subscribers request - Create subscriber
 */
export const CreateSubscriberRequest = z.object({
  email: Email,
  name: z.string().optional(),
  lists: z.array(NonEmptyString).default([]),
  source: z.string().default('manual'),
});
export type CreateSubscriberRequest = z.infer<typeof CreateSubscriberRequest>;

/**
 * PUT /api/subscribers/:email request - Update subscriber
 */
export const UpdateSubscriberRequest = z.object({
  name: z.string().optional(),
  status: SubscriberStatus.optional(),
  lists: z.array(NonEmptyString).optional(),
});
export type UpdateSubscriberRequest = z.infer<typeof UpdateSubscriberRequest>;

/**
 * POST /api/subscribers/import request - Bulk import
 */
export const ImportSubscribersRequest = z.object({
  subscribers: z.array(z.object({
    email: Email,
    name: z.string().optional(),
  })).min(1),
  listId: NonEmptyString.optional(),
  source: z.string().default('import'),
});
export type ImportSubscribersRequest = z.infer<typeof ImportSubscribersRequest>;

/**
 * GET /api/subscribers query parameters
 */
export const GetSubscribersQuery = z.object({
  status: SubscriberStatus.optional(),
  listId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});
export type GetSubscribersQuery = z.infer<typeof GetSubscribersQuery>;

/**
 * GET /api/subscribers response
 */
export const GetSubscribersResponse = z.object({
  subscribers: z.array(Subscriber),
  total: z.number(),
  hasMore: z.boolean(),
});
export type GetSubscribersResponse = z.infer<typeof GetSubscribersResponse>;

// =============================================================================
// SUBSCRIBER LIST SCHEMAS
// =============================================================================

/**
 * Subscriber list schema
 */
export const SubscriberList = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  description: z.string().optional(),
  dateCreated: IsoDateString,
  subscriberCount: z.number().int().min(0),
});
export type SubscriberList = z.infer<typeof SubscriberList>;

/**
 * POST /api/subscriber-lists request - Create list
 */
export const CreateSubscriberListRequest = z.object({
  name: NonEmptyString,
  description: z.string().optional(),
});
export type CreateSubscriberListRequest = z.infer<typeof CreateSubscriberListRequest>;

/**
 * PUT /api/subscriber-lists/:id request - Update list
 */
export const UpdateSubscriberListRequest = z.object({
  name: NonEmptyString.optional(),
  description: z.string().optional(),
});
export type UpdateSubscriberListRequest = z.infer<typeof UpdateSubscriberListRequest>;

/**
 * GET /api/subscriber-lists response
 */
export const GetSubscriberListsResponse = z.object({
  lists: z.array(SubscriberList),
});
export type GetSubscriberListsResponse = z.infer<typeof GetSubscriberListsResponse>;

// =============================================================================
// EMAIL SEND SCHEMAS
// =============================================================================

/**
 * POST /api/sendEmail request
 */
export const SendEmailRequest = z.object({
  newsletterId: z.string().optional(),
  subject: NonEmptyString,
  htmlContent: NonEmptyString,
  recipients: z.array(Email).min(1).max(500),
  listId: z.string().optional(),
});
export type SendEmailRequest = z.infer<typeof SendEmailRequest>;

/**
 * POST /api/sendEmail response
 */
export const SendEmailResponse = z.object({
  success: z.boolean(),
  sentCount: z.number(),
  failedCount: z.number(),
  errors: z.array(z.object({
    email: Email,
    error: z.string(),
  })).optional(),
});
export type SendEmailResponse = z.infer<typeof SendEmailResponse>;
