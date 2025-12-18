/**
 * Intent Classifier
 *
 * Classifies incoming requests into intents and maps them to tools.
 * Enables dynamic tool selection based on request context.
 *
 * ## Purpose
 * - Parse request method and path into structured intent
 * - Map intents to required tools
 * - Determine authentication requirements
 * - Generate execution plans for complex operations
 *
 * ## Usage
 * ```typescript
 * import { classifyIntent, resolveTools } from './intentClassifier';
 *
 * const intent = classifyIntent('POST', '/api/generateNewsletter');
 * // { action: 'generate', resource: 'newsletter', ... }
 *
 * const tools = resolveTools(intent);
 * // ['claude', 'stability', 'db-newsletter']
 * ```
 *
 * @module control-plane/resolver/intentClassifier
 */

import { ResolvedIntent, ExecutionStep } from '../types';
import { logger } from '../feedback';

// =============================================================================
// INTENT TYPES
// =============================================================================

/**
 * Parsed route information
 */
interface ParsedRoute {
  resource: string;
  action: string;
  subAction?: string;
  params: Record<string, string>;
}

/**
 * Route pattern definition
 */
interface RoutePattern {
  pattern: RegExp;
  resource: string;
  action: string;
  subAction?: string;
  tools: string[];
  requiresAuth: boolean;
  authType?: 'api_key' | 'oauth';
}

// =============================================================================
// ROUTE PATTERNS
// =============================================================================

/**
 * Route patterns for intent classification
 *
 * Order matters - more specific patterns should come first
 */
const routePatterns: RoutePattern[] = [
  // Newsletter Generation
  {
    pattern: /^POST \/api\/generateNewsletter$/,
    resource: 'newsletter',
    action: 'generate',
    tools: ['claude', 'stability', 'db-newsletter'],
    requiresAuth: true,
    authType: 'api_key',
  },
  {
    pattern: /^POST \/api\/generateEnhancedNewsletter$/,
    resource: 'newsletter',
    action: 'generate',
    subAction: 'enhanced',
    tools: ['claude', 'stability', 'db-newsletter'],
    requiresAuth: true,
    authType: 'api_key',
  },
  {
    pattern: /^POST \/api\/generateImage$/,
    resource: 'image',
    action: 'generate',
    tools: ['stability'],
    requiresAuth: true,
    authType: 'api_key',
  },
  {
    pattern: /^POST \/api\/generateTopicSuggestions$/,
    resource: 'topics',
    action: 'generate',
    tools: ['claude'],
    requiresAuth: true,
    authType: 'api_key',
  },
  {
    pattern: /^POST \/api\/generateCompellingTrendingContent$/,
    resource: 'content',
    action: 'generate',
    subAction: 'compelling',
    tools: ['claude'],
    requiresAuth: true,
    authType: 'api_key',
  },

  // Trending Sources
  {
    pattern: /^GET \/api\/fetchTrendingSources$/,
    resource: 'sources',
    action: 'fetch',
    tools: ['source-hackernews', 'source-arxiv', 'source-github', 'source-reddit'],
    requiresAuth: false,
  },

  // Newsletter CRUD
  {
    pattern: /^GET \/api\/newsletters$/,
    resource: 'newsletter',
    action: 'list',
    tools: ['db-newsletter'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/newsletters\/([^/]+)$/,
    resource: 'newsletter',
    action: 'read',
    tools: ['db-newsletter'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/newsletters$/,
    resource: 'newsletter',
    action: 'create',
    tools: ['db-newsletter'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/newsletters\/([^/]+)$/,
    resource: 'newsletter',
    action: 'update',
    tools: ['db-newsletter'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/newsletters\/([^/]+)\/sections$/,
    resource: 'newsletter',
    action: 'update',
    subAction: 'sections',
    tools: ['db-newsletter'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/newsletters\/([^/]+)$/,
    resource: 'newsletter',
    action: 'delete',
    tools: ['db-newsletter'],
    requiresAuth: false,
  },

  // Subscribers
  {
    pattern: /^GET \/api\/subscribers$/,
    resource: 'subscriber',
    action: 'list',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/subscribers$/,
    resource: 'subscriber',
    action: 'create',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/subscribers\/import$/,
    resource: 'subscriber',
    action: 'import',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/subscribers\/([^/]+)$/,
    resource: 'subscriber',
    action: 'update',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/subscribers\/([^/]+)$/,
    resource: 'subscriber',
    action: 'delete',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },

  // Subscriber Lists
  {
    pattern: /^GET \/api\/subscriber-lists$/,
    resource: 'subscriber-list',
    action: 'list',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/subscriber-lists$/,
    resource: 'subscriber-list',
    action: 'create',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/subscriber-lists\/([^/]+)$/,
    resource: 'subscriber-list',
    action: 'update',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/subscriber-lists\/([^/]+)$/,
    resource: 'subscriber-list',
    action: 'delete',
    tools: ['db-subscriber'],
    requiresAuth: false,
  },

  // Personas
  {
    pattern: /^GET \/api\/personas$/,
    resource: 'persona',
    action: 'list',
    tools: ['db-persona'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/personas\/active$/,
    resource: 'persona',
    action: 'read',
    subAction: 'active',
    tools: ['db-persona'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/personas\/([^/]+)$/,
    resource: 'persona',
    action: 'read',
    tools: ['db-persona'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/personas$/,
    resource: 'persona',
    action: 'create',
    tools: ['db-persona'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/personas\/([^/]+)$/,
    resource: 'persona',
    action: 'update',
    tools: ['db-persona'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/personas\/([^/]+)\/activate$/,
    resource: 'persona',
    action: 'activate',
    tools: ['db-persona'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/personas\/([^/]+)$/,
    resource: 'persona',
    action: 'delete',
    tools: ['db-persona'],
    requiresAuth: false,
  },

  // Templates
  {
    pattern: /^GET \/api\/templates$/,
    resource: 'template',
    action: 'list',
    tools: ['db-template'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/templates\/([^/]+)$/,
    resource: 'template',
    action: 'read',
    tools: ['db-template'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/templates$/,
    resource: 'template',
    action: 'create',
    tools: ['db-template'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/templates\/from-newsletter$/,
    resource: 'template',
    action: 'create',
    subAction: 'from-newsletter',
    tools: ['db-template'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/templates\/([^/]+)$/,
    resource: 'template',
    action: 'update',
    tools: ['db-template'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/templates\/([^/]+)$/,
    resource: 'template',
    action: 'delete',
    tools: ['db-template'],
    requiresAuth: false,
  },

  // Drafts
  {
    pattern: /^GET \/api\/drafts\/([^/]+)\/exists$/,
    resource: 'draft',
    action: 'exists',
    tools: ['db-draft'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/drafts\/([^/]+)$/,
    resource: 'draft',
    action: 'read',
    tools: ['db-draft'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/drafts$/,
    resource: 'draft',
    action: 'save',
    tools: ['db-draft'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/drafts\/([^/]+)$/,
    resource: 'draft',
    action: 'delete',
    tools: ['db-draft'],
    requiresAuth: false,
  },

  // Calendar
  {
    pattern: /^GET \/api\/calendar$/,
    resource: 'calendar',
    action: 'list',
    tools: ['db-calendar'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/calendar\/([^/]+)$/,
    resource: 'calendar',
    action: 'read',
    tools: ['db-calendar'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/calendar$/,
    resource: 'calendar',
    action: 'create',
    tools: ['db-calendar'],
    requiresAuth: false,
  },
  {
    pattern: /^PUT \/api\/calendar\/([^/]+)$/,
    resource: 'calendar',
    action: 'update',
    tools: ['db-calendar'],
    requiresAuth: false,
  },
  {
    pattern: /^DELETE \/api\/calendar\/([^/]+)$/,
    resource: 'calendar',
    action: 'delete',
    tools: ['db-calendar'],
    requiresAuth: false,
  },

  // Thumbnails
  {
    pattern: /^GET \/api\/thumbnails$/,
    resource: 'thumbnail',
    action: 'list',
    tools: ['db-thumbnail'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/thumbnails\/status$/,
    resource: 'thumbnail',
    action: 'status',
    tools: ['db-thumbnail'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/thumbnails\/([^/]+)\/generate$/,
    resource: 'thumbnail',
    action: 'generate',
    tools: ['stability', 'db-thumbnail'],
    requiresAuth: true,
    authType: 'api_key',
  },
  {
    pattern: /^DELETE \/api\/thumbnails\/([^/]+)$/,
    resource: 'thumbnail',
    action: 'delete',
    tools: ['db-thumbnail'],
    requiresAuth: false,
  },

  // Google OAuth
  {
    pattern: /^POST \/api\/oauth\/google\/url$/,
    resource: 'oauth',
    action: 'initiate',
    tools: ['google-oauth'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/oauth\/google\/callback$/,
    resource: 'oauth',
    action: 'callback',
    tools: ['google-oauth'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/oauth\/google\/status$/,
    resource: 'oauth',
    action: 'status',
    tools: ['google-oauth'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/oauth\/google\/revoke$/,
    resource: 'oauth',
    action: 'revoke',
    tools: ['google-oauth'],
    requiresAuth: false,
  },

  // Google Drive
  {
    pattern: /^POST \/api\/saveToDrive$/,
    resource: 'drive',
    action: 'save',
    tools: ['google-drive'],
    requiresAuth: true,
    authType: 'oauth',
  },
  {
    pattern: /^GET \/api\/loadFromDrive$/,
    resource: 'drive',
    action: 'load',
    tools: ['google-drive'],
    requiresAuth: true,
    authType: 'oauth',
  },

  // Gmail
  {
    pattern: /^POST \/api\/sendEmail$/,
    resource: 'email',
    action: 'send',
    tools: ['google-gmail', 'db-subscriber'],
    requiresAuth: true,
    authType: 'oauth',
  },

  // Presets
  {
    pattern: /^POST \/api\/savePresets$/,
    resource: 'preset',
    action: 'save',
    tools: ['google-sheets'],
    requiresAuth: true,
    authType: 'oauth',
  },
  {
    pattern: /^GET \/api\/loadPresets$/,
    resource: 'preset',
    action: 'load',
    tools: ['google-sheets'],
    requiresAuth: true,
    authType: 'oauth',
  },

  // API Keys
  {
    pattern: /^POST \/api\/api-keys$/,
    resource: 'api-key',
    action: 'save',
    tools: ['db-apikey'],
    requiresAuth: false,
  },
  {
    pattern: /^POST \/api\/api-keys\/validate$/,
    resource: 'api-key',
    action: 'validate',
    tools: ['db-apikey', 'claude', 'stability'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/api-keys\/status$/,
    resource: 'api-key',
    action: 'status',
    tools: ['db-apikey'],
    requiresAuth: false,
  },

  // Logs
  {
    pattern: /^GET \/api\/logs$/,
    resource: 'logs',
    action: 'list',
    tools: ['db-logs'],
    requiresAuth: false,
  },
  {
    pattern: /^GET \/api\/logs\/stats$/,
    resource: 'logs',
    action: 'stats',
    tools: ['db-logs'],
    requiresAuth: false,
  },

  // Health
  {
    pattern: /^GET \/api\/health$/,
    resource: 'health',
    action: 'check',
    tools: [],
    requiresAuth: false,
  },
];

// =============================================================================
// CLASSIFICATION FUNCTIONS
// =============================================================================

/**
 * Classify a request into an intent
 *
 * @param method - HTTP method
 * @param path - Request path
 * @returns Resolved intent or null if no match
 */
export function classifyIntent(method: string, path: string): ResolvedIntent | null {
  const routeKey = `${method.toUpperCase()} ${path}`;

  for (const pattern of routePatterns) {
    const match = routeKey.match(pattern.pattern);
    if (match) {
      // Extract path parameters if any
      const params: Record<string, string> = {};
      if (match.length > 1) {
        params.id = match[1];
      }

      logger.debug(
        'intentClassifier',
        'classify',
        `Classified intent: ${pattern.resource}.${pattern.action}`,
        { method, path, resource: pattern.resource, action: pattern.action }
      );

      return {
        action: pattern.action,
        resource: pattern.resource,
        subAction: pattern.subAction,
        tools: pattern.tools,
        authRequired: pattern.requiresAuth,
        executionPlan: createExecutionPlan(pattern.tools),
      };
    }
  }

  logger.warn(
    'intentClassifier',
    'classify',
    `No intent match found for route`,
    { method, path }
  );

  return null;
}

/**
 * Create an execution plan for a list of tools
 *
 * @param tools - List of tool IDs
 * @returns Execution steps
 */
function createExecutionPlan(tools: string[]): ExecutionStep[] {
  // Simple sequential execution by default
  // Complex operations (like newsletter generation) can have custom plans
  return tools.map((toolId, index) => ({
    order: index,
    toolId,
    parallel: false,
    dependsOn: index > 0 ? [index - 1] : [],
    timeout: getToolTimeout(toolId),
  }));
}

/**
 * Get default timeout for a tool
 */
function getToolTimeout(toolId: string): number {
  // AI tools need longer timeouts
  if (toolId === 'claude') return 120000; // 2 minutes
  if (toolId === 'stability') return 60000; // 1 minute
  if (toolId.startsWith('source-')) return 30000; // 30 seconds
  if (toolId.startsWith('google-')) return 30000; // 30 seconds
  return 10000; // 10 seconds default
}

/**
 * Get tools required for an intent
 *
 * @param intent - Resolved intent
 * @returns List of tool IDs
 */
export function resolveTools(intent: ResolvedIntent): string[] {
  return intent.tools;
}

/**
 * Check if intent requires authentication
 */
export function requiresAuth(intent: ResolvedIntent): boolean {
  return intent.authRequired;
}

/**
 * Get the auth type required for an intent
 */
export function getAuthType(method: string, path: string): 'api_key' | 'oauth' | 'none' {
  const routeKey = `${method.toUpperCase()} ${path}`;

  for (const pattern of routePatterns) {
    const match = routeKey.match(pattern.pattern);
    if (match) {
      return pattern.authType || 'none';
    }
  }

  return 'none';
}

/**
 * Get all registered route patterns (for documentation)
 */
export function getAllRoutePatterns(): Array<{
  pattern: string;
  resource: string;
  action: string;
  tools: string[];
  requiresAuth: boolean;
}> {
  return routePatterns.map((p) => ({
    pattern: p.pattern.source,
    resource: p.resource,
    action: p.action,
    tools: p.tools,
    requiresAuth: p.requiresAuth,
  }));
}
