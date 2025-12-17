/**
 * Persona Client Service
 * Frontend API client for managing writer personas via SQLite backend
 */

import type { WriterPersona, PersonaStats } from '../types.ts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ======================
// PERSONA API
// ======================

/**
 * Get all personas (defaults + custom)
 */
export const getAllPersonas = async (): Promise<WriterPersona[]> => {
  const response = await fetch(`${API_BASE}/api/personas`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch personas');
  }

  return response.json();
};

/**
 * Get the currently active persona (or null if none)
 */
export const getActivePersona = async (): Promise<WriterPersona | null> => {
  const response = await fetch(`${API_BASE}/api/personas/active`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch active persona');
  }

  return response.json();
};

/**
 * Get a persona by ID
 */
export const getPersonaById = async (id: string): Promise<WriterPersona> => {
  const response = await fetch(`${API_BASE}/api/personas/${encodeURIComponent(id)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch persona');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(persona)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create persona');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/personas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update persona');
  }

  return response.json();
};

/**
 * Delete a custom persona (defaults cannot be deleted)
 */
export const deletePersona = async (id: string): Promise<{ success: boolean }> => {
  const response = await fetch(`${API_BASE}/api/personas/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete persona');
  }

  return response.json();
};

/**
 * Set the active persona (or pass "none" to deactivate all)
 */
export const setActivePersona = async (id: string | null): Promise<{ success: boolean; activePersonaId: string | null }> => {
  const personaId = id || 'none';
  const response = await fetch(`${API_BASE}/api/personas/${encodeURIComponent(personaId)}/activate`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to activate persona');
  }

  return response.json();
};

/**
 * Get persona statistics
 */
export const getPersonaStats = async (): Promise<PersonaStats> => {
  const response = await fetch(`${API_BASE}/api/personas/stats`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch persona stats');
  }

  return response.json();
};

/**
 * Toggle persona favorite status
 */
export const togglePersonaFavorite = async (id: string): Promise<WriterPersona> => {
  const response = await fetch(`${API_BASE}/api/personas/${encodeURIComponent(id)}/favorite`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle persona favorite');
  }

  return response.json();
};
