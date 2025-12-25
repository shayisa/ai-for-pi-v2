/**
 * Topic Validation Service
 *
 * Validates that user-provided topics are real and current before newsletter generation.
 * Uses Brave Search API to verify topics exist and are not fictional.
 *
 * @module services/topicValidationService
 *
 * ## Purpose
 * Prevents hallucination by blocking fictional topics (e.g., "ChatGPT 5.2") before
 * they reach the newsletter generator, which would otherwise fabricate content.
 *
 * ## Validation Process
 * 1. Search for topic using Brave Search API
 * 2. Analyze results to determine if topic exists
 * 3. Assign confidence score based on result quality
 * 4. Flag topics that appear fictional or have no search results
 */

import { performWebSearch } from '../external/brave/client';

/**
 * Confidence levels for topic validation
 *
 * - high: Multiple authoritative sources mention this topic
 * - medium: Some results found but may be tangential
 * - low: Few results, topic may be obscure or misspelled
 * - none: No results found, topic likely fictional or nonexistent
 */
export type ValidationConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Result of validating a single topic
 */
export interface TopicValidationResult {
  /** The original topic string */
  topic: string;
  /** Whether the topic appears to be valid/real */
  isValid: boolean;
  /** Confidence level based on search result quality */
  confidence: ValidationConfidence;
  /** Raw search results for debugging/display */
  webSearchResults?: string;
  /** Suggested alternative if topic seems misspelled or fictional */
  suggestedAlternative?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Response from validating multiple topics
 */
export interface ValidateTopicsResponse {
  /** Validation results for each topic */
  results: TopicValidationResult[];
  /** True if all topics are valid */
  allValid: boolean;
  /** List of topics that failed validation */
  invalidTopics: string[];
  /** Total time for validation in ms */
  validationTimeMs: number;
}

/**
 * Patterns that indicate high-quality search results
 */
const HIGH_QUALITY_INDICATORS = [
  /official|announced|released|launched/i,
  /documentation|docs|guide|tutorial/i,
  /github\.com|microsoft\.com|google\.com|anthropic\.com|openai\.com/i,
  /techcrunch|verge|arstechnica|wired/i,
  /blog|news|article/i,
];

/**
 * Patterns that indicate fictional or non-existent topics
 */
const FICTIONAL_INDICATORS = [
  /no results found/i,
  /did you mean/i,
  /search temporarily unavailable/i,
  /training knowledge/i,  // Fallback message from Brave client
];

/**
 * Known version patterns that may be fictional
 * (e.g., "ChatGPT 5.2" when latest is 4.0)
 */
const VERSION_PATTERNS = [
  { pattern: /chatgpt\s*(\d+(?:\.\d+)?)/i, maxKnownVersion: 4.5 },
  { pattern: /gpt-?(\d+(?:\.\d+)?)/i, maxKnownVersion: 4.5 },
  { pattern: /claude\s*(\d+(?:\.\d+)?)/i, maxKnownVersion: 4.5 },
  { pattern: /gemini\s*(\d+(?:\.\d+)?)/i, maxKnownVersion: 2.5 },
];

/**
 * Check if topic contains a potentially fictional version number
 */
function checkForFictionalVersion(topic: string): { isFictional: boolean; reason?: string } {
  for (const { pattern, maxKnownVersion } of VERSION_PATTERNS) {
    const match = topic.match(pattern);
    if (match && match[1]) {
      const version = parseFloat(match[1]);
      if (version > maxKnownVersion) {
        return {
          isFictional: true,
          reason: `Version ${match[1]} appears to be fictional (latest known: ${maxKnownVersion})`,
        };
      }
    }
  }
  return { isFictional: false };
}

/**
 * Analyze search results to determine confidence level
 */
function analyzeSearchResults(searchResults: string): {
  confidence: ValidationConfidence;
  hasAuthoritative: boolean;
  resultCount: number;
} {
  // Check for fictional/empty indicators
  for (const indicator of FICTIONAL_INDICATORS) {
    if (indicator.test(searchResults)) {
      return { confidence: 'none', hasAuthoritative: false, resultCount: 0 };
    }
  }

  // Count high-quality indicators
  let qualityScore = 0;
  for (const indicator of HIGH_QUALITY_INDICATORS) {
    if (indicator.test(searchResults)) {
      qualityScore++;
    }
  }

  // Count numbered results (e.g., "1. **Title**")
  const resultMatches = searchResults.match(/\d+\.\s+\*\*/g);
  const resultCount = resultMatches ? resultMatches.length : 0;

  // Determine confidence based on quality and quantity
  let confidence: ValidationConfidence;
  if (resultCount >= 5 && qualityScore >= 3) {
    confidence = 'high';
  } else if (resultCount >= 3 && qualityScore >= 1) {
    confidence = 'medium';
  } else if (resultCount >= 1) {
    confidence = 'low';
  } else {
    confidence = 'none';
  }

  return {
    confidence,
    hasAuthoritative: qualityScore >= 2,
    resultCount,
  };
}

/**
 * Validate a single topic using web search
 *
 * @param topic - The topic to validate
 * @returns Validation result with confidence score
 */
export async function validateSingleTopic(topic: string): Promise<TopicValidationResult> {
  const startTime = Date.now();

  try {
    // First check for obviously fictional version numbers
    const versionCheck = checkForFictionalVersion(topic);
    if (versionCheck.isFictional) {
      console.log(`[TopicValidation] Fictional version detected for "${topic}": ${versionCheck.reason}`);
      return {
        topic,
        isValid: false,
        confidence: 'none',
        suggestedAlternative: topic.replace(/\d+(\.\d+)?/, '').trim(),
        error: versionCheck.reason,
      };
    }

    // Perform web search to validate topic exists
    const searchQuery = `"${topic}" news OR announcement OR release 2024 2025`;
    console.log(`[TopicValidation] Searching for: ${topic}`);
    const searchResults = await performWebSearch(searchQuery);

    // Analyze the results
    const analysis = analyzeSearchResults(searchResults);

    const isValid = analysis.confidence !== 'none';
    const validationTimeMs = Date.now() - startTime;

    console.log(`[TopicValidation] "${topic}" - Valid: ${isValid}, Confidence: ${analysis.confidence}, Time: ${validationTimeMs}ms`);

    return {
      topic,
      isValid,
      confidence: analysis.confidence,
      webSearchResults: searchResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[TopicValidation] Error validating "${topic}":`, errorMessage);

    return {
      topic,
      isValid: false,
      confidence: 'none',
      error: errorMessage,
    };
  }
}

/**
 * Validate multiple topics in parallel
 *
 * @param topics - Array of topics to validate
 * @returns Aggregated validation results
 */
export async function validateTopics(topics: string[]): Promise<ValidateTopicsResponse> {
  const startTime = Date.now();

  console.log(`[TopicValidation] Validating ${topics.length} topics...`);

  // Validate all topics in parallel (with some rate limiting)
  const validationPromises = topics.map((topic, index) =>
    // Stagger requests slightly to avoid rate limiting
    new Promise<TopicValidationResult>((resolve) =>
      setTimeout(async () => {
        const result = await validateSingleTopic(topic);
        resolve(result);
      }, index * 200) // 200ms stagger between requests
    )
  );

  const results = await Promise.all(validationPromises);

  // Aggregate results
  const invalidTopics = results
    .filter((r) => !r.isValid)
    .map((r) => r.topic);

  const allValid = invalidTopics.length === 0;
  const validationTimeMs = Date.now() - startTime;

  console.log(`[TopicValidation] Complete. Valid: ${results.filter((r) => r.isValid).length}/${topics.length}, Time: ${validationTimeMs}ms`);

  return {
    results,
    allValid,
    invalidTopics,
    validationTimeMs,
  };
}

/**
 * Quick check if a topic is likely fictional without full web search
 * Used for fast pre-screening before expensive API calls
 *
 * @param topic - The topic to check
 * @returns True if topic appears obviously fictional
 */
export function isObviouslyFictional(topic: string): boolean {
  const versionCheck = checkForFictionalVersion(topic);
  return versionCheck.isFictional;
}

export default {
  validateTopics,
  validateSingleTopic,
  isObviouslyFictional,
};
