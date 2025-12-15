/**
 * Audience Generation Service
 *
 * Uses Claude Haiku to generate audience configurations from a name and description.
 * Produces structured config with persona, keywords, subreddits, and search templates.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AudienceConfig } from '../../types';

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
 * Get the default hardcoded audiences with their generated configs
 */
export function getDefaultAudiences(): AudienceConfig[] {
  return [
    {
      id: 'academics',
      name: 'Academics',
      description: 'Forensic anthropology & computational archeology professors.',
      isCustom: false,
      generated: {
        persona:
          'University researchers and professors specializing in forensic anthropology and computational archaeology. They analyze skeletal remains, use imaging technology for 3D reconstruction, and apply AI tools for pattern recognition in archaeological data.',
        relevance_keywords: [
          'skeletal analysis',
          '3D reconstruction',
          'forensic imaging',
          'bone morphometry',
          'archaeological AI',
          'remote sensing',
          'photogrammetry',
          'GIS analysis',
        ],
        subreddits: ['forensics', 'archaeology', 'AcademicBiology', 'Anthropology'],
        arxiv_categories: ['cs.CV', 'q-bio.QM', 'cs.AI'],
        search_templates: [
          'AI {topic} forensic anthropology',
          '{topic} skeletal analysis machine learning',
          'computational archaeology {topic}',
          '{topic} 3D reconstruction bone',
        ],
      },
    },
    {
      id: 'business',
      name: 'Business Leaders',
      description: 'Admins & leaders upskilling in AI.',
      isCustom: false,
      generated: {
        persona:
          'Business administrators, office managers, and team leaders seeking to leverage AI for workflow automation and productivity. They focus on practical tools that can immediately improve daily operations without requiring deep technical expertise.',
        relevance_keywords: [
          'workflow automation',
          'productivity tools',
          'document processing',
          'scheduling AI',
          'task automation',
          'business intelligence',
          'process optimization',
          'no-code AI',
        ],
        subreddits: ['automation', 'productivity', 'Entrepreneur', 'smallbusiness'],
        arxiv_categories: ['cs.AI', 'cs.HC'],
        search_templates: [
          'AI {topic} workflow automation',
          '{topic} business productivity tools',
          'automate {topic} for business',
          '{topic} no-code AI solution',
        ],
      },
    },
    {
      id: 'analysts',
      name: 'Data Analysts',
      description: 'Analysts extracting business intelligence.',
      isCustom: false,
      generated: {
        persona:
          'Business and data analysts who use analytics tools for extracting insights, forecasting, and decision support. They work with supply chain data, financial metrics, and operational KPIs to drive business outcomes.',
        relevance_keywords: [
          'predictive analytics',
          'data visualization',
          'supply chain optimization',
          'demand forecasting',
          'business intelligence',
          'dashboard automation',
          'anomaly detection',
          'time series analysis',
        ],
        subreddits: ['datascience', 'BusinessIntelligence', 'analytics', 'supplychain'],
        arxiv_categories: ['cs.LG', 'stat.ML', 'cs.AI'],
        search_templates: [
          'AI {topic} data analytics',
          '{topic} predictive modeling business',
          'supply chain {topic} AI',
          '{topic} forecasting machine learning',
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

export default {
  generateAudienceConfig,
  getDefaultAudiences,
  getAudiencePromptDescription,
};
