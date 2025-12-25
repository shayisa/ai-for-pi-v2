/**
 * Audience Description Helpers
 *
 * Provides hierarchical audience management with parent categories and
 * child specializations for focused, domain-specific content generation.
 *
 * @module domains/generation/helpers/audienceHelpers
 *
 * ## Architecture (Phase 15.2 - Audience Restructure)
 *
 * PARENT CATEGORIES                    CHILD SPECIALIZATIONS
 * ─────────────────                    ────────────────────
 *     Academic ────────────────────┬── forensic-anthropology
 *                                  └── computational-archaeology
 *
 *     Business ────────────────────┬── business-administration
 *                                  └── business-intelligence
 *
 * ## Benefits
 * - Users can select at parent level ("All Academic") or child level
 * - Content generation uses specific child definitions
 * - Easy to add new specializations without breaking structure
 * - Backward compatible: old IDs map to new specializations
 */

import type {
  AudienceCategory,
  AudienceSpecialization,
  AudienceJsonExample,
  AudienceSourcePreference,
} from '../../../../types';

// =============================================================================
// Hierarchical Audience Categories
// =============================================================================

/**
 * Parent categories for audience grouping
 * Users can select at this level to include all child specializations
 */
export const AUDIENCE_CATEGORIES: AudienceCategory[] = [
  {
    id: 'academic',
    name: 'Academic',
    children: ['forensic-anthropology', 'computational-archaeology'],
  },
  {
    id: 'business',
    name: 'Business',
    children: ['business-administration', 'business-intelligence'],
  },
];

// =============================================================================
// Audience Specializations (The Core Data)
// =============================================================================

/**
 * Detailed specialization definitions with domain-specific content
 * Each specialization has its own prompt context, examples, and source preferences
 */
export const SPECIALIZATIONS: Record<string, AudienceSpecialization> = {
  // ===== ACADEMIC SPECIALIZATIONS =====
  'forensic-anthropology': {
    id: 'forensic-anthropology',
    parentId: 'academic',
    name: 'Forensic Anthropology',
    description:
      'Forensic anthropology professors and researchers specializing in skeletal analysis, ' +
      'trauma interpretation, taphonomy, and mass disaster victim identification using AI for ' +
      'morphometric analysis, age estimation, sex determination, ancestry classification, ' +
      'and biological profile construction from skeletal remains.',
    domainExamples:
      '- Forensic anthropology applications: skeletal analysis AI for bone measurements, ' +
      'trauma pattern recognition from fractures, morphometric analysis automation, ' +
      'mass fatality incident response tools, age/sex/ancestry estimation algorithms, ' +
      'commingled remains sorting, postmortem interval estimation, taphonomic analysis',
    jsonExamples: [
      {
        title: 'How to Build a Skeletal Analysis Pipeline Using Claude Vision API and Python',
        summary:
          'Use Claude API with base64-encoded bone images for morphometric measurements and ' +
          'trauma documentation. Implementation: Create Python wrapper, prompt for specific ' +
          'measurements, integrate with case management systems.',
      },
      {
        title: 'Automate Age Estimation from Skeletal Features with TensorFlow and Medical Imaging',
        summary:
          'Train a model on pubic symphysis and auricular surface images for age-at-death ' +
          'estimation. Implementation: Collect annotated datasets, fine-tune ResNet, deploy ' +
          'for forensic case assessment.',
      },
    ],
    topicTitles: [
      'Build a Skeletal Analysis Pipeline Using Claude Vision API and Python',
      'Configure Automated Trauma Pattern Recognition System with TensorFlow and Medical Imaging',
      'Automate Age Estimation from Skeletal Features Using Deep Learning',
      'Create a Commingled Remains Sorting Tool with Claude and Morphometric Analysis',
    ],
    sourcePreferences: ['arxiv', 'github', 'dev'],
  },

  'computational-archaeology': {
    id: 'computational-archaeology',
    parentId: 'academic',
    name: 'Computational Archaeology',
    description:
      'Digital and computational archaeology researchers applying LiDAR processing, ' +
      'photogrammetry, 3D site reconstruction, geospatial analysis, and remote sensing ' +
      'to archaeological site discovery, artifact documentation, cultural heritage ' +
      'preservation, and landscape archaeology.',
    domainExamples:
      '- Digital/computational archaeology applications: LiDAR site discovery and ' +
      'feature extraction, photogrammetry pipelines for artifact digitization, ' +
      'artifact classification with computer vision, 3D reconstruction of excavation sites, ' +
      'geospatial analysis with GIS tools, cultural heritage preservation databases, ' +
      'remote sensing for landscape archaeology, ceramic typology automation',
    jsonExamples: [
      {
        title: 'Deploy LiDAR Point Cloud Processing Pipeline Using CloudCompare and Python',
        summary:
          'Build an automated pipeline for archaeological feature detection from LiDAR data. ' +
          'Implementation: Use CloudCompare Python bindings, apply terrain analysis, identify ' +
          'potential sites with ML classification.',
      },
      {
        title: 'Create a Photogrammetry Workflow for Artifact Documentation with Meshroom',
        summary:
          'Automate 3D artifact digitization from photo sets. Implementation: Configure ' +
          'Meshroom pipeline, optimize for small object capture, export to Sketchfab for sharing.',
      },
    ],
    topicTitles: [
      'Deploy LiDAR Point Cloud Processing Pipeline Using CloudCompare and Python for Site Discovery',
      'Create a Photogrammetry Workflow for Artifact Documentation with Meshroom and AliceVision',
      'Build an Artifact Classification System Using Claude Vision and Transfer Learning',
      'Automate GIS Analysis for Archaeological Surveys with QGIS and Python',
    ],
    sourcePreferences: ['arxiv', 'github', 'dev'],
  },

  // ===== BUSINESS SPECIALIZATIONS =====
  'business-administration': {
    id: 'business-administration',
    parentId: 'business',
    name: 'Business Administration',
    description:
      'Business administrators, office managers, and operations professionals seeking ' +
      'AI-powered workflow automation, document processing, meeting transcription, ' +
      'task orchestration, business process automation (BPA), robotic process automation (RPA), ' +
      'and productivity enhancement tools to streamline operations and reduce manual overhead.',
    domainExamples:
      '- Business automation applications: workflow orchestration with n8n and Zapier, ' +
      'document processing automation for invoices and contracts, meeting intelligence and ' +
      'transcription, RPA implementation with UiPath and Power Automate, API integration ' +
      'patterns, no-code/low-code development, email triage and auto-response, ' +
      'calendar management automation, expense report processing',
    jsonExamples: [
      {
        title: 'How to Automate Business Workflows Using n8n Cloud and Claude Integration',
        summary:
          'Build no-code AI workflows for document processing, email triage, and meeting ' +
          'follow-ups. Implementation: Connect n8n to Gmail/Slack, configure Claude prompts, ' +
          'route actions to project management tools.',
      },
      {
        title: 'Automate Meeting Notes with Whisper API and Claude Summarization',
        summary:
          'Create an end-to-end meeting intelligence pipeline. Implementation: Record via ' +
          'Zoom API, transcribe with Whisper, summarize and extract action items with Claude, ' +
          'push to Notion.',
      },
    ],
    topicTitles: [
      'Automate Business Workflows Using n8n Cloud and Claude Integration',
      'Configure Document Intelligence Workflow Using Claude 3.5 and LangChain',
      'Automate Meeting Notes with Whisper API and Claude Summarization',
      'Build an Invoice Processing System with Claude Vision and Zapier',
    ],
    sourcePreferences: ['hackernews', 'reddit', 'dev'],
  },

  'business-intelligence': {
    id: 'business-intelligence',
    parentId: 'business',
    name: 'Business Intelligence & Analytics',
    description:
      'Business analytics, logistics, and data professionals using data mining, ' +
      'predictive analytics, supply chain optimization, demand forecasting, ' +
      'inventory management, route optimization, warehouse automation, and ' +
      'ML-driven insights to extract actionable intelligence from structured and ' +
      'unstructured data. Includes dashboard development, KPI tracking, and data visualization.',
    domainExamples:
      '- Business analytics/logistics applications: supply chain optimization models, ' +
      'demand forecasting with time series, inventory management automation, ' +
      'route optimization algorithms, warehouse automation integration, ' +
      'predictive analytics dashboards, data mining and ETL pipelines, ' +
      'KPI tracking and alerting, executive reporting automation, ' +
      'customer segmentation analysis, churn prediction models',
    jsonExamples: [
      {
        title: 'How to Automate Supply Chain Forecasting with Prophet and Streamlit',
        summary:
          'Build an end-to-end demand forecasting dashboard with real-time predictions. ' +
          'Implementation: Pull historical data, train Prophet model, deploy Streamlit ' +
          'dashboard for visualization.',
      },
      {
        title: 'Build a Real-Time Analytics Dashboard with Streamlit and Plotly',
        summary:
          'Create an interactive executive dashboard for KPI monitoring. Implementation: ' +
          'Connect to data warehouse, build Plotly visualizations, add Streamlit filters ' +
          'and drill-down capabilities.',
      },
    ],
    topicTitles: [
      'Automate Supply Chain Forecasting with Prophet, Pandas, and Streamlit',
      'Optimize Inventory Predictions Using XGBoost and Historical Sales Data',
      'Build a Real-Time Analytics Dashboard with Streamlit and Plotly',
      'Create a Customer Churn Prediction Model with Scikit-learn and Claude Analysis',
    ],
    sourcePreferences: ['hackernews', 'reddit', 'github', 'dev'],
  },
};

// =============================================================================
// Legacy ID Mapping (Backward Compatibility)
// =============================================================================

/**
 * Maps old combined audience IDs to new specialization IDs
 */
const LEGACY_MAPPING: Record<string, string[]> = {
  academics: ['forensic-anthropology', 'computational-archaeology'],
  business: ['business-administration', 'business-intelligence'],
  analysts: ['business-intelligence'], // Merged into business-intelligence
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a single specialization by ID
 */
export function getSpecialization(id: string): AudienceSpecialization | undefined {
  return SPECIALIZATIONS[id];
}

/**
 * Get all specializations for a parent category
 */
export function getSpecializationsForCategory(categoryId: string): AudienceSpecialization[] {
  const category = AUDIENCE_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return [];
  return category.children.map((childId) => SPECIALIZATIONS[childId]).filter(Boolean);
}

/**
 * Get all available specializations
 */
export function getAllSpecializations(): AudienceSpecialization[] {
  return Object.values(SPECIALIZATIONS);
}

/**
 * Get all audience categories
 */
export function getAudienceCategories(): AudienceCategory[] {
  return AUDIENCE_CATEGORIES;
}

/**
 * Resolve legacy audience IDs to new specialization IDs
 * Also handles parent category IDs (expands to all children)
 */
export function resolveLegacyAudienceId(id: string): string[] {
  // Check legacy mapping first
  if (LEGACY_MAPPING[id]) {
    return LEGACY_MAPPING[id];
  }

  // Check if it's a parent category
  const category = AUDIENCE_CATEGORIES.find((c) => c.id === id);
  if (category) {
    return category.children;
  }

  // If it's already a specialization ID, return as-is
  if (SPECIALIZATIONS[id]) {
    return [id];
  }

  // Unknown ID - return empty
  console.warn(`[audienceHelpers] Unknown audience ID: ${id}`);
  return [];
}

/**
 * Resolve an array of audience IDs (legacy, parent, or specialization)
 * Returns unique specialization IDs
 */
export function resolveAudienceIds(ids: string[]): string[] {
  const resolved = new Set<string>();
  for (const id of ids) {
    const specializations = resolveLegacyAudienceId(id);
    specializations.forEach((s) => resolved.add(s));
  }
  return Array.from(resolved);
}

/**
 * Get specializations from audience IDs (resolves legacy/parent IDs)
 */
export function getSpecializationsFromIds(ids: string[]): AudienceSpecialization[] {
  const resolvedIds = resolveAudienceIds(ids);
  return resolvedIds.map((id) => SPECIALIZATIONS[id]).filter(Boolean);
}

// =============================================================================
// Content Generation Helpers (Backward Compatible API)
// =============================================================================

/**
 * Get audience description for newsletter generation
 *
 * Generates personalized audience description based on selected audiences.
 * Supports both legacy IDs and new specialization IDs.
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Formatted audience description string for use in prompts
 */
export const getAudienceDescription = (audience: string[]): string => {
  // Resolve to specializations
  const specializations = getSpecializationsFromIds(audience);

  // If no valid specializations, return all
  if (specializations.length === 0) {
    return getAllSpecializations()
      .map((s) => `- ${s.description}`)
      .join('\n');
  }

  return specializations.map((s) => `- ${s.description}`).join('\n');
};

/**
 * Get domain examples for newsletter generation prompts
 *
 * Returns domain-specific use case examples based on selected audiences.
 * Supports both legacy IDs and new specialization IDs.
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Formatted domain examples string for use in prompts
 */
export const getDomainExamples = (audience: string[]): string => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    return getAllSpecializations()
      .map((s) => s.domainExamples)
      .join('\n');
  }

  return specializations.map((s) => s.domainExamples).join('\n');
};

/**
 * Get JSON examples for topic generation prompts
 *
 * Returns audience-appropriate examples to avoid bias in generated topics.
 * Supports both legacy IDs and new specialization IDs.
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Array of AudienceJsonExample objects for use in JSON format prompts
 */
export const getJsonExamples = (audience: string[]): AudienceJsonExample[] => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    // Return one from each specialization for balanced representation
    return getAllSpecializations().map((s) => s.jsonExamples[0]);
  }

  // Return first example from each selected specialization
  return specializations.map((s) => s.jsonExamples[0]);
};

/**
 * Get topic title examples for topic suggestions generator
 *
 * Returns audience-appropriate topic titles to avoid bias.
 * Supports both legacy IDs and new specialization IDs.
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Array of topic title strings for use in JSON array examples
 */
export const getTopicTitles = (audience: string[]): string[] => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    // Return balanced mix from all specializations (2-3 per spec)
    return getAllSpecializations().flatMap((s) => s.topicTitles.slice(0, 3));
  }

  // Return titles from selected specializations
  const titles = specializations.flatMap((s) => s.topicTitles);

  // Ensure we have at least 10 titles
  const genericPadding = [
    'Create a Custom AI Assistant Using Claude API and React',
    'Build an Automated Data Pipeline with Python and Airflow',
    'Implement a RAG System with LangChain and Vector Databases',
  ];

  while (titles.length < 10 && genericPadding.length > 0) {
    titles.push(genericPadding.shift()!);
  }

  return titles.slice(0, 10);
};

/**
 * Get source preferences for a set of audience IDs
 * Returns the union of all source preferences from resolved specializations
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Array of unique source preferences
 */
export const getSourcePreferences = (audience: string[]): AudienceSourcePreference[] => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    // Return all possible sources
    return ['arxiv', 'hackernews', 'github', 'reddit', 'dev', 'gdelt'];
  }

  // Collect unique preferences
  const preferences = new Set<AudienceSourcePreference>();
  specializations.forEach((s) => {
    s.sourcePreferences.forEach((p) => preferences.add(p));
  });

  return Array.from(preferences);
};

// =============================================================================
// Balanced Selection Helpers (Phase 15.3 - Parallel Per-Audience Generation)
// =============================================================================

/**
 * Fisher-Yates shuffle algorithm for randomizing array order
 * Eliminates position bias when selecting examples
 *
 * @param array - Array to shuffle
 * @returns New shuffled array (does not mutate original)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get balanced topic titles with equal representation per audience
 *
 * Unlike getTopicTitles() which uses flatMap() and slice(0,10) causing first-in-order bias,
 * this function ensures each selected audience gets equal representation by:
 * 1. Taking N titles per audience (not all titles)
 * 2. Shuffling the audience order
 * 3. Shuffling the final result
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @param titlesPerAudience - Number of titles to take from each audience (default: 3)
 * @returns Balanced, shuffled array of topic titles
 */
export const getBalancedTopicTitles = (
  audience: string[],
  titlesPerAudience: number = 3
): string[] => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    // Return balanced mix from all specializations
    const all = getAllSpecializations();
    const shuffled = shuffleArray(all);
    const titles: string[] = [];
    for (const spec of shuffled) {
      titles.push(...spec.topicTitles.slice(0, titlesPerAudience));
    }
    return shuffleArray(titles);
  }

  // Shuffle specializations order to avoid position bias
  const shuffledSpecs = shuffleArray([...specializations]);

  // Take equal number from each
  const titles: string[] = [];
  for (const spec of shuffledSpecs) {
    titles.push(...spec.topicTitles.slice(0, titlesPerAudience));
  }

  // Shuffle final result and limit to 12 (reasonable max for prompt examples)
  return shuffleArray(titles).slice(0, 12);
};

/**
 * Get balanced JSON examples with shuffled order
 *
 * Unlike getJsonExamples() which returns examples in fixed object-key order,
 * this function shuffles the order to eliminate position bias.
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Shuffled array of AudienceJsonExample objects
 */
export const getBalancedJsonExamples = (audience: string[]): AudienceJsonExample[] => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    const all = getAllSpecializations();
    return shuffleArray(all.map((s) => s.jsonExamples[0]));
  }

  // Shuffle order to avoid position bias
  const shuffledSpecs = shuffleArray([...specializations]);
  return shuffledSpecs.map((s) => s.jsonExamples[0]);
};

/**
 * Get balanced domain examples with shuffled order
 *
 * Returns domain-specific use case examples in randomized order
 * to eliminate position bias in Claude's output.
 *
 * @param audience - Array of audience keys (legacy, parent, or specialization IDs)
 * @returns Formatted domain examples string with shuffled order
 */
export const getBalancedDomainExamples = (audience: string[]): string => {
  const specializations = getSpecializationsFromIds(audience);

  if (specializations.length === 0) {
    return shuffleArray(getAllSpecializations())
      .map((s) => s.domainExamples)
      .join('\n');
  }

  return shuffleArray([...specializations])
    .map((s) => s.domainExamples)
    .join('\n');
};

/**
 * Resolve all audiences including custom audiences from database
 *
 * This function handles both built-in specializations and custom audiences.
 * Custom audiences are identified by having properties like customId or not
 * existing in SPECIALIZATIONS.
 *
 * @param audienceIds - Array of audience IDs (built-in or custom)
 * @param customAudiences - Optional array of custom audience objects from database
 * @returns Array of resolved audience objects with consistent shape
 */
export interface ResolvedAudience {
  id: string;
  name: string;
  description: string;
  domainExamples: string;
  jsonExamples: AudienceJsonExample[];
  topicTitles: string[];
  sourcePreferences: AudienceSourcePreference[];
  parentId?: string;
  isCustom: boolean;
}

export function resolveAllAudiences(
  audienceIds: string[],
  customAudiences?: Array<{
    id: string;
    name: string;
    description: string;
    domain_examples?: string;
    json_examples?: AudienceJsonExample[];
    topic_titles?: string[];
    source_preferences?: AudienceSourcePreference[];
  }>
): ResolvedAudience[] {
  const resolved: ResolvedAudience[] = [];
  const customMap = new Map(customAudiences?.map((c) => [c.id, c]) || []);

  for (const id of audienceIds) {
    // Check if it's a built-in specialization
    const spec = SPECIALIZATIONS[id];
    if (spec) {
      resolved.push({
        ...spec,
        isCustom: false,
      });
      continue;
    }

    // Check if it's a custom audience
    const custom = customMap.get(id);
    if (custom) {
      resolved.push({
        id: custom.id,
        name: custom.name,
        description: custom.description,
        domainExamples: custom.domain_examples || custom.description,
        jsonExamples: custom.json_examples || [
          {
            title: `How to Apply AI to ${custom.name}`,
            summary: `Implementation guide for ${custom.description.slice(0, 100)}...`,
          },
        ],
        topicTitles: custom.topic_titles || [
          `Build an AI Solution for ${custom.name}`,
          `Automate ${custom.name} Workflows with Claude`,
          `Create a ${custom.name} Dashboard with Streamlit`,
        ],
        sourcePreferences: custom.source_preferences || ['hackernews', 'github', 'dev'],
        isCustom: true,
      });
      continue;
    }

    // Check if it's a legacy or parent ID
    const legacyResolved = resolveLegacyAudienceId(id);
    for (const legacyId of legacyResolved) {
      const legacySpec = SPECIALIZATIONS[legacyId];
      if (legacySpec && !resolved.some((r) => r.id === legacySpec.id)) {
        resolved.push({
          ...legacySpec,
          isCustom: false,
        });
      }
    }
  }

  return resolved;
}

/**
 * Group audiences by parent category for per-category agent batching
 *
 * @param audiences - Array of resolved audiences
 * @returns Map of parent category ID to audiences in that category
 */
export function groupAudiencesByCategory(
  audiences: ResolvedAudience[]
): Map<string, ResolvedAudience[]> {
  const groups = new Map<string, ResolvedAudience[]>();

  for (const audience of audiences) {
    const categoryId = audience.parentId || (audience.isCustom ? 'custom' : 'other');

    if (!groups.has(categoryId)) {
      groups.set(categoryId, []);
    }
    groups.get(categoryId)!.push(audience);
  }

  return groups;
}
