/**
 * Preview Client Service
 * Frontend API client for generating persona preview samples
 */

import { apiRequest } from './apiHelper.ts';

export interface PersonaPreview {
  personaId: string;
  personaName: string;
  sample: string;
}

export interface PersonaPreviewsResponse {
  topic: string;
  tone: string;
  previews: PersonaPreview[];
}

/**
 * Generate preview samples for multiple personas
 * Returns short writing samples for side-by-side comparison
 */
export const getPersonaPreviews = async (
  topic: string,
  personaIds: string[],
  tone: string
): Promise<PersonaPreviewsResponse> => {
  return apiRequest<PersonaPreviewsResponse>('/api/preview/personas', {
    method: 'POST',
    body: JSON.stringify({ topic, personaIds, tone }),
  });
};
