/**
 * usePersonas Hook
 *
 * Manages writer personas using SQLite backend:
 * - Loads all personas (defaults + custom) on mount
 * - Tracks active persona
 * - Creates, updates, and deletes custom personas
 * - Activates/deactivates personas
 */

import { useState, useCallback, useEffect } from 'react';
import * as personaApi from '../services/personaClientService';
import type { WriterPersona } from '../types';

interface UsePersonasReturn {
  personas: WriterPersona[];
  activePersona: WriterPersona | null;
  isLoading: boolean;
  error: string | null;
  setActivePersona: (id: string | null) => Promise<void>;
  createPersona: (persona: {
    name: string;
    tagline?: string;
    expertise?: string;
    values?: string;
    writingStyle?: string;
    signatureElements?: string[];
    sampleWriting?: string;
  }) => Promise<WriterPersona>;
  updatePersona: (id: string, updates: Partial<{
    name: string;
    tagline: string;
    expertise: string;
    values: string;
    writingStyle: string;
    signatureElements: string[];
    sampleWriting: string;
  }>) => Promise<WriterPersona>;
  deletePersona: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  refreshPersonas: () => Promise<void>;
}

export function usePersonas(): UsePersonasReturn {
  const [personas, setPersonas] = useState<WriterPersona[]>([]);
  const [activePersona, setActivePersonaState] = useState<WriterPersona | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all personas from SQLite on mount
  const loadPersonas = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [allPersonas, active] = await Promise.all([
        personaApi.getAllPersonas(),
        personaApi.getActivePersona(),
      ]);

      setPersonas(allPersonas);
      setActivePersonaState(active);
      console.log(`[Personas] Loaded ${allPersonas.length} personas, active: ${active?.name || 'None'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load personas';
      console.error('[Personas] Error loading from SQLite:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersonas();
  }, [loadPersonas]);

  const setActivePersona = useCallback(async (id: string | null): Promise<void> => {
    try {
      await personaApi.setActivePersona(id);

      // Update local state
      if (id) {
        const persona = personas.find((p) => p.id === id);
        setActivePersonaState(persona || null);
      } else {
        setActivePersonaState(null);
      }

      // Update isActive flag in personas list
      setPersonas((prev) =>
        prev.map((p) => ({
          ...p,
          isActive: p.id === id,
        }))
      );

      console.log(`[Personas] Activated: ${id || 'None'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to activate persona';
      console.error('[Personas] Error activating:', e);
      throw new Error(msg);
    }
  }, [personas]);

  const createPersona = useCallback(
    async (persona: {
      name: string;
      tagline?: string;
      expertise?: string;
      values?: string;
      writingStyle?: string;
      signatureElements?: string[];
      sampleWriting?: string;
    }): Promise<WriterPersona> => {
      try {
        const created = await personaApi.createPersona(persona);

        // Add to local state
        setPersonas((prev) => [...prev, created]);

        console.log(`[Personas] Created: ${created.name} (${created.id})`);
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create persona';
        console.error('[Personas] Error creating:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const updatePersona = useCallback(
    async (
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
      try {
        const updated = await personaApi.updatePersona(id, updates);

        // Update local state
        setPersonas((prev) => prev.map((p) => (p.id === id ? updated : p)));

        // Update active persona if it's the one being updated
        if (activePersona?.id === id) {
          setActivePersonaState(updated);
        }

        console.log(`[Personas] Updated: ${updated.name} (${updated.id})`);
        return updated;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to update persona';
        console.error('[Personas] Error updating:', e);
        throw new Error(msg);
      }
    },
    [activePersona]
  );

  const deletePersona = useCallback(
    async (id: string): Promise<void> => {
      try {
        await personaApi.deletePersona(id);

        // Remove from local state
        setPersonas((prev) => prev.filter((p) => p.id !== id));

        // If deleting the active persona, clear it
        if (activePersona?.id === id) {
          setActivePersonaState(null);
        }

        console.log(`[Personas] Deleted: ${id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete persona';
        console.error('[Personas] Error deleting:', e);
        throw new Error(msg);
      }
    },
    [activePersona]
  );

  const refreshPersonas = useCallback(async () => {
    await loadPersonas();
  }, [loadPersonas]);

  const toggleFavorite = useCallback(
    async (id: string): Promise<void> => {
      try {
        const updated = await personaApi.togglePersonaFavorite(id);

        // Update local state with the updated persona and re-sort (favorites first)
        setPersonas((prev) => {
          const updated_list = prev.map((p) => (p.id === id ? updated : p));
          // Re-sort: favorites first, then defaults, then alphabetically
          return updated_list.sort((a, b) => {
            if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
            if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
            return a.name.localeCompare(b.name);
          });
        });

        // Update active persona if it's the one being toggled
        if (activePersona?.id === id) {
          setActivePersonaState(updated);
        }

        console.log(`[Personas] Toggled favorite: ${id} -> ${updated.isFavorite}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to toggle favorite';
        console.error('[Personas] Error toggling favorite:', e);
        throw new Error(msg);
      }
    },
    [activePersona]
  );

  return {
    personas,
    activePersona,
    isLoading,
    error,
    setActivePersona,
    createPersona,
    updatePersona,
    deletePersona,
    toggleFavorite,
    refreshPersonas,
  };
}

export default usePersonas;
