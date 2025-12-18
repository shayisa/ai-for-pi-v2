/**
 * Generation Services Module
 *
 * Aggregates all newsletter generation services.
 *
 * @module domains/generation/services
 *
 * ## PRESERVATION NOTE
 * All services contain EXACT copies of prompts and logic from server.ts.
 * Do NOT modify any prompts in the individual service files.
 */
export { generateNewsletter } from './newsletterGenerator';
export type { GenerateNewsletterParams, GenerateNewsletterResult } from './newsletterGenerator';

export { generateEnhancedNewsletter } from './enhancedGenerator';
export type { GenerateEnhancedNewsletterParams, GenerateEnhancedNewsletterResult } from './enhancedGenerator';

export { generateTopicSuggestions } from './topicGenerator';
export type { GenerateTopicSuggestionsParams, GenerateTopicSuggestionsResult } from './topicGenerator';

export { generateTrendingTopics, generateTrendingTopicsWithSources } from './trendingGenerator';
export type { GenerateTrendingTopicsParams, GenerateTrendingTopicsWithSourcesParams, GenerateTrendingTopicsResult } from './trendingGenerator';

export { generateCompellingTrendingContent } from './compellingContentGenerator';
export type { GenerateCompellingContentParams, GenerateCompellingContentResult } from './compellingContentGenerator';
