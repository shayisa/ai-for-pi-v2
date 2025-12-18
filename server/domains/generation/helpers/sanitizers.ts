/**
 * Newsletter Content Sanitizers
 *
 * Provides post-processing functions for cleaning generated newsletter content.
 *
 * @module domains/generation/helpers/sanitizers
 *
 * ## Original Location
 * - server.ts lines 101-127
 *
 * ## PRESERVATION NOTE
 * These functions clean up AI-generated content.
 * Do NOT modify the regex patterns without testing.
 */

/**
 * Remove emojis and special symbols from text
 *
 * Strips all emoji characters and special Unicode symbols from content.
 * Also normalizes whitespace.
 *
 * @param text - Input text potentially containing emojis
 * @returns Cleaned text without emojis
 *
 * Unicode ranges removed:
 * - Emoji_Presentation: Most visual emojis
 * - Extended_Pictographic: Pictographic characters
 * - U+1F300-U+1F9FF: Miscellaneous Symbols and Pictographs
 * - U+2600-U+27BF: Miscellaneous Symbols
 * - U+2300-U+23FF: Miscellaneous Technical
 * - U+2000-U+206F: General Punctuation (converted to spaces)
 *
 * @example
 * removeEmojis("Hello 🌍 World! 🚀") // Returns: "Hello World!"
 */
export const removeEmojis = (text: string): string => {
  // Remove emojis and other special symbols
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/[\u{2000}-\u{206F}]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

/**
 * Sanitize newsletter object to remove emojis from key fields
 *
 * Cleans the subject line and section titles of any emoji characters.
 * Modifies the newsletter object in place.
 *
 * @param newsletter - Newsletter object to sanitize
 * @returns The sanitized newsletter object
 *
 * Fields cleaned:
 * - newsletter.subject
 * - newsletter.sections[].title
 *
 * @example
 * const newsletter = { subject: "🚀 AI News!", sections: [{ title: "🤖 Robots" }] };
 * sanitizeNewsletter(newsletter);
 * // newsletter.subject is now "AI News!"
 * // newsletter.sections[0].title is now "Robots"
 */
export const sanitizeNewsletter = (newsletter: any) => {
  if (newsletter.subject) {
    newsletter.subject = removeEmojis(newsletter.subject);
  }
  if (newsletter.sections && Array.isArray(newsletter.sections)) {
    newsletter.sections.forEach((section: any) => {
      if (section.title) {
        section.title = removeEmojis(section.title);
      }
    });
  }
  return newsletter;
};
