import React from 'react';
import { TypeIcon } from '../components/IconComponents';

interface DefineTonePageProps {
    selectedTone: string;
    setSelectedTone: (tone: string) => void;
    toneOptions: Record<string, { label: string; description: string; sampleOutput: string }>;
    selectedFlavors: Record<string, boolean>;
    handleFlavorChange: (key: string) => void;
    flavorOptions: Record<string, { label: string; description: string }>;
}

export const DefineTonePage: React.FC<DefineTonePageProps> = ({
    selectedTone,
    setSelectedTone,
    toneOptions,
    selectedFlavors,
    handleFlavorChange,
    flavorOptions,
}) => {
    return (
        <div className="space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-6">
                Define Newsletter Tone
            </h1>

            {/* Select Tone */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-muted-blue to-accent-salmon mb-4 flex items-center gap-2">
                    <TypeIcon className="h-6 w-6" />
                    1. Select Tone
                </h2>
                <p className="text-secondary-text mb-6">Choose the overall emotional character of your newsletter's writing style.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {Object.entries(toneOptions).map(([key, { label, description, sampleOutput }]) => (
                        <div key={key} className="relative group">
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
                                className="block p-3 rounded-lg bg-gray-50 border border-border-light hover:bg-gray-100 transition cursor-pointer peer-checked:bg-accent-salmon peer-checked:border-transparent"
                            >
                                <span className="font-medium text-primary-text peer-checked:text-white">{label}</span>
                                <p className="text-sm text-secondary-text peer-checked:text-white/90">{description}</p>
                            </label>
                            {/* Tooltip */}
                            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 z-20 w-80 p-4 bg-primary-text text-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                                <h4 className="font-bold text-sm mb-2">{label} Tone Sample:</h4>
                                <p className="text-xs italic leading-snug">"{sampleOutput}"</p>
                                <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[8px] border-t-transparent border-b-transparent border-r-primary-text"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Stylistic Flavors */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-salmon to-accent-light-blue mb-4 flex items-center gap-2">
                    <TypeIcon className="h-6 w-6" />
                    2. Add Stylistic Flavors <span className="text-secondary-text font-normal text-lg">(Optional)</span>
                </h2>
                <p className="text-secondary-text mb-6">Enhance your newsletter with specific stylistic elements for a unique touch.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(flavorOptions).map(([key, { label, description }]) => (
                        <label key={key} htmlFor={`flavor-${key}`} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer border border-transparent has-[:checked]:border-accent-yellow">
                            <input
                                type="checkbox"
                                id={`flavor-${key}`}
                                checked={!!selectedFlavors[key]}
                                onChange={() => handleFlavorChange(key)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 bg-white text-accent-salmon focus:ring-accent-salmon"
                            />
                            <div>
                                <span className="font-medium text-primary-text">{label}</span>
                                <p className="text-sm text-secondary-text">{description}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
};