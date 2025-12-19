/**
 * Tone Execution Helpers
 *
 * Provides research-backed tone instructions for newsletter generation.
 * Based on analysis of 77+ award-winning newsletters.
 *
 * @module domains/generation/helpers/toneHelpers
 *
 * Phase 13.1: Research-backed 8-tone system
 */

/**
 * Tone execution rules interface
 * Defines how each tone should be executed in writing
 */
interface ToneExecutionRules {
  sentenceConstruction: string[];  // How to build sentences
  wordsToUse: string[];           // Preferred language patterns
  wordsToAvoid: string[];         // Language to avoid
  punctuationStyle: string;       // Punctuation guidance
}

/**
 * Complete tone definition
 */
interface ToneDefinition {
  label: string;
  description: string;
  executionRules: ToneExecutionRules;
}

/**
 * Research-backed tone definitions
 *
 * 8 tones based on analysis of 77+ award-winning publications including:
 * - Morning Brew, Wait But Why, Lenny's Newsletter, Blackbird Spyplane
 * - The Atlantic, The New Yorker, Wired, MIT Technology Review, Vox
 */
const TONE_DEFINITIONS: Record<string, ToneDefinition> = {
  warm: {
    label: 'Warm',
    description: 'Friendly, accepting, and celebratory. Perfect for community and support content.',
    executionRules: {
      sentenceConstruction: [
        'Use positive framing: "Here\'s what helped" not "Don\'t do this"',
        'Include gratitude: "Thanks for being here"',
        'Celebrate wins and progress',
      ],
      wordsToUse: ['welcome', 'glad', 'excited', 'appreciate', 'together'],
      wordsToAvoid: ['unfortunately', 'problem', 'issue', 'failed'],
      punctuationStyle: 'Occasional exclamation points (use carefully), warm ellipses',
    },
  },
  confident: {
    label: 'Confident',
    description: 'Sure, direct, and authoritative. No hedging. Perfect for business and leadership.',
    executionRules: {
      sentenceConstruction: [
        'Short, declarative sentences',
        'Active voice only',
        'Imperative mood: "Do this" not "You might consider"',
      ],
      wordsToUse: ['proven', 'works', 'results', 'exactly', "here's how"],
      wordsToAvoid: ['seems', 'might', 'perhaps', 'appears', 'arguably', 'I think'],
      punctuationStyle: 'Periods. Short sentences. Direct.',
    },
  },
  witty: {
    label: 'Witty',
    description: 'Clever, humorous, and engaging. Insider jokes that reward knowledge.',
    executionRules: {
      sentenceConstruction: [
        'Unexpected word choices and wordplay',
        'Timing through sentence length variation',
        'Deadpan delivery followed by punchline',
      ],
      wordsToUse: ['impossibly', 'finally', 'actually', 'somehow'],
      wordsToAvoid: ['LOL', 'hilarious', 'funny thing is', 'haha'],
      punctuationStyle: 'Parentheticals for asides, em dashes for timing',
    },
  },
  empathetic: {
    label: 'Empathetic',
    description: 'Understanding, validating, and supportive. Perfect for wellness and difficult topics.',
    executionRules: {
      sentenceConstruction: [
        'Acknowledge feelings first, then information',
        'Use second person: "You" and "your"',
        'Validate before advising',
      ],
      wordsToUse: ['understand', 'feel', 'struggle', 'not alone', 'valid'],
      wordsToAvoid: ['just', 'simply', 'obviously', 'easy', 'should have'],
      punctuationStyle: 'Gentle pauses with em dashes, ellipses for reflection',
    },
  },
  analytical: {
    label: 'Analytical',
    description: 'Thoughtful, intellectual, and nuanced. Multiple perspectives examined.',
    executionRules: {
      sentenceConstruction: [
        'Complex sentence structures with clear logic',
        'Transitional language: "However," "Conversely," "Moreover"',
        '"On the surface... but actually..." pattern',
      ],
      wordsToUse: ['however', 'conversely', 'notably', 'interestingly', 'reveals'],
      wordsToAvoid: ['obviously', 'clearly', 'everyone knows'],
      punctuationStyle: 'Colons for explanations, semicolons for related ideas',
    },
  },
  urgent: {
    label: 'Urgent',
    description: 'Fast-paced, action-focused, FOMO-inducing. For breaking news and launches.',
    executionRules: {
      sentenceConstruction: [
        'Short sentences. Very short.',
        'Time-specific framing',
        'Direct calls to action',
      ],
      wordsToUse: ['now', 'immediately', 'breaking', 'just announced', 'this changes'],
      wordsToAvoid: ['eventually', 'sometime', 'might want to consider'],
      punctuationStyle: 'Periods for punch. Em dashes for speed. Exclamation points (sparingly).',
    },
  },
  introspective: {
    label: 'Introspective',
    description: 'Reflective, questioning, and contemplative. For essays and personal development.',
    executionRules: {
      sentenceConstruction: [
        'Questions without immediate answers',
        'First person reflection: "I\'ve been thinking..."',
        'Exploration over conclusions',
      ],
      wordsToUse: ['wondering', 'perhaps', 'what if', "I've noticed", 'makes me think'],
      wordsToAvoid: ['definitely', 'certainly', 'the answer is', 'everyone should'],
      punctuationStyle: 'Question marks for genuine inquiry, ellipses for trailing thoughts...',
    },
  },
  serious: {
    label: 'Serious',
    description: 'Formal, grave, and respectful. For crisis, investigative, or policy content.',
    executionRules: {
      sentenceConstruction: [
        'Formal without being cold',
        'Acknowledge stakes clearly',
        'Measured, deliberate pacing',
      ],
      wordsToUse: ['significant', 'implications', 'important to understand', 'deserves attention'],
      wordsToAvoid: ['joke', 'fun', 'exciting', 'cool', 'awesome'],
      punctuationStyle: 'Conservative punctuation, no exclamation points, formal structure',
    },
  },
};

/**
 * Get tone instructions for newsletter generation
 *
 * Generates detailed writing tone instructions based on selected tone.
 * Includes sentence construction patterns, preferred/avoided words, and punctuation guidance.
 *
 * @param tone - The selected tone key ('warm', 'confident', 'witty', etc.)
 * @returns Formatted tone instructions string for use in prompts
 *
 * @example
 * const instructions = getToneInstructions('confident');
 * // Returns detailed prompt instructions for confident tone
 */
export const getToneInstructions = (tone: string): string => {
  const toneOption = TONE_DEFINITIONS[tone];

  if (!toneOption) {
    // Fall back to confident if unknown tone
    console.warn(`[toneHelpers] Unknown tone "${tone}", falling back to "confident"`);
    return getToneInstructions('confident');
  }

  const rules = toneOption.executionRules;

  return `
TONE: ${toneOption.label}
${toneOption.description}

SENTENCE CONSTRUCTION:
${rules.sentenceConstruction.map(r => `- ${r}`).join('\n')}

PREFERRED LANGUAGE: ${rules.wordsToUse.join(', ')}
AVOID: ${rules.wordsToAvoid.join(', ')}
PUNCTUATION STYLE: ${rules.punctuationStyle}
`;
};

/**
 * Get all available tone keys
 *
 * @returns Array of valid tone keys
 */
export const getAvailableTones = (): string[] => {
  return Object.keys(TONE_DEFINITIONS);
};

/**
 * Get tone definition by key
 *
 * @param tone - The tone key
 * @returns ToneDefinition or undefined if not found
 */
export const getToneDefinition = (tone: string): ToneDefinition | undefined => {
  return TONE_DEFINITIONS[tone];
};
