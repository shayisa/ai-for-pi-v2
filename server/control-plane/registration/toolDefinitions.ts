/**
 * Tool Definitions
 *
 * Defines all tools available in the AI Newsletter Generator.
 * These definitions are used by the Tool Registry.
 *
 * ## Tool Categories
 * - **ai**: AI/ML services (Claude, Stability AI)
 * - **search**: Search services (Brave Search)
 * - **storage**: File storage (Google Drive)
 * - **email**: Email services (Gmail)
 * - **auth**: Authentication services (Google OAuth)
 * - **data**: Database operations (SQLite)
 *
 * @module control-plane/registration/toolDefinitions
 */

import { Tool, ToolCategory, RateLimitTier } from '../types';

// =============================================================================
// AI TOOLS
// =============================================================================

/**
 * Claude AI tool definition
 */
export const claudeTool: Tool = {
  id: 'claude',
  name: 'Claude AI',
  description: 'Anthropic Claude for content generation, topic suggestions, and compelling insights',
  category: 'ai',
  rateLimitTier: 'medium',
  requiresAuth: true,
  authType: 'api_key',
  metadata: {
    provider: 'anthropic',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
    capabilities: ['text-generation', 'web-search'],
    endpoints: [
      '/api/generateNewsletter',
      '/api/generateTopicSuggestions',
      '/api/generateCompellingTrendingContent',
      '/api/generateEnhancedNewsletter',
    ],
  },
};

/**
 * Stability AI tool definition
 */
export const stabilityTool: Tool = {
  id: 'stability',
  name: 'Stability AI',
  description: 'Stability AI for image generation with various style presets',
  category: 'ai',
  rateLimitTier: 'high',
  requiresAuth: true,
  authType: 'api_key',
  metadata: {
    provider: 'stability',
    models: ['stable-diffusion-xl-1024-v1-0'],
    capabilities: ['image-generation'],
    endpoints: ['/api/generateImage', '/api/thumbnails/:styleName/generate'],
    imageStyles: [
      'photorealistic',
      'digital-art',
      'cinematic',
      'anime',
      'low-poly',
      'origami',
      'line-art',
      'pixel-art',
      'fantasy-art',
    ],
  },
};

// =============================================================================
// SEARCH TOOLS
// =============================================================================

/**
 * Brave Search tool definition
 */
export const braveSearchTool: Tool = {
  id: 'brave-search',
  name: 'Brave Search',
  description: 'Brave Search API for web search and trending content discovery',
  category: 'search',
  rateLimitTier: 'medium',
  requiresAuth: true,
  authType: 'api_key',
  metadata: {
    provider: 'brave',
    capabilities: ['web-search', 'news-search'],
    endpoints: ['/api/fetchTrendingSources'],
  },
};

// =============================================================================
// GOOGLE TOOLS
// =============================================================================

/**
 * Google OAuth tool definition
 */
export const googleOAuthTool: Tool = {
  id: 'google-oauth',
  name: 'Google OAuth',
  description: 'Google OAuth 2.0 authentication for workspace integrations',
  category: 'auth',
  rateLimitTier: 'low',
  requiresAuth: false,
  metadata: {
    provider: 'google',
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    endpoints: [
      '/api/oauth/google/url',
      '/api/oauth/google/callback',
      '/api/oauth/google/status',
      '/api/oauth/google/revoke',
    ],
  },
};

/**
 * Google Drive tool definition
 */
export const googleDriveTool: Tool = {
  id: 'google-drive',
  name: 'Google Drive',
  description: 'Google Drive for saving and loading newsletters',
  category: 'storage',
  rateLimitTier: 'low',
  requiresAuth: true,
  authType: 'oauth',
  metadata: {
    provider: 'google',
    capabilities: ['file-upload', 'file-download', 'folder-management'],
    endpoints: ['/api/saveToDrive', '/api/loadFromDrive', '/api/listDriveFiles'],
  },
};

/**
 * Google Gmail tool definition
 */
export const googleGmailTool: Tool = {
  id: 'google-gmail',
  name: 'Gmail',
  description: 'Gmail for sending newsletters to subscribers',
  category: 'email',
  rateLimitTier: 'high',
  requiresAuth: true,
  authType: 'oauth',
  metadata: {
    provider: 'google',
    capabilities: ['email-send'],
    endpoints: ['/api/sendEmail'],
    limits: {
      dailyLimit: 500,
      recipientsPerEmail: 100,
    },
  },
};

/**
 * Google Sheets tool definition
 */
export const googleSheetsTool: Tool = {
  id: 'google-sheets',
  name: 'Google Sheets',
  description: 'Google Sheets for preset storage and subscriber management',
  category: 'storage',
  rateLimitTier: 'low',
  requiresAuth: true,
  authType: 'oauth',
  metadata: {
    provider: 'google',
    capabilities: ['spreadsheet-read', 'spreadsheet-write'],
    endpoints: ['/api/savePresets', '/api/loadPresets'],
  },
};

// =============================================================================
// DATABASE TOOLS
// =============================================================================

/**
 * Newsletter database tool definition
 */
export const newsletterDbTool: Tool = {
  id: 'db-newsletter',
  name: 'Newsletter Database',
  description: 'SQLite operations for newsletter CRUD',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['newsletters', 'newsletter_logs'],
    operations: ['create', 'read', 'update', 'delete', 'list'],
    endpoints: ['/api/newsletters', '/api/newsletters/:id'],
  },
};

/**
 * Subscriber database tool definition
 */
export const subscriberDbTool: Tool = {
  id: 'db-subscriber',
  name: 'Subscriber Database',
  description: 'SQLite operations for subscriber and list management',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['subscribers', 'subscriber_lists'],
    operations: ['create', 'read', 'update', 'delete', 'list', 'import'],
    endpoints: [
      '/api/subscribers',
      '/api/subscribers/:email',
      '/api/subscriber-lists',
      '/api/subscriber-lists/:id',
    ],
  },
};

/**
 * Persona database tool definition
 */
export const personaDbTool: Tool = {
  id: 'db-persona',
  name: 'Persona Database',
  description: 'SQLite operations for writer persona management',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['writer_personas'],
    operations: ['create', 'read', 'update', 'delete', 'list', 'activate'],
    endpoints: ['/api/personas', '/api/personas/:id', '/api/personas/active'],
  },
};

/**
 * Template database tool definition
 */
export const templateDbTool: Tool = {
  id: 'db-template',
  name: 'Template Database',
  description: 'SQLite operations for newsletter template management',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['newsletter_templates'],
    operations: ['create', 'read', 'update', 'delete', 'list'],
    endpoints: ['/api/templates', '/api/templates/:id', '/api/templates/from-newsletter'],
  },
};

/**
 * Draft database tool definition
 */
export const draftDbTool: Tool = {
  id: 'db-draft',
  name: 'Draft Database',
  description: 'SQLite operations for newsletter draft auto-save',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['newsletter_drafts'],
    operations: ['create', 'read', 'update', 'delete'],
    endpoints: ['/api/drafts', '/api/drafts/:userEmail', '/api/drafts/:userEmail/exists'],
  },
};

/**
 * Calendar database tool definition
 */
export const calendarDbTool: Tool = {
  id: 'db-calendar',
  name: 'Calendar Database',
  description: 'SQLite operations for content calendar management',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['calendar_entries', 'scheduled_sends'],
    operations: ['create', 'read', 'update', 'delete', 'list'],
    endpoints: ['/api/calendar', '/api/calendar/:id', '/api/scheduled-sends'],
  },
};

/**
 * Thumbnail database tool definition
 */
export const thumbnailDbTool: Tool = {
  id: 'db-thumbnail',
  name: 'Thumbnail Database',
  description: 'SQLite operations for image style thumbnails',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['image_style_thumbnails'],
    operations: ['create', 'read', 'delete', 'list'],
    endpoints: ['/api/thumbnails', '/api/thumbnails/status', '/api/thumbnails/:styleName'],
  },
};

/**
 * API Key database tool definition
 */
export const apiKeyDbTool: Tool = {
  id: 'db-apikey',
  name: 'API Key Database',
  description: 'SQLite operations for API key storage and validation',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['api_keys', 'api_key_audit_log'],
    operations: ['save', 'validate', 'delete', 'status'],
    endpoints: ['/api/api-keys', '/api/api-keys/validate', '/api/api-keys/status'],
  },
};

/**
 * Logs database tool definition
 */
export const logsDbTool: Tool = {
  id: 'db-logs',
  name: 'Logs Database',
  description: 'SQLite operations for system logs and audit trails',
  category: 'data',
  rateLimitTier: 'unlimited',
  requiresAuth: false,
  metadata: {
    tables: ['newsletter_logs', 'api_key_audit_log'],
    operations: ['read', 'list', 'stats'],
    endpoints: ['/api/logs', '/api/logs/stats'],
  },
};

// =============================================================================
// CONTENT SOURCE TOOLS
// =============================================================================

/**
 * Hacker News source tool definition
 */
export const hackerNewsTool: Tool = {
  id: 'source-hackernews',
  name: 'Hacker News',
  description: 'Fetch trending topics from Hacker News',
  category: 'search',
  rateLimitTier: 'low',
  requiresAuth: false,
  metadata: {
    provider: 'hackernews',
    apiUrl: 'https://hacker-news.firebaseio.com/v0',
    capabilities: ['top-stories', 'new-stories'],
  },
};

/**
 * ArXiv source tool definition
 */
export const arxivTool: Tool = {
  id: 'source-arxiv',
  name: 'ArXiv',
  description: 'Fetch academic papers from ArXiv',
  category: 'search',
  rateLimitTier: 'low',
  requiresAuth: false,
  metadata: {
    provider: 'arxiv',
    apiUrl: 'https://export.arxiv.org/api/query',
    capabilities: ['paper-search'],
    categories: ['cs.AI', 'cs.LG', 'cs.CL'],
  },
};

/**
 * GitHub source tool definition
 */
export const githubTool: Tool = {
  id: 'source-github',
  name: 'GitHub Trending',
  description: 'Fetch trending repositories from GitHub',
  category: 'search',
  rateLimitTier: 'low',
  requiresAuth: false,
  metadata: {
    provider: 'github',
    capabilities: ['trending-repos'],
  },
};

/**
 * Reddit source tool definition
 */
export const redditTool: Tool = {
  id: 'source-reddit',
  name: 'Reddit',
  description: 'Fetch trending posts from AI subreddits',
  category: 'search',
  rateLimitTier: 'low',
  requiresAuth: false,
  metadata: {
    provider: 'reddit',
    subreddits: ['MachineLearning', 'artificial', 'LocalLLaMA'],
    capabilities: ['subreddit-top'],
  },
};

// =============================================================================
// ALL TOOLS ARRAY
// =============================================================================

/**
 * All tool definitions
 */
export const allToolDefinitions: Tool[] = [
  // AI
  claudeTool,
  stabilityTool,
  // Search
  braveSearchTool,
  // Google
  googleOAuthTool,
  googleDriveTool,
  googleGmailTool,
  googleSheetsTool,
  // Database
  newsletterDbTool,
  subscriberDbTool,
  personaDbTool,
  templateDbTool,
  draftDbTool,
  calendarDbTool,
  thumbnailDbTool,
  apiKeyDbTool,
  logsDbTool,
  // Content Sources
  hackerNewsTool,
  arxivTool,
  githubTool,
  redditTool,
];

/**
 * Get tool definitions by category
 */
export function getToolDefinitionsByCategory(category: ToolCategory): Tool[] {
  return allToolDefinitions.filter((t) => t.category === category);
}

/**
 * Get tool definition by ID
 */
export function getToolDefinition(toolId: string): Tool | undefined {
  return allToolDefinitions.find((t) => t.id === toolId);
}
