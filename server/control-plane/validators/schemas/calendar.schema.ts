/**
 * Calendar Domain Schemas
 *
 * Zod schemas for content calendar and scheduling endpoints.
 *
 * @module control-plane/validators/schemas/calendar
 */

import { z } from 'zod';
import { NonEmptyString, Email, IsoDateString } from './common.schema';

// =============================================================================
// CALENDAR ENTRY SCHEMAS
// =============================================================================

/**
 * Calendar entry status enum
 */
export const CalendarEntryStatus = z.enum(['draft', 'scheduled', 'sent', 'cancelled']);
export type CalendarEntryStatus = z.infer<typeof CalendarEntryStatus>;

/**
 * Calendar entry schema
 */
export const CalendarEntry = z.object({
  id: z.string(),
  title: NonEmptyString,
  description: z.string().nullable(),
  scheduledDate: IsoDateString,
  status: CalendarEntryStatus,
  topics: z.array(z.string()),
  audiences: z.array(z.string()),
  newsletterId: z.string().nullable(),
  personaId: z.string().nullable(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type CalendarEntry = z.infer<typeof CalendarEntry>;

/**
 * POST /api/calendar request - Create entry
 */
export const CreateCalendarEntryRequest = z.object({
  title: NonEmptyString,
  description: z.string().nullable().optional(),
  scheduledDate: IsoDateString,
  topics: z.array(z.string()).default([]),
  audiences: z.array(z.string()).default([]),
  personaId: z.string().nullable().optional(),
});
export type CreateCalendarEntryRequest = z.infer<typeof CreateCalendarEntryRequest>;

/**
 * PUT /api/calendar/:id request - Update entry
 */
export const UpdateCalendarEntryRequest = z.object({
  title: NonEmptyString.optional(),
  description: z.string().nullable().optional(),
  scheduledDate: IsoDateString.optional(),
  status: CalendarEntryStatus.optional(),
  topics: z.array(z.string()).optional(),
  audiences: z.array(z.string()).optional(),
  newsletterId: z.string().nullable().optional(),
  personaId: z.string().nullable().optional(),
});
export type UpdateCalendarEntryRequest = z.infer<typeof UpdateCalendarEntryRequest>;

/**
 * GET /api/calendar query parameters
 */
export const GetCalendarEntriesQuery = z.object({
  startDate: IsoDateString.optional(),
  endDate: IsoDateString.optional(),
  status: CalendarEntryStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});
export type GetCalendarEntriesQuery = z.infer<typeof GetCalendarEntriesQuery>;

/**
 * GET /api/calendar response
 */
export const GetCalendarEntriesResponse = z.object({
  entries: z.array(CalendarEntry),
  count: z.number(),
});
export type GetCalendarEntriesResponse = z.infer<typeof GetCalendarEntriesResponse>;

// =============================================================================
// SCHEDULED SEND SCHEMAS
// =============================================================================

/**
 * Scheduled send status enum
 */
export const ScheduledSendStatus = z.enum(['pending', 'sent', 'failed', 'cancelled']);
export type ScheduledSendStatus = z.infer<typeof ScheduledSendStatus>;

/**
 * Scheduled send schema
 */
export const ScheduledSend = z.object({
  id: z.string(),
  calendarEntryId: z.string().nullable(),
  newsletterId: z.string(),
  scheduledAt: IsoDateString,
  status: ScheduledSendStatus,
  recipientListId: z.string().nullable(),
  recipientCount: z.number().int().min(0),
  sentAt: IsoDateString.nullable(),
  error: z.string().nullable(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type ScheduledSend = z.infer<typeof ScheduledSend>;

/**
 * POST /api/scheduled-sends request
 */
export const CreateScheduledSendRequest = z.object({
  calendarEntryId: z.string().nullable().optional(),
  newsletterId: z.string(),
  scheduledAt: IsoDateString,
  recipientListId: z.string().nullable().optional(),
});
export type CreateScheduledSendRequest = z.infer<typeof CreateScheduledSendRequest>;

/**
 * PUT /api/scheduled-sends/:id/cancel request
 */
export const CancelScheduledSendRequest = z.object({
  // No body required
});
export type CancelScheduledSendRequest = z.infer<typeof CancelScheduledSendRequest>;

/**
 * GET /api/scheduled-sends response
 */
export const GetScheduledSendsResponse = z.object({
  scheduledSends: z.array(ScheduledSend),
  count: z.number(),
});
export type GetScheduledSendsResponse = z.infer<typeof GetScheduledSendsResponse>;

// =============================================================================
// EMAIL TRACKING SCHEMAS
// =============================================================================

/**
 * Email tracking event schema
 */
export const EmailTrackingEvent = z.object({
  id: z.string(),
  newsletterId: z.string(),
  recipientEmail: Email,
  eventType: z.enum(['sent', 'opened', 'clicked', 'bounced', 'unsubscribed']),
  eventData: z.record(z.string(), z.unknown()).nullable(),
  createdAt: IsoDateString,
});
export type EmailTrackingEvent = z.infer<typeof EmailTrackingEvent>;

/**
 * Email stats schema
 */
export const EmailStats = z.object({
  newsletterId: z.string(),
  sent: z.number(),
  opened: z.number(),
  clicked: z.number(),
  bounced: z.number(),
  unsubscribed: z.number(),
  openRate: z.number(),
  clickRate: z.number(),
});
export type EmailStats = z.infer<typeof EmailStats>;

/**
 * GET /api/newsletters/:id/stats response
 */
export const GetNewsletterStatsResponse = z.object({
  stats: EmailStats,
});
export type GetNewsletterStatsResponse = z.infer<typeof GetNewsletterStatsResponse>;
