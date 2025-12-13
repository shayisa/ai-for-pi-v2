import React from 'react';
import { Newsletter, NewsletterSection, Preset, PromptOfTheDay } from '../types';
import { NewsletterPreview } from '../components/NewsletterPreview';
import { PresetsManager } from '../components/PresetsManager';
import { PromptOfTheDayEditor } from '../components/PromptOfTheDayEditor';
import { ProgressGauge } from '../components/ProgressGauge';
import { SparklesIcon, RefreshIcon } from '../components/IconComponents';
import { Spinner } from '../components/Spinner';

interface GenerateNewsletterPageProps {
    selectedTopics: string[];
    selectedAudience: Record<string, boolean>;
    selectedTone: string;
    selectedFlavors: Record<string, boolean>;
    selectedImageStyle: string;
    audienceOptions: Record<string, { label: string; description: string }>;
    toneOptions: Record<string, { label: string; description: string }>;
    flavorOptions: Record<string, { label: string; description: string }>;
    imageStyleOptions: Record<string, { label: string; description: string }>;
    newsletter: Newsletter | null;
    onEditImage: (index: number, src: string, prompt: string) => void;
    onImageUpload: (sectionIndex: number, file: File) => void;
    onReorderSections: (newSections: NewsletterSection[]) => void;
    onUpdate: (field: keyof Newsletter | keyof NewsletterSection, value: string, sectionIndex?: number) => void;
    isLoading: boolean;
    handleGenerateNewsletter: () => Promise<void>;
    loading: string | null;
    progress: number;
    error: { message: string; onRetry?: () => void; } | null;
    hasSelectedAudience: boolean;
    presets: Preset[];
    onSavePreset: (name: string) => void;
    onLoadPreset: (preset: Preset) => void;
    onDeletePreset: (name: string) => void;
    onSyncToCloud?: () => Promise<void>;
    onLoadFromCloud?: () => Promise<void>;
    isAuthenticated?: boolean;
    promptOfTheDay: PromptOfTheDay | null;
    onSavePromptOfTheDay: (prompt: PromptOfTheDay | null) => void;
}

export const GenerateNewsletterPage: React.FC<GenerateNewsletterPageProps> = ({
    selectedTopics,
    selectedAudience,
    selectedTone,
    selectedFlavors,
    selectedImageStyle,
    audienceOptions,
    toneOptions,
    flavorOptions,
    imageStyleOptions,
    newsletter,
    onEditImage,
    onImageUpload,
    onReorderSections,
    onUpdate,
    isLoading,
    handleGenerateNewsletter,
    loading,
    progress,
    error,
    hasSelectedAudience,
    presets,
    onSavePreset,
    onLoadPreset,
    onDeletePreset,
    onSyncToCloud,
    onLoadFromCloud,
    isAuthenticated,
    promptOfTheDay,
    onSavePromptOfTheDay,
}) => {
    const getSelectedLabels = (options: Record<string, { label: string }>, selected: Record<string, boolean> | string) => {
        if (typeof selected === 'string') {
            return options[selected]?.label || '';
        }
        return Object.keys(selected).filter(key => selected[key]).map(key => options[key].label).join(', ');
    };

    const isActionLoading = !!loading;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-6">
                Generate Your Newsletter
            </h1>

            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border border-border-light backdrop-blur-sm">
                <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-muted-blue to-accent-salmon mb-6">
                   Current Newsletter Configuration
                </h2>

                <div className="space-y-4 text-primary-text mb-8">
                    <p><strong>Audience:</strong> {getSelectedLabels(audienceOptions, selectedAudience) || <span className="text-accent-salmon">None selected!</span>}</p>
                    <p><strong>Topics:</strong> {selectedTopics.length > 0 ? selectedTopics.join(', ') : <span className="text-accent-salmon">None selected!</span>}</p>
                    <p><strong>Tone:</strong> {getSelectedLabels(toneOptions, selectedTone) || <span className="text-accent-salmon">None selected!</span>}</p>
                    <p><strong>Flavors:</strong> {getSelectedLabels(flavorOptions, selectedFlavors) || 'None'}</p>
                    <p><strong>Image Style:</strong> {getSelectedLabels(imageStyleOptions, selectedImageStyle) || <span className="text-accent-salmon">None selected!</span>}</p>
                </div>
                
                <PresetsManager
                    presets={presets}
                    onSave={onSavePreset}
                    onLoad={onLoadPreset}
                    onDelete={onDeletePreset}
                    onSyncToCloud={onSyncToCloud}
                    onLoadFromCloud={onLoadFromCloud}
                    isAuthenticated={isAuthenticated}
                />

                <div className="mt-8 border-t border-border-light pt-6 flex justify-end">
                    <button
                        onClick={handleGenerateNewsletter}
                        disabled={isActionLoading || selectedTopics.length === 0 || !hasSelectedAudience}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent-salmon hover:bg-opacity-90 disabled:bg-accent-salmon/40 disabled:text-secondary-text disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg shadow-accent-salmon/30"
                    >
                        <SparklesIcon className="h-5 w-5" />
                        <span>{loading ? 'Generating...' : 'Generate Newsletter'}</span>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="mt-8 flex flex-col items-center justify-center text-center">
                    <ProgressGauge
                        progress={progress}
                        message={loading}
                        size="large"
                    />
                </div>
            )}
            
            {error && (
                <div className="mt-8 bg-red-100 border border-red-300 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between" role="alert">
                    <div>
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error.message}</span>
                    </div>
                    {error.onRetry && (
                            <button
                                onClick={error.onRetry}
                                className="flex items-center justify-center gap-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 px-3 rounded-lg transition duration-200 ml-4"
                            >
                                <RefreshIcon className="h-4 w-4" />
                                <span>Retry</span>
                            </button>
                    )}
                </div>
            )}

            {/* Prompt of the Day Editor */}
            <div className="mt-8">
                <PromptOfTheDayEditor 
                    initialPrompt={promptOfTheDay}
                    onSave={onSavePromptOfTheDay}
                />
            </div>


            {newsletter && !loading && (
                <div id="newsletter-preview">
                    <NewsletterPreview
                        newsletter={newsletter}
                        topics={selectedTopics}
                        onEditImage={onEditImage}
                        onImageUpload={onImageUpload}
                        onReorderSections={onReorderSections}
                        onUpdate={onUpdate}
                        isLoading={isLoading}
                    />
                </div>
            )}
        </div>
    );
};