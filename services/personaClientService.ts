/**
 * Persona Client Service
 * Frontend API client for managing writer personas via SQLite backend
 */

import type { WriterPersona, PersonaStats } from '../types.ts';
import { apiRequest } from './apiHelper.ts';

// ======================
// PERSONA API
// ======================

/**
 * Get all personas (defaults + custom)
 */
export const getAllPersonas = async (): Promise<WriterPersona[]> => {
  // API returns array directly in data field
  return apiRequest<WriterPersona[]>('/api/personas');
};

/**
 * Get the currently active persona (or null if none)
 */
export const getActivePersona = async (): Promise<WriterPersona | null> => {
  // API returns persona directly in data field (or null)
  return apiRequest<WriterPersona | null>('/api/personas/active');
};

/**
 * Get a persona by ID
 */
export const getPersonaById = async (id: string): Promise<WriterPersona> => {
  return apiRequest<WriterPersona>(`/api/personas/${encodeURIComponent(id)}`);
};

/**
 * Create a new custom persona
 */
export const createPersona = async (persona: {
  name: string;
  tagline?: string;
  expertise?: string;
  values?: string;
  writingStyle?: string;
  signatureElements?: string[];
  sampleWriting?: string;
}): Promise<WriterPersona> => {
  return apiRequest<WriterPersona>('/api/personas', {
    method: 'POST',
    body: JSON.stringify(persona)
  });
};

/**
 * Update an existing persona (custom only - defaults cannot be edited)
 */
export const updatePersona = async (
  id: string,
  updates: Partial<{
    name: string;
    tagline: string;
    expertise: string;
    values: string;
    writingStyle: string;
    signatureElements: string[];
    sampleWriting: string;
  }>
): Promise<WriterPersona> => {
  return apiRequest<WriterPersona>(`/api/personas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

/**
 * Delete a custom persona (defaults cannot be deleted)
 */
export const deletePersona = async (id: string): Promise<{ success: boolean }> => {
  return apiRequest<{ success: boolean }>(`/api/personas/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
};

/**
 * Set the active persona (or pass "none" to deactivate all)
 */
export const setActivePersona = async (id: string | null): Promise<{ success: boolean; activePersonaId: string | null }> => {
  const personaId = id || 'none';
  return apiRequest<{ success: boolean; activePersonaId: string | null }>(
    `/api/personas/${encodeURIComponent(personaId)}/activate`,
    { method: 'POST' }
  );
};

/**
 * Get persona statistics
 */
export const getPersonaStats = async (): Promise<PersonaStats> => {
  return apiRequest<PersonaStats>('/api/personas/stats');
};

/**
 * Toggle persona favorite status
 */
export const togglePersonaFavorite = async (id: string): Promise<WriterPersona> => {
  return apiRequest<WriterPersona>(`/api/personas/${encodeURIComponent(id)}/favorite`, {
    method: 'POST'
  });
};

// ======================
// PERSONA PREVIEW (Phase 12.0)
// ======================

/**
 * Generate a short preview paragraph in a persona's voice
 * Used for A/B persona comparison feature
 */
export const generatePersonaPreview = async (
  personaId: string,
  sampleTopic: string
): Promise<{ preview: string; personaName: string }> => {
  return apiRequest<{ preview: string; personaName: string }>('/api/generatePersonaPreview', {
    method: 'POST',
    body: JSON.stringify({ personaId, sampleTopic }),
  });
};
