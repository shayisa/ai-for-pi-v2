/**
 * GenerateNewsletterPage - 2-Panel Layout
 *
 * Redesigned page with:
 * - Left panel: Configuration (resizable)
 * - Right panel: Newsletter preview
 * - Button state feedback throughout
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Newsletter, NewsletterSection, Preset, PromptOfTheDay, EnhancedNewsletter, WriterPersona } from '../types';
import { ResizablePanelLayout } from '../components/ResizablePanelLayout';
import { ConfigurationPanel } from '../components/ConfigurationPanel';
import { PreviewPanel } from '../components/PreviewPanel';
import { fadeInUp } from '../utils/animations';

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
    onSavePromptToLibrary?: (prompt: PromptOfTheDay) => Promise<void>;
    // Workflow actions
    onSaveToDrive?: () => Promise<void>;
    onSendViaGmail?: () => Promise<void>;
    workflowStatus?: { savedToDrive: boolean; sentEmail: boolean };
    // Enhanced newsletter v2 props
    useEnhancedFormat?: boolean;
    onToggleEnhancedFormat?: (value: boolean) => void;
    enhancedNewsletter?: EnhancedNewsletter | null;
    onEnhancedUpdate?: (field: string, value: string, sectionIndex?: number) => void;
    onOpenAudienceEditor?: () => void;
    onGenerateImage?: (sectionIndex: number, imagePrompt: string) => Promise<void>;
    // Persona display
    activePersona?: WriterPersona | null;
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
    onSavePromptToLibrary,
    onSaveToDrive,
    onSendViaGmail,
    workflowStatus,
    // Enhanced newsletter v2 props
    useEnhancedFormat = true,
    onToggleEnhancedFormat,
    enhancedNewsletter,
    onEnhancedUpdate,
    onOpenAudienceEditor,
    onGenerateImage,
    activePersona,
}) => {
    return (
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="h-full flex flex-col"
        >
            {/* Page Header */}
            <header className="border-b-2 border-ink pb-4 mb-6 flex-shrink-0">
                <h1 className="font-display text-h2 text-ink">
                    Generate Newsletter
                </h1>
                <p className="font-serif text-body text-slate mt-1">
                    Configure and preview your newsletter
                </p>
            </header>

            {/* 2-Panel Layout */}
            <ResizablePanelLayout
                storageKey="generatePage.panelWidth"
                defaultLeftWidth={35}
                minLeftWidth={25}
                maxLeftWidth={50}
                leftPanel={
                    <ConfigurationPanel
                        // Configuration display
                        selectedTopics={selectedTopics}
                        selectedAudience={selectedAudience}
                        selectedTone={selectedTone}
                        selectedFlavors={selectedFlavors}
                        selectedImageStyle={selectedImageStyle}
                        audienceOptions={audienceOptions}
                        toneOptions={toneOptions}
                        flavorOptions={flavorOptions}
                        imageStyleOptions={imageStyleOptions}
                        // Format toggle
                        useEnhancedFormat={useEnhancedFormat}
                        onToggleEnhancedFormat={onToggleEnhancedFormat || (() => {})}
                        onOpenAudienceEditor={onOpenAudienceEditor}
                        // Persona
                        activePersona={activePersona}
                        // Presets
                        presets={presets}
                        onSavePreset={onSavePreset}
                        onLoadPreset={onLoadPreset}
                        onDeletePreset={onDeletePreset}
                        onSyncToCloud={onSyncToCloud}
                        onLoadFromCloud={onLoadFromCloud}
                        isAuthenticated={isAuthenticated}
                        // Prompt of the Day
                        promptOfTheDay={promptOfTheDay}
                        onSavePromptOfTheDay={onSavePromptOfTheDay}
                        onSavePromptToLibrary={onSavePromptToLibrary}
                        // Generation
                        handleGenerateNewsletter={handleGenerateNewsletter}
                        hasSelectedAudience={hasSelectedAudience}
                        isLoading={isLoading}
                        loading={loading}
                        progress={progress}
                        error={error}
                    />
                }
                rightPanel={
                    <PreviewPanel
                        // Newsletter content
                        newsletter={newsletter}
                        enhancedNewsletter={enhancedNewsletter || null}
                        useEnhancedFormat={useEnhancedFormat}
                        topics={selectedTopics}
                        // Newsletter editing handlers
                        onEditImage={onEditImage}
                        onImageUpload={onImageUpload}
                        onReorderSections={onReorderSections}
                        onUpdate={onUpdate}
                        onEnhancedUpdate={onEnhancedUpdate}
                        onGenerateImage={onGenerateImage}
                        isLoading={isLoading}
                        // Workflow actions
                        onSaveToDrive={onSaveToDrive}
                        onSendViaGmail={onSendViaGmail}
                        isAuthenticated={isAuthenticated}
                        workflowStatus={workflowStatus}
                    />
                }
            />
        </motion.div>
    );
};
