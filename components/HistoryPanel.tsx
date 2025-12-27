import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EnhancedHistoryItem } from '../types';
import { TrashIcon, CodeIcon } from './IconComponents';
import { ConfirmationDialog } from './ConfirmationDialog';
import { staggerContainer, staggerItem } from '../utils/animations';

interface HistoryPanelProps {
    history: EnhancedHistoryItem[];
    onLoad: (item: EnhancedHistoryItem) => void;
    onClear: () => void;
    onDelete?: (id: string) => Promise<void>;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onLoad, onClear, onDelete }) => {
    const [itemToDelete, setItemToDelete] = useState<EnhancedHistoryItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirmDelete = async () => {
        if (!itemToDelete || !onDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(itemToDelete.id);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete newsletter:', error);
        } finally {
            setIsDeleting(false);
        }
    };
    if (history.length === 0) {
        return (
            <div className="bg-paper border border-border-subtle p-12 text-center">
                <p className="font-sans text-ui text-slate">
                    No generation history yet.
                </p>
                <p className="font-sans text-caption text-silver mt-1">
                    Generate a newsletter to see it here.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-paper border border-border-subtle">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border-subtle">
                <div>
                    <h2 className="font-display text-h3 text-ink">
                        Previous Newsletters
                    </h2>
                    <p className="font-sans text-caption text-slate mt-1">
                        {history.length} {history.length === 1 ? 'newsletter' : 'newsletters'} saved
                    </p>
                </div>
                <button
                    onClick={onClear}
                    className="flex items-center gap-2 font-sans text-ui text-slate hover:text-editorial-red transition-colors"
                >
                    <TrashIcon className="h-4 w-4" />
                    Clear All
                </button>
            </div>

            {/* List */}
            <motion.ul
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto"
            >
                <AnimatePresence>
                    {history.map((item) => (
                        <motion.li
                            key={item.id}
                            variants={staggerItem}
                            layout
                        >
                            <div
                                onClick={() => onLoad(item)}
                                className="w-full text-left px-6 py-4 hover:bg-pearl transition-colors group cursor-pointer"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onLoad(item);
                                    }
                                }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-sans text-ui font-medium text-ink truncate group-hover:text-editorial-navy transition-colors">
                                                {item.subject}
                                            </p>
                                            {item.formatVersion === 'v2' && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-medium bg-editorial-navy text-paper flex-shrink-0">
                                                    Enhanced
                                                </span>
                                            )}
                                            {item.newsletter.promptOfTheDay && (
                                                <span
                                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-sans font-medium bg-editorial-red text-paper flex-shrink-0"
                                                    title={item.newsletter.promptOfTheDay.title
                                                        ? `Prompt: ${item.newsletter.promptOfTheDay.title}`
                                                        : 'Includes Prompt of the Day'}
                                                >
                                                    <CodeIcon className="h-3 w-3" />
                                                    {item.newsletter.promptOfTheDay.title
                                                        ? (item.newsletter.promptOfTheDay.title.length > 15
                                                            ? `${item.newsletter.promptOfTheDay.title.substring(0, 15)}...`
                                                            : item.newsletter.promptOfTheDay.title)
                                                        : 'Prompt'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-sans text-caption text-slate mt-1">
                                            {item.date}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="font-sans text-caption text-silver group-hover:text-ink transition-colors">
                                            Load
                                        </span>
                                        {onDelete && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setItemToDelete(item);
                                                }}
                                                className="p-1 text-silver hover:text-editorial-red transition-colors"
                                                title="Delete newsletter"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </motion.ul>

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Newsletter"
                message={`Are you sure you want to delete "${itemToDelete?.subject}"? This action cannot be undone.`}
                confirmText="Delete"
                isDestructive={true}
                isLoading={isDeleting}
            />
        </div>
    );
};
