/**
 * PersonaEditor Modal
 * Create or edit custom writer personas
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './IconComponents';
import { modalOverlay, modalContent } from '../utils/animations';
import type { WriterPersona } from '../types';

interface PersonaEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (persona: {
    name: string;
    tagline?: string;
    expertise?: string;
    values?: string;
    writingStyle?: string;
    signatureElements?: string[];
    sampleWriting?: string;
  }) => Promise<void>;
  editingPersona?: WriterPersona | null;
}

export const PersonaEditor: React.FC<PersonaEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPersona,
}) => {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [expertise, setExpertise] = useState('');
  const [values, setValues] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [signatureElements, setSignatureElements] = useState('');
  const [sampleWriting, setSampleWriting] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when editing
  useEffect(() => {
    if (editingPersona) {
      setName(editingPersona.name);
      setTagline(editingPersona.tagline || '');
      setExpertise(editingPersona.expertise || '');
      setValues(editingPersona.values || '');
      setWritingStyle(editingPersona.writingStyle || '');
      setSignatureElements(editingPersona.signatureElements?.join('\n') || '');
      setSampleWriting(editingPersona.sampleWriting || '');
    } else {
      // Reset fields for new persona
      setName('');
      setTagline('');
      setExpertise('');
      setValues('');
      setWritingStyle('');
      setSignatureElements('');
      setSampleWriting('');
    }
    setError(null);
  }, [editingPersona, isOpen]);

  // Handle escape key and body overflow
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        expertise: expertise.trim() || undefined,
        values: values.trim() || undefined,
        writingStyle: writingStyle.trim() || undefined,
        signatureElements: signatureElements.trim()
          ? signatureElements.split('\n').map((s) => s.trim()).filter(Boolean)
          : undefined,
        sampleWriting: sampleWriting.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save persona');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={modalOverlay}
          onClick={onClose}
        >
          <motion.div
            className="bg-paper w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-editorial mx-4"
            variants={modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-paper border-b border-border-subtle px-6 py-4 flex items-center justify-between">
              <h2 className="font-serif text-headline text-ink">
                {editingPersona ? 'Edit Persona' : 'Create New Persona'}
              </h2>
              <button
                onClick={onClose}
                className="text-slate hover:text-ink transition-colors p-1"
                aria-label="Close"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {error && (
                <div className="bg-editorial-red/10 border border-editorial-red text-editorial-red px-4 py-2 font-sans text-ui">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label htmlFor="persona-name" className="block font-sans text-ui font-medium text-ink mb-2">
                  Name <span className="text-editorial-red">*</span>
                </label>
                <input
                  type="text"
                  id="persona-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., The Visionary"
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
                />
              </div>

              {/* Tagline */}
              <div>
                <label htmlFor="persona-tagline" className="block font-sans text-ui font-medium text-ink mb-2">
                  Tagline
                </label>
                <input
                  type="text"
                  id="persona-tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g., Seeing tomorrow's possibilities today"
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors"
                />
                <p className="font-sans text-caption text-slate mt-1">A short phrase capturing the persona's essence</p>
              </div>

              {/* Expertise */}
              <div>
                <label htmlFor="persona-expertise" className="block font-sans text-ui font-medium text-ink mb-2">
                  Expertise
                </label>
                <textarea
                  id="persona-expertise"
                  value={expertise}
                  onChange={(e) => setExpertise(e.target.value)}
                  placeholder="e.g., Emerging technologies, market disruption, innovation strategy"
                  rows={2}
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors resize-none"
                />
                <p className="font-sans text-caption text-slate mt-1">Areas of knowledge this persona draws from</p>
              </div>

              {/* Values */}
              <div>
                <label htmlFor="persona-values" className="block font-sans text-ui font-medium text-ink mb-2">
                  Values
                </label>
                <textarea
                  id="persona-values"
                  value={values}
                  onChange={(e) => setValues(e.target.value)}
                  placeholder="e.g., Forward-thinking, ambitious, embracing change, calculated risk-taking"
                  rows={2}
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors resize-none"
                />
                <p className="font-sans text-caption text-slate mt-1">Core beliefs and worldview that guide the writing</p>
              </div>

              {/* Writing Style */}
              <div>
                <label htmlFor="persona-style" className="block font-sans text-ui font-medium text-ink mb-2">
                  Writing Style
                </label>
                <textarea
                  id="persona-style"
                  value={writingStyle}
                  onChange={(e) => setWritingStyle(e.target.value)}
                  placeholder="e.g., Bold and confident. Uses future tense often. Paints vivid pictures of possibilities. Short, punchy sentences for emphasis."
                  rows={3}
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors resize-none"
                />
                <p className="font-sans text-caption text-slate mt-1">How this persona constructs sentences and paragraphs</p>
              </div>

              {/* Signature Elements */}
              <div>
                <label htmlFor="persona-signatures" className="block font-sans text-ui font-medium text-ink mb-2">
                  Signature Elements
                </label>
                <textarea
                  id="persona-signatures"
                  value={signatureElements}
                  onChange={(e) => setSignatureElements(e.target.value)}
                  placeholder={"Imagine this:\nThe future is:\nHere's what's coming:\nMark my words:"}
                  rows={4}
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors resize-none"
                />
                <p className="font-sans text-caption text-slate mt-1">Catchphrases or recurring patterns (one per line)</p>
              </div>

              {/* Sample Writing */}
              <div>
                <label htmlFor="persona-sample" className="block font-sans text-ui font-medium text-ink mb-2">
                  Sample Writing
                </label>
                <textarea
                  id="persona-sample"
                  value={sampleWriting}
                  onChange={(e) => setSampleWriting(e.target.value)}
                  placeholder="Write 2-3 paragraphs demonstrating this persona's voice. This helps the AI learn the writing patterns..."
                  rows={6}
                  className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors resize-none"
                />
                <p className="font-sans text-caption text-slate mt-1">An example of how this persona writes (helps AI learn the voice)</p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-paper border-t border-border-subtle px-6 py-4 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="font-sans text-ui text-slate hover:text-ink px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
                className="bg-ink text-paper font-sans text-ui px-6 py-2 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : editingPersona ? 'Update Persona' : 'Create Persona'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PersonaEditor;
