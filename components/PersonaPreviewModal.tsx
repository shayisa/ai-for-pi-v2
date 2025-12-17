/**
 * PersonaPreviewModal - A/B Persona Comparison
 *
 * Side-by-side comparison of writing samples from different personas
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WriterPersona } from '../types';
import * as previewApi from '../services/previewClientService';

interface PersonaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: WriterPersona[];
  selectedTone: string;
  onSelectPersona: (personaId: string) => void;
}

export const PersonaPreviewModal: React.FC<PersonaPreviewModalProps> = ({
  isOpen,
  onClose,
  personas,
  selectedTone,
  onSelectPersona,
}) => {
  const [topic, setTopic] = useState('');
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [previews, setPreviews] = useState<previewApi.PersonaPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTogglePersona = (personaId: string) => {
    setSelectedPersonaIds(prev => {
      if (prev.includes(personaId)) {
        return prev.filter(id => id !== personaId);
      }
      // Limit to 4 personas
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, personaId];
    });
  };

  const handleGeneratePreviews = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }
    if (selectedPersonaIds.length < 2) {
      setError('Please select at least 2 personas to compare');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await previewApi.getPersonaPreviews(
        topic,
        selectedPersonaIds,
        selectedTone
      );
      setPreviews(response.previews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate previews');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAndClose = (personaId: string) => {
    onSelectPersona(personaId);
    onClose();
  };

  const handleClose = () => {
    setTopic('');
    setSelectedPersonaIds([]);
    setPreviews([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-pearl border border-stone rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-stone p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl text-ink">Compare Personas</h2>
                <p className="font-serif text-body-sm text-slate mt-1">
                  See how different personas write about the same topic
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-slate hover:text-ink transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Topic Input */}
            <div className="mb-6">
              <label className="block font-sans text-caption text-charcoal mb-2">
                Enter a topic to compare
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., The future of AI in healthcare"
                className="w-full px-4 py-3 border border-stone rounded-lg font-serif text-body focus:outline-none focus:ring-2 focus:ring-ink/20"
              />
            </div>

            {/* Persona Selection */}
            <div className="mb-6">
              <label className="block font-sans text-caption text-charcoal mb-2">
                Select personas to compare (2-4)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {personas.map(persona => (
                  <button
                    key={persona.id}
                    onClick={() => handleTogglePersona(persona.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedPersonaIds.includes(persona.id)
                        ? 'border-ink bg-ink/5'
                        : 'border-stone hover:border-slate'
                    } ${
                      selectedPersonaIds.length >= 4 && !selectedPersonaIds.includes(persona.id)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    disabled={selectedPersonaIds.length >= 4 && !selectedPersonaIds.includes(persona.id)}
                  >
                    <p className="font-sans text-body-sm font-medium text-ink truncate">
                      {persona.name}
                    </p>
                    {persona.tagline && (
                      <p className="font-serif text-caption text-slate truncate mt-0.5">
                        {persona.tagline}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              <p className="font-sans text-caption text-slate mt-2">
                {selectedPersonaIds.length} of 4 selected
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-sans text-body-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <div className="mb-6">
              <button
                onClick={handleGeneratePreviews}
                disabled={isLoading || selectedPersonaIds.length < 2 || !topic.trim()}
                className={`px-6 py-3 font-sans text-body font-medium rounded-lg transition-colors ${
                  isLoading || selectedPersonaIds.length < 2 || !topic.trim()
                    ? 'bg-stone text-slate cursor-not-allowed'
                    : 'bg-ink text-pearl hover:bg-charcoal'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Generate Previews'
                )}
              </button>
            </div>

            {/* Preview Results */}
            {previews.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-sans text-caption text-charcoal uppercase tracking-wide">
                  Preview Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previews.map(preview => (
                    <motion.div
                      key={preview.personaId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 border border-stone rounded-lg bg-white"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-sans text-body font-semibold text-ink">
                          {preview.personaName}
                        </h4>
                        <button
                          onClick={() => handleSelectAndClose(preview.personaId)}
                          className="px-3 py-1 font-sans text-caption text-ink border border-ink rounded hover:bg-ink hover:text-pearl transition-colors"
                        >
                          Use This
                        </button>
                      </div>
                      <p className="font-serif text-body text-ink leading-relaxed">
                        {preview.sample}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-stone p-4 flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 font-sans text-body-sm text-charcoal hover:text-ink transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
