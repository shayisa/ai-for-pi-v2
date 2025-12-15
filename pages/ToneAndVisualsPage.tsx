/**
 * ToneAndVisualsPage
 *
 * Combined page for:
 * - Step 1: Select Tone (radio buttons)
 * - Step 2: Stylistic Flavors (checkboxes, optional)
 * - Step 3: Image Aesthetic (radio buttons)
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ImageIcon } from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

interface ToneAndVisualsPageProps {
    selectedTone: string;
    setSelectedTone: (tone: string) => void;
    toneOptions: Record<string, { label: string; description: string; sampleOutput: string }>;
    selectedFlavors: Record<string, boolean>;
    handleFlavorChange: (key: string) => void;
    flavorOptions: Record<string, { label: string; description: string }>;
    selectedImageStyle: string;
    setSelectedImageStyle: (style: string) => void;
    imageStyleOptions: Record<string, { label: string; description: string }>;
}

export const ToneAndVisualsPage: React.FC<ToneAndVisualsPageProps> = ({
    selectedTone,
    setSelectedTone,
    toneOptions,
    selectedFlavors,
    handleFlavorChange,
    flavorOptions,
    selectedImageStyle,
    setSelectedImageStyle,
    imageStyleOptions,
}) => {
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

            {/* Section 3: Image Aesthetic */}
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
                    {Object.entries(imageStyleOptions).map(([key, { label, description }]) => (
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
                                    flex flex-col items-center text-center p-6 cursor-pointer transition-all duration-200
                                    border ${selectedImageStyle === key
                                        ? 'border-ink bg-ink text-paper'
                                        : 'border-border-subtle bg-paper hover:bg-pearl text-ink'}
                                `}
                            >
                                <ImageIcon className={`h-10 w-10 mb-3 ${selectedImageStyle === key ? 'text-silver' : 'text-slate'}`} />
                                <span className="font-sans text-ui font-medium block mb-1">{label}</span>
                                <p className={`font-sans text-caption ${selectedImageStyle === key ? 'text-silver' : 'text-slate'}`}>
                                    {description}
                                </p>
                            </label>
                        </motion.div>
                    ))}
                </motion.div>
            </section>
        </motion.div>
    );
};
