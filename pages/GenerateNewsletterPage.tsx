/**
 * GenerateNewsletterPage - 2-Panel Layout
 *
 * Phase 6g.7: Migrated from props to contexts/hooks
 *
 * State sources:
 * - Topics: TopicsContext (useSelectedTopics)
 * - Audience: TopicsContext (useAudienceSelection)
 * - Tone/Flavor/ImageStyle: NewsletterContext (useNewsletterSettings)
 * - Newsletter: NewsletterContext (useNewsletter)
 * - Loading/Error: UIContext (useLoading, useError)
 * - Auth: AuthContext (useIsAuthenticated)
 * - Presets: usePresets hook
 * - Templates: useTemplates hook
 * - Personas: usePersonas hook
 * - Modals: UIContext (useModals)
 *
 * Remaining props (API call and multi-state handlers):
 * - onEditImage, onImageUpload, onReorderSections, onUpdate, onEnhancedUpdate
 * - handleGenerateNewsletter, onSaveToDrive, onSendViaGmail
 * - onGenerateImage, onSavePreset, onLoadPreset
 * - onSyncToCloud, onLoadFromCloud, onSavePromptToLibrary
 * - selectedTemplateId, onSelectTemplate, onSaveAsTemplate
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Newsletter, NewsletterSection, Preset, PromptOfTheDay, EnhancedNewsletter } from '../types';
import { ResizablePanelLayout } from '../components/ResizablePanelLayout';
import { ConfigurationPanel } from '../components/ConfigurationPanel';
import { PreviewPanel } from '../components/PreviewPanel';
import { fadeInUp } from '../utils/animations';
import {
    useSelectedTopics,
    useAudienceSelection,
    useNewsletterSettings,
    useNewsletter,
    useWorkflowActions,
    useModals,
    useIsAuthenticated,
    useAuth,
} from '../contexts';
import { useLoading, useError } from '../contexts';
import { usePresets } from '../hooks/usePresets';
import { useTemplates } from '../hooks/useTemplates';
import { usePersonas } from '../hooks/usePersonas';
import { usePrompts } from '../hooks/usePrompts';
import { usePromptImport } from '../hooks/usePromptImport';

interface GenerateNewsletterPageProps {
    // Newsletter editing handlers that must remain as props
    onEditImage: (index: number, src: string, prompt: string) => void;
    onImageUpload: (sectionIndex: number, file: File) => void;
    onReorderSections: (newSections: NewsletterSection[]) => void;
    onUpdate: (field: keyof Newsletter | keyof NewsletterSection, value: string, sectionIndex?: number) => void;
    onEnhancedUpdate?: (field: string, value: string, sectionIndex?: number) => void;
    // Generation and workflow handlers
    handleGenerateNewsletter: () => Promise<void>;
    onSaveToDrive?: () => Promise<void>;
    onSendViaGmail?: () => Promise<void>;
    onGenerateImage?: (sectionIndex: number, imagePrompt: string) => Promise<void>;
    // Preset handlers (multi-state)
    onSavePreset: (name: string) => void;
    onLoadPreset: (preset: Preset) => void;
    onSyncToCloud?: () => Promise<void>;
    onLoadFromCloud?: () => Promise<void>;
    // Prompt library
    onSavePromptToLibrary?: (prompt: PromptOfTheDay) => Promise<void>;
    // Template management
    selectedTemplateId?: string | null;
    onSelectTemplate?: (templateId: string | null) => void;
    onSaveAsTemplate?: (name: string, description: string) => Promise<void>;
    // Calendar entry tracking (Issue 2 fix)
    calendarEntryTitle?: string | null;
}

export const GenerateNewsletterPage: React.FC<GenerateNewsletterPageProps> = ({
    // Newsletter editing handlers
    onEditImage,
    onImageUpload,
    onReorderSections,
    onUpdate,
    onEnhancedUpdate,
    // Generation and workflow
    handleGenerateNewsletter,
    onSaveToDrive,
    onSendViaGmail,
    onGenerateImage,
    // Preset handlers
    onSavePreset,
    onLoadPreset,
    onSyncToCloud,
    onLoadFromCloud,
    // Prompt library
    onSavePromptToLibrary,
    // Templates
    selectedTemplateId,
    onSelectTemplate,
    onSaveAsTemplate,
    // Calendar entry tracking
    calendarEntryTitle,
}) => {
    // Topics state from TopicsContext (Phase 10: added setters for inline editing)
    const { topics: selectedTopics, addTopic, removeTopic } = useSelectedTopics();

    // Audience selection from TopicsContext (Phase 10: added setter for inline editing)
    const { selectedAudience, audienceOptions, hasSelectedAudience, handleAudienceChange } = useAudienceSelection();

    // Tone, flavor, image style from NewsletterContext (Phase 10: added setters for inline editing)
    const {
        selectedTone,
        setSelectedTone,
        selectedFlavors,
        handleFlavorChange,
        selectedImageStyle,
        setSelectedImageStyle,
        toneOptions,
        flavorOptions,
        imageStyleOptions,
    } = useNewsletterSettings();

    // Newsletter state from NewsletterContext
    const {
        newsletter,
        enhancedNewsletter,
        useEnhancedFormat,
        setUseEnhancedFormat,
        promptOfTheDay,
        setPromptOfTheDay,
    } = useNewsletter();

    // Workflow actions from NewsletterContext
    const { workflowActions } = useWorkflowActions();
    const workflowStatus = workflowActions;

    // Loading/error from UIContext
    const { loading, progress } = useLoading();
    const { error } = useError();
    const isLoading = !!loading;

    // Auth state
    const isAuthenticated = useIsAuthenticated();
    const { authData } = useAuth();
    const userEmail = authData?.email;

    // Modal actions from UIContext
    const { openAudienceEditor } = useModals();
    const onOpenAudienceEditor = openAudienceEditor;

    // Presets from usePresets hook
    const { presets, deletePreset: onDeletePreset } = usePresets();

    // Templates from useTemplates hook
    const { templates, isLoading: isTemplatesLoading } = useTemplates();

    // Personas from usePersonas hook (Phase 10: added personas list and setter for inline editing)
    const { personas, activePersona, setActivePersona, isLoading: isPersonasLoading } = usePersonas();

    // Phase 9a: Saved prompts from usePrompts hook
    const { prompts: savedPrompts } = usePrompts();

    // Phase 11: Prompt import from usePromptImport hook
    // Pass userEmail for API key lookup (needed for AI parsing fallback)
    const {
        isImporting: isPromptImporting,
        error: promptImportError,
        templates: importTemplates,
        importFromUrl,
        importFromFile,
    } = usePromptImport({ userEmail });

    // Aliases for context setters to match prop API
    const onToggleEnhancedFormat = setUseEnhancedFormat;
    const onSavePromptOfTheDay = setPromptOfTheDay;
    // Determine if there's newsletter content to save as template
    const hasNewsletterContent = !!(newsletter || enhancedNewsletter);
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

            {/* Calendar Entry Indicator (Issue 2 fix) */}
            {calendarEntryTitle && (
                <div className="mb-4 p-3 bg-editorial-navy/5 border border-editorial-navy/20 rounded-md flex-shrink-0">
                    <span className="text-sm text-editorial-navy">
                        <span className="font-medium">Working on Calendar Entry:</span> {calendarEntryTitle}
                    </span>
                </div>
            )}

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
                        // Phase 10: Inline editing setters
                        onAudienceChange={handleAudienceChange}
                        onTopicsChange={{ add: addTopic, remove: removeTopic }}
                        onToneChange={setSelectedTone}
                        onFlavorChange={handleFlavorChange}
                        onImageStyleChange={setSelectedImageStyle}
                        personas={personas}
                        onPersonaChange={setActivePersona}
                        isPersonasLoading={isPersonasLoading}
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
                        savedPrompts={savedPrompts}
                        // Phase 11: Import from URL/File
                        onImportFromUrl={importFromUrl}
                        onImportFromFile={importFromFile}
                        isPromptImporting={isPromptImporting}
                        promptImportError={promptImportError}
                        importTemplates={importTemplates}
                        // Templates
                        templates={templates}
                        selectedTemplateId={selectedTemplateId}
                        onSelectTemplate={onSelectTemplate}
                        onSaveAsTemplate={onSaveAsTemplate}
                        isTemplatesLoading={isTemplatesLoading}
                        hasNewsletterContent={hasNewsletterContent}
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
                        // Phase 12.0: Bulk image regeneration (uses same handler as reorder)
                        onBulkUpdateSections={onReorderSections}
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
