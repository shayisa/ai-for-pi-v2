/**
 * Route Registry
 *
 * Central registry for all API routes with metadata.
 * Provides route discovery, documentation generation, and validation.
 *
 * ## Purpose
 * - Register and organize all API routes
 * - Attach metadata (auth, rate limits, schemas)
 * - Generate route documentation
 * - Enable route discovery for testing
 *
 * ## Usage
 * ```typescript
 * import { registerRoute, getRoute, getAllRoutes } from './routeRegistry';
 *
 * // Register a route
 * registerRoute({
 *   method: 'POST',
 *   path: '/api/newsletters',
 *   handler: createNewsletter,
 *   authType: 'none',
 *   inputSchema: CreateNewsletterSchema,
 * });
 *
 * // Get all routes
 * const routes = getAllRoutes();
 * ```
 *
 * @module control-plane/router/routeRegistry
 */

import type { ZodSchema } from 'zod';
import { logger } from '../feedback';

// =============================================================================
// TYPES
// =============================================================================

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Route authentication type
 */
export type RouteAuthType = 'api_key' | 'oauth' | 'none';

/**
 * Rate limit tier
 */
export type RateLimitTier = 'low' | 'medium' | 'high' | 'unlimited';

/**
 * Route category for organization
 */
export type RouteCategory =
  | 'newsletter'
  | 'generation'
  | 'topics'
  | 'subscribers'
  | 'personas'
  | 'templates'
  | 'drafts'
  | 'calendar'
  | 'auth'
  | 'health'
  | 'logs'
  | 'other';

/**
 * Route definition
 */
export interface RouteDefinition {
  /** HTTP method */
  method: HttpMethod;
  /** Route path (Express-style with params like :id) */
  path: string;
  /** Human-readable description */
  description?: string;
  /** Route category for organization */
  category: RouteCategory;
  /** Authentication requirement */
  authType: RouteAuthType;
  /** Rate limit tier */
  rateLimitTier?: RateLimitTier;
  /** Input validation schema */
  inputSchema?: ZodSchema;
  /** Output validation schema */
  outputSchema?: ZodSchema;
  /** Tags for documentation */
  tags?: string[];
  /** Whether route is deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecationMessage?: string;
  /** Custom timeout in ms */
  timeout?: number;
}

/**
 * Registered route with handler
 */
export interface RegisteredRoute extends RouteDefinition {
  /** Route handler function */
  handler: RouteHandler;
  /** Route registration timestamp */
  registeredAt: Date;
  /** Route ID (method:path) */
  id: string;
}

/**
 * Route handler function
 */
export type RouteHandler = (
  req: {
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
    headers?: Record<string, string | string[] | undefined>;
    context?: { correlationId: string };
  },
  res: {
    status: (code: number) => { json: (data: unknown) => void };
    json: (data: unknown) => void;
  },
  next?: (error?: unknown) => void
) => void | Promise<void>;

// =============================================================================
// REGISTRY STORAGE
// =============================================================================

const routeStore = new Map<string, RegisteredRoute>();
const routesByCategory = new Map<RouteCategory, Set<string>>();

/**
 * Generate route ID from method and path
 */
function generateRouteId(method: HttpMethod, path: string): string {
  return `${method}:${path}`;
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register a route
 */
export function registerRoute(
  definition: RouteDefinition,
  handler: RouteHandler
): void {
  const id = generateRouteId(definition.method, definition.path);

  if (routeStore.has(id)) {
    logger.warn(
      'routeRegistry',
      'route_exists',
      `Route ${id} already registered, overwriting`,
      { method: definition.method, path: definition.path }
    );
  }

  const route: RegisteredRoute = {
    ...definition,
    handler,
    registeredAt: new Date(),
    id,
  };

  routeStore.set(id, route);

  // Index by category
  if (!routesByCategory.has(definition.category)) {
    routesByCategory.set(definition.category, new Set());
  }
  routesByCategory.get(definition.category)!.add(id);

  logger.debug(
    'routeRegistry',
    'route_registered',
    `Registered route: ${id}`,
    {
      method: definition.method,
      path: definition.path,
      category: definition.category,
      authType: definition.authType,
    }
  );
}

/**
 * Unregister a route
 */
export function unregisterRoute(method: HttpMethod, path: string): boolean {
  const id = generateRouteId(method, path);
  const route = routeStore.get(id);

  if (!route) {
    return false;
  }

  routeStore.delete(id);
  routesByCategory.get(route.category)?.delete(id);

  logger.debug(
    'routeRegistry',
    'route_unregistered',
    `Unregistered route: ${id}`,
    { method, path }
  );

  return true;
}

/**
 * Clear all registered routes
 */
export function clearRoutes(): void {
  routeStore.clear();
  routesByCategory.clear();
  logger.debug('routeRegistry', 'routes_cleared', 'All routes cleared');
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get a route by method and path
 */
export function getRoute(
  method: HttpMethod,
  path: string
): RegisteredRoute | undefined {
  return routeStore.get(generateRouteId(method, path));
}

/**
 * Check if route exists
 */
export function hasRoute(method: HttpMethod, path: string): boolean {
  return routeStore.has(generateRouteId(method, path));
}

/**
 * Get all registered routes
 */
export function getAllRoutes(): RegisteredRoute[] {
  return Array.from(routeStore.values());
}

/**
 * Get routes by category
 */
export function getRoutesByCategory(category: RouteCategory): RegisteredRoute[] {
  const ids = routesByCategory.get(category);
  if (!ids) {
    return [];
  }
  return Array.from(ids)
    .map((id) => routeStore.get(id))
    .filter((r): r is RegisteredRoute => r !== undefined);
}

/**
 * Get routes by auth type
 */
export function getRoutesByAuthType(authType: RouteAuthType): RegisteredRoute[] {
  return getAllRoutes().filter((r) => r.authType === authType);
}

/**
 * Get routes by method
 */
export function getRoutesByMethod(method: HttpMethod): RegisteredRoute[] {
  return getAllRoutes().filter((r) => r.method === method);
}

/**
 * Get deprecated routes
 */
export function getDeprecatedRoutes(): RegisteredRoute[] {
  return getAllRoutes().filter((r) => r.deprecated);
}

/**
 * Search routes by path pattern
 */
export function searchRoutes(pattern: string | RegExp): RegisteredRoute[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  return getAllRoutes().filter((r) => regex.test(r.path));
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Route registry statistics
 */
export interface RouteStats {
  total: number;
  byCategory: Record<RouteCategory, number>;
  byAuthType: Record<RouteAuthType, number>;
  byMethod: Record<HttpMethod, number>;
  deprecated: number;
}

/**
 * Get registry statistics
 */
export function getRouteStats(): RouteStats {
  const routes = getAllRoutes();

  const byCategory: Partial<Record<RouteCategory, number>> = {};
  const byAuthType: Partial<Record<RouteAuthType, number>> = {};
  const byMethod: Partial<Record<HttpMethod, number>> = {};
  let deprecated = 0;

  for (const route of routes) {
    byCategory[route.category] = (byCategory[route.category] || 0) + 1;
    byAuthType[route.authType] = (byAuthType[route.authType] || 0) + 1;
    byMethod[route.method] = (byMethod[route.method] || 0) + 1;
    if (route.deprecated) {
      deprecated++;
    }
  }

  return {
    total: routes.length,
    byCategory: byCategory as Record<RouteCategory, number>,
    byAuthType: byAuthType as Record<RouteAuthType, number>,
    byMethod: byMethod as Record<HttpMethod, number>,
    deprecated,
  };
}

// =============================================================================
// DOCUMENTATION GENERATION
// =============================================================================

/**
 * Route documentation entry
 */
export interface RouteDoc {
  method: string;
  path: string;
  description?: string;
  category: string;
  authType: string;
  deprecated: boolean;
  tags: string[];
  inputSchema?: string;
  outputSchema?: string;
}

/**
 * Generate documentation for all routes
 */
export function generateRouteDocumentation(): RouteDoc[] {
  return getAllRoutes()
    .sort((a, b) => {
      // Sort by category, then by path
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.path.localeCompare(b.path);
    })
    .map((route) => ({
      method: route.method,
      path: route.path,
      description: route.description,
      category: route.category,
      authType: route.authType,
      deprecated: route.deprecated || false,
      tags: route.tags || [],
      inputSchema: route.inputSchema
        ? `${route.inputSchema.description || 'Schema'}`
        : undefined,
      outputSchema: route.outputSchema
        ? `${route.outputSchema.description || 'Schema'}`
        : undefined,
    }));
}

/**
 * Generate OpenAPI-style paths object
 */
export function generateOpenApiPaths(): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of getAllRoutes()) {
    // Convert Express path params to OpenAPI format
    const openApiPath = route.path.replace(/:([^/]+)/g, '{$1}');

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    paths[openApiPath][route.method.toLowerCase()] = {
      summary: route.description,
      tags: [route.category, ...(route.tags || [])],
      deprecated: route.deprecated,
      security:
        route.authType === 'none'
          ? []
          : route.authType === 'api_key'
            ? [{ ApiKeyAuth: [] }]
            : [{ OAuth2: [] }],
      responses: {
        '200': {
          description: 'Successful response',
        },
        '400': {
          description: 'Validation error',
        },
        '401': {
          description: 'Authentication required',
        },
        '500': {
          description: 'Internal server error',
        },
      },
    };
  }

  return paths;
}

// =============================================================================
// ROUTE MATCHING
// =============================================================================

/**
 * Match a request path to a registered route
 * Supports Express-style path parameters
 */
export function matchRoute(
  method: HttpMethod,
  requestPath: string
): { route: RegisteredRoute; params: Record<string, string> } | null {
  // Try exact match first
  const exactMatch = getRoute(method, requestPath);
  if (exactMatch) {
    return { route: exactMatch, params: {} };
  }

  // Try pattern matching
  for (const route of getAllRoutes()) {
    if (route.method !== method) {
      continue;
    }

    const params = matchPath(route.path, requestPath);
    if (params !== null) {
      return { route, params };
    }
  }

  return null;
}

/**
 * Match a path pattern to a request path
 * Returns params if matched, null if not matched
 */
function matchPath(
  pattern: string,
  path: string
): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      // Parameter - extract name and capture value
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      // Literal doesn't match
      return null;
    }
  }

  return params;
}

// =============================================================================
// BULK REGISTRATION
// =============================================================================

/**
 * Route definition for bulk registration
 */
export interface BulkRouteDefinition extends Omit<RouteDefinition, 'handler'> {
  handler: RouteHandler;
}

/**
 * Register multiple routes at once
 */
export function registerRoutes(routes: BulkRouteDefinition[]): void {
  for (const route of routes) {
    registerRoute(route, route.handler);
  }

  logger.info(
    'routeRegistry',
    'bulk_registered',
    `Registered ${routes.length} routes`,
    { count: routes.length }
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export const routeRegistry = {
  register: registerRoute,
  unregister: unregisterRoute,
  clear: clearRoutes,
  get: getRoute,
  has: hasRoute,
  getAll: getAllRoutes,
  getByCategory: getRoutesByCategory,
  getByAuthType: getRoutesByAuthType,
  getByMethod: getRoutesByMethod,
  getDeprecated: getDeprecatedRoutes,
  search: searchRoutes,
  match: matchRoute,
  stats: getRouteStats,
  docs: generateRouteDocumentation,
  openApi: generateOpenApiPaths,
};
