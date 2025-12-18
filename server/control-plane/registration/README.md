# Registration Module

> **Purpose**: Central registry for all tools/services available in the Control Plane.

## Overview

The Registration module provides:

| Component | Purpose | File |
|-----------|---------|------|
| **Tool Registry** | Register, discover, and manage tools | `toolRegistry.ts` |
| **Tool Definitions** | Pre-defined tool configurations | `toolDefinitions.ts` |

## Dependencies

### Internal Modules
- `../types` - Control Plane type definitions
- `../feedback` - Logging

### NPM Packages
- None

## Registered Tools

### AI Tools (2)

| Tool ID | Name | Auth | Rate Limit |
|---------|------|------|------------|
| `claude` | Claude AI | API Key | Medium |
| `stability` | Stability AI | API Key | High |

### Search Tools (5)

| Tool ID | Name | Auth | Rate Limit |
|---------|------|------|------------|
| `brave-search` | Brave Search | API Key | Medium |
| `source-hackernews` | Hacker News | None | Low |
| `source-arxiv` | ArXiv | None | Low |
| `source-github` | GitHub Trending | None | Low |
| `source-reddit` | Reddit | None | Low |

### Google Tools (4)

| Tool ID | Name | Auth | Rate Limit |
|---------|------|------|------------|
| `google-oauth` | Google OAuth | None | Low |
| `google-drive` | Google Drive | OAuth | Low |
| `google-gmail` | Gmail | OAuth | High |
| `google-sheets` | Google Sheets | OAuth | Low |

### Database Tools (9)

| Tool ID | Name | Tables |
|---------|------|--------|
| `db-newsletter` | Newsletter DB | newsletters, newsletter_logs |
| `db-subscriber` | Subscriber DB | subscribers, subscriber_lists |
| `db-persona` | Persona DB | writer_personas |
| `db-template` | Template DB | newsletter_templates |
| `db-draft` | Draft DB | newsletter_drafts |
| `db-calendar` | Calendar DB | calendar_entries, scheduled_sends |
| `db-thumbnail` | Thumbnail DB | image_style_thumbnails |
| `db-apikey` | API Key DB | api_keys, api_key_audit_log |
| `db-logs` | Logs DB | newsletter_logs, api_key_audit_log |

## Public API

### Registering Tools

```typescript
import { registerTool, toolRegistry } from './registration';

// Register a new tool
registerTool(
  {
    id: 'my-tool',
    name: 'My Tool',
    description: 'Description of my tool',
    category: 'data',
    rateLimitTier: 'medium',
    requiresAuth: true,
    authType: 'api_key',
  },
  async (input, context) => {
    // Tool handler implementation
    return { result: 'success' };
  },
  {
    enabled: true,
    healthCheck: async () => true,
  }
);
```

### Querying Tools

```typescript
import {
  getTool,
  getEnabledTool,
  getAllTools,
  getToolsByCategory,
  searchTools,
} from './registration';

// Get a specific tool
const claude = getTool('claude');

// Get only if enabled
const enabledClaude = getEnabledTool('claude');

// Get all tools
const allTools = getAllTools();

// Get tools by category
const aiTools = getToolsByCategory('ai');
const dbTools = getToolsByCategory('data');

// Search tools
const results = searchTools('newsletter');
```

### Managing Tool State

```typescript
import {
  enableTool,
  disableTool,
  checkToolHealth,
  checkAllToolsHealth,
} from './registration';

// Disable a tool temporarily
disableTool('stability');

// Re-enable
enableTool('stability');

// Check health
const isHealthy = await checkToolHealth('claude');

// Check all tools
const healthMap = await checkAllToolsHealth();
// Map<string, boolean>
```

### Registry Statistics

```typescript
import { getRegistryStats } from './registration';

const stats = getRegistryStats();
// {
//   total: 20,
//   enabled: 19,
//   disabled: 1,
//   byCategory: { ai: 2, search: 5, auth: 1, storage: 2, email: 1, data: 9 },
//   byAuthType: { api_key: 3, oauth: 3, none: 14 }
// }
```

## Tool Definition Structure

```typescript
interface Tool {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  description: string;           // What the tool does
  category: ToolCategory;        // 'ai' | 'search' | 'storage' | 'email' | 'auth' | 'data'
  rateLimitTier: RateLimitTier;  // 'low' | 'medium' | 'high' | 'unlimited'
  requiresAuth: boolean;         // Whether auth is needed
  authType?: 'api_key' | 'oauth' | 'none';
  metadata?: Record<string, unknown>;
}
```

## Usage Examples

### Initialize All Tools at Startup

```typescript
import { registerTool, allToolDefinitions } from './registration';
import { claudeHandler, stabilityHandler, /* ... */ } from '../handlers';

// Map of tool ID to handler
const handlers = {
  'claude': claudeHandler,
  'stability': stabilityHandler,
  // ...
};

// Register all tools
for (const tool of allToolDefinitions) {
  const handler = handlers[tool.id];
  if (handler) {
    registerTool(tool, handler);
  }
}
```

### Execute a Tool

```typescript
import { getTool } from './registration';
import { generateCorrelationId } from '../feedback';

async function executeTool(toolId: string, input: unknown) {
  const tool = getTool(toolId);
  if (!tool || !tool.enabled) {
    throw new Error(`Tool ${toolId} not available`);
  }

  const context = {
    correlationId: generateCorrelationId(),
    userId: 'user-123',
    userEmail: 'user@example.com',
  };

  return await tool.handler(input, context);
}
```

## Testing Instructions

### Running Tests

```bash
npm test -- --grep "registration"
```

### Mocking the Registry

```typescript
import { clearRegistry, registerTool, getTool } from './registration';

describe('MyService', () => {
  beforeEach(() => {
    clearRegistry();
    // Register mock tools
    registerTool(
      { id: 'mock-tool', name: 'Mock', /* ... */ },
      async () => ({ mocked: true })
    );
  });

  it('should use registered tool', async () => {
    const tool = getTool('mock-tool');
    const result = await tool.handler({}, { correlationId: 'test' });
    expect(result.mocked).toBe(true);
  });
});
```

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-17 | Initial implementation | Claude |
