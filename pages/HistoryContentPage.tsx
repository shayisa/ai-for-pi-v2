/**
 * HistoryContentPage
 *
 * Phase 6g.5: Migrated from props to contexts/hooks
 *
 * State sources:
 * - History: useHistory hook
 * - Prompts: usePrompts hook
 * - Auth: AuthContext (useAuth)
 * - Settings: SettingsContext (useSettings)
 *
 * Remaining props (multi-state handlers):
 * - onLoad: Modifies 5 states (selectedTopics, newsletter, activePage, useEnhancedFormat, promptOfTheDay)
 * - onClear: App-level history clear handler
 * - onLoadPrompt: Modifies promptOfTheDay + navigates
 * - onImportFromDrive: Mirrors onLoad behavior
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HistoryPanel } from '../components/HistoryPanel';
import { LoadFromDriveModal } from '../components/LoadFromDriveModal';
import { SavedPromptsList } from '../components/SavedPromptsList';
import type { EnhancedHistoryItem, Newsletter, EnhancedNewsletter } from '../types';
import type { SavedPrompt } from '../services/promptClientService';
import { DriveIcon } from '../components/IconComponents';
import { fadeInUp } from '../utils/animations';
import { useHistory } from '../hooks/useHistory';
import { usePrompts } from '../hooks/usePrompts';
import { useAuth } from '../contexts';
import { useSettings } from '../contexts';

interface HistoryContentPageProps {
    // Multi-state handlers that must remain as props
    onLoad: (item: EnhancedHistoryItem) => void;
    onClear: () => void;
    onLoadPrompt: (prompt: SavedPrompt) => void;
    onImportFromDrive?: (newsletter: Newsletter | EnhancedNewsletter, topics: string[], formatVersion: 'v1' | 'v2') => void;
}

export const HistoryContentPage: React.FC<HistoryContentPageProps> = ({
    onLoad,
    onClear,
    onLoadPrompt,
    onImportFromDrive,
}) => {
    // History state from useHistory hook
    const { history, deleteFromHistory } = useHistory();

    // Prompts state from usePrompts hook
    const { prompts: savedPrompts, isLoading: isPromptsLoading, deletePrompt: onDeletePrompt } = usePrompts();

    // Auth state from AuthContext
    const { authData } = useAuth();
    const isAuthenticated = !!authData?.access_token;
    const accessToken = authData?.access_token;
    const userEmail = authData?.email;

    // Settings state from SettingsContext
    const { googleSettings } = useSettings();
    const driveFolderName = googleSettings?.driveFolderName;
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
                onDelete={deleteFromHistory}
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
