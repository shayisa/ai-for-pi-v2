import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './IconComponents';
import * as googleApi from '../services/googleApiService';
import type { Newsletter, EnhancedNewsletter } from '../types';
import { modalOverlay, modalContent, staggerContainer, staggerItem } from '../utils/animations';

interface DriveNewsletterItem {
    fileId: string;
    fileName: string;
    modifiedTime: string;
    webViewLink?: string;
}

interface LoadFromDriveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (
        newsletter: Newsletter | EnhancedNewsletter,
        topics: string[],
        formatVersion: 'v1' | 'v2'
    ) => void;
    driveFolderName: string;
    accessToken: string;
    userEmail: string;
}

export const LoadFromDriveModal: React.FC<LoadFromDriveModalProps> = ({
    isOpen,
    onClose,
    onLoad,
    driveFolderName,
    accessToken,
    userEmail,
}) => {
    const [newsletters, setNewsletters] = useState<DriveNewsletterItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

    // Load newsletters from Drive when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const loadNewsletters = async () => {
            setLoading(true);
            setError(null);
            setNewsletters([]);
            try {
                const items = await googleApi.listNewslettersFromDrive(userEmail);
                setNewsletters(items);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load newsletters from Drive';
                setError(errorMessage);
                console.error('Error loading newsletters from Drive:', err);
            } finally {
                setLoading(false);
            }
        };

        loadNewsletters();
    }, [isOpen, userEmail]);

    const handleSelectNewsletter = async (fileId: string) => {
        setLoadingFileId(fileId);
        setError(null);
        try {
            const { newsletter, topics, formatVersion } = await googleApi.loadNewsletterFromDrive(userEmail, fileId);
            onLoad(newsletter, topics, formatVersion);
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load newsletter';
            setError(errorMessage);
            console.error('Error loading newsletter:', err);
        } finally {
            setLoadingFileId(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={modalOverlay}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        variants={modalContent}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="bg-paper border border-border-subtle w-full max-w-2xl max-h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
                            <div>
                                <h2 className="font-display text-h2 text-ink">Load from Drive</h2>
                                <p className="font-sans text-caption text-slate mt-1">
                                    Select a previously saved newsletter
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate hover:text-ink transition-colors p-2"
                                aria-label="Close modal"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-8 py-6">
                            {loading && (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin mx-auto mb-4" />
                                        <p className="font-sans text-ui text-slate">Loading newsletters...</p>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 border-l-2 border-editorial-red p-4 mb-6">
                                    <p className="font-sans text-ui font-medium text-editorial-red">Error</p>
                                    <p className="font-sans text-caption text-charcoal mt-1">{error}</p>
                                </div>
                            )}

                            {!loading && newsletters.length === 0 && !error && (
                                <div className="text-center py-12">
                                    <p className="font-serif text-body text-slate">
                                        No newsletters found in "{driveFolderName}"
                                    </p>
                                </div>
                            )}

                            {!loading && newsletters.length > 0 && (
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="visible"
                                    className="divide-y divide-border-subtle"
                                >
                                    {newsletters.map((newsletter) => (
                                        <motion.button
                                            key={newsletter.fileId}
                                            variants={staggerItem}
                                            onClick={() => handleSelectNewsletter(newsletter.fileId)}
                                            disabled={loadingFileId === newsletter.fileId}
                                            className={`w-full py-4 text-left transition-colors group ${
                                                loadingFileId === newsletter.fileId
                                                    ? 'opacity-50'
                                                    : 'hover:bg-pearl'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-sans text-ui font-medium text-ink group-hover:text-editorial-navy truncate transition-colors">
                                                        {newsletter.fileName}
                                                    </p>
                                                    <p className="font-sans text-caption text-slate mt-1">
                                                        {new Date(newsletter.modifiedTime).toLocaleString()}
                                                    </p>
                                                </div>
                                                {loadingFileId === newsletter.fileId ? (
                                                    <div className="w-5 h-5 border-2 border-ink border-t-transparent animate-spin ml-4" />
                                                ) : (
                                                    <span className="font-sans text-caption text-silver group-hover:text-ink transition-colors ml-4">
                                                        Load
                                                    </span>
                                                )}
                                            </div>
                                        </motion.button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-pearl border-t border-border-subtle flex justify-end">
                            <button
                                onClick={onClose}
                                className="font-sans text-ui text-slate hover:text-ink transition-colors px-4 py-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
