# Testing Strategy

> **Purpose**: Enable comprehensive testing without burning API tokens/credits

## Testing Philosophy

1. **Mocks by default**: All external APIs are mocked in tests
2. **Real tests are explicit**: Only run real API tests manually and sparingly
3. **Test behavior, not implementation**: Focus on what the code does, not how
4. **Fast feedback**: Unit tests should run in <5 seconds

## Test Categories

| Category | Uses Mocks | Speed | Purpose |
|----------|------------|-------|---------|
| Unit | Yes | <100ms each | Test individual functions |
| Integration | Yes | <1s each | Test component interactions |
| E2E | Yes | <5s each | Test user flows |
| Token Usage | **No** | 30-60s | Verify API efficiency (manual only) |

---

## Mock Structure

### Directory Layout

```
src/__mocks__/
├── claudeService.ts       # Mock Claude API responses
├── stabilityService.ts    # Mock image generation
├── googleServices.ts      # Mock Google OAuth/Drive/Sheets/Gmail
├── braveSearch.ts         # Mock web search results
└── trendingSources.ts     # Mock trending data
```

### Claude Service Mock

```typescript
// src/__mocks__/claudeService.ts
import { Newsletter } from '@/types';

export const mockNewsletterResponse: Newsletter = {
  subject: "Test Newsletter: Latest AI Developments",
  introduction: "Welcome to this week's AI newsletter...",
  sections: [
    {
      title: "Claude 3.5 Sonnet Release",
      content: "Anthropic released Claude 3.5 Sonnet with <a href='https://anthropic.com'>improved capabilities</a>...",
      imagePrompt: "Professional photo of AI interface",
      actionability: {
        implementationTime: "15 minutes",
        skillLevel: "beginner",
        prerequisites: ["Anthropic API key"],
        steps: [
          "Sign up at anthropic.com",
          "Get API key from console",
          "Install SDK: npm install @anthropic-ai/sdk"
        ],
        expectedOutcome: "Working Claude integration"
      }
    }
  ],
  conclusion: "Stay tuned for more AI updates!"
};

export const generateNewsletterContent = jest.fn().mockResolvedValue({
  text: JSON.stringify(mockNewsletterResponse)
});

export const generateTopicSuggestions = jest.fn().mockResolvedValue({
  text: JSON.stringify(["AI agents", "LLM optimization", "RAG systems"])
});

export const generateCompellingContent = jest.fn().mockResolvedValue({
  text: JSON.stringify({
    actionableCapabilities: [
      { title: "Test Capability", description: "Test description" }
    ]
  })
});
```

### Stability Service Mock

```typescript
// src/__mocks__/stabilityService.ts

// 1x1 transparent PNG as base64
const PLACEHOLDER_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const generateImage = jest.fn().mockResolvedValue(PLACEHOLDER_IMAGE);

export const generateImagesForNewsletter = jest.fn().mockImplementation(
  async (sections) => sections.map((_, i) => ({
    index: i,
    imageUrl: PLACEHOLDER_IMAGE
  }))
);
```

### Google Services Mock

```typescript
// src/__mocks__/googleServices.ts

export const mockAuthData = {
  access_token: "mock_access_token",
  id_token: "mock_id_token",
  email: "test@example.com",
  name: "Test User"
};

export const initClient = jest.fn().mockResolvedValue(mockAuthData);
export const signIn = jest.fn().mockResolvedValue(mockAuthData);
export const signOut = jest.fn().mockResolvedValue(undefined);

export const saveToDrive = jest.fn().mockResolvedValue("mock_file_id");
export const loadFromDrive = jest.fn().mockResolvedValue({ /* mock newsletter */ });

export const logToSheet = jest.fn().mockResolvedValue(true);
export const loadPresets = jest.fn().mockResolvedValue([]);
export const savePresets = jest.fn().mockResolvedValue(true);

export const sendEmail = jest.fn().mockResolvedValue({ success: true, message: "Email sent" });
```

### Trending Sources Mock

```typescript
// src/__mocks__/trendingSources.ts
import { TrendingSource } from '@/types';

export const mockTrendingSources: TrendingSource[] = [
  {
    id: "hn-1",
    title: "Show HN: AI-powered code review tool",
    url: "https://news.ycombinator.com/item?id=123",
    author: "testuser",
    publication: "Hacker News",
    date: new Date().toISOString(),
    category: "hackernews",
    summary: "A tool that uses LLMs to review code"
  },
  {
    id: "arxiv-1",
    title: "Advances in Large Language Models",
    url: "https://arxiv.org/abs/2024.12345",
    author: "Researcher et al.",
    publication: "arXiv",
    date: new Date().toISOString(),
    category: "arxiv",
    summary: "New techniques for LLM training"
  }
];

export const fetchTrendingSources = jest.fn().mockResolvedValue(mockTrendingSources);
```

---

## Unit Test Examples

### Testing Hooks

```typescript
// src/hooks/__tests__/useNewsletterGeneration.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNewsletterGeneration } from '../useNewsletterGeneration';

// Mock the service
jest.mock('@/services/claudeService');

describe('useNewsletterGeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with null state', () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    expect(result.current.newsletter).toBeNull();
    expect(result.current.loading).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('sets loading state during generation', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    act(() => {
      result.current.generate({
        topics: ['AI'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic'
      });
    });

    expect(result.current.loading).toBe('Generating newsletter content...');

    await waitFor(() => {
      expect(result.current.loading).toBeNull();
    });
  });

  it('updates progress during generation', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());
    const progressValues: number[] = [];

    // Track progress updates
    const unsubscribe = result.current.onProgressChange?.((p) => {
      progressValues.push(p);
    });

    await act(async () => {
      await result.current.generate({
        topics: ['AI'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic'
      });
    });

    expect(progressValues).toContain(10);  // Started
    expect(progressValues).toContain(100); // Completed
  });

  it('handles errors correctly', async () => {
    const mockError = new Error('API error');
    require('@/services/claudeService').generateNewsletterContent.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useNewsletterGeneration());

    await act(async () => {
      try {
        await result.current.generate({
          topics: ['AI'],
          audience: ['business'],
          tone: 'professional',
          flavors: [],
          imageStyle: 'photorealistic'
        });
      } catch (e) {
        // Expected
      }
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('API error');
    expect(result.current.error?.onRetry).toBeDefined();
  });

  it('resets state correctly', async () => {
    const { result } = renderHook(() => useNewsletterGeneration());

    // Generate first
    await act(async () => {
      await result.current.generate({
        topics: ['AI'],
        audience: ['business'],
        tone: 'professional',
        flavors: [],
        imageStyle: 'photorealistic'
      });
    });

    expect(result.current.newsletter).not.toBeNull();

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.newsletter).toBeNull();
    expect(result.current.progress).toBe(0);
  });
});
```

### Testing Utilities

```typescript
// src/utils/__tests__/stringUtils.test.ts
import { extractStrictJson } from '../stringUtils';

describe('extractStrictJson', () => {
  it('extracts JSON from markdown code block', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = extractStrictJson(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('extracts JSON object from mixed content', () => {
    const input = 'Here is the result: {"key": "value"} end';
    const result = extractStrictJson(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('extracts JSON array', () => {
    const input = '["item1", "item2"]';
    const result = extractStrictJson(input);
    expect(JSON.parse(result)).toEqual(['item1', 'item2']);
  });

  it('handles nested JSON', () => {
    const input = '{"outer": {"inner": "value"}}';
    const result = extractStrictJson(input);
    expect(JSON.parse(result)).toEqual({ outer: { inner: 'value' } });
  });
});
```

---

## Integration Test Examples

```typescript
// src/__tests__/integration/newsletterFlow.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

// Mock all services
jest.mock('@/services/claudeService');
jest.mock('@/services/googleServices');
jest.mock('@/services/stabilityService');

describe('Newsletter Generation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('completes full generation flow', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Step 1: Sign in
    await user.click(screen.getByText('Sign in with Google'));
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    // Step 2: Select audience
    await user.click(screen.getByLabelText('Business'));

    // Step 3: Add topic
    await user.type(screen.getByPlaceholderText('Enter topic'), 'AI tools');
    await user.click(screen.getByText('Add'));
    expect(screen.getByText('AI tools')).toBeInTheDocument();

    // Step 4: Generate
    await user.click(screen.getByText('Generate Newsletter'));

    // Step 5: Verify result
    await waitFor(() => {
      expect(screen.getByText('Newsletter Generated')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify preview shows content
    expect(screen.getByText(/Latest AI Developments/)).toBeInTheDocument();
  });
});
```

---

## Token Usage Test (Manual Only)

```typescript
// src/__tests__/tokenUsage.test.ts
import { generateNewsletterContent } from '@/services/claudeService';

// Skip in CI - only run manually
const SKIP_IN_CI = process.env.CI === 'true';

describe('Token Usage (Real API)', () => {
  it.skipIf(SKIP_IN_CI)('uses less than 5000 tokens', async () => {
    const result = await generateNewsletterContent({
      topics: ['AI coding assistants'],
      audience: ['business'],
      tone: 'professional',
      flavors: [],
      imageStyle: 'photorealistic'
    });

    // Check metadata (requires API to return token counts)
    expect(result.metadata?.tokensUsed).toBeLessThan(5000);
    expect(result.metadata?.searchQueries?.length).toBeLessThanOrEqual(2);
  }, 120000);
});
```

---

## Test Scripts (package.json)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__/.*\\.test\\.ts$",
    "test:integration": "jest --testPathPattern=integration/.*\\.test\\.ts$",
    "test:e2e": "jest --testPathPattern=e2e/.*\\.test\\.ts$",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:tokens": "REAL_API=true jest --testPathPattern=tokenUsage"
  }
}
```

---

## Test Configuration (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Auto-mock services unless REAL_API is set
    '^@/services/claudeService$': process.env.REAL_API
      ? '<rootDir>/src/services/claudeService'
      : '<rootDir>/src/__mocks__/claudeService',
    '^@/services/stabilityService$': '<rootDir>/src/__mocks__/stabilityService',
    '^@/services/googleServices$': '<rootDir>/src/__mocks__/googleServices',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/__mocks__/**',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

---

## Running Tests

```bash
# Run all unit tests (uses mocks, fast)
npm run test:unit

# Run integration tests (uses mocks)
npm run test:integration

# Run with coverage report
npm run test:coverage

# Watch mode during development
npm run test:watch

# Run real API test (manual, uses credits)
npm run test:tokens
```

---

## Best Practices

1. **Always mock external APIs** in automated tests
2. **One assertion per test** when possible
3. **Clear setup/teardown** with beforeEach/afterEach
4. **Descriptive test names** that explain the behavior
5. **Test edge cases** not just happy paths
6. **Keep tests fast** - if a test takes >1s, it's probably doing too much
