/**
 * Audience Config Editor Component
 *
 * Allows users to view, create, and manage custom audiences
 * with AI-generated configuration.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AudienceConfig } from '../types';
import { generateAudienceConfig } from '../services/enhancedNewsletterService';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';
import { SparklesIcon, PlusIcon, XIcon } from './IconComponents';

interface AudienceConfigEditorProps {
  defaultAudiences: AudienceConfig[];
  customAudiences: AudienceConfig[];
  onAddAudience: (audience: AudienceConfig) => void;
  onRemoveAudience: (audienceId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AudienceConfigEditor: React.FC<AudienceConfigEditorProps> = ({
  defaultAudiences,
  customAudiences,
  onAddAudience,
  onRemoveAudience,
  isOpen,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newAudienceName, setNewAudienceName] = useState('');
  const [newAudienceDescription, setNewAudienceDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<AudienceConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateConfig = async () => {
    if (!newAudienceName.trim() || !newAudienceDescription.trim()) {
      setError('Please provide both name and description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await generateAudienceConfig(
        newAudienceName.trim(),
        newAudienceDescription.trim()
      );

      setGeneratedConfig({
        ...response.config,
        isCustom: true,
      });
    } catch (err) {
      console.error('Failed to generate audience config:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate configuration');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAudience = () => {
    if (generatedConfig) {
      onAddAudience(generatedConfig);
      // Reset form
      setNewAudienceName('');
      setNewAudienceDescription('');
      setGeneratedConfig(null);
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setNewAudienceName('');
    setNewAudienceDescription('');
    setGeneratedConfig(null);
    setError(null);
    setIsCreating(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="relative bg-paper w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4 shadow-editorial"
      >
        {/* Header */}
        <div className="sticky top-0 bg-paper border-b border-border-subtle px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-h3 text-ink">Manage Audiences</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-pearl transition-colors"
          >
            <XIcon className="h-5 w-5 text-slate" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Default Audiences */}
          <section>
            <h3 className="font-sans text-overline text-slate uppercase tracking-widest mb-4">
              Default Audiences
            </h3>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {defaultAudiences.map((audience) => (
                <motion.div
                  key={audience.id}
                  variants={staggerItem}
                  className="border border-border-subtle p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-sans text-ui font-medium text-ink">
                        {audience.name}
                      </p>
                      <p className="font-sans text-caption text-slate mt-1">
                        {audience.description}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-pearl text-slate text-xs font-sans">
                      Default
                    </span>
                  </div>
                  {audience.generated && (
                    <div className="mt-3 pt-3 border-t border-border-subtle">
                      <p className="font-sans text-xs text-slate italic">
                        {audience.generated.persona}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {audience.generated.relevance_keywords?.slice(0, 5).map((kw) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 bg-pearl text-charcoal text-xs font-sans"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* Custom Audiences */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans text-overline text-slate uppercase tracking-widest">
                Custom Audiences
              </h3>
              {!isCreating && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1.5 font-sans text-ui text-editorial-red hover:text-ink transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Add New</span>
                </button>
              )}
            </div>

            {/* Custom Audience List */}
            {customAudiences.length > 0 && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-3 mb-6"
              >
                {customAudiences.map((audience) => (
                  <motion.div
                    key={audience.id}
                    variants={staggerItem}
                    className="border border-editorial-red/30 bg-editorial-red/5 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-sans text-ui font-medium text-ink">
                          {audience.name}
                        </p>
                        <p className="font-sans text-caption text-slate mt-1">
                          {audience.description}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveAudience(audience.id)}
                        className="p-1 hover:bg-editorial-red/20 transition-colors"
                        title="Remove audience"
                      >
                        <XIcon className="h-4 w-4 text-editorial-red" />
                      </button>
                    </div>
                    {audience.generated && (
                      <div className="mt-3 pt-3 border-t border-editorial-red/20">
                        <p className="font-sans text-xs text-slate italic">
                          {audience.generated.persona}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {audience.generated.relevance_keywords?.slice(0, 5).map((kw) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 bg-editorial-red/10 text-charcoal text-xs font-sans"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {customAudiences.length === 0 && !isCreating && (
              <p className="font-sans text-ui text-slate text-center py-8 border border-dashed border-border-subtle">
                No custom audiences yet. Add one to personalize your newsletters.
              </p>
            )}

            {/* Create New Audience Form */}
            <AnimatePresence>
              {isCreating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border border-ink p-6"
                >
                  <h4 className="font-sans text-ui font-medium text-ink mb-4">
                    Create New Audience
                  </h4>

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block font-sans text-caption text-slate mb-1">
                        Audience Name
                      </label>
                      <input
                        type="text"
                        value={newAudienceName}
                        onChange={(e) => setNewAudienceName(e.target.value)}
                        placeholder="e.g., Healthcare Professionals"
                        className="w-full border border-border-subtle px-4 py-2 font-sans text-ui focus:outline-none focus:border-ink"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block font-sans text-caption text-slate mb-1">
                        Description
                      </label>
                      <textarea
                        value={newAudienceDescription}
                        onChange={(e) => setNewAudienceDescription(e.target.value)}
                        placeholder="Describe who this audience is and what they're interested in..."
                        rows={3}
                        className="w-full border border-border-subtle px-4 py-2 font-sans text-ui focus:outline-none focus:border-ink resize-none"
                      />
                    </div>

                    {/* Error */}
                    {error && (
                      <p className="font-sans text-ui text-editorial-red">{error}</p>
                    )}

                    {/* Generate Button */}
                    {!generatedConfig && (
                      <div className="flex gap-3">
                        <button
                          onClick={handleGenerateConfig}
                          disabled={isGenerating || !newAudienceName.trim() || !newAudienceDescription.trim()}
                          className="flex items-center gap-2 bg-ink text-paper font-sans text-ui py-2 px-4 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
                        >
                          <SparklesIcon className="h-4 w-4" />
                          <span>{isGenerating ? 'Generating...' : 'Generate Config'}</span>
                        </button>
                        <button
                          onClick={handleCancel}
                          className="font-sans text-ui text-slate hover:text-ink transition-colors py-2 px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Generated Config Preview */}
                    {generatedConfig && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-pearl p-4 space-y-3"
                      >
                        <p className="font-sans text-overline text-slate uppercase tracking-widest">
                          Generated Configuration
                        </p>

                        <div>
                          <p className="font-sans text-xs text-slate mb-1">Persona</p>
                          <p className="font-serif text-ui text-charcoal italic">
                            {generatedConfig.generated?.persona}
                          </p>
                        </div>

                        <div>
                          <p className="font-sans text-xs text-slate mb-1">Keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {generatedConfig.generated?.relevance_keywords?.map((kw) => (
                              <span
                                key={kw}
                                className="px-2 py-0.5 bg-paper text-charcoal text-xs font-sans"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>

                        {generatedConfig.generated?.subreddits &&
                          generatedConfig.generated.subreddits.length > 0 && (
                            <div>
                              <p className="font-sans text-xs text-slate mb-1">Subreddits</p>
                              <div className="flex flex-wrap gap-1">
                                {generatedConfig.generated.subreddits.map((sub) => (
                                  <span
                                    key={sub}
                                    className="px-2 py-0.5 bg-paper text-charcoal text-xs font-sans"
                                  >
                                    r/{sub}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        <div className="flex gap-3 pt-3 border-t border-border-subtle">
                          <button
                            onClick={handleSaveAudience}
                            className="bg-editorial-red text-paper font-sans text-ui py-2 px-4 hover:bg-red-700 transition-colors"
                          >
                            Save Audience
                          </button>
                          <button
                            onClick={handleCancel}
                            className="font-sans text-ui text-slate hover:text-ink transition-colors py-2 px-4"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

export default AudienceConfigEditor;
