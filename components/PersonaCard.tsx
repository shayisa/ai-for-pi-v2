/**
 * PersonaCard Component
 *
 * Displays a writer persona as a selectable card with:
 * - Persona name and tagline
 * - Star icon for favorites (toggleable)
 * - Sample writing preview
 * - Edit button for custom personas
 */

import React from 'react';
import { motion } from 'framer-motion';
import { StarIcon, EditIcon } from './IconComponents';
import type { WriterPersona } from '../types';

interface PersonaCardProps {
    persona: WriterPersona;
    isActive: boolean;
    onSelect: () => void;
    onToggleFavorite: () => void;
    onEdit?: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
    persona,
    isActive,
    onSelect,
    onToggleFavorite,
    onEdit,
}) => {
    return (
        <motion.div
            onClick={onSelect}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
                relative p-4 cursor-pointer transition-all duration-200 border
                ${isActive
                    ? 'border-ink bg-ink text-paper'
                    : 'border-border-subtle bg-paper hover:bg-pearl text-ink'}
            `}
        >
            {/* Star Icon for Favorites */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                }}
                className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
                    isActive ? 'hover:bg-charcoal/20' : 'hover:bg-pearl'
                }`}
                aria-label={persona.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <StarIcon
                    className={`h-5 w-5 transition-colors ${
                        persona.isFavorite
                            ? 'fill-editorial-gold text-editorial-gold'
                            : isActive
                                ? 'text-silver'
                                : 'text-slate'
                    }`}
                />
            </button>

            {/* Persona Info */}
            <h3 className="font-sans text-ui font-semibold pr-8">{persona.name}</h3>
            {persona.tagline && (
                <p className={`font-sans text-caption mt-1 italic ${
                    isActive ? 'text-silver' : 'text-slate'
                }`}>
                    "{persona.tagline}"
                </p>
            )}

            {/* Sample writing preview */}
            {persona.sampleWriting && (
                <div className={`mt-3 pt-3 border-t ${
                    isActive ? 'border-charcoal/30' : 'border-border-subtle'
                }`}>
                    <p className={`font-serif text-caption line-clamp-2 ${
                        isActive ? 'text-silver' : 'text-slate'
                    }`}>
                        {persona.sampleWriting}
                    </p>
                </div>
            )}

            {/* Edit button for custom personas */}
            {!persona.isDefault && onEdit && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    className={`absolute bottom-2 right-2 p-1 rounded transition-colors ${
                        isActive
                            ? 'hover:bg-charcoal/20 text-silver'
                            : 'hover:bg-pearl text-slate'
                    }`}
                    aria-label="Edit persona"
                >
                    <EditIcon className="h-4 w-4" />
                </button>
            )}

            {/* Active indicator */}
            {isActive && (
                <motion.div
                    layoutId="activePersonaIndicator"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-editorial-red"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
            )}
        </motion.div>
    );
};
