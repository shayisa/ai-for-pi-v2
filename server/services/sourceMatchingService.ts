/**
 * Source-Topic Matching Service
 *
 * Associates topics with relevant sources using keyword-based semantic matching.
 * Prevents hallucination by ensuring only topics with matching sources are written about.
 *
 * @module services/sourceMatchingService
 *
 * ## Phase 19: PRIMARY SOURCE ENFORCEMENT
 * - If topic has a pre-attached resource URL, that source is ALWAYS PRIMARY
 * - No keyword matching needed - direct URL match
 * - Other keyword-matched sources become SECONDARY
 *
 * ## Relevance Scoring (for topics WITHOUT pre-attached sources)
 * - Title match: +0.5 (most important - topic in source title)
 * - Content match: +0.3 (topic mentioned in article body)
 * - URL/domain match: +0.2 (topic-related domain)
 *
 * ## Threshold
 * A source is considered "matched" if relevanceScore >= 0.3
 */

import type { SourceArticle } from './sourceFetchingService';
import type { ExtractedArticle } from './articleExtractorService';
import type { TopicWithAudienceId } from '../../types';

/**
 * Mapping of a single topic to its matched sources
 */
export interface TopicSourceMapping {
  /** The topic being matched */
  topic: string;
  /** Sources that match this topic */
  matchedSources: (SourceArticle | ExtractedArticle)[];
  /** Highest relevance score among matched sources */
  relevanceScore: number;
  /** Whether at least one source matched */
  hasMatch: boolean;
  /** Keywords extracted from the topic */
  topicKeywords: string[];
  /** Phase 19: PRIMARY source URL (if topic had pre-attached resource) */
  primarySourceUrl?: string;
  /** Phase 19: The PRIMARY source object (if found) */
  primarySource?: SourceArticle | ExtractedArticle;
}

/**
 * Result of matching all topics to sources
 */
export interface MatchingResult {
  /** Mapping for each topic */
  mappings: TopicSourceMapping[];
  /** Topics with no matching sources */
  unmatchedTopics: string[];
  /** Whether all topics have at least one match */
  allMatched: boolean;
  /** Total unique sources cited */
  totalSourcesCited: number;
}

/**
 * Relevance weights for different match types
 */
const RELEVANCE_WEIGHTS = {
  titleMatch: 0.5,
  contentMatch: 0.3,
  urlMatch: 0.2,
};

/**
 * Minimum relevance score to consider a source "matched"
 */
const MATCH_THRESHOLD = 0.3;

/**
 * Common stop words to exclude from keyword extraction
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'use', 'uses', 'used', 'using', 'case', 'cases', 'how', 'what', 'when',
  'where', 'why', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your',
]);

/**
 * Extract meaningful keywords from a topic string
 *
 * @param topic - The topic to extract keywords from
 * @returns Array of lowercase keywords
 */
export function extractKeywords(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')  // Remove punctuation except hyphens
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map((word) => word.trim());
}

/**
 * Check if text contains any of the keywords
 *
 * @param text - The text to search in
 * @param keywords - Keywords to search for
 * @returns Number of keywords found
 */
function countKeywordMatches(text: string, keywords: string[]): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  return keywords.filter((keyword) => lowerText.includes(keyword)).length;
}

/**
 * Calculate relevance score between a topic and a source
 *
 * @param topic - The topic string
 * @param source - The source article
 * @returns Relevance score from 0 to 1
 */
export function calculateRelevanceScore(
  topic: string,
  source: SourceArticle | ExtractedArticle
): number {
  const keywords = extractKeywords(topic);
  if (keywords.length === 0) return 0;

  let score = 0;

  // Check title match
  const titleMatches = countKeywordMatches(source.title, keywords);
  if (titleMatches > 0) {
    // Proportional score based on how many keywords matched
    score += RELEVANCE_WEIGHTS.titleMatch * (titleMatches / keywords.length);
  }

  // Check content match (for ExtractedArticle)
  const content = 'content' in source ? source.content : source.snippet;
  if (content) {
    const contentMatches = countKeywordMatches(content, keywords);
    if (contentMatches > 0) {
      score += RELEVANCE_WEIGHTS.contentMatch * Math.min(contentMatches / keywords.length, 1);
    }
  }

  // Check URL match
  if (source.url) {
    const urlMatches = countKeywordMatches(source.url, keywords);
    if (urlMatches > 0) {
      score += RELEVANCE_WEIGHTS.urlMatch * (urlMatches / keywords.length);
    }
  }

  return Math.min(score, 1); // Cap at 1.0
}

/**
 * Match a single topic to relevant sources
 *
 * @param topic - The topic to match
 * @param sources - Available sources to match against
 * @returns Mapping with matched sources and relevance score
 */
export function matchSingleTopic(
  topic: string,
  sources: (SourceArticle | ExtractedArticle)[]
): TopicSourceMapping {
  const topicKeywords = extractKeywords(topic);

  // Calculate relevance for each source
  const scoredSources = sources.map((source) => ({
    source,
    score: calculateRelevanceScore(topic, source),
  }));

  // Filter sources that meet the threshold and sort by score
  const matchedSources = scoredSources
    .filter((s) => s.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.source);

  // Get highest score
  const highestScore = matchedSources.length > 0
    ? scoredSources.find((s) => s.source === matchedSources[0])?.score || 0
    : 0;

  return {
    topic,
    matchedSources,
    relevanceScore: highestScore,
    hasMatch: matchedSources.length > 0,
    topicKeywords,
  };
}

/**
 * Phase 19: Match a single topic WITH PRIMARY SOURCE enforcement
 * If topic has a pre-attached resource URL, that source is ALWAYS PRIMARY
 *
 * @param topic - The topic object (may include resource URL)
 * @param sources - Available sources to match against
 * @returns Mapping with PRIMARY source first, then keyword-matched secondaries
 */
export function matchSingleTopicWithPrimary(
  topic: TopicWithAudienceId | string,
  sources: (SourceArticle | ExtractedArticle)[]
): TopicSourceMapping {
  // Extract topic title and resource URL
  const topicTitle = typeof topic === 'string' ? topic : topic.title;
  const primarySourceUrl = typeof topic === 'string' ? undefined : topic.resource;

  const topicKeywords = extractKeywords(topicTitle);

  // Phase 19: Check if topic has pre-attached resource URL
  if (primarySourceUrl) {
    console.log(`[SourceMatching] Phase 19: Topic "${topicTitle}" has PRIMARY SOURCE: ${primarySourceUrl}`);

    // Find the PRIMARY source in the pool by URL match
    const primarySource = sources.find((s) => {
      // Normalize URLs for comparison (remove trailing slashes, compare case-insensitive)
      const normalizedPrimary = primarySourceUrl.toLowerCase().replace(/\/$/, '');
      const normalizedSource = s.url.toLowerCase().replace(/\/$/, '');
      return normalizedSource === normalizedPrimary || normalizedSource.includes(normalizedPrimary) || normalizedPrimary.includes(normalizedSource);
    });

    if (primarySource) {
      console.log(`[SourceMatching] Phase 19: Found PRIMARY source "${primarySource.title}" in pool`);

      // Get secondary sources via keyword matching (excluding the primary)
      const secondarySources = sources
        .filter((s) => s.url !== primarySource.url)
        .map((s) => ({ source: s, score: calculateRelevanceScore(topicTitle, s) }))
        .filter((s) => s.score >= MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)  // Limit secondary sources
        .map((s) => s.source);

      // PRIMARY source is ALWAYS first, with relevance score of 1.0
      return {
        topic: topicTitle,
        matchedSources: [primarySource, ...secondarySources],
        relevanceScore: 1.0,  // Maximum relevance for PRIMARY source
        hasMatch: true,
        topicKeywords,
        primarySourceUrl,
        primarySource,
      };
    } else {
      console.log(`[SourceMatching] Phase 19: WARNING - PRIMARY source ${primarySourceUrl} NOT FOUND in pool!`);
      // Fall back to keyword matching but log the warning
    }
  }

  // No PRIMARY source - use standard keyword matching
  return matchSingleTopic(topicTitle, sources);
}

/**
 * Match multiple topics to sources
 * Phase 19: Updated to accept full topic objects and enforce PRIMARY sources
 *
 * @param topics - Array of topics to match (strings or TopicWithAudienceId objects)
 * @param sources - Available sources to match against
 * @returns Complete matching result
 */
export function matchTopicsToSources(
  topics: (string | TopicWithAudienceId)[],
  sources: (SourceArticle | ExtractedArticle)[]
): MatchingResult {
  console.log(`[SourceMatching] Matching ${topics.length} topics to ${sources.length} sources...`);

  // Phase 19: Log topics with PRIMARY sources
  const topicsWithPrimary = topics.filter((t) => typeof t !== 'string' && t.resource);
  if (topicsWithPrimary.length > 0) {
    console.log(`[SourceMatching] Phase 19: ${topicsWithPrimary.length} topic(s) have PRIMARY SOURCES attached`);
  }

  // Match each topic - use matchSingleTopicWithPrimary to handle PRIMARY sources
  const mappings = topics.map((topic) => matchSingleTopicWithPrimary(topic, sources));

  // Identify unmatched topics
  const unmatchedTopics = mappings
    .filter((m) => !m.hasMatch)
    .map((m) => m.topic);

  // Count unique sources cited
  const citedSourceUrls = new Set<string>();
  for (const mapping of mappings) {
    for (const source of mapping.matchedSources) {
      citedSourceUrls.add(source.url);
    }
  }

  // Phase 19: Log PRIMARY source results
  const mappingsWithPrimary = mappings.filter((m) => m.primarySource);
  if (mappingsWithPrimary.length > 0) {
    console.log(`[SourceMatching] Phase 19: ${mappingsWithPrimary.length} topic(s) matched to their PRIMARY sources:`);
    for (const m of mappingsWithPrimary) {
      console.log(`[SourceMatching]   "${m.topic}" -> PRIMARY: ${m.primarySourceUrl}`);
    }
  }

  const result: MatchingResult = {
    mappings,
    unmatchedTopics,
    allMatched: unmatchedTopics.length === 0,
    totalSourcesCited: citedSourceUrls.size,
  };

  console.log(`[SourceMatching] Complete. Matched: ${topics.length - unmatchedTopics.length}/${topics.length}, Sources cited: ${result.totalSourcesCited}`);

  return result;
}

/**
 * Build a formatted context string for Claude prompt
 * Shows topic-source mappings clearly so Claude knows which sources to use for each topic
 * Phase 19: Clearly marks PRIMARY sources and enforces their usage
 *
 * @param mappings - Topic-source mappings
 * @param maxSourcesPerTopic - Maximum sources to include per topic (default: 3)
 * @returns Formatted string for Claude prompt
 */
export function buildTopicSourceContext(
  mappings: TopicSourceMapping[],
  maxSourcesPerTopic: number = 3
): string {
  const sections: string[] = [];

  for (const mapping of mappings) {
    let section = `TOPIC: "${mapping.topic}"\n`;
    section += `Keywords: ${mapping.topicKeywords.join(', ')}\n`;

    if (mapping.hasMatch) {
      // Phase 19: Check if this topic has a PRIMARY source
      if (mapping.primarySource) {
        section += `Status: PRIMARY SOURCE ASSIGNED (MUST BE CITED)\n`;
        section += `\n*** PRIMARY SOURCE (MANDATORY - MUST BE THE MAIN CITATION) ***\n`;
        const primaryContent = 'content' in mapping.primarySource ? mapping.primarySource.content : mapping.primarySource.snippet;
        const primarySnippet = primaryContent ? primaryContent.substring(0, 500) + '...' : 'No content available';
        section += `   Title: ${mapping.primarySource.title}\n`;
        section += `   URL: ${mapping.primarySource.url}\n`;
        section += `   Content: ${primarySnippet}\n`;
        section += `\n   ENFORCEMENT: This article MUST cite the PRIMARY SOURCE above as its main reference.\n`;
        section += `   The PRIMARY SOURCE URL (${mapping.primarySource.url}) MUST appear in the sources array.\n`;

        // Show secondary sources if any
        const secondarySources = mapping.matchedSources.filter(s => s.url !== mapping.primarySource!.url);
        if (secondarySources.length > 0) {
          section += `\n   Secondary Sources (optional, only if directly relevant to PRIMARY):\n`;
          for (let i = 0; i < Math.min(secondarySources.length, 2); i++) {
            const source = secondarySources[i];
            section += `     ${i + 1}. ${source.title} (${source.url})\n`;
          }
        }
      } else {
        // Standard keyword-matched sources
        section += `Status: MATCHED (relevance: ${(mapping.relevanceScore * 100).toFixed(0)}%)\n`;
        section += `Available Sources (use ONLY these for this topic):\n`;

        const sourcesToShow = mapping.matchedSources.slice(0, maxSourcesPerTopic);
        for (let i = 0; i < sourcesToShow.length; i++) {
          const source = sourcesToShow[i];
          const content = 'content' in source ? source.content : source.snippet;
          const snippet = content ? content.substring(0, 200) + '...' : 'No content available';

          section += `  ${i + 1}. ${source.title}\n`;
          section += `     URL: ${source.url}\n`;
          section += `     Snippet: ${snippet}\n`;
        }
      }
    } else {
      section += `Status: NO SOURCES FOUND\n`;
      section += `Action: Do NOT write about this topic. Note "No current information available."\n`;
    }

    sections.push(section);
  }

  return sections.join('\n---\n\n');
}

/**
 * Get sources matched to a specific topic
 *
 * @param topic - The topic to get sources for
 * @param mappings - All topic-source mappings
 * @returns Array of matched sources or empty array
 */
export function getSourcesForTopic(
  topic: string,
  mappings: TopicSourceMapping[]
): (SourceArticle | ExtractedArticle)[] {
  const mapping = mappings.find((m) => m.topic === topic);
  return mapping?.matchedSources || [];
}

export default {
  matchTopicsToSources,
  matchSingleTopic,
  matchSingleTopicWithPrimary,
  calculateRelevanceScore,
  extractKeywords,
  buildTopicSourceContext,
  getSourcesForTopic,
};
