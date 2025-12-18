/**
 * InlinePersonaSelector Component
 *
 * Phase 10b: Compact persona selection list for inline editing.
 * Shows personas sorted by favorites, defaults, then alphabetically.
 */

import React from 'react';
import type { WriterPersona } from '../../types';
import { Spinner } from '../Spinner';
import { StarIcon } from '../IconComponents';

interface InlinePersonaSelectorProps {
  personas: WriterPersona[];
  activePersona: WriterPersona | null;
  onSelect: (personaId: string) => void;
  isLoading?: boolean;
}

export const InlinePersonaSelector: React.FC<InlinePersonaSelectorProps> = ({
  personas,
  activePersona,
  onSelect,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner />
        <span className="ml-2 text-slate text-caption">Loading personas...</span>
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <p className="font-sans text-caption text-slate py-2">
        No personas available. Create one in Tone & Visuals.
      </p>
    );
  }

  // Sort: favorites first, then defaults, then alphabetically
  const sortedPersonas = [...personas].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
    if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {sortedPersonas.map((persona) => (
        <button
          key={persona.id}
          type="button"
          onClick={() => onSelect(persona.id)}
          className={`w-full text-left px-3 py-2 font-sans text-ui transition-colors ${
            activePersona?.id === persona.id
              ? 'bg-ink text-paper'
              : 'bg-paper hover:bg-border-subtle'
          }`}
        >
          <div className="flex items-center gap-2">
            {persona.isFavorite && (
              <StarIcon className={`h-3 w-3 flex-shrink-0 ${
                activePersona?.id === persona.id ? 'text-editorial-gold' : 'text-editorial-gold'
              }`} />
            )}
            <span className="font-medium truncate">{persona.name}</span>
          </div>
          {persona.tagline && (
            <p className={`text-caption truncate mt-0.5 ${
              activePersona?.id === persona.id ? 'text-silver' : 'text-slate'
            }`}>
              {persona.tagline}
            </p>
          )}
        </button>
      ))}
    </div>
  );
};

export default InlinePersonaSelector;
