/**
 * Newsletter Format Utilities
 *
 * Provides type guards and conversion functions for handling both
 * legacy (v1) and enhanced (v2) newsletter formats.
 */

import type {
  Newsletter,
  EnhancedNewsletter,
  NewsletterSection,
  EnhancedAudienceSection,
  HistoryItem,
  EnhancedHistoryItem,
} from '../types';

/**
 * Type guard to check if a newsletter is in enhanced (v2) format.
 * Enhanced newsletters have editorsNote and audienceSections instead of sections.
 */
export function isEnhancedNewsletter(
  newsletter: Newsletter | EnhancedNewsletter | null | undefined
): newsletter is EnhancedNewsletter {
  if (!newsletter) return false;
  return (
    'editorsNote' in newsletter &&
    'audienceSections' in newsletter &&
    Array.isArray((newsletter as EnhancedNewsletter).audienceSections)
  );
}

/**
 * Type guard to check if a history item contains an enhanced newsletter.
 */
export function isEnhancedHistoryItem(
  item: HistoryItem | EnhancedHistoryItem
): item is EnhancedHistoryItem {
  return 'formatVersion' in item && item.formatVersion === 'v2';
}

/**
 * Get the subject/title from either newsletter format.
 * For enhanced newsletters, derives subject from the first audience section title
 * or the tool of the day name.
 */
export function getNewsletterSubject(
  newsletter: Newsletter | EnhancedNewsletter
): string {
  if (isEnhancedNewsletter(newsletter)) {
    // Use explicit subject if set, otherwise derive from content
    if (newsletter.subject) return newsletter.subject;
    if (newsletter.audienceSections.length > 0) {
      return newsletter.audienceSections[0].title;
    }
    if (newsletter.toolOfTheDay?.name) {
      return `Tool of the Day: ${newsletter.toolOfTheDay.name}`;
    }
    return 'AI for PI Newsletter';
  }
  return newsletter.subject || 'Newsletter';
}

/**
 * Get the introduction/editor's note from either format.
 */
export function getNewsletterIntro(
  newsletter: Newsletter | EnhancedNewsletter
): string {
  if (isEnhancedNewsletter(newsletter)) {
    return newsletter.editorsNote?.message || '';
  }
  return newsletter.introduction || '';
}

/**
 * Convert a legacy (v1) newsletter to enhanced (v2) format.
 * This is a best-effort conversion that maps existing fields to the new structure.
 */
export function convertLegacyToEnhanced(
  legacy: Newsletter,
  audienceId = 'general',
  audienceName = 'General Audience'
): EnhancedNewsletter {
  // Convert legacy sections to enhanced audience sections
  const audienceSections: EnhancedAudienceSection[] = legacy.sections.map(
    (section, index) => ({
      audienceId: `${audienceId}_${index}`,
      audienceName,
      title: section.title,
      whyItMatters: 'This content is relevant to your interests.',
      content: section.content,
      practicalPrompt: {
        scenario: 'General use',
        prompt: legacy.promptOfTheDay?.promptCode || 'No prompt available',
        isToolSpecific: false,
      },
      cta: {
        text: 'Learn More',
        action: 'visit_url' as const,
      },
      sources: [],
      imagePrompt: section.imagePrompt,
      imageUrl: section.imageUrl,
    })
  );

  return {
    id: legacy.id,
    editorsNote: {
      message: legacy.introduction,
    },
    toolOfTheDay: {
      name: 'Featured Tool',
      url: '#',
      whyNow: 'Check out this useful tool.',
      quickStart: 'Visit the link to get started.',
    },
    audienceSections,
    conclusion: legacy.conclusion,
    subject: legacy.subject,
    promptOfTheDay: legacy.promptOfTheDay,
  };
}

/**
 * Convert an enhanced (v2) newsletter to legacy (v1) format.
 * Useful for backward compatibility with older rendering code.
 */
export function convertEnhancedToLegacy(
  enhanced: EnhancedNewsletter
): Newsletter {
  // Convert enhanced audience sections to legacy sections
  const sections: NewsletterSection[] = enhanced.audienceSections.map(
    (section) => ({
      title: section.title,
      content: section.content,
      imagePrompt: section.imagePrompt || '',
      imageUrl: section.imageUrl,
    })
  );

  return {
    id: enhanced.id,
    subject:
      enhanced.subject || getNewsletterSubject(enhanced),
    introduction: enhanced.editorsNote.message,
    sections,
    conclusion: enhanced.conclusion,
    promptOfTheDay: enhanced.promptOfTheDay,
  };
}

/**
 * Get all sections from either format as a unified structure.
 * Returns an array with title, content, and optional metadata.
 */
export function getNewsletterSections(
  newsletter: Newsletter | EnhancedNewsletter
): Array<{
  title: string;
  content: string;
  imageUrl?: string;
  audienceName?: string;
  whyItMatters?: string;
  sources?: Array<{ url: string; title: string }>;
}> {
  if (isEnhancedNewsletter(newsletter)) {
    return newsletter.audienceSections.map((section) => ({
      title: section.title,
      content: section.content,
      imageUrl: section.imageUrl,
      audienceName: section.audienceName,
      whyItMatters: section.whyItMatters,
      sources: section.sources,
    }));
  }
  return newsletter.sections.map((section) => ({
    title: section.title,
    content: section.content,
    imageUrl: section.imageUrl,
  }));
}

/**
 * Determine the format version of a newsletter.
 */
export function getNewsletterFormatVersion(
  newsletter: Newsletter | EnhancedNewsletter
): 'v1' | 'v2' {
  return isEnhancedNewsletter(newsletter) ? 'v2' : 'v1';
}

/**
 * Create an empty enhanced newsletter with default values.
 */
export function createEmptyEnhancedNewsletter(): EnhancedNewsletter {
  return {
    editorsNote: {
      message: '',
    },
    toolOfTheDay: {
      name: '',
      url: '',
      whyNow: '',
      quickStart: '',
    },
    audienceSections: [],
    conclusion: '',
  };
}

/**
 * Validate that an enhanced newsletter has all required fields.
 */
export function validateEnhancedNewsletter(
  newsletter: EnhancedNewsletter
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!newsletter.editorsNote?.message) {
    errors.push("Editor's Note is required");
  }

  if (!newsletter.toolOfTheDay?.name) {
    errors.push('Tool of the Day name is required');
  }

  if (!newsletter.toolOfTheDay?.url) {
    errors.push('Tool of the Day URL is required');
  }

  if (!newsletter.audienceSections || newsletter.audienceSections.length === 0) {
    errors.push('At least one audience section is required');
  }

  newsletter.audienceSections?.forEach((section, index) => {
    if (!section.title) {
      errors.push(`Section ${index + 1}: Title is required`);
    }
    if (!section.content) {
      errors.push(`Section ${index + 1}: Content is required`);
    }
    if (!section.whyItMatters) {
      errors.push(`Section ${index + 1}: "Why It Matters" is required`);
    }
  });

  if (!newsletter.conclusion) {
    errors.push('Conclusion is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
