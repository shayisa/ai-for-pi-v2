/**
 * ConfigurationPanel Component
 *
 * Left panel of the Generate Newsletter page containing:
 * - Configuration Summary (compact)
 * - Newsletter Format Toggle + Manage Audiences
 * - Presets Manager
 * - Prompt of the Day Editor
 * - Generation Progress (conditional)
 * - Error Alert (conditional)
 * - Generate Newsletter Button (sticky footer)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Preset, PromptOfTheDay, WriterPersona } from '../types';
import type { NewsletterTemplate } from '../services/templateClientService';
import { PresetsManager } from './PresetsManager';
import { PromptOfTheDayEditor } from './PromptOfTheDayEditor';
import { GenerationProgress } from './GenerationProgress';
import { ActionButton } from './ActionButton';
import { SparklesIcon, RefreshIcon, SaveIcon, ChevronDownIcon } from './IconComponents';
import { staggerContainer, staggerItem } from '../utils/animations';

interface ConfigurationPanelProps {
  // Configuration display
  selectedTopics: string[];
  selectedAudience: Record<string, boolean>;
  selectedTone: string;
  selectedFlavors: Record<string, boolean>;
  selectedImageStyle: string;
  audienceOptions: Record<string, { label: string; description: string }>;
  toneOptions: Record<string, { label: string; description: string }>;
  flavorOptions: Record<string, { label: string; description: string }>;
  imageStyleOptions: Record<string, { label: string; description: string }>;

  // Format toggle
  useEnhancedFormat: boolean;
  onToggleEnhancedFormat: (value: boolean) => void;
  onOpenAudienceEditor?: () => void;

  // Persona
  activePersona?: WriterPersona | null;

  // Presets
  presets: Preset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: Preset) => void;
  onDeletePreset: (name: string) => void;
  onSyncToCloud?: () => Promise<void>;
  onLoadFromCloud?: () => Promise<void>;
  isAuthenticated?: boolean;

  // Prompt of the Day
  promptOfTheDay: PromptOfTheDay | null;
  onSavePromptOfTheDay: (prompt: PromptOfTheDay | null) => void;
  onSavePromptToLibrary?: (prompt: PromptOfTheDay) => Promise<void>;

  // Templates
  templates?: NewsletterTemplate[];
  selectedTemplateId?: string | null;
  onSelectTemplate?: (templateId: string | null) => void;
  onSaveAsTemplate?: (name: string, description: string) => Promise<void>;
  isTemplatesLoading?: boolean;
  hasNewsletterContent?: boolean;

  // Generation
  handleGenerateNewsletter: () => Promise<void>;
  hasSelectedAudience: boolean;
  isLoading: boolean;
  loading: string | null;
  progress: number;
  error: { message: string; onRetry?: () => void } | null;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  selectedTopics,
  selectedAudience,
  selectedTone,
  selectedFlavors,
  selectedImageStyle,
  audienceOptions,
  toneOptions,
  flavorOptions,
  imageStyleOptions,
  useEnhancedFormat,
  onToggleEnhancedFormat,
  onOpenAudienceEditor,
  activePersona,
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
  templates = [],
  selectedTemplateId,
  onSelectTemplate,
  onSaveAsTemplate,
  isTemplatesLoading,
  hasNewsletterContent,
  handleGenerateNewsletter,
  hasSelectedAudience,
  isLoading,
  loading,
  progress,
  error,
}) => {
  // Template save modal state
  const [showTemplateSaveModal, setShowTemplateSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Handle saving current newsletter as template
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || !onSaveAsTemplate) return;

    setIsSavingTemplate(true);
    try {
      await onSaveAsTemplate(newTemplateName.trim(), newTemplateDescription.trim());
      setShowTemplateSaveModal(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
    } catch (err) {
      console.error('[ConfigurationPanel] Failed to save template:', err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const getSelectedLabels = (
    options: Record<string, { label: string }>,
    selected: Record<string, boolean> | string
  ) => {
    if (typeof selected === 'string') {
      return options[selected]?.label || '';
    }
    return Object.keys(selected)
      .filter((key) => selected[key])
      .map((key) => options[key]?.label)
      .filter(Boolean)
      .join(', ');
  };

  const configItems = [
    { label: 'Persona', value: activePersona?.name || '', required: false },
    { label: 'Audience', value: getSelectedLabels(audienceOptions, selectedAudience), required: true },
    { label: 'Topics', value: selectedTopics.length > 0 ? selectedTopics.join(', ') : '', required: true },
    { label: 'Tone', value: getSelectedLabels(toneOptions, selectedTone), required: true },
    { label: 'Flavors', value: getSelectedLabels(flavorOptions, selectedFlavors), required: false },
    { label: 'Image Style', value: getSelectedLabels(imageStyleOptions, selectedImageStyle), required: true },
  ];

  const canGenerate = selectedTopics.length > 0 && hasSelectedAudience && !loading;

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Configuration Summary - Compact */}
        <section>
          <h2 className="font-display text-h4 text-ink mb-4">Configuration</h2>
          <motion.dl
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-3"
          >
            {configItems.map((item) => (
              <motion.div
                key={item.label}
                variants={staggerItem}
                className="flex items-baseline gap-2 border-l-2 border-border-subtle pl-3 py-1"
              >
                <dt className="text-caption text-slate uppercase tracking-wider font-sans min-w-[70px]">
                  {item.label}
                </dt>
                <dd className="font-sans text-ui text-ink flex-1 truncate">
                  {item.value || (
                    <span className={item.required ? 'text-editorial-red' : 'text-silver'}>
                      {item.required ? 'Required' : 'None'}
                    </span>
                  )}
                </dd>
              </motion.div>
            ))}
          </motion.dl>
        </section>

        {/* Newsletter Format Toggle */}
        <section className="border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-sans text-ui font-medium text-ink">Format</p>
              <p className="font-sans text-caption text-slate mt-1 truncate">
                {useEnhancedFormat ? 'Enhanced v2' : 'Classic v1'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {useEnhancedFormat && onOpenAudienceEditor && (
                <button
                  onClick={onOpenAudienceEditor}
                  className="font-sans text-caption text-editorial-red hover:text-ink transition-colors whitespace-nowrap"
                >
                  Audiences
                </button>
              )}
              <button
                onClick={() => onToggleEnhancedFormat(!useEnhancedFormat)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  useEnhancedFormat ? 'bg-editorial-red' : 'bg-silver'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-paper transition-transform ${
                    useEnhancedFormat ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Newsletter Templates */}
        {onSelectTemplate && (
          <section className="border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-sans text-ui font-medium text-ink">Template</p>
              {hasNewsletterContent && onSaveAsTemplate && (
                <button
                  onClick={() => setShowTemplateSaveModal(true)}
                  className="flex items-center gap-1 font-sans text-caption text-editorial-red hover:text-ink transition-colors"
                >
                  <SaveIcon className="h-3.5 w-3.5" />
                  Save as Template
                </button>
              )}
            </div>

            {/* Template Selector */}
            <div className="relative">
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => onSelectTemplate(e.target.value || null)}
                disabled={isTemplatesLoading}
                className="w-full px-3 py-2 bg-paper border border-border-subtle text-ink font-sans text-ui appearance-none cursor-pointer hover:border-slate transition-colors focus:outline-none focus:border-editorial-red disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate pointer-events-none" />
            </div>

            {/* Selected Template Description */}
            {selectedTemplateId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                {templates.find(t => t.id === selectedTemplateId)?.description && (
                  <p className="font-sans text-caption text-slate">
                    {templates.find(t => t.id === selectedTemplateId)?.description}
                  </p>
                )}
              </motion.div>
            )}

            {/* Save Template Modal */}
            <AnimatePresence>
              {showTemplateSaveModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setShowTemplateSaveModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-paper p-6 max-w-md w-full shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-display text-h4 text-ink mb-4">Save as Template</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block font-sans text-caption text-slate mb-1">
                          Template Name *
                        </label>
                        <input
                          type="text"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          placeholder="e.g., Weekly Tech Roundup"
                          className="w-full px-3 py-2 border border-border-subtle bg-paper text-ink font-sans text-ui focus:outline-none focus:border-editorial-red"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-caption text-slate mb-1">
                          Description (optional)
                        </label>
                        <textarea
                          value={newTemplateDescription}
                          onChange={(e) => setNewTemplateDescription(e.target.value)}
                          placeholder="Brief description of this template..."
                          rows={2}
                          className="w-full px-3 py-2 border border-border-subtle bg-paper text-ink font-sans text-ui resize-none focus:outline-none focus:border-editorial-red"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setShowTemplateSaveModal(false)}
                          className="flex-1 px-4 py-2 border border-border-subtle text-ink font-sans text-ui hover:bg-pearl transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveAsTemplate}
                          disabled={!newTemplateName.trim() || isSavingTemplate}
                          className="flex-1 px-4 py-2 bg-editorial-red text-paper font-sans text-ui hover:bg-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingTemplate ? 'Saving...' : 'Save Template'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Presets Manager */}
        <section className="border-t border-border-subtle pt-4">
          <PresetsManager
            presets={presets}
            onSave={onSavePreset}
            onLoad={onLoadPreset}
            onDelete={onDeletePreset}
            onSyncToCloud={onSyncToCloud}
            onLoadFromCloud={onLoadFromCloud}
            isAuthenticated={isAuthenticated}
          />
        </section>

        {/* Prompt of the Day Editor */}
        <section className="border-t border-border-subtle pt-4">
          <PromptOfTheDayEditor
            initialPrompt={promptOfTheDay}
            onSave={onSavePromptOfTheDay}
            onSaveToLibrary={onSavePromptToLibrary}
          />
        </section>

        {/* Generation Progress */}
        <AnimatePresence>
          {loading && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border-subtle pt-4"
            >
              <h3 className="font-display text-h4 text-ink mb-4 text-center">
                Creating Newsletter
              </h3>
              <GenerationProgress progress={progress} message={loading} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-paper border-l-4 border-editorial-red px-4 py-3 flex items-center justify-between gap-4"
              role="alert"
            >
              <div className="min-w-0">
                <p className="font-sans text-ui font-semibold text-ink">Error</p>
                <p className="font-sans text-caption text-charcoal truncate">{error.message}</p>
              </div>
              {error.onRetry && (
                <button
                  onClick={error.onRetry}
                  className="flex items-center gap-1 font-sans text-caption text-editorial-red hover:text-ink transition-colors flex-shrink-0"
                >
                  <RefreshIcon className="h-4 w-4" />
                  <span>Retry</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Footer - Generate Button */}
      <div className="border-t border-border-subtle p-4 bg-paper flex-shrink-0">
        <ActionButton
          onClick={handleGenerateNewsletter}
          idleText="Generate Newsletter"
          loadingText="Generating..."
          successText="Generated!"
          IdleIcon={SparklesIcon}
          variant="primary"
          disabled={!canGenerate}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default ConfigurationPanel;
