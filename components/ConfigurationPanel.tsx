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

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Preset, PromptOfTheDay, WriterPersona } from '../types';
import { PresetsManager } from './PresetsManager';
import { PromptOfTheDayEditor } from './PromptOfTheDayEditor';
import { GenerationProgress } from './GenerationProgress';
import { ActionButton } from './ActionButton';
import { SparklesIcon, RefreshIcon } from './IconComponents';
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
  handleGenerateNewsletter,
  hasSelectedAudience,
  isLoading,
  loading,
  progress,
  error,
}) => {
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
