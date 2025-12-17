/**
 * Preview Client Service
 * Frontend API client for generating persona preview samples
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const response = await fetch(`${API_BASE}/api/preview/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, personaIds, tone }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate persona previews');
  }

  return response.json();
};
