/**
 * PersonaABPreview Component
 *
 * Side-by-side comparison modal for writer personas.
 * Generates sample paragraphs in each persona's voice.
 *
 * Phase 12.0: A/B Persona Preview feature
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WriterPersona } from '../types';
import { generatePersonaPreview } from '../services/personaClientService';
import { XIcon, SparklesIcon } from './IconComponents';
import { fadeInUp } from '../utils/animations';

interface PersonaABPreviewProps {
  personas: WriterPersona[];
  currentTopic: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPersona: (persona: WriterPersona) => void;
}

export const PersonaABPreview: React.FC<PersonaABPreviewProps> = ({
  personas,
  currentTopic,
  isOpen,
  onClose,
  onSelectPersona,
}) => {
  const [selectedA, setSelectedA] = useState<WriterPersona | null>(null);
  const [selectedB, setSelectedB] = useState<WriterPersona | null>(null);
  const [previewA, setPreviewA] = useState<string>('');
  const [previewB, setPreviewB] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState(currentTopic || 'AI tools for productivity');

  const handleGeneratePreviews = useCallback(async () => {
    if (!selectedA || !selectedB) {
      setError('Please select two personas to compare');
      return;
    }

    if (!topic.trim()) {
      setError('Please enter a topic for the preview');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPreviewA('');
    setPreviewB('');

    try {
      const [resultA, resultB] = await Promise.all([
        generatePersonaPreview(selectedA.id, topic.trim()),
        generatePersonaPreview(selectedB.id, topic.trim()),
      ]);

      setPreviewA(resultA.preview);
      setPreviewB(resultB.preview);
    } catch (err) {
      console.error('[PersonaABPreview] Error generating previews:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate previews');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedA, selectedB, topic]);

  const handleSelectPersonaA = () => {
    if (selectedA) {
      onSelectPersona(selectedA);
      onClose();
    }
  };

  const handleSelectPersonaB = () => {
    if (selectedB) {
      onSelectPersona(selectedB);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="bg-paper border-2 border-ink max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-ink">
            <div>
              <h2 className="font-display text-h2 text-ink">Compare Personas</h2>
              <p className="font-serif text-body text-slate mt-1">
                See how different personas write about the same topic
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-pearl transition-colors"
            >
              <XIcon className="h-5 w-5 text-ink" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Topic Input */}
            <div>
              <label className="block font-sans text-ui font-medium text-ink mb-2">
                Sample Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic for the preview..."
                className="w-full bg-pearl border border-border-subtle px-4 py-2 font-sans text-body text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            {/* Persona Selectors */}
            <div className="grid grid-cols-2 gap-6">
              {/* Persona A */}
              <div>
                <label className="block font-sans text-ui font-medium text-ink mb-2">
                  Persona A
                </label>
                <select
                  value={selectedA?.id || ''}
                  onChange={(e) => {
                    const persona = personas.find(p => p.id === e.target.value);
                    setSelectedA(persona || null);
                  }}
                  className="w-full bg-pearl border border-border-subtle px-4 py-2 font-sans text-body text-ink focus:outline-none focus:border-ink transition-colors"
                >
                  <option value="">Select persona...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.id === selectedB?.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selectedA && (
                  <p className="font-serif text-caption text-slate mt-2 italic">
                    {selectedA.tagline || selectedA.writingStyle}
                  </p>
                )}
              </div>

              {/* Persona B */}
              <div>
                <label className="block font-sans text-ui font-medium text-ink mb-2">
                  Persona B
                </label>
                <select
                  value={selectedB?.id || ''}
                  onChange={(e) => {
                    const persona = personas.find(p => p.id === e.target.value);
                    setSelectedB(persona || null);
                  }}
                  className="w-full bg-pearl border border-border-subtle px-4 py-2 font-sans text-body text-ink focus:outline-none focus:border-ink transition-colors"
                >
                  <option value="">Select persona...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.id === selectedA?.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selectedB && (
                  <p className="font-serif text-caption text-slate mt-2 italic">
                    {selectedB.tagline || selectedB.writingStyle}
                  </p>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-center">
              <button
                onClick={handleGeneratePreviews}
                disabled={!selectedA || !selectedB || isGenerating}
                className="flex items-center gap-2 bg-editorial-red text-paper font-sans text-ui px-6 py-3 hover:bg-red-700 transition-colors disabled:bg-silver disabled:cursor-not-allowed"
              >
                <SparklesIcon className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate Previews'}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-editorial-red text-editorial-red font-sans text-ui">
                {error}
              </div>
            )}

            {/* Preview Results */}
            {(previewA || previewB) && (
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border-subtle">
                {/* Preview A */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans text-ui font-medium text-ink">
                      {selectedA?.name}
                    </h3>
                    <button
                      onClick={handleSelectPersonaA}
                      className="font-sans text-caption text-editorial-navy hover:underline"
                    >
                      Use This Persona
                    </button>
                  </div>
                  <div className="p-4 bg-pearl border border-border-subtle">
                    <p className="font-serif text-body text-charcoal leading-relaxed">
                      {previewA || 'Generating...'}
                    </p>
                  </div>
                </div>

                {/* Preview B */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans text-ui font-medium text-ink">
                      {selectedB?.name}
                    </h3>
                    <button
                      onClick={handleSelectPersonaB}
                      className="font-sans text-caption text-editorial-navy hover:underline"
                    >
                      Use This Persona
                    </button>
                  </div>
                  <div className="p-4 bg-pearl border border-border-subtle">
                    <p className="font-serif text-body text-charcoal leading-relaxed">
                      {previewB || 'Generating...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-border-subtle">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-ink text-ink font-sans text-ui hover:bg-pearl transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PersonaABPreview;
