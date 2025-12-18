/**
 * Control Plane - Main Entry Point
 *
 * The Control Plane is a unified interface that encapsulates tool routing,
 * validation, and execution logic for the AI Newsletter Generator.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        CONTROL PLANE                            │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 * │  │ Registration │  │   Resolver   │  │    Router    │          │
 * │  │   Module     │  │   (Intent)   │  │   Handler    │          │
 * │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
 * │         │                 │                 │                   │
 * │  ┌──────▼───────────────▼──────────────────▼───────┐           │
 * │  │              Invocation Module                    │           │
 * │  │         (Request Processing & Context)            │           │
 * │  └──────────────────────┬───────────────────────────┘           │
 * │                         │                                       │
 * │  ┌──────────────────────▼───────────────────────────┐           │
 * │  │              Validators (Input/Output)            │           │
 * │  │              Zod Schemas + Sanitization           │           │
 * │  └──────────────────────┬───────────────────────────┘           │
 * │                         │                                       │
 * │  ┌──────────────────────▼───────────────────────────┐           │
 * │  │              Feedback Module                      │           │
 * │  │       Logging + Tracing + Audit + Metrics        │           │
 * │  └──────────────────────────────────────────────────┘           │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * @module control-plane
 */

// =============================================================================
// TYPES
// =============================================================================

export * from './types';

// =============================================================================
// FEEDBACK (Logging, Tracing, Metrics, Audit)
// =============================================================================

export {
  // Logger
  logger,
  createRequestLogger,
  generateCorrelationId as generateLogCorrelationId,
  configureLogger,
  resetLoggerConfig,
  getRecentLogs,
  clearLogBuffer,
  type RequestLogger,

  // Audit Trail
  auditTrail,
  configureAuditTrail,
  resetAuditConfig,
  getRecentAuditEntries,
  clearAuditBuffer,

  // Metrics
  metrics,
  configureMetrics,
  resetMetricsConfig,
  clearMetrics,
  startMetricsSummaryLogging,
  stopMetricsSummaryLogging,

  // Tracing
  tracer,
  configureTracing,
  resetTracingConfig,
  clearTraces,
  getRecentTraces,
  getTrace,
  withSpan,
  formatTrace,
  type ActiveTrace,
  type ActiveSpan,
  type Span,
  type Trace,
  type SpanStatus,
  type SpanEvent,
} from './feedback';

// =============================================================================
// VALIDATORS
// =============================================================================

export {
  // Input Validation
  validateInput,
  validateQuery,
  validateParams,
  safeValidate,
  validateBody,
  validateQueryMiddleware,
  configureInputValidator,
  resetInputValidatorConfig,

  // Output Validation
  validateOutput,
  sanitizeResponse,
  buildSuccessResponse,
  buildErrorResponse,
  buildApiResponse,
  responseInterceptor,
  configureOutputValidator,
  resetOutputValidatorConfig,
  addSensitiveFields,

  // Common Schemas
  NonEmptyString,
  Email,
  Url,
  Uuid,
  IsoDateString,
  PaginationQuery,
  SourceCategory,
  TrendingSource,
  TrendingSources,
  SectionSource,
  SectionActionability,
  NewsletterSection,
  PromptOfTheDay,
  Newsletter,
  ApiService,
  SuccessResponse,
  ErrorResponse,
  createApiResponseSchema,

  // Newsletter Schemas
  GenerateNewsletterRequest,
  GenerateNewsletterResponse,
  GenerateImageRequest,
  GenerateImageResponse,
  GenerateTopicSuggestionsRequest,
  GenerateTopicSuggestionsResponse,
  GenerateCompellingContentRequest,
  GenerateCompellingContentResponse,
  SaveNewsletterRequest,
  GetNewslettersResponse,
  UpdateNewsletterSectionsRequest,
  FetchTrendingSourcesResponse,
  ToolOfTheDay,
  PracticalPrompt,
  SectionCTA,
  EnhancedAudienceSection,
  EnhancedNewsletter,
  GenerateEnhancedNewsletterRequest,

  // Subscriber Schemas
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

  // Template Schemas
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

  // Persona Schemas
  WriterPersona,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  ActivatePersonaRequest,
  ToggleFavoriteRequest,
  GetPersonasResponse,
  GetActivePersonaResponse,

  // Calendar Schemas
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
} from './validators';

// =============================================================================
// REGISTRATION (Tool Registry)
// =============================================================================

export {
  // Registry
  toolRegistry,
  registerTool,
  unregisterTool,
  getTool,
  getEnabledTool,
  hasTool,
  getAllTools,
  getToolsByCategory,
  getEnabledToolsByCategory,
  getToolsRequiringAuth,
  searchTools,
  enableTool,
  disableTool,
  checkToolHealth,
  checkAllToolsHealth,
  getRegistryStats,
  clearRegistry,
  type ToolHandler,
  type ToolContext,
  type RegisteredTool,

  // Tool Definitions
  claudeTool,
  stabilityTool,
  braveSearchTool,
  googleOAuthTool,
  googleDriveTool,
  googleGmailTool,
  googleSheetsTool,
  newsletterDbTool,
  subscriberDbTool,
  personaDbTool,
  templateDbTool,
  draftDbTool,
  calendarDbTool,
  thumbnailDbTool,
  apiKeyDbTool,
  logsDbTool,
  hackerNewsTool,
  arxivTool,
  githubTool,
  redditTool,
  allToolDefinitions,
  getToolDefinitionsByCategory,
  getToolDefinition,
} from './registration';

// =============================================================================
// RESOLVER (Intent Classification & Auth)
// =============================================================================

export {
  // Intent Classifier
  classifyIntent,
  resolveTools,
  requiresAuth,
  getAuthType,
  getAllRoutePatterns,

  // Auth Resolver
  resolveAuth,
  validateApiKey,
  validateOAuthToken,
  configureAuthResolver,
  resetAuthResolverConfig,

  // Types
  type AuthType,
  type AuthResult,
  type ApiKeyValidation,
  type OAuthValidation,
} from './resolver';

// =============================================================================
// INVOCATION (Request Processing & Context)
// =============================================================================

export {
  // Context Manager
  generateCorrelationId,
  isValidCorrelationId,
  createContext,
  createContextFromRequest,
  getContext,
  requireContext,
  getCorrelationId,
  withContext,
  withContextSync,
  extendContext,
  withAuth,
  withIntent,
  getElapsedTime,
  finalizeContext,
  contextMiddleware,
  hasContext,
  type CreateContextOptions,
  type RequestWithContext,

  // Response Builder
  successResponse,
  errorResponse,
  fromInvocationResult,
  ErrorCodes,
  errorCodeToStatus,
  ResponseBuilder,
  sendSuccess,
  sendError,
  sendResponse,
  wrapItem,
  wrapList,
  wrapCreated,
  wrapDeleted,
  type ApiResponse,
  type ApiError,
  type ResponseMeta,
  type PaginationMeta,
  type RateLimitMeta,
  type ErrorCode,

  // Request Processor
  processRequest,
  createRequestHandler,
  withRequestContext,
  invokeTool,
  type RequestHandlerOptions,
  type ToolExecutionContext,
  type ExpressRequest,
  type ExpressResponse,
} from './invocation';

// =============================================================================
// ROUTER (Route Registry & Middleware)
// =============================================================================

export {
  // Route Registry
  registerRoute,
  unregisterRoute,
  clearRoutes,
  getRoute,
  hasRoute,
  getAllRoutes,
  getRoutesByCategory,
  getRoutesByAuthType,
  getRoutesByMethod,
  getDeprecatedRoutes,
  searchRoutes,
  getRouteStats,
  generateRouteDocumentation,
  generateOpenApiPaths,
  matchRoute,
  registerRoutes,
  routeRegistry,
  type HttpMethod,
  type RouteAuthType,
  type RateLimitTier,
  type RouteCategory,
  type RouteDefinition,
  type RegisteredRoute,
  type RouteHandler,
  type RouteStats,
  type RouteDoc,
  type BulkRouteDefinition,

  // Middleware Chain
  createMiddleware,
  asyncMiddleware,
  pathMiddleware,
  methodMiddleware,
  MiddlewareChain,
  requestLoggerMiddleware,
  errorRecoveryMiddleware,
  corsMiddleware,
  timeoutMiddleware,
  createApiChain,
  createCorsChain,
  type MiddlewareRequest,
  type MiddlewareResponse,
  type NextFunction,
  type Middleware,
  type AsyncMiddleware,
  type ErrorMiddleware,
  type MiddlewareCondition,
  type MiddlewareOptions,
} from './router';
