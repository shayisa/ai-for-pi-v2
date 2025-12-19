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

/**
 * Flavor formatting rules for content structure
 *
 * Phase 14: Research-backed formatting rules based on Newsletter Type Guide analysis.
 * Different flavors require different content structures and presentation.
 *
 * @param flavors - Array of flavor keys
 * @returns Formatting rules string for system prompt
 */
const flavorFormattingRulesMap: Record<string, string> = {
  citeData: `DATA-DRIVEN FORMATTING:
- Highlight numbers and percentages prominently (e.g., "73% of users reported...")
- Use comparisons to show scale ("up from X to Y", "3x faster than", "50% reduction")
- Include specific sources for every statistic cited
- Use bullet points for lists of data points
- Create mini-tables or structured lists for comparing metrics`,

  includeHumor: `CONVERSATIONAL FORMATTING:
- Use contractions naturally ("you're", "it's", "don't")
- Direct address to engage readers ("You know that feeling when...")
- Vary sentence length for rhythm - mix short punchy lines with longer explanations
- Add parenthetical asides for personality (like this one)
- End sections with memorable, quotable lines`,

  useSlang: `MODERN VOICE FORMATTING:
- Keep paragraphs short (3-4 sentences max)
- Use casual transitions ("So here's the thing...", "Real talk:")
- Break the fourth wall occasionally
- Include pop culture references where relevant
- Use bold for emphasis on key phrases`,

  useJargon: `TECHNICAL FORMATTING:
- Define acronyms on first use, then use freely
- Use inline code formatting for technical terms
- Include specification callouts (e.g., "API rate limit: 1000 req/hr")
- Structure complex concepts with clear subheadings
- Add "Prerequisites" or "Requirements" callouts`,

  useAnalogies: `EXPLANATORY FORMATTING:
- Lead technical explanations with the analogy
- Use "Think of it like..." or "Imagine..." as openers
- Follow analogies with concrete applications
- Use visual language that creates mental pictures
- Connect abstract concepts to everyday experiences`,
};

/**
 * Get flavor formatting rules for enhanced content structure
 *
 * These rules tell the LLM HOW to format content based on selected flavors,
 * complementing the getFlavorInstructions which tell WHAT to include.
 *
 * @param flavors - Array of flavor keys
 * @returns Formatted rules string for system prompt
 */
export const getFlavorFormattingRules = (flavors: string[]): string => {
  if (flavors.length === 0) {
    return `DEFAULT FORMATTING:
- Use clear, professional formatting throughout
- Balance short and medium-length paragraphs
- Include subheadings for scannability
- Bold key terms and concepts`;
  }

  const rules = flavors
    .map((key) => flavorFormattingRulesMap[key])
    .filter(Boolean);

  if (rules.length === 0) {
    return `DEFAULT FORMATTING:
- Use clear, professional formatting throughout
- Balance short and medium-length paragraphs
- Include subheadings for scannability
- Bold key terms and concepts`;
  }

  return `FLAVOR-SPECIFIC FORMATTING RULES:
${rules.join('\n\n')}`;
};
