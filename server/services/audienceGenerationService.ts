/**
 * Audience Generation Service
 *
 * Provides audience configuration management including:
 * - Hierarchical audience categories and specializations (Phase 15.2)
 * - Custom audience generation via Claude Haiku
 * - Backward-compatible audience APIs
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AudienceConfig, AudienceCategory } from '../../types';
import {
  AUDIENCE_CATEGORIES,
  SPECIALIZATIONS,
  getAllSpecializations,
  getAudienceCategories as getCategories,
  resolveLegacyAudienceId,
} from '../domains/generation/helpers/audienceHelpers';

interface GeneratedAudienceConfig {
  persona: string;
  relevance_keywords: string[];
  subreddits: string[];
  arxiv_categories: string[];
  search_templates: string[];
}

interface GenerationResult {
  config: AudienceConfig;
  success: boolean;
  error?: string;
  timeMs: number;
  tokensUsed?: number;
}

/**
 * Generate audience configuration using Claude Haiku
 */
export async function generateAudienceConfig(
  apiKey: string,
  name: string,
  description: string
): Promise<GenerationResult> {
  const startTime = Date.now();

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are an AI assistant that generates newsletter audience configuration.
Return ONLY valid JSON with no explanation or markdown formatting.`,
      messages: [
        {
          role: 'user',
          content: `Generate a newsletter audience configuration for:
Name: ${name}
Description: ${description}

Return JSON with exactly this structure:
{
  "persona": "3-4 sentence expanded description of this audience, their daily work, challenges, and what AI tools would help them",
  "relevance_keywords": ["5-8 specific keywords for content filtering, including technical terms and tool names relevant to this audience"],
  "subreddits": ["3-5 relevant subreddit names without the r/ prefix"],
  "arxiv_categories": ["2-4 relevant arxiv category codes like cs.AI, cs.CV, q-bio.QM"],
  "search_templates": ["3-5 search query templates with {topic} placeholder for dynamic searches"]
}

Be specific to the audience. Include domain-specific terminology.`,
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );

    if (!textBlock) {
      return {
        config: { id: '', name, description },
        success: false,
        error: 'No text response from API',
        timeMs: Date.now() - startTime,
      };
    }

    // Parse JSON response
    let jsonText = textBlock.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const generated: GeneratedAudienceConfig = JSON.parse(jsonText);

    // Create unique ID from name
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const config: AudienceConfig = {
      id,
      name,
      description,
      isCustom: true,
      generated,
    };

    const tokensUsed =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      config,
      success: true,
      timeMs: Date.now() - startTime,
      tokensUsed,
    };
  } catch (error) {
    return {
      config: { id: '', name, description },
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * Get the default audiences as AudienceConfig objects
 *
 * Returns the 4 specializations (forensic-anthropology, computational-archaeology,
 * business-administration, business-intelligence) converted to AudienceConfig format
 * for UI compatibility.
 */
export function getDefaultAudiences(): AudienceConfig[] {
  return getAllSpecializations().map((spec) => ({
    id: spec.id,
    name: spec.name,
    description: spec.description,
    isCustom: false,
    generated: {
      persona: spec.description,
      relevance_keywords: extractKeywords(spec.domainExamples),
      subreddits: getSubredditsForSpecialization(spec.id),
      arxiv_categories: getArxivCategoriesForSpecialization(spec.id),
      search_templates: getSearchTemplatesForSpecialization(spec.id),
    },
  }));
}

/**
 * Get audience categories for hierarchical UI display
 */
export function getAudienceCategories(): AudienceCategory[] {
  return getCategories();
}

/**
 * Get audiences organized by category for grouped UI display
 */
export function getAudiencesByCategory(): {
  category: AudienceCategory;
  audiences: AudienceConfig[];
}[] {
  return AUDIENCE_CATEGORIES.map((category) => ({
    category,
    audiences: category.children.map((childId) => {
      const spec = SPECIALIZATIONS[childId];
      return {
        id: spec.id,
        name: spec.name,
        description: spec.description,
        isCustom: false,
        generated: {
          persona: spec.description,
          relevance_keywords: extractKeywords(spec.domainExamples),
          subreddits: getSubredditsForSpecialization(spec.id),
          arxiv_categories: getArxivCategoriesForSpecialization(spec.id),
          search_templates: getSearchTemplatesForSpecialization(spec.id),
        },
      };
    }),
  }));
}

/**
 * Get legacy audiences for backward compatibility
 * Maps old audience IDs to new specializations
 */
export function getLegacyAudiences(): AudienceConfig[] {
  // Return legacy-style audiences that map to new specializations
  return [
    {
      id: 'academics',
      name: 'Academics',
      description: 'Forensic anthropology & computational archaeology researchers.',
      isCustom: false,
      generated: {
        persona:
          'University researchers specializing in forensic anthropology and computational archaeology.',
        relevance_keywords: [
          'skeletal analysis',
          '3D reconstruction',
          'forensic imaging',
          'bone morphometry',
          'archaeological AI',
          'LiDAR',
          'photogrammetry',
          'GIS analysis',
        ],
        subreddits: ['forensics', 'archaeology', 'AcademicBiology', 'Anthropology'],
        arxiv_categories: ['cs.CV', 'q-bio.QM', 'cs.AI'],
        search_templates: [
          'AI {topic} forensic anthropology',
          '{topic} skeletal analysis machine learning',
          'computational archaeology {topic}',
        ],
      },
    },
    {
      id: 'business',
      name: 'Business',
      description: 'Business administrators and intelligence professionals.',
      isCustom: false,
      generated: {
        persona:
          'Business administrators, office managers, and analytics professionals seeking AI-powered tools.',
        relevance_keywords: [
          'workflow automation',
          'productivity tools',
          'business intelligence',
          'predictive analytics',
          'dashboard automation',
          'process optimization',
        ],
        subreddits: ['automation', 'productivity', 'BusinessIntelligence', 'analytics'],
        arxiv_categories: ['cs.AI', 'cs.HC', 'cs.LG'],
        search_templates: [
          'AI {topic} workflow automation',
          '{topic} business productivity tools',
          'automate {topic} for business',
        ],
      },
    },
  ];
}

/**
 * Get audience description for Claude newsletter generation prompt
 */
export function getAudiencePromptDescription(audiences: AudienceConfig[]): string {
  return audiences
    .map((audience) => {
      const persona = audience.generated?.persona || audience.description;
      return `- ${audience.name}: ${persona}`;
    })
    .join('\n');
}

// =============================================================================
// Helper Functions for Generated Config
// =============================================================================

function extractKeywords(domainExamples: string): string[] {
  // Extract key terms from domain examples
  const terms = domainExamples
    .replace(/[-•]/g, '')
    .split(/[,:]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3 && t.length < 40);
  return terms.slice(0, 8);
}

function getSubredditsForSpecialization(specId: string): string[] {
  const subredditMap: Record<string, string[]> = {
    'forensic-anthropology': ['forensics', 'Anthropology', 'AcademicBiology', 'ForensicScience'],
    'computational-archaeology': ['archaeology', 'gis', 'AcademicHistory', 'DigitalHumanities'],
    'business-administration': ['automation', 'productivity', 'Entrepreneur', 'smallbusiness'],
    'business-intelligence': [
      'datascience',
      'BusinessIntelligence',
      'analytics',
      'supplychain',
    ],
  };
  return subredditMap[specId] || ['technology', 'artificial'];
}

function getArxivCategoriesForSpecialization(specId: string): string[] {
  const arxivMap: Record<string, string[]> = {
    'forensic-anthropology': ['cs.CV', 'q-bio.QM', 'cs.AI'],
    'computational-archaeology': ['cs.CV', 'cs.GR', 'cs.AI', 'eess.IV'],
    'business-administration': ['cs.AI', 'cs.HC', 'cs.SE'],
    'business-intelligence': ['cs.LG', 'stat.ML', 'cs.AI', 'cs.DB'],
  };
  return arxivMap[specId] || ['cs.AI'];
}

function getSearchTemplatesForSpecialization(specId: string): string[] {
  const templateMap: Record<string, string[]> = {
    'forensic-anthropology': [
      'AI {topic} forensic anthropology',
      '{topic} skeletal analysis machine learning',
      '{topic} morphometric analysis automation',
    ],
    'computational-archaeology': [
      'AI {topic} computational archaeology',
      '{topic} LiDAR site discovery',
      '{topic} photogrammetry 3D reconstruction',
    ],
    'business-administration': [
      'AI {topic} workflow automation',
      '{topic} business process automation',
      'automate {topic} n8n zapier',
    ],
    'business-intelligence': [
      'AI {topic} business analytics',
      '{topic} predictive modeling',
      '{topic} dashboard automation visualization',
    ],
  };
  return templateMap[specId] || ['AI {topic}'];
}

export default {
  generateAudienceConfig,
  getDefaultAudiences,
  getAudienceCategories,
  getAudiencesByCategory,
  getLegacyAudiences,
  getAudiencePromptDescription,
};
