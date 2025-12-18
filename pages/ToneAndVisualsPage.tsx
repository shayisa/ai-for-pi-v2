/**
 * ToneAndVisualsPage
 *
 * Phase 6g.4: Migrated from props to contexts
 *
 * Combined page for:
 * - Step 0: Writer Persona (selectable persona cards)
 * - Step 1: Select Tone (radio buttons)
 * - Step 2: Stylistic Flavors (checkboxes, optional)
 * - Step 3: Image Aesthetic (radio buttons with thumbnail previews)
 *
 * State sources:
 * - Tone/Flavor/ImageStyle: NewsletterContext (useNewsletterSettings)
 * - Personas: usePersonas hook
 * - Thumbnails: useStyleThumbnails hook
 * - Modal actions: UIContext (useModals)
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ImageIcon, PlusIcon, SparklesIcon } from '../components/IconComponents';
import { PersonaCard } from '../components/PersonaCard';
import { PersonaABPreview } from '../components/PersonaABPreview';
import { Spinner } from '../components/Spinner';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';
import { useNewsletterSettings, useModals } from '../contexts';
import { usePersonas } from '../hooks/usePersonas';
import { useStyleThumbnails } from '../hooks/useStyleThumbnails';
import { useSelectedTopics } from '../contexts';

export const ToneAndVisualsPage: React.FC = () => {
    // Get tone/flavor/imageStyle from NewsletterContext (Phase 6g.0)
    const {
        selectedTone,
        setSelectedTone,
        toneOptions,
        selectedFlavors,
        handleFlavorChange,
        flavorOptions,
        selectedImageStyle,
        setSelectedImageStyle,
        imageStyleOptions,
    } = useNewsletterSettings();

    // Get persona state from usePersonas hook
    const {
        personas,
        activePersona,
        isLoading: isPersonasLoading,
        setActivePersona: onSetActivePersona,
        toggleFavorite: onToggleFavorite,
    } = usePersonas();

    // Get thumbnail state from useStyleThumbnails hook
    const {
        thumbnails,
        isLoading: isThumbnailsLoading,
        isGenerating: isGeneratingThumbnails,
        generatingStyles,
        progress: thumbnailProgress,
    } = useStyleThumbnails();

    // Get modal actions from UIContext (Phase 6g.0)
    const { openPersonaEditor } = useModals();

    // Get selected topics for A/B preview (Phase 12.0)
    const { topics: selectedTopics } = useSelectedTopics();

    // Phase 12.0: A/B Persona Preview modal state
    const [showABPreview, setShowABPreview] = useState(false);

    // Sort personas: favorites first, then defaults, then alphabetically
    const sortedPersonas = [...personas].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
        if (a.isDefault !== b.isDefault) return b.isDefault ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    return (
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="space-y-10"
        >
            {/* Page Header */}
            <header className="border-b-2 border-ink pb-6">
                <h1 className="font-display text-h1 text-ink">
                    Tone & Visuals
                </h1>
                <p className="font-serif text-body text-slate mt-2">
                    Set the voice, style, and visual aesthetic of your newsletter
                </p>
            </header>

            {/* Section 0: Writer Persona (NEW) */}
            {personas.length > 0 && (
                <section className="bg-paper border border-border-subtle p-8">
                    <div className="flex items-baseline justify-between mb-4">
                        <div className="flex items-baseline gap-3">
                            <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 0</span>
                            <h2 className="font-display text-h3 text-ink">Writer Persona</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Phase 12.0: A/B Persona Preview button */}
                            {personas.length >= 2 && (
                                <button
                                    onClick={() => setShowABPreview(true)}
                                    className="font-sans text-ui text-editorial-navy hover:text-ink transition-colors flex items-center gap-1"
                                >
                                    <SparklesIcon className="h-4 w-4" />
                                    Compare Personas
                                </button>
                            )}
                            <button
                                onClick={() => openPersonaEditor()}
                                className="font-sans text-ui text-editorial-red hover:text-ink transition-colors flex items-center gap-1"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Create New
                            </button>
                        </div>
                    </div>
                    <p className="font-sans text-ui text-slate mb-6">
                        Choose a writing voice that shapes the entire newsletter's personality
                    </p>

                    {isPersonasLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Spinner />
                            <span className="ml-2 text-slate">Loading personas...</span>
                        </div>
                    ) : (
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                        >
                            {sortedPersonas.map((persona) => (
                                <motion.div key={persona.id} variants={staggerItem}>
                                    <PersonaCard
                                        persona={persona}
                                        isActive={activePersona?.id === persona.id}
                                        onSelect={() => onSetActivePersona(persona.id)}
                                        onToggleFavorite={() => onToggleFavorite(persona.id)}
                                        onEdit={!persona.isDefault ? () => openPersonaEditor(persona) : undefined}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {/* Active persona info */}
                    {activePersona && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 p-4 bg-pearl border-l-4 border-editorial-red"
                        >
                            <p className="font-sans text-ui">
                                <span className="font-semibold">Active:</span> {activePersona.name}
                                {activePersona.tagline && (
                                    <span className="text-slate italic ml-2">— "{activePersona.tagline}"</span>
                                )}
                            </p>
                            {activePersona.writingStyle && (
                                <p className="font-sans text-caption text-slate mt-1">
                                    Style: {activePersona.writingStyle}
                                </p>
                            )}
                        </motion.div>
                    )}
                </section>
            )}

            {/* Section 1: Select Tone */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 1</span>
                    <h2 className="font-display text-h3 text-ink">Select Tone</h2>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Choose the overall emotional character of your writing
                </p>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
                >
                    {Object.entries(toneOptions).map(([key, { label, description, sampleOutput }]) => (
                        <motion.div key={key} variants={staggerItem} className="relative group">
                            <input
                                type="radio"
                                id={`tone-${key}`}
                                name="tone"
                                value={key}
                                checked={selectedTone === key}
                                onChange={() => setSelectedTone(key)}
                                className="sr-only peer"
                            />
                            <label
                                htmlFor={`tone-${key}`}
                                className={`
                                    block p-4 cursor-pointer transition-all duration-200
                                    border ${selectedTone === key
                                        ? 'border-ink bg-ink text-paper'
                                        : 'border-border-subtle bg-paper hover:bg-pearl text-ink'}
                                `}
                            >
                                <span className="font-sans text-ui font-medium block mb-1">{label}</span>
                                <p className={`font-sans text-caption ${selectedTone === key ? 'text-silver' : 'text-slate'}`}>
                                    {description}
                                </p>
                                {/* Phase 12.0: Inline sample output preview */}
                                <div className={`mt-2 pt-2 border-t ${selectedTone === key ? 'border-silver/30' : 'border-border-subtle'}`}>
                                    <p className={`font-serif text-caption italic ${selectedTone === key ? 'text-silver' : 'text-slate'}`}>
                                        "{sampleOutput}"
                                    </p>
                                </div>
                            </label>
                            {/* Tooltip */}
                            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 z-20 w-72 p-4 bg-ink text-paper shadow-editorial-modal opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                                <h4 className="font-sans text-caption font-semibold text-silver uppercase tracking-wide mb-2">
                                    Sample Output
                                </h4>
                                <p className="font-serif text-ui italic leading-relaxed">"{sampleOutput}"</p>
                                <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-ink" />
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Section 2: Stylistic Flavors */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 2</span>
                    <h2 className="font-display text-h3 text-ink">
                        Stylistic Flavors
                        <span className="font-sans text-ui text-slate font-normal ml-2">(Optional)</span>
                    </h2>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Enhance your newsletter with specific stylistic elements
                </p>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                >
                    {Object.entries(flavorOptions).map(([key, { label, description }]) => (
                        <motion.label
                            key={key}
                            variants={staggerItem}
                            htmlFor={`flavor-${key}`}
                            className={`
                                flex items-start gap-3 p-4 cursor-pointer transition-all duration-200
                                border ${selectedFlavors[key] ? 'border-ink bg-pearl' : 'border-border-subtle bg-paper hover:bg-pearl'}
                            `}
                        >
                            <input
                                type="checkbox"
                                id={`flavor-${key}`}
                                checked={!!selectedFlavors[key]}
                                onChange={() => handleFlavorChange(key)}
                                className="mt-1 h-4 w-4 border-charcoal bg-paper text-ink focus:ring-ink"
                            />
                            <div>
                                <span className="font-sans text-ui font-medium text-ink">{label}</span>
                                <p className="font-sans text-caption text-slate mt-1">{description}</p>
                            </div>
                        </motion.label>
                    ))}
                </motion.div>
            </section>

            {/* Section 3: Image Aesthetic (with thumbnails) */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-overline text-slate uppercase tracking-widest font-sans">Step 3</span>
                    <h2 className="font-display text-h3 text-ink">Image Aesthetic</h2>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Determine the artistic style for all AI-generated images
                </p>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
                >
                    {Object.entries(imageStyleOptions).map(([key, { label, description }]) => {
                        const thumbnail = thumbnails[key];
                        const isGenerating = generatingStyles.includes(key);

                        return (
                            <motion.div key={key} variants={staggerItem}>
                                <input
                                    type="radio"
                                    id={`style-${key}`}
                                    name="style"
                                    value={key}
                                    checked={selectedImageStyle === key}
                                    onChange={() => setSelectedImageStyle(key)}
                                    className="sr-only peer"
                                />
                                <label
                                    htmlFor={`style-${key}`}
                                    className={`
                                        flex flex-col items-center text-center p-4 cursor-pointer transition-all duration-200
                                        border ${selectedImageStyle === key
                                            ? 'border-ink bg-ink text-paper'
                                            : 'border-border-subtle bg-paper hover:bg-pearl text-ink'}
                                    `}
                                >
                                    {/* Thumbnail Preview */}
                                    <div className={`aspect-square w-full mb-3 overflow-hidden flex items-center justify-center ${
                                        selectedImageStyle === key ? 'bg-charcoal/30' : 'bg-pearl'
                                    }`}>
                                        {thumbnail ? (
                                            <img
                                                src={`data:image/png;base64,${thumbnail}`}
                                                alt={`${label} style preview`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : isGenerating ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <Spinner />
                                                <span className={`text-caption mt-2 ${
                                                    selectedImageStyle === key ? 'text-silver' : 'text-slate'
                                                }`}>
                                                    Generating...
                                                </span>
                                            </div>
                                        ) : (
                                            <ImageIcon className={`h-10 w-10 ${
                                                selectedImageStyle === key ? 'text-silver' : 'text-slate'
                                            }`} />
                                        )}
                                    </div>

                                    <span className="font-sans text-ui font-medium block mb-1">{label}</span>
                                    <p className={`font-sans text-caption ${
                                        selectedImageStyle === key ? 'text-silver' : 'text-slate'
                                    }`}>
                                        {description}
                                    </p>
                                </label>
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* Thumbnail Generation Progress */}
                {thumbnailProgress && isGeneratingThumbnails && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-6 text-center"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-pearl border border-border-subtle">
                            <Spinner />
                            <p className="font-sans text-caption text-slate">
                                Generating style thumbnails: {thumbnailProgress.current}/{thumbnailProgress.total}
                            </p>
                        </div>
                    </motion.div>
                )}
            </section>

            {/* Phase 12.0: A/B Persona Preview Modal */}
            <PersonaABPreview
                personas={personas}
                currentTopic={selectedTopics[0] || 'AI tools for productivity'}
                isOpen={showABPreview}
                onClose={() => setShowABPreview(false)}
                onSelectPersona={(persona) => {
                    onSetActivePersona(persona.id);
                    setShowABPreview(false);
                }}
            />
        </motion.div>
    );
};
