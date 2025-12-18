/**
 * Writing Style Flavor Helpers
 *
 * Provides writing style instructions for newsletter tone customization.
 *
 * @module domains/generation/helpers/flavorHelpers
 *
 * ## Original Location
 * - server.ts lines 416-442
 *
 * ## PRESERVATION NOTE - PERSONALITY CRITICAL
 * These exact instructions define the newsletter's writing style.
 * Do NOT modify the flavor instructions without explicit approval.
 */

/**
 * Flavor instruction mappings
 *
 * Each flavor adds specific writing style instructions to the prompt.
 *
 * Flavors:
 * - includeHumor: Light-hearted, clever humor
 * - useSlang: Modern, conversational language
 * - useJargon: Technical terminology
 * - useAnalogies: Relatable metaphors
 * - citeData: Statistical/research citations
 *
 * @constant flavorMap
 */
const flavorMap: Record<string, string> = {
  includeHumor:
    "- You may sprinkle in one or two instances of light-hearted, clever humor where appropriate, without undermining the main tone.",
  useSlang:
    "- You may incorporate some modern, conversational slang to make the content feel more relatable and authentic.",
  useJargon:
    "- You should incorporate relevant technical jargon where it adds precision and is appropriate for the expert audience.",
  useAnalogies:
    "- You should use relatable analogies and simple metaphors to explain complex technical concepts.",
  citeData:
    "- Wherever possible, you should cite specific data points, statistics, or findings to add authority and credibility to your points.",
};

/**
 * Get flavor instructions for newsletter generation
 *
 * Generates writing style instructions based on selected flavors.
 * Returns empty string if no flavors are selected.
 *
 * @param flavors - Array of flavor keys ('includeHumor', 'useSlang', etc.)
 * @returns Formatted flavor instructions string for use in prompts
 *
 * @example
 * // Single flavor
 * const instructions = getFlavorInstructions(['includeHumor']);
 * // Returns: "\n\n    Additionally, adhere to the following stylistic instructions:\n    - You may sprinkle in..."
 *
 * @example
 * // No flavors
 * const instructions = getFlavorInstructions([]);
 * // Returns: ""
 */
export const getFlavorInstructions = (flavors: string[]): string => {
  if (flavors.length === 0) return "";

  const instructions = flavors.map((key) => flavorMap[key]).filter(Boolean);

  if (instructions.length === 0) return "";

  return `

    Additionally, adhere to the following stylistic instructions:
    ${instructions.join("\n")}
    `;
};
