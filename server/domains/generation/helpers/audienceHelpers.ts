/**
 * Audience Description Helpers
 *
 * Provides domain-specific audience descriptions for newsletter personalization.
 *
 * @module domains/generation/helpers/audienceHelpers
 *
 * ## Original Location
 * - server.ts lines 79-99
 *
 * ## PRESERVATION NOTE - PERSONALITY CRITICAL
 * These exact strings define the newsletter's voice and audience targeting.
 * Do NOT modify the audience descriptions without explicit approval.
 */

/**
 * Audience description mappings
 *
 * Each audience has carefully crafted descriptions with domain-specific
 * terminology that influences Claude's content generation.
 *
 * Audiences:
 * - academics: Forensic anthropology + computational archaeology
 * - business: Business administrators + workflow automation
 * - analysts: Business analytics + logistics professionals
 *
 * @constant audienceMap
 */
const audienceMap: Record<string, string> = {
  academics:
    "- Forensic anthropology professors specializing in skeletal analysis, trauma interpretation, taphonomy, and mass disaster victim identification using AI for morphometric analysis, age estimation, and ancestry classification. Digital/computational archaeology researchers applying LiDAR processing, photogrammetry, 3D site reconstruction, geospatial analysis, and remote sensing to archaeological site discovery and artifact documentation.",
  business:
    "- Business administrators and office managers seeking AI-powered workflow automation, document processing, meeting transcription, task orchestration, business process automation (BPA), robotic process automation (RPA), and productivity enhancement tools to streamline operations and reduce manual overhead.",
  analysts:
    "- Business analytics and logistics professionals using data mining, predictive analytics, supply chain optimization, demand forecasting, inventory management, route optimization, warehouse automation, and ML-driven insights to extract actionable intelligence from structured and unstructured data lakes.",
};

/**
 * Get audience description for newsletter generation
 *
 * Generates personalized audience description based on selected audiences.
 * When all audiences are selected (or none), returns the full combined description.
 *
 * @param audience - Array of audience keys ('academics', 'business', 'analysts')
 * @returns Formatted audience description string for use in prompts
 *
 * @example
 * // Single audience
 * const desc = getAudienceDescription(['academics']);
 * // Returns forensic anthropology + archaeology description
 *
 * @example
 * // All audiences (or empty array)
 * const desc = getAudienceDescription([]);
 * // Returns combined description for all 3 audiences
 */
export const getAudienceDescription = (audience: string[]): string => {
  if (audience.length === 0 || audience.length === 3) {
    return `
- Forensic anthropology professors specializing in skeletal analysis, trauma interpretation, taphonomy, and mass disaster victim identification using AI for morphometric analysis, age estimation, and ancestry classification. Digital/computational archaeology researchers applying LiDAR processing, photogrammetry, 3D site reconstruction, geospatial analysis, and remote sensing to archaeological site discovery and artifact documentation.
- Business administrators and office managers seeking AI-powered workflow automation, document processing, meeting transcription, task orchestration, business process automation (BPA), robotic process automation (RPA), and productivity enhancement tools to streamline operations and reduce manual overhead.
- Business analytics and logistics professionals using data mining, predictive analytics, supply chain optimization, demand forecasting, inventory management, route optimization, warehouse automation, and ML-driven insights to extract actionable intelligence from structured and unstructured data lakes.
        `;
  }

  return audience.map((key) => audienceMap[key]).join("\n");
};
