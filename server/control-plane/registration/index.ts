/**
 * Registration Module - Public Exports
 *
 * Provides tool registry and definitions for the Control Plane.
 *
 * @module control-plane/registration
 */

// Tool Registry
export {
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
} from './toolRegistry.ts';

// Tool Definitions
export {
  // AI Tools
  claudeTool,
  stabilityTool,
  // Search Tools
  braveSearchTool,
  // Google Tools
  googleOAuthTool,
  googleDriveTool,
  googleGmailTool,
  googleSheetsTool,
  // Database Tools
  newsletterDbTool,
  subscriberDbTool,
  personaDbTool,
  templateDbTool,
  draftDbTool,
  calendarDbTool,
  thumbnailDbTool,
  apiKeyDbTool,
  logsDbTool,
  // Content Source Tools
  hackerNewsTool,
  arxivTool,
  githubTool,
  redditTool,
  // Collections
  allToolDefinitions,
  getToolDefinitionsByCategory,
  getToolDefinition,
} from './toolDefinitions.ts';
