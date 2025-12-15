import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HistoryPanel } from '../components/HistoryPanel';
import { LoadFromDriveModal } from '../components/LoadFromDriveModal';
import { SavedPromptsList } from '../components/SavedPromptsList';
import type { EnhancedHistoryItem, Newsletter, EnhancedNewsletter, PromptOfTheDay } from '../types';
import type { SavedPrompt } from '../services/promptClientService';
import { DriveIcon } from '../components/IconComponents';
import { fadeInUp } from '../utils/animations';

interface HistoryContentPageProps {
    history: EnhancedHistoryItem[];
    onLoad: (item: EnhancedHistoryItem) => void;
    onClear: () => void;
    onDelete?: (id: string) => Promise<void>;
    // Saved prompts library props
    savedPrompts: SavedPrompt[];
    isPromptsLoading: boolean;
    onDeletePrompt: (id: string) => Promise<void>;
    onLoadPrompt: (prompt: SavedPrompt) => void;
    // Import from Drive props
    isAuthenticated?: boolean;
    driveFolderName?: string;
    accessToken?: string;
    userEmail?: string;
    onImportFromDrive?: (newsletter: Newsletter | EnhancedNewsletter, topics: string[], formatVersion: 'v1' | 'v2') => void;
}

export const HistoryContentPage: React.FC<HistoryContentPageProps> = ({
    history,
    onLoad,
    onClear,
    onDelete,
    savedPrompts,
    isPromptsLoading,
    onDeletePrompt,
    onLoadPrompt,
    isAuthenticated,
    driveFolderName,
    accessToken,
    userEmail,
    onImportFromDrive,
}) => {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const handleImport = (newsletter: Newsletter | EnhancedNewsletter, topics: string[], formatVersion: 'v1' | 'v2') => {
        if (onImportFromDrive) {
            onImportFromDrive(newsletter, topics, formatVersion);
        }
        setIsImportModalOpen(false);
    };

    return (
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="space-y-10"
        >
            {/* Page Header */}
            <header className="border-b-2 border-ink pb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="font-display text-h1 text-ink">
                            History
                        </h1>
                        <p className="font-serif text-body text-slate mt-2">
                            Browse and reload previously generated newsletters
                        </p>
                    </div>

                    {/* Import from Drive button */}
                    {isAuthenticated && driveFolderName && accessToken && userEmail && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 bg-editorial-navy text-paper font-sans text-ui py-2 px-4 hover:bg-opacity-90 transition-colors"
                        >
                            <DriveIcon className="h-4 w-4" />
                            <span>Import from Drive</span>
                        </button>
                    )}
                </div>
            </header>

            {/* History Panel */}
            <HistoryPanel
                history={history}
                onLoad={onLoad}
                onClear={onClear}
                onDelete={onDelete}
            />

            {/* Saved Prompts Library */}
            <section>
                <h2 className="font-display text-h2 text-ink mb-4">Prompt Library</h2>
                <p className="font-serif text-body text-slate mb-6">
                    Your collection of saved Prompt of the Day prompts, ready to reuse
                </p>
                <SavedPromptsList
                    prompts={savedPrompts}
                    onDelete={onDeletePrompt}
                    onLoad={onLoadPrompt}
                    isLoading={isPromptsLoading}
                />
            </section>

            {/* Import from Drive Modal */}
            {isAuthenticated && driveFolderName && accessToken && userEmail && (
                <LoadFromDriveModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    onLoad={handleImport}
                    driveFolderName={driveFolderName}
                    accessToken={accessToken}
                    userEmail={userEmail}
                />
            )}
        </motion.div>
    );
};
