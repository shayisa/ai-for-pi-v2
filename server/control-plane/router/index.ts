/**
 * Router Module - Public Exports
 *
 * Provides route registration, matching, and middleware composition.
 *
 * @module control-plane/router
 */

// Route Registry
export {
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
} from './routeRegistry.ts';

// Middleware Chain
export {
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
} from './middlewareChain.ts';
