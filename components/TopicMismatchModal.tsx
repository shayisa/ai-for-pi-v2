/**
 * TopicMismatchModal
 *
 * Phase 16: Topic-Audience Mismatch Resolution
 *
 * Modal for handling topics that were generated for audiences not currently selected.
 * User can choose to reassign the topic to a different audience or generate a fresh topic.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, AlertIcon, ArrowRightIcon, RefreshIcon } from './IconComponents';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';
import type {
  TopicWithAudienceId,
  AudienceConfig,
  MismatchResolution,
  MismatchResolutionAction,
  MismatchInfo,
} from '../types';

interface TopicMismatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (resolutions: MismatchResolution[]) => void;
  mismatches: MismatchInfo[];
  selectedAudiences: AudienceConfig[];
}

export const TopicMismatchModal: React.FC<TopicMismatchModalProps> = ({
  isOpen,
  onClose,
  onResolve,
  mismatches,
  selectedAudiences,
}) => {
  // Track resolutions for each mismatch
  const [resolutions, setResolutions] = useState<Map<string, MismatchResolution>>(new Map());
  const [globalAction, setGlobalAction] = useState<MismatchResolutionAction>('reassign');

  console.log('[TopicMismatchModal] Render', {
    isOpen,
    mismatchCount: mismatches.length,
    resolvedCount: resolutions.size,
  });

  // Handle resolution for a single topic
  const handleResolution = (
    topic: TopicWithAudienceId,
    action: MismatchResolutionAction,
    targetAudienceId?: string
  ) => {
    console.log('[TopicMismatchModal] handleResolution', {
      topic: topic.title,
      action,
      targetAudienceId,
    });

    const newResolutions = new Map(resolutions);
    newResolutions.set(topic.title, {
      topic,
      action,
      targetAudienceId,
    });
    setResolutions(newResolutions);
  };

  // Handle apply to all
  const handleApplyToAll = () => {
    console.log('[TopicMismatchModal] handleApplyToAll', { globalAction });

    const newResolutions = new Map<string, MismatchResolution>();

    for (const mismatch of mismatches) {
      if (globalAction === 'reassign' && mismatch.suggestedAudienceId) {
        newResolutions.set(mismatch.topic.title, {
          topic: mismatch.topic,
          action: 'reassign',
          targetAudienceId: mismatch.suggestedAudienceId,
          applyToAll: true,
        });
      } else if (globalAction === 'generate_fresh') {
        newResolutions.set(mismatch.topic.title, {
          topic: mismatch.topic,
          action: 'generate_fresh',
          applyToAll: true,
        });
      } else if (globalAction === 'skip') {
        newResolutions.set(mismatch.topic.title, {
          topic: mismatch.topic,
          action: 'skip',
          applyToAll: true,
        });
      }
    }

    setResolutions(newResolutions);
  };

  // Handle confirm
  const handleConfirm = () => {
    const resolvedList = Array.from(resolutions.values());
    console.log('[TopicMismatchModal] handleConfirm', {
      resolutionCount: resolvedList.length,
    });
    onResolve(resolvedList);
    onClose();
  };

  // Check if all mismatches are resolved
  const allResolved = mismatches.every((m) => resolutions.has(m.topic.title));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={modalOverlay}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-slate-900 border border-slate-700 shadow-2xl"
          variants={modalContent}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertIcon className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Topic-Audience Mismatch
                </h2>
                <p className="text-sm text-slate-400">
                  {mismatches.length} topic{mismatches.length !== 1 ? 's' : ''} generated for non-selected audiences
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
            {/* Apply to all option */}
            {mismatches.length > 1 && (
              <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">
                    Apply same action to all mismatches
                  </span>
                  <button
                    onClick={handleApplyToAll}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Apply to All
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGlobalAction('reassign')}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      globalAction === 'reassign'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => setGlobalAction('generate_fresh')}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      globalAction === 'generate_fresh'
                        ? 'bg-green-600/20 border-green-500 text-green-400'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    Generate Fresh
                  </button>
                  <button
                    onClick={() => setGlobalAction('skip')}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      globalAction === 'skip'
                        ? 'bg-red-600/20 border-red-500 text-red-400'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}

            {/* Individual mismatches */}
            <motion.div
              className="space-y-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {mismatches.map((mismatch) => {
                const resolution = resolutions.get(mismatch.topic.title);
                const isResolved = !!resolution;

                return (
                  <motion.div
                    key={mismatch.topic.title}
                    variants={staggerItem}
                    className={`p-4 rounded-lg border transition-colors ${
                      isResolved
                        ? 'bg-slate-800/30 border-slate-600'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    {/* Topic info */}
                    <div className="mb-3">
                      <h3 className="text-sm font-medium text-white truncate">
                        {mismatch.topic.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-700">
                          {mismatch.originalAudienceName}
                        </span>
                        <span>not selected</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2">
                      {/* Reassign option */}
                      {mismatch.sameCategoryOptions.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleResolution(
                                mismatch.topic,
                                'reassign',
                                mismatch.suggestedAudienceId || undefined
                              )
                            }
                            className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                              resolution?.action === 'reassign'
                                ? 'bg-blue-600/20 border-blue-500'
                                : 'bg-slate-700/50 border-slate-600 hover:border-blue-500'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <ArrowRightIcon className="w-4 h-4 text-blue-400" />
                              <span className="text-sm text-slate-200">
                                Reassign to
                              </span>
                            </div>
                            <select
                              className="px-2 py-1 text-xs rounded bg-slate-700 border border-slate-600 text-slate-200"
                              value={resolution?.targetAudienceId || mismatch.suggestedAudienceId || ''}
                              onChange={(e) =>
                                handleResolution(mismatch.topic, 'reassign', e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              {mismatch.sameCategoryOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                              {/* Also include all selected audiences */}
                              {selectedAudiences
                                .filter(
                                  (a) =>
                                    !mismatch.sameCategoryOptions.find((o) => o.id === a.id)
                                )
                                .map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name} (different category)
                                  </option>
                                ))}
                            </select>
                          </button>
                        </div>
                      )}

                      {/* Generate fresh option */}
                      <button
                        onClick={() => handleResolution(mismatch.topic, 'generate_fresh')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          resolution?.action === 'generate_fresh'
                            ? 'bg-green-600/20 border-green-500'
                            : 'bg-slate-700/50 border-slate-600 hover:border-green-500'
                        }`}
                      >
                        <RefreshIcon className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-slate-200">
                          Discard and generate fresh topic
                        </span>
                      </button>

                      {/* Skip option */}
                      <button
                        onClick={() => handleResolution(mismatch.topic, 'skip')}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          resolution?.action === 'skip'
                            ? 'bg-red-600/20 border-red-500'
                            : 'bg-slate-700/50 border-slate-600 hover:border-red-500'
                        }`}
                      >
                        <XIcon className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-slate-200">
                          Skip this topic
                        </span>
                      </button>
                    </div>

                    {/* Resolution indicator */}
                    {isResolved && (
                      <div className="mt-2 text-xs text-green-400">
                        Resolved: {resolution.action === 'reassign' ? `Reassign to ${resolution.targetAudienceId}` : resolution.action}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <div className="text-sm text-slate-400">
              {resolutions.size} of {mismatches.length} resolved
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!allResolved}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  allResolved
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Confirm & Continue
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TopicMismatchModal;
