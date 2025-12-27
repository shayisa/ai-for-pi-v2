/**
 * Strategic Overlap Detector
 *
 * Detects when topics mention platforms/tools that have equivalents,
 * and suggests complementary topics for other audiences.
 *
 * @module domains/generation/services/strategicOverlapDetector
 *
 * ## Examples
 *
 * Topic: "Google Gemini for Research"
 * -> Suggests "Claude for Research" for another audience
 *
 * Topic: "Microsoft 365 Copilot Automation"
 * -> Suggests "Google Workspace AI Features" for another audience
 *
 * Topic: "AWS Bedrock Deployment"
 * -> Suggests "Vertex AI Deployment" or "Azure OpenAI Deployment"
 */

import type {
  TopicWithAudienceId,
  PlatformEquivalent,
  StrategicOverlap,
  AudienceConfig,
} from '../../../../types';

// =============================================================================
// Platform Equivalence Mappings
// =============================================================================

/**
 * Platform/tool equivalence database.
 * Each entry maps a platform to its alternatives and category.
 */
export const PLATFORM_EQUIVALENTS: PlatformEquivalent[] = [
  // AI Models
  {
    platform: 'gemini',
    equivalents: ['claude', 'gpt-4', 'gpt-4o', 'llama', 'mistral', 'command-r'],
    category: 'ai-model',
  },
  {
    platform: 'claude',
    equivalents: ['gemini', 'gpt-4', 'gpt-4o', 'llama', 'mistral', 'command-r'],
    category: 'ai-model',
  },
  {
    platform: 'gpt-4',
    equivalents: ['claude', 'gemini', 'llama', 'mistral', 'command-r'],
    category: 'ai-model',
  },
  {
    platform: 'chatgpt',
    equivalents: ['claude', 'gemini', 'perplexity', 'copilot'],
    category: 'ai-model',
  },
  {
    platform: 'openai',
    equivalents: ['anthropic', 'google-ai', 'meta-ai', 'mistral-ai', 'cohere'],
    category: 'ai-model',
  },
  {
    platform: 'anthropic',
    equivalents: ['openai', 'google-ai', 'meta-ai', 'mistral-ai', 'cohere'],
    category: 'ai-model',
  },

  // Cloud AI Platforms
  {
    platform: 'vertex-ai',
    equivalents: ['bedrock', 'azure-openai', 'together-ai', 'anyscale'],
    category: 'cloud',
  },
  {
    platform: 'bedrock',
    equivalents: ['vertex-ai', 'azure-openai', 'together-ai', 'anyscale'],
    category: 'cloud',
  },
  {
    platform: 'azure-openai',
    equivalents: ['vertex-ai', 'bedrock', 'together-ai', 'anyscale'],
    category: 'cloud',
  },
  {
    platform: 'aws',
    equivalents: ['gcp', 'azure', 'oracle-cloud', 'ibm-cloud'],
    category: 'cloud',
  },
  {
    platform: 'gcp',
    equivalents: ['aws', 'azure', 'oracle-cloud', 'ibm-cloud'],
    category: 'cloud',
  },
  {
    platform: 'azure',
    equivalents: ['aws', 'gcp', 'oracle-cloud', 'ibm-cloud'],
    category: 'cloud',
  },

  // Productivity Suites
  {
    platform: 'google-workspace',
    equivalents: ['microsoft-365', 'notion', 'coda', 'airtable'],
    category: 'productivity',
  },
  {
    platform: 'microsoft-365',
    equivalents: ['google-workspace', 'notion', 'coda', 'airtable'],
    category: 'productivity',
  },
  {
    platform: 'google-docs',
    equivalents: ['microsoft-word', 'notion', 'coda'],
    category: 'productivity',
  },
  {
    platform: 'google-sheets',
    equivalents: ['excel', 'airtable', 'coda'],
    category: 'productivity',
  },
  {
    platform: 'excel',
    equivalents: ['google-sheets', 'airtable', 'coda'],
    category: 'productivity',
  },
  {
    platform: 'copilot',
    equivalents: ['duet-ai', 'codeium', 'cursor', 'tabnine'],
    category: 'productivity',
  },

  // AI Frameworks
  {
    platform: 'langchain',
    equivalents: ['llamaindex', 'semantic-kernel', 'haystack', 'dspy'],
    category: 'framework',
  },
  {
    platform: 'llamaindex',
    equivalents: ['langchain', 'semantic-kernel', 'haystack', 'dspy'],
    category: 'framework',
  },
  {
    platform: 'langgraph',
    equivalents: ['autogen', 'crewai', 'agents-sdk'],
    category: 'framework',
  },
  {
    platform: 'autogen',
    equivalents: ['langgraph', 'crewai', 'agents-sdk'],
    category: 'framework',
  },
  {
    platform: 'huggingface',
    equivalents: ['replicate', 'together-ai', 'modal'],
    category: 'framework',
  },

  // Programming Languages
  {
    platform: 'python',
    equivalents: ['typescript', 'javascript', 'go', 'rust'],
    category: 'language',
  },
  {
    platform: 'typescript',
    equivalents: ['python', 'javascript', 'go', 'rust'],
    category: 'language',
  },
  {
    platform: 'javascript',
    equivalents: ['python', 'typescript', 'go'],
    category: 'language',
  },

  // Automation Platforms
  {
    platform: 'n8n',
    equivalents: ['zapier', 'make', 'power-automate', 'pipedream'],
    category: 'productivity',
  },
  {
    platform: 'zapier',
    equivalents: ['n8n', 'make', 'power-automate', 'pipedream'],
    category: 'productivity',
  },
  {
    platform: 'make',
    equivalents: ['n8n', 'zapier', 'power-automate', 'pipedream'],
    category: 'productivity',
  },
];

// Build a lookup map for faster access
const platformLookup = new Map<string, PlatformEquivalent>();
for (const equiv of PLATFORM_EQUIVALENTS) {
  platformLookup.set(equiv.platform.toLowerCase(), equiv);
}

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Normalize a platform name for lookup
 */
function normalizePlatform(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Extract potential platform/tool mentions from a topic title
 */
export function extractPlatformMentions(topicTitle: string): string[] {
  console.log(`[StrategicOverlapDetector] Extracting platforms from: "${topicTitle}"`);

  const normalized = topicTitle.toLowerCase();
  const mentions: string[] = [];

  // Check each known platform against the topic title
  for (const equiv of PLATFORM_EQUIVALENTS) {
    const platformLower = equiv.platform.toLowerCase();

    // Check if platform name appears in the title
    if (normalized.includes(platformLower)) {
      mentions.push(equiv.platform);
      continue;
    }

    // Also check equivalents (in case topic mentions an equivalent)
    for (const alt of equiv.equivalents) {
      if (normalized.includes(alt.toLowerCase())) {
        mentions.push(alt);
      }
    }
  }

  // Deduplicate
  const unique = [...new Set(mentions)];
  console.log(`[StrategicOverlapDetector] Found ${unique.length} platform mentions`);
  return unique;
}

/**
 * Find equivalents for a given platform
 */
export function findEquivalents(platform: string): PlatformEquivalent | null {
  const normalized = normalizePlatform(platform);

  // Direct lookup
  if (platformLookup.has(normalized)) {
    return platformLookup.get(normalized)!;
  }

  // Search in equivalents (find the parent platform)
  for (const equiv of PLATFORM_EQUIVALENTS) {
    if (equiv.equivalents.some((e) => normalizePlatform(e) === normalized)) {
      return equiv;
    }
  }

  return null;
}

/**
 * Detect strategic overlaps across topics and audiences.
 * Returns suggestions for complementary topics.
 */
export function detectStrategicOverlaps(
  topicsByAudience: Map<string, TopicWithAudienceId[]>,
  audiences: AudienceConfig[]
): StrategicOverlap[] {
  console.log('[StrategicOverlapDetector] detectStrategicOverlaps START', {
    audienceCount: audiences.length,
  });

  const overlaps: StrategicOverlap[] = [];
  const audienceIds = new Set(audiences.map((a) => a.id));

  // For each audience's topics, check for platform mentions
  for (const [audienceId, topics] of topicsByAudience) {
    for (const topic of topics) {
      const mentions = extractPlatformMentions(topic.title);

      for (const mention of mentions) {
        const equiv = findEquivalents(mention);
        if (!equiv) continue;

        // For each equivalent platform, suggest a topic for another audience
        for (const altPlatform of equiv.equivalents) {
          // Skip if it's the same platform
          if (normalizePlatform(altPlatform) === normalizePlatform(mention)) {
            continue;
          }

          // Find other audiences that might benefit from this equivalent
          for (const otherAudienceId of audienceIds) {
            if (otherAudienceId === audienceId) continue;

            // Check if this audience already has a topic with this platform
            const otherTopics = topicsByAudience.get(otherAudienceId) || [];
            const alreadyHas = otherTopics.some((t) =>
              t.title.toLowerCase().includes(altPlatform.toLowerCase())
            );

            if (!alreadyHas) {
              // Suggest a complementary topic
              const suggestedTitle = generateEquivalentTopicTitle(
                topic.title,
                mention,
                altPlatform
              );

              overlaps.push({
                originalTopic: topic,
                originalAudienceId: audienceId,
                suggestedTopic: suggestedTitle,
                targetAudienceId: otherAudienceId,
                overlapType: 'platform-equivalent',
                confidence: calculateOverlapConfidence(mention, altPlatform, equiv.category),
              });
            }
          }
        }
      }
    }
  }

  // Sort by confidence (highest first) and deduplicate
  const result = deduplicateOverlaps(overlaps.sort((a, b) => b.confidence - a.confidence));
  console.log('[StrategicOverlapDetector] detectStrategicOverlaps END', {
    overlapsFound: result.length,
  });

  return result;
}

/**
 * Generate an equivalent topic title by replacing the platform name
 */
function generateEquivalentTopicTitle(
  originalTitle: string,
  originalPlatform: string,
  newPlatform: string
): string {
  // Simple replacement with proper casing
  const regex = new RegExp(escapeRegex(originalPlatform), 'gi');
  return originalTitle.replace(regex, formatPlatformName(newPlatform));
}

/**
 * Format a platform name for display (proper casing)
 */
function formatPlatformName(platform: string): string {
  // Special cases
  const specialCases: Record<string, string> = {
    'gpt-4': 'GPT-4',
    'gpt-4o': 'GPT-4o',
    aws: 'AWS',
    gcp: 'GCP',
    azure: 'Azure',
    'azure-openai': 'Azure OpenAI',
    'vertex-ai': 'Vertex AI',
    bedrock: 'Bedrock',
    claude: 'Claude',
    gemini: 'Gemini',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    langchain: 'LangChain',
    llamaindex: 'LlamaIndex',
    langgraph: 'LangGraph',
    autogen: 'AutoGen',
    crewai: 'CrewAI',
    huggingface: 'Hugging Face',
    n8n: 'n8n',
    zapier: 'Zapier',
    make: 'Make',
    'power-automate': 'Power Automate',
    'google-workspace': 'Google Workspace',
    'microsoft-365': 'Microsoft 365',
    python: 'Python',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    go: 'Go',
    rust: 'Rust',
  };

  const lower = platform.toLowerCase();
  if (specialCases[lower]) {
    return specialCases[lower];
  }

  // Default: capitalize first letter of each word
  return platform
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate confidence score for an overlap suggestion
 */
function calculateOverlapConfidence(
  originalPlatform: string,
  newPlatform: string,
  category: string
): number {
  let confidence = 0.5; // Base confidence

  // Higher confidence for same-category AI models (most directly comparable)
  if (category === 'ai-model') {
    confidence += 0.3;
  } else if (category === 'cloud') {
    confidence += 0.25;
  } else if (category === 'framework') {
    confidence += 0.2;
  }

  // Bonus for well-known equivalents
  const wellKnownPairs = [
    ['claude', 'gpt-4'],
    ['claude', 'gemini'],
    ['gemini', 'gpt-4'],
    ['langchain', 'llamaindex'],
    ['aws', 'gcp'],
    ['aws', 'azure'],
    ['n8n', 'zapier'],
  ];

  const isWellKnown = wellKnownPairs.some(
    ([a, b]) =>
      (a === originalPlatform.toLowerCase() && b === newPlatform.toLowerCase()) ||
      (b === originalPlatform.toLowerCase() && a === newPlatform.toLowerCase())
  );

  if (isWellKnown) {
    confidence += 0.15;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Deduplicate overlaps by target audience and suggested topic
 */
function deduplicateOverlaps(overlaps: StrategicOverlap[]): StrategicOverlap[] {
  const seen = new Set<string>();
  const result: StrategicOverlap[] = [];

  for (const overlap of overlaps) {
    const key = `${overlap.targetAudienceId}:${overlap.suggestedTopic.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(overlap);
    }
  }

  return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all known platforms
 */
export function getAllPlatforms(): string[] {
  const platforms = new Set<string>();
  for (const equiv of PLATFORM_EQUIVALENTS) {
    platforms.add(equiv.platform);
    for (const alt of equiv.equivalents) {
      platforms.add(alt);
    }
  }
  return [...platforms].sort();
}

/**
 * Get platforms by category
 */
export function getPlatformsByCategory(
  category: 'ai-model' | 'cloud' | 'productivity' | 'framework' | 'language'
): PlatformEquivalent[] {
  return PLATFORM_EQUIVALENTS.filter((p) => p.category === category);
}

/**
 * Check if two platforms are equivalents
 */
export function arePlatformEquivalents(platform1: string, platform2: string): boolean {
  const norm1 = normalizePlatform(platform1);
  const norm2 = normalizePlatform(platform2);

  if (norm1 === norm2) return true;

  const equiv = findEquivalents(platform1);
  if (!equiv) return false;

  return (
    equiv.equivalents.some((e) => normalizePlatform(e) === norm2) ||
    normalizePlatform(equiv.platform) === norm2
  );
}
