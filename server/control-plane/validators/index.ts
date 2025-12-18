/**
 * Validators Module - Public Exports
 *
 * Provides input/output validation using Zod schemas.
 *
 * @module control-plane/validators
 */

// =============================================================================
// INPUT VALIDATOR
// =============================================================================

export {
  validateInput,
  validateQuery,
  validateParams,
  safeValidate,
  validateBody,
  validateQueryMiddleware,
  configureInputValidator,
  resetInputValidatorConfig,
} from './inputValidator.ts';

// =============================================================================
// OUTPUT VALIDATOR
// =============================================================================

export {
  validateOutput,
  sanitizeResponse,
  buildSuccessResponse,
  buildErrorResponse,
  buildApiResponse,
  responseInterceptor,
  configureOutputValidator,
  resetOutputValidatorConfig,
  addSensitiveFields,
} from './outputValidator.ts';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

export {
  // Primitives
  NonEmptyString,
  Email,
  Url,
  Uuid,
  IsoDateString,
  // Pagination
  PaginationQuery,
  // Source
  SourceCategory,
  TrendingSource,
  TrendingSources,
  // Newsletter parts
  SectionSource,
  SectionActionability,
  NewsletterSection,
  PromptOfTheDay,
  Newsletter,
  // API
  ApiService,
  SuccessResponse,
  ErrorResponse,
  createApiResponseSchema,
} from './schemas/common.schema.ts';

// =============================================================================
// NEWSLETTER SCHEMAS
// =============================================================================

export {
  // Generation
  GenerateNewsletterRequest,
  GenerateNewsletterResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  GenerateTopicSuggestionsRequest,
  GenerateTopicSuggestionsResponse,
  GenerateCompellingContentRequest,
  GenerateCompellingContentResponse,
  // CRUD
  SaveNewsletterRequest,
  GetNewslettersResponse,
  UpdateNewsletterSectionsRequest,
  // Trending
  FetchTrendingSourcesResponse,
  // Enhanced (v2)
  ToolOfTheDay,
  PracticalPrompt,
  SectionCTA,
  EnhancedAudienceSection,
  EnhancedNewsletter,
  GenerateEnhancedNewsletterRequest,
} from './schemas/newsletter.schema.ts';

// =============================================================================
// SUBSCRIBER SCHEMAS
// =============================================================================

export {
  SubscriberStatus,
  Subscriber,
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
  ImportSubscribersRequest,
  GetSubscribersQuery,
  GetSubscribersResponse,
  SubscriberList,
  CreateSubscriberListRequest,
  UpdateSubscriberListRequest,
  GetSubscriberListsResponse,
  SendEmailRequest,
  SendEmailResponse,
} from './schemas/subscriber.schema.ts';

// =============================================================================
// TEMPLATE SCHEMAS
// =============================================================================

export {
  TemplateStructure,
  TemplateSettings,
  NewsletterTemplate,
  CreateTemplateRequest,
  CreateFromNewsletterRequest,
  UpdateTemplateRequest,
  GetTemplatesQuery,
  GetTemplatesResponse,
  DraftContent,
  DraftSettings,
  NewsletterDraft,
  SaveDraftRequest,
  DraftExistsResponse,
} from './schemas/template.schema.ts';

// =============================================================================
// PERSONA SCHEMAS
// =============================================================================

export {
  WriterPersona,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  ActivatePersonaRequest,
  ToggleFavoriteRequest,
  GetPersonasResponse,
  GetActivePersonaResponse,
} from './schemas/persona.schema.ts';

// =============================================================================
// CALENDAR SCHEMAS
// =============================================================================

export {
  CalendarEntryStatus,
  CalendarEntry,
  CreateCalendarEntryRequest,
  UpdateCalendarEntryRequest,
  GetCalendarEntriesQuery,
  GetCalendarEntriesResponse,
  ScheduledSendStatus,
  ScheduledSend,
  CreateScheduledSendRequest,
  CancelScheduledSendRequest,
  GetScheduledSendsResponse,
  EmailTrackingEvent,
  EmailStats,
  GetNewsletterStatsResponse,
} from './schemas/calendar.schema.ts';
