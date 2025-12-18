/**
 * Source Quality Scoring Helpers
 *
 * Provides scoring algorithms for content curation and source ranking.
 *
 * @module domains/generation/helpers/scoringHelpers
 *
 * ## Original Location
 * - server.ts lines 595-653
 *
 * ## PRESERVATION NOTE - CONTENT CURATION CRITICAL
 * This scoring algorithm determines content quality and relevance.
 * Do NOT modify the scoring weights or keywords without explicit approval.
 */

import type { TrendingSource } from '../sources/types';

/**
 * Domain-specific keyword categories
 *
 * 60 keywords across 4 professional domains for audience relevance scoring.
 *
 * @constant domainKeywords
 */
export const domainKeywords = {
  forensic: ["skeletal", "bone", "remains", "forensic", "osteology", "trauma", "taphonomy", "morphometric", "ancestry", "bioarchaeology", "pathology", "identification", "decomposition", "craniofacial", "odontology"],
  archaeology: ["lidar", "photogrammetry", "archaeological", "artifact", "excavation", "geospatial", "gis", "remote sensing", "3d reconstruction", "site analysis", "stratigraphy", "cultural heritage", "heritage preservation", "landscape analysis", "ground-penetrating radar"],
  automation: ["workflow", "automation", "orchestration", "rpa", "bpa", "process optimization", "document processing", "task management", "productivity", "efficiency", "integration", "api workflow", "no-code", "low-code", "zapier"],
  analytics: ["analytics", "logistics", "supply chain", "forecasting", "optimization", "inventory", "warehouse", "route planning", "demand planning", "data mining", "predictive", "dashboard", "visualization", "kpi", "reporting"]
};

/**
 * Practical content indicator keywords
 *
 * @constant practicalKeywords
 */
export const practicalKeywords = ["tutorial", "guide", "implementation", "how to", "setup", "library", "tool", "framework", "api", "resource", "code", "github"];

/**
 * Score sources by recency, engagement, and practicality
 *
 * Calculates a quality score for content curation purposes.
 * Higher scores indicate more relevant and actionable content.
 *
 * Scoring factors:
 * - Recency: +30 (today), +20 (yesterday), +10 (within 7 days)
 * - Engagement: +5 to +25 based on stars/upvotes
 * - Practicality: +5 per matching practical keyword
 * - Domain relevance: +8 per matching domain keyword
 * - Source type: +15 for ArXiv/GitHub (structured content)
 *
 * @param source - Trending source to score
 * @returns Numeric quality score (higher is better)
 *
 * @example
 * const score = scoreSourceForPracticality(source);
 * // Use score to sort and prioritize sources
 */
export const scoreSourceForPracticality = (source: TrendingSource): number => {
  let score = 0;

  // Recency: sources from today score higher
  if (source.date) {
    const sourceDate = new Date(source.date);
    const today = new Date();
    const daysOld = (today.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld === 0) score += 30;
    else if (daysOld === 1) score += 20;
    else if (daysOld <= 7) score += 10;
  }

  // Engagement: GitHub stars and Reddit upvotes
  if (source.summary) {
    if (source.summary.includes("star") || source.summary.includes("upvote")) {
      const num = parseInt(source.summary.match(/\d+/)?.[0] || "0");
      if (num > 1000) score += 25;
      else if (num > 100) score += 15;
      else if (num > 0) score += 5;
    }
  }

  // Practicality: certain keywords indicate practical content
  const titleLower = source.title.toLowerCase();
  const summaryLower = (source.summary || "").toLowerCase();
  const combinedText = `${titleLower} ${summaryLower}`;

  const matchedKeywords = practicalKeywords.filter(kw => combinedText.includes(kw)).length;
  score += matchedKeywords * 5;

  // Domain-specific keywords: HIGH VALUE for audience relevance (60 keywords across 4 domains)
  // Check all domain keywords across all categories
  let domainMatches = 0;
  Object.values(domainKeywords).forEach(keywordList => {
    keywordList.forEach(keyword => {
      if (combinedText.includes(keyword)) {
        domainMatches++;
      }
    });
  });

  // Each domain keyword match adds significant value
  score += domainMatches * 8;

  // Source type: ArXiv and GitHub tend to have more structured content
  if (source.category === "arxiv" || source.category === "github") score += 15;

  return score;
};
