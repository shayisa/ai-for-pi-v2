/**
 * Tool Registry
 *
 * Central registry for all tools/services available in the Control Plane.
 * Each tool represents an external API, database operation, or internal service.
 *
 * ## Purpose
 * - Register and discover available tools
 * - Store tool metadata (rate limits, auth requirements)
 * - Enable dynamic tool selection
 * - Provide tool lifecycle management
 *
 * ## Usage
 * ```typescript
 * import { toolRegistry, registerTool, getTool } from './toolRegistry';
 *
 * // Register a tool
 * registerTool({
 *   id: 'claude',
 *   name: 'Claude AI',
 *   category: 'ai',
 *   handler: claudeHandler,
 *   // ...
 * });
 *
 * // Get a tool
 * const tool = getTool('claude');
 * const result = await tool.handler(input);
 * ```
 *
 * @module control-plane/registration/toolRegistry
 */

import { Tool, ToolCategory, RateLimitTier } from '../types';
import { logger } from '../feedback';

// =============================================================================
// TOOL HANDLER TYPE
// =============================================================================

/**
 * Tool handler function type
 */
export type ToolHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolContext
) => Promise<TOutput>;

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  correlationId: string;
  userId?: string;
  userEmail?: string;
  /** Result from previous tool in chain */
  previousResult?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Extended tool definition with handler
 */
export interface RegisteredTool extends Tool {
  /** Handler function for the tool */
  handler: ToolHandler;
  /** Whether the tool is currently enabled */
  enabled: boolean;
  /** When the tool was registered */
  registeredAt: Date;
  /** Health check function */
  healthCheck?: () => Promise<boolean>;
}

// =============================================================================
// REGISTRY STORAGE
// =============================================================================

/**
 * Tool registry storage
 */
const registry = new Map<string, RegisteredTool>();

/**
 * Category index for fast lookups
 */
const categoryIndex = new Map<ToolCategory, Set<string>>();

// =============================================================================
// REGISTRATION FUNCTIONS
// =============================================================================

/**
 * Register a new tool
 *
 * @param tool - Tool definition
 * @param handler - Tool handler function
 * @param options - Additional options
 */
export function registerTool(
  tool: Omit<Tool, 'id'> & { id: string },
  handler: ToolHandler,
  options?: {
    enabled?: boolean;
    healthCheck?: () => Promise<boolean>;
  }
): void {
  if (registry.has(tool.id)) {
    logger.warn(
      'toolRegistry',
      'register',
      `Tool "${tool.id}" is already registered, overwriting`,
      { toolId: tool.id }
    );
  }

  const registeredTool: RegisteredTool = {
    ...tool,
    handler,
    enabled: options?.enabled ?? true,
    registeredAt: new Date(),
    healthCheck: options?.healthCheck,
  };

  registry.set(tool.id, registeredTool);

  // Update category index
  if (!categoryIndex.has(tool.category)) {
    categoryIndex.set(tool.category, new Set());
  }
  categoryIndex.get(tool.category)!.add(tool.id);

  logger.info(
    'toolRegistry',
    'register',
    `Tool "${tool.name}" registered`,
    { toolId: tool.id, category: tool.category }
  );
}

/**
 * Unregister a tool
 */
export function unregisterTool(toolId: string): boolean {
  const tool = registry.get(toolId);
  if (!tool) {
    return false;
  }

  registry.delete(toolId);

  // Update category index
  const categoryTools = categoryIndex.get(tool.category);
  if (categoryTools) {
    categoryTools.delete(toolId);
  }

  logger.info(
    'toolRegistry',
    'unregister',
    `Tool "${tool.name}" unregistered`,
    { toolId }
  );

  return true;
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get a tool by ID
 */
export function getTool(toolId: string): RegisteredTool | undefined {
  return registry.get(toolId);
}

/**
 * Get an enabled tool by ID (returns undefined if disabled)
 */
export function getEnabledTool(toolId: string): RegisteredTool | undefined {
  const tool = registry.get(toolId);
  return tool?.enabled ? tool : undefined;
}

/**
 * Check if a tool exists
 */
export function hasTool(toolId: string): boolean {
  return registry.has(toolId);
}

/**
 * Get all registered tools
 */
export function getAllTools(): RegisteredTool[] {
  return Array.from(registry.values());
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): RegisteredTool[] {
  const toolIds = categoryIndex.get(category);
  if (!toolIds) {
    return [];
  }

  return Array.from(toolIds)
    .map((id) => registry.get(id)!)
    .filter(Boolean);
}

/**
 * Get enabled tools by category
 */
export function getEnabledToolsByCategory(category: ToolCategory): RegisteredTool[] {
  return getToolsByCategory(category).filter((t) => t.enabled);
}

/**
 * Get tools that require authentication
 */
export function getToolsRequiringAuth(): RegisteredTool[] {
  return getAllTools().filter((t) => t.requiresAuth);
}

/**
 * Search tools by name or description
 */
export function searchTools(query: string): RegisteredTool[] {
  const lowerQuery = query.toLowerCase();
  return getAllTools().filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );
}

// =============================================================================
// TOOL STATE MANAGEMENT
// =============================================================================

/**
 * Enable a tool
 */
export function enableTool(toolId: string): boolean {
  const tool = registry.get(toolId);
  if (!tool) {
    return false;
  }

  tool.enabled = true;
  logger.info('toolRegistry', 'enable', `Tool "${tool.name}" enabled`, { toolId });
  return true;
}

/**
 * Disable a tool
 */
export function disableTool(toolId: string): boolean {
  const tool = registry.get(toolId);
  if (!tool) {
    return false;
  }

  tool.enabled = false;
  logger.info('toolRegistry', 'disable', `Tool "${tool.name}" disabled`, { toolId });
  return true;
}

/**
 * Check tool health
 */
export async function checkToolHealth(toolId: string): Promise<boolean> {
  const tool = registry.get(toolId);
  if (!tool) {
    return false;
  }

  if (!tool.healthCheck) {
    // No health check defined, assume healthy
    return true;
  }

  try {
    return await tool.healthCheck();
  } catch (error) {
    logger.error(
      'toolRegistry',
      'health_check',
      `Health check failed for tool "${tool.name}"`,
      error instanceof Error ? error : new Error(String(error)),
      { toolId }
    );
    return false;
  }
}

/**
 * Check health of all tools
 */
export async function checkAllToolsHealth(): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  const checks = Array.from(registry.keys()).map(async (toolId) => {
    const healthy = await checkToolHealth(toolId);
    results.set(toolId, healthy);
  });

  await Promise.all(checks);
  return results;
}

// =============================================================================
// REGISTRY INFO
// =============================================================================

/**
 * Get registry statistics
 */
export function getRegistryStats(): {
  total: number;
  enabled: number;
  disabled: number;
  byCategory: Record<string, number>;
  byAuthType: Record<string, number>;
} {
  const tools = getAllTools();
  const byCategory: Record<string, number> = {};
  const byAuthType: Record<string, number> = {};

  for (const tool of tools) {
    byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
    const authType = tool.authType || 'none';
    byAuthType[authType] = (byAuthType[authType] || 0) + 1;
  }

  return {
    total: tools.length,
    enabled: tools.filter((t) => t.enabled).length,
    disabled: tools.filter((t) => !t.enabled).length,
    byCategory,
    byAuthType,
  };
}

/**
 * Clear the registry (for testing)
 */
export function clearRegistry(): void {
  registry.clear();
  categoryIndex.clear();
  logger.debug('toolRegistry', 'clear', 'Registry cleared');
}

// =============================================================================
// TOOL REGISTRY SINGLETON
// =============================================================================

/**
 * Tool registry API
 */
export const toolRegistry = {
  register: registerTool,
  unregister: unregisterTool,
  get: getTool,
  getEnabled: getEnabledTool,
  has: hasTool,
  getAll: getAllTools,
  getByCategory: getToolsByCategory,
  getEnabledByCategory: getEnabledToolsByCategory,
  getRequiringAuth: getToolsRequiringAuth,
  search: searchTools,
  enable: enableTool,
  disable: disableTool,
  checkHealth: checkToolHealth,
  checkAllHealth: checkAllToolsHealth,
  getStats: getRegistryStats,
  clear: clearRegistry,
};
