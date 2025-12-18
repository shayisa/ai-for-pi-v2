/**
 * BulkImageRegeneration Component
 *
 * Modal for regenerating multiple section images at once.
 * Shows progress and allows selective regeneration.
 *
 * Phase 12.0: Bulk image regeneration feature
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, SparklesIcon, CheckIcon } from './IconComponents';
import { Spinner } from './Spinner';
import { generateImage } from '../services/claudeService';
import { fadeInUp } from '../utils/animations';

interface SectionWithImage {
  title: string;
  imagePrompt?: string;
  imageUrl?: string;
}

interface BulkImageRegenerationProps {
  sections: SectionWithImage[];
  imageStyle: string;
  onComplete: (updatedSections: SectionWithImage[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

type RegenerationStatus = 'pending' | 'generating' | 'success' | 'error';

export const BulkImageRegeneration: React.FC<BulkImageRegenerationProps> = ({
  sections,
  imageStyle,
  onComplete,
  isOpen,
  onClose,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statuses, setStatuses] = useState<Map<number, RegenerationStatus>>(new Map());

  // Get sections that have image prompts
  const sectionsWithPrompts = sections
    .map((s, i) => ({ ...s, index: i }))
    .filter(s => s.imagePrompt);

  const handleSelectAll = useCallback(() => {
    const allIndices = new Set(sectionsWithPrompts.map(s => s.index));
    setSelectedIndices(allIndices);
  }, [sectionsWithPrompts]);

  const handleSelectNone = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleToggleSection = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleRegenerate = useCallback(async () => {
    const indices = Array.from(selectedIndices);
    if (indices.length === 0) return;

    setIsRegenerating(true);
    setProgress({ current: 0, total: indices.length });
    setStatuses(new Map(indices.map(i => [i, 'pending' as RegenerationStatus])));

    const updatedSections = [...sections];

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const prompt = sections[idx].imagePrompt;

      if (!prompt) continue;

      // Mark as generating
      setStatuses(prev => new Map(prev).set(idx, 'generating'));

      try {
        const base64 = await generateImage(prompt, imageStyle);
        updatedSections[idx] = {
          ...updatedSections[idx],
          imageUrl: base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
        };
        setStatuses(prev => new Map(prev).set(idx, 'success'));
      } catch (error) {
        console.error(`[BulkRegeneration] Failed to regenerate image for section ${idx}:`, error);
        setStatuses(prev => new Map(prev).set(idx, 'error'));
      }

      setProgress({ current: i + 1, total: indices.length });
    }

    setIsRegenerating(false);
    onComplete(updatedSections);
  }, [selectedIndices, sections, imageStyle, onComplete]);

  const handleClose = useCallback(() => {
    if (!isRegenerating) {
      setSelectedIndices(new Set());
      setStatuses(new Map());
      setProgress({ current: 0, total: 0 });
      onClose();
    }
  }, [isRegenerating, onClose]);

  if (!isOpen) return null;

  const successCount = Array.from(statuses.values()).filter(s => s === 'success').length;
  const errorCount = Array.from(statuses.values()).filter(s => s === 'error').length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="bg-paper border-2 border-ink max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-ink">
            <div>
              <h2 className="font-display text-h2 text-ink">Regenerate Images</h2>
              <p className="font-serif text-body text-slate mt-1">
                Select sections to regenerate their images
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isRegenerating}
              className="p-2 hover:bg-pearl transition-colors disabled:opacity-50"
            >
              <XIcon className="h-5 w-5 text-ink" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Selection Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSelectAll}
                disabled={isRegenerating}
                className="font-sans text-ui text-editorial-navy hover:underline disabled:opacity-50"
              >
                Select All ({sectionsWithPrompts.length})
              </button>
              <button
                onClick={handleSelectNone}
                disabled={isRegenerating}
                className="font-sans text-ui text-slate hover:underline disabled:opacity-50"
              >
                Select None
              </button>
              <span className="font-sans text-caption text-slate ml-auto">
                {selectedIndices.size} selected
              </span>
            </div>

            {/* Section List */}
            <div className="space-y-2">
              {sectionsWithPrompts.map(({ title, imagePrompt, index }) => {
                const status = statuses.get(index);
                const isSelected = selectedIndices.has(index);

                return (
                  <div
                    key={index}
                    className={`
                      flex items-center gap-3 p-4 border transition-colors
                      ${isSelected ? 'border-ink bg-pearl' : 'border-border-subtle bg-paper'}
                      ${isRegenerating ? 'cursor-default' : 'cursor-pointer'}
                    `}
                    onClick={() => !isRegenerating && handleToggleSection(index)}
                  >
                    {/* Checkbox */}
                    <div className={`
                      w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'border-ink bg-ink' : 'border-border-subtle'}
                    `}>
                      {isSelected && <CheckIcon className="h-3 w-3 text-paper" />}
                    </div>

                    {/* Section Info */}
                    <div className="flex-grow min-w-0">
                      <p className="font-sans text-ui font-medium text-ink truncate">{title}</p>
                      <p className="font-sans text-caption text-slate truncate">{imagePrompt}</p>
                    </div>

                    {/* Status Indicator */}
                    {status && (
                      <div className="flex-shrink-0">
                        {status === 'generating' && <Spinner />}
                        {status === 'success' && (
                          <span className="text-green-600 font-sans text-caption">Done</span>
                        )}
                        {status === 'error' && (
                          <span className="text-editorial-red font-sans text-caption">Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            {isRegenerating && (
              <div className="space-y-2">
                <div className="h-2 bg-pearl overflow-hidden">
                  <motion.div
                    className="h-full bg-editorial-red"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="font-sans text-caption text-slate text-center">
                  Regenerating {progress.current} of {progress.total} images...
                </p>
              </div>
            )}

            {/* Results Summary */}
            {!isRegenerating && (successCount > 0 || errorCount > 0) && (
              <div className="p-4 bg-pearl border border-border-subtle">
                <p className="font-sans text-ui">
                  <span className="text-green-600">{successCount} succeeded</span>
                  {errorCount > 0 && (
                    <span className="text-editorial-red ml-3">{errorCount} failed</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-border-subtle">
            <button
              onClick={handleClose}
              disabled={isRegenerating}
              className="px-4 py-2 border border-ink text-ink font-sans text-ui hover:bg-pearl transition-colors disabled:opacity-50"
            >
              {successCount > 0 || errorCount > 0 ? 'Done' : 'Cancel'}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={selectedIndices.size === 0 || isRegenerating}
              className="flex items-center gap-2 bg-editorial-red text-paper font-sans text-ui px-6 py-2 hover:bg-red-700 transition-colors disabled:bg-silver disabled:cursor-not-allowed"
            >
              <SparklesIcon className="h-4 w-4" />
              {isRegenerating ? 'Regenerating...' : `Regenerate ${selectedIndices.size} Images`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BulkImageRegeneration;
