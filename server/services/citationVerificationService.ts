/**
 * Citation Verification Service
 *
 * Post-generation service that verifies the newsletter content
 * actually cites the sources that were allocated to each audience.
 *
 * @module services/citationVerificationService
 *
 * ## Verification Checks
 * 1. Each audience section cites at least one allocated source
 * 2. No sources are cited that weren't allocated to that audience
 * 3. Source URLs are valid and match the allocated URLs
 * 4. Source diversity is maintained across audience sections
 */

import type { EnhancedNewsletter } from '../../types';
import type { SourceAllocation, AllocationResult } from './sourceAllocationService';

/**
 * Result of verifying a single audience section
 */
export interface SectionVerificationResult {
  audienceId: string;
  audienceName: string;
  /** URLs that were allocated to this audience */
  allocatedUrls: string[];
  /** URLs actually cited in the content */
  citedUrls: string[];
  /** Allocated URLs that were cited (intersection) */
  validCitations: string[];
  /** Allocated URLs that were NOT cited */
  missedAllocations: string[];
  /** URLs cited that were NOT allocated (violations) */
  unauthorizedCitations: string[];
  /** Whether this section passes verification */
  isValid: boolean;
  /** Specific issues found */
  issues: string[];
}

/**
 * Result of verifying source diversity across all sections
 */
export interface DiversityVerificationResult {
  /** URLs that appear in multiple audience sections */
  duplicatedUrls: string[];
  /** Number of unique URLs cited across all sections */
  uniqueUrlCount: number;
  /** Total citations across all sections */
  totalCitations: number;
  /** Diversity score: 100 = perfect, 0 = all same URL */
  diversityScore: number;
  /** Whether diversity requirements are met */
  isValid: boolean;
  /** Specific diversity issues */
  issues: string[];
}

/**
 * Complete verification result for a newsletter
 */
export interface NewsletterVerificationResult {
  /** Whether the entire newsletter passes verification */
  isValid: boolean;
  /** Per-section verification results */
  sectionResults: SectionVerificationResult[];
  /** Cross-section diversity verification */
  diversityResult: DiversityVerificationResult;
  /** Summary of all issues found */
  allIssues: string[];
  /** Recommendations for fixing issues */
  recommendations: string[];
  /** Verification timestamp */
  verifiedAt: string;
}

/**
 * Extract URLs from HTML content (finds href attributes and plain URLs)
 *
 * @param content - HTML content string
 * @returns Array of extracted URLs
 */
export function extractUrlsFromContent(content: string): string[] {
  const urls: string[] = [];

  // Match href attributes: href="url" or href='url'
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(content)) !== null) {
    if (match[1] && match[1].startsWith('http')) {
      urls.push(match[1]);
    }
  }

  // Match plain URLs (not already in href)
  const plainUrlPattern = /(?<!href=["'])https?:\/\/[^\s<>"')\]]+/gi;
  const plainMatches = content.match(plainUrlPattern) || [];
  for (const url of plainMatches) {
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Normalize URL for comparison (remove trailing slashes, www, etc.)
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove www prefix
    let host = parsed.hostname.replace(/^www\./, '');
    // Lowercase
    host = host.toLowerCase();
    // Remove trailing slash from path
    let path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.protocol}//${host}${path}${parsed.search}`;
  } catch {
    // If URL parsing fails, just clean it up manually
    return url.toLowerCase().replace(/\/$/, '').replace(/^www\./, '');
  }
}

/**
 * Check if two URLs match (allowing for normalization differences)
 *
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns Whether the URLs effectively match
 */
export function urlsMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Find matching URL in a set (with normalization)
 *
 * @param url - URL to find
 * @param urlSet - Set of URLs to search
 * @returns The matching URL from the set, or undefined
 */
export function findMatchingUrl(url: string, urlSet: string[]): string | undefined {
  const normalized = normalizeUrl(url);
  return urlSet.find((u) => normalizeUrl(u) === normalized);
}

/**
 * Verify a single audience section's citations
 *
 * @param section - The audience section from the newsletter
 * @param allocations - Source allocations for this audience
 * @returns Section verification result
 */
export function verifySectionCitations(
  section: {
    audienceId: string;
    audienceName: string;
    content: string;
    sources?: Array<{ url: string; title: string }>;
  },
  allocations: SourceAllocation[]
): SectionVerificationResult {
  const issues: string[] = [];

  // Get allocations for this audience
  const audienceAllocations = allocations.filter((a) => a.audienceId === section.audienceId);
  const allocatedUrls = audienceAllocations.flatMap((a) => a.sources.map((s) => s.url));

  // Extract cited URLs from content and sources array
  const contentUrls = extractUrlsFromContent(section.content);
  const sourcesArrayUrls = (section.sources || []).map((s) => s.url);
  const allCitedUrls = [...new Set([...contentUrls, ...sourcesArrayUrls])];

  // Check each cited URL against allocations
  const validCitations: string[] = [];
  const unauthorizedCitations: string[] = [];

  for (const citedUrl of allCitedUrls) {
    const matchingAllocation = findMatchingUrl(citedUrl, allocatedUrls);
    if (matchingAllocation) {
      validCitations.push(citedUrl);
    } else {
      unauthorizedCitations.push(citedUrl);
    }
  }

  // Check which allocated URLs were missed
  const missedAllocations = allocatedUrls.filter(
    (allocUrl) => !allCitedUrls.some((cited) => urlsMatch(cited, allocUrl))
  );

  // Generate issues
  if (validCitations.length === 0 && allocatedUrls.length > 0) {
    issues.push(`Section "${section.audienceName}" does not cite any allocated sources`);
  }

  if (unauthorizedCitations.length > 0) {
    issues.push(
      `Section "${section.audienceName}" cites ${unauthorizedCitations.length} unauthorized source(s): ${unauthorizedCitations.slice(0, 3).join(', ')}${unauthorizedCitations.length > 3 ? '...' : ''}`
    );
  }

  if (missedAllocations.length > 0 && allocatedUrls.length > 1) {
    // Only warn if there were multiple allocated sources
    issues.push(
      `Section "${section.audienceName}" could have cited ${missedAllocations.length} more allocated source(s)`
    );
  }

  return {
    audienceId: section.audienceId,
    audienceName: section.audienceName,
    allocatedUrls,
    citedUrls: allCitedUrls,
    validCitations,
    missedAllocations,
    unauthorizedCitations,
    isValid: validCitations.length > 0 || allocatedUrls.length === 0,
    issues,
  };
}

/**
 * Verify source diversity across all audience sections
 *
 * @param sectionResults - Results from verifying each section
 * @returns Diversity verification result
 */
export function verifySourceDiversity(
  sectionResults: SectionVerificationResult[]
): DiversityVerificationResult {
  const issues: string[] = [];

  // Collect all cited URLs per section
  const citedUrlsBySection = new Map<string, Set<string>>();
  for (const result of sectionResults) {
    citedUrlsBySection.set(
      result.audienceId,
      new Set(result.citedUrls.map((u) => normalizeUrl(u)))
    );
  }

  // Find duplicated URLs (cited in multiple sections)
  const urlCounts = new Map<string, string[]>(); // normalized URL -> [audienceIds that cite it]
  for (const [audienceId, urls] of Array.from(citedUrlsBySection.entries())) {
    for (const url of Array.from(urls)) {
      const existing = urlCounts.get(url) || [];
      existing.push(audienceId);
      urlCounts.set(url, existing);
    }
  }

  const duplicatedUrls: string[] = [];
  for (const [url, audiences] of Array.from(urlCounts.entries())) {
    if (audiences.length > 1) {
      duplicatedUrls.push(url);
      issues.push(
        `URL "${url.substring(0, 60)}..." is cited in ${audiences.length} sections: ${audiences.join(', ')}`
      );
    }
  }

  // Calculate diversity metrics
  const totalCitations = sectionResults.reduce((sum, r) => sum + r.citedUrls.length, 0);
  const uniqueUrlCount = urlCounts.size;
  const duplicateCount = duplicatedUrls.length;

  // Diversity score: penalize duplicates
  // 100 if no duplicates, lower if duplicates exist
  let diversityScore = 100;
  if (uniqueUrlCount > 0 && duplicateCount > 0) {
    diversityScore = Math.max(0, 100 - (duplicateCount / uniqueUrlCount) * 100);
  }

  return {
    duplicatedUrls,
    uniqueUrlCount,
    totalCitations,
    diversityScore,
    isValid: duplicatedUrls.length === 0,
    issues,
  };
}

/**
 * Verify an entire newsletter's citations and source diversity
 *
 * @param newsletter - The generated newsletter
 * @param allocations - Source allocations that were assigned
 * @returns Complete verification result
 */
export function verifyNewsletter(
  newsletter: EnhancedNewsletter,
  allocations: SourceAllocation[]
): NewsletterVerificationResult {
  const sectionResults: SectionVerificationResult[] = [];

  // Verify each audience section
  for (const section of newsletter.audienceSections || []) {
    const result = verifySectionCitations(section, allocations);
    sectionResults.push(result);
  }

  // Verify cross-section diversity
  const diversityResult = verifySourceDiversity(sectionResults);

  // Collect all issues
  const allIssues: string[] = [];
  for (const result of sectionResults) {
    allIssues.push(...result.issues);
  }
  allIssues.push(...diversityResult.issues);

  // Generate recommendations
  const recommendations: string[] = [];

  // Check for sections with no valid citations
  const sectionsWithNoCitations = sectionResults.filter(
    (r) => r.validCitations.length === 0 && r.allocatedUrls.length > 0
  );
  if (sectionsWithNoCitations.length > 0) {
    recommendations.push(
      `Regenerate sections for: ${sectionsWithNoCitations.map((s) => s.audienceName).join(', ')} - they don't cite their allocated sources`
    );
  }

  // Check for unauthorized citations
  const sectionsWithUnauthorized = sectionResults.filter((r) => r.unauthorizedCitations.length > 0);
  if (sectionsWithUnauthorized.length > 0) {
    recommendations.push(
      `Review unauthorized sources in: ${sectionsWithUnauthorized.map((s) => s.audienceName).join(', ')} - they cite sources not allocated to them`
    );
  }

  // Check for low diversity
  if (diversityResult.diversityScore < 70) {
    recommendations.push(
      `Consider regenerating newsletter - source diversity is low (${diversityResult.diversityScore.toFixed(0)}%). Same sources appear across multiple sections.`
    );
  }

  const isValid =
    sectionResults.every((r) => r.isValid) &&
    diversityResult.isValid;

  return {
    isValid,
    sectionResults,
    diversityResult,
    allIssues,
    recommendations,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Quick check if a newsletter passes basic verification
 * (cheaper than full verification for quick decisions)
 *
 * @param newsletter - The generated newsletter
 * @param allocations - Source allocations that were assigned
 * @returns Whether the newsletter passes basic checks
 */
export function quickVerify(
  newsletter: EnhancedNewsletter,
  allocations: SourceAllocation[]
): boolean {
  // Check each section cites at least one of its allocated sources
  for (const section of newsletter.audienceSections || []) {
    const audienceAllocations = allocations.filter((a) => a.audienceId === section.audienceId);
    const allocatedUrls = audienceAllocations.flatMap((a) => a.sources.map((s) => s.url));

    if (allocatedUrls.length === 0) continue; // No allocations = can't verify

    const contentUrls = extractUrlsFromContent(section.content);
    const sourcesArrayUrls = (section.sources || []).map((s) => s.url);
    const allCitedUrls = [...contentUrls, ...sourcesArrayUrls];

    // Check if at least one allocated URL was cited
    const hasCitation = allocatedUrls.some((allocUrl) =>
      allCitedUrls.some((cited) => urlsMatch(cited, allocUrl))
    );

    if (!hasCitation) {
      return false;
    }
  }

  return true;
}

export default {
  extractUrlsFromContent,
  normalizeUrl,
  urlsMatch,
  findMatchingUrl,
  verifySectionCitations,
  verifySourceDiversity,
  verifyNewsletter,
  quickVerify,
};
