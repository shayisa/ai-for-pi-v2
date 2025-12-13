/**
 * Mock Services for Testing
 *
 * Pre-defined responses that don't require API calls
 */

import { vi } from 'vitest';

// Mock newsletter content response
export const mockNewsletterContent = {
  text: JSON.stringify({
    subject: "Test Newsletter: AI Tools Weekly",
    introduction: "Welcome to this week's AI newsletter covering the latest developments.",
    sections: [
      {
        title: "New AI Tool: DataViz Pro",
        content: "DataViz Pro is a revolutionary tool for data visualization...",
        imagePrompt: "A futuristic data visualization dashboard",
        actionability: {
          implementationTime: "15 minutes",
          skillLevel: "beginner",
          prerequisites: ["Node.js 18+", "npm"],
          steps: [
            "Install with npm install dataviz-pro",
            "Import and initialize",
            "Connect your data source",
            "Configure visualization settings"
          ],
          expectedOutcome: "Working data visualization dashboard",
          estimatedCost: "Free tier available"
        },
        sources: [
          {
            url: "https://example.com/dataviz-pro",
            title: "DataViz Pro Documentation",
            lastVerified: new Date().toISOString()
          }
        ]
      }
    ],
    conclusion: "Stay tuned for more AI updates next week!"
  })
};

// Mock image generation response (base64 placeholder)
export const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Mock topic suggestions
export const mockTopicSuggestions = [
  "Latest developments in GPT-5",
  "AI-powered code review tools",
  "Machine learning for climate science"
];

// Mock trending sources
export const mockTrendingSources = [
  {
    title: "OpenAI Announces New Model",
    publication: "hackernews",
    category: "hackernews",
    url: "https://news.ycombinator.com/item?id=123456",
    date: new Date().toISOString()
  },
  {
    title: "Breakthrough in Neural Networks",
    publication: "arxiv",
    category: "arxiv",
    url: "https://arxiv.org/abs/2024.12345",
    date: new Date().toISOString()
  }
];

// Create mock service functions
export const createMockClaudeService = () => ({
  generateNewsletterContent: vi.fn().mockResolvedValue(mockNewsletterContent),
  generateImage: vi.fn().mockResolvedValue(mockImageBase64),
  generateTopicSuggestions: vi.fn().mockResolvedValue({ text: JSON.stringify(mockTopicSuggestions) }),
  generateCompellingTrendingContent: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      actionableCapabilities: [
        { title: "AI Code Generation", description: "Use AI to write code faster" },
        { title: "Smart Data Analysis", description: "Automate data insights" }
      ]
    })
  }),
  savePresetsToCloud: vi.fn().mockResolvedValue({ success: true }),
  loadPresetsFromCloud: vi.fn().mockResolvedValue({ presets: [] }),
});

export const createMockTrendingDataService = () => ({
  fetchAllTrendingSources: vi.fn().mockResolvedValue(mockTrendingSources),
  filterSourcesByAudience: vi.fn().mockImplementation((sources) => sources),
});

export const createMockGoogleApiService = () => ({
  initClient: vi.fn((onAuthChange, onInit) => {
    setTimeout(onInit, 0);
  }),
  signIn: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn(),
  saveToDrive: vi.fn().mockResolvedValue('file_id_123'),
  logToSheet: vi.fn().mockResolvedValue('Logged successfully'),
  sendEmail: vi.fn().mockResolvedValue({ message: 'Email sent', listNames: ['Test List'] }),
  readHistoryFromSheet: vi.fn().mockResolvedValue([]),
});
