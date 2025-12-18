/**
 * SavedPromptsList Component
 *
 * Displays the saved prompts library with:
 * - List of saved prompts
 * - Load prompt into editor
 * - Delete prompt with confirmation
 * - Empty state
 * - Phase 9c: Usage count showing which newsletters used each prompt
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SavedPrompt } from '../services/promptClientService';
import { getNewslettersBySavedPromptId } from '../services/newsletterClientService';
import { TrashIcon, CodeIcon } from './IconComponents';
import { ConfirmationDialog } from './ConfirmationDialog';
import { staggerContainer, staggerItem } from '../utils/animations';

interface SavedPromptsListProps {
  prompts: SavedPrompt[];
  onDelete: (id: string) => Promise<void>;
  onLoad: (prompt: SavedPrompt) => void;
  isLoading: boolean;
}

export const SavedPromptsList: React.FC<SavedPromptsListProps> = ({
  prompts,
  onDelete,
  onLoad,
  isLoading,
}) => {
  const [promptToDelete, setPromptToDelete] = useState<SavedPrompt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Phase 9c: Track usage counts for each prompt
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  // Phase 9c: Fetch usage counts when prompts change
  useEffect(() => {
    const fetchUsageCounts = async () => {
      if (prompts.length === 0) return;

      setIsLoadingUsage(true);
      const counts: Record<string, number> = {};

      // Fetch usage counts in parallel (max 5 concurrent)
      const batchSize = 5;
      for (let i = 0; i < prompts.length; i += batchSize) {
        const batch = prompts.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (prompt) => {
            try {
              const result = await getNewslettersBySavedPromptId(prompt.id);
              counts[prompt.id] = result.count;
            } catch {
              counts[prompt.id] = 0;
            }
          })
        );
      }

      setUsageCounts(counts);
      setIsLoadingUsage(false);
    };

    fetchUsageCounts();
  }, [prompts]);

  const handleConfirmDelete = async () => {
    if (!promptToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(promptToDelete.id);
      setPromptToDelete(null);
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-paper border border-border-subtle p-12 text-center">
        <div className="animate-spin h-6 w-6 border-2 border-ink border-t-transparent rounded-full mx-auto mb-3" />
        <p className="font-sans text-ui text-slate">Loading prompts...</p>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="bg-paper border border-border-subtle p-12 text-center">
        <CodeIcon className="h-10 w-10 text-silver mx-auto mb-3" />
        <p className="font-sans text-ui text-slate">No saved prompts yet.</p>
        <p className="font-sans text-caption text-silver mt-1">
          Save prompts from the Prompt of the Day editor to reuse them.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-paper border border-border-subtle">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-subtle">
          <div>
            <h3 className="font-display text-h4 text-ink">Saved Prompts</h3>
            <p className="font-sans text-caption text-slate mt-1">
              {prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'} in library
            </p>
          </div>
        </div>

        {/* List */}
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="divide-y divide-border-subtle max-h-[20rem] overflow-y-auto"
        >
          <AnimatePresence>
            {prompts.map((prompt) => (
              <motion.li
                key={prompt.id}
                variants={staggerItem}
                layout
                className="group"
              >
                <div className="flex items-center px-6 py-4 hover:bg-pearl transition-colors">
                  {/* Prompt info - clickable to load */}
                  <button
                    onClick={() => onLoad(prompt)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <CodeIcon className="h-4 w-4 text-slate flex-shrink-0" />
                      <p className="font-sans text-ui font-medium text-ink truncate group-hover:text-editorial-red transition-colors">
                        {prompt.title}
                      </p>
                    </div>
                    {prompt.summary && (
                      <p className="font-sans text-caption text-slate mt-1 line-clamp-1 ml-6">
                        {prompt.summary}
                      </p>
                    )}
                    <p className="font-sans text-caption text-silver mt-1 ml-6">
                      {new Date(prompt.createdAt).toLocaleDateString()}
                      {/* Phase 9c: Show usage count */}
                      {usageCounts[prompt.id] !== undefined && usageCounts[prompt.id] > 0 && (
                        <span className="ml-2 text-editorial-navy">
                          • Used in {usageCounts[prompt.id]} newsletter{usageCounts[prompt.id] !== 1 ? 's' : ''}
                        </span>
                      )}
                      {isLoadingUsage && usageCounts[prompt.id] === undefined && (
                        <span className="ml-2 text-silver">• Loading...</span>
                      )}
                    </p>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="font-sans text-caption text-silver group-hover:text-ink transition-colors">
                      Load
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPromptToDelete(prompt);
                      }}
                      className="p-1.5 text-silver hover:text-editorial-red transition-colors"
                      title="Delete prompt"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!promptToDelete}
        onClose={() => setPromptToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Prompt"
        message={`Are you sure you want to delete "${promptToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </>
  );
};

export default SavedPromptsList;
