import React, { useState, useEffect } from 'react';
import { XIcon } from './IconComponents';
import * as googleApi from '../services/googleApiService';
import type { Newsletter } from '../types';

interface DriveNewsletterItem {
    fileId: string;
    fileName: string;
    modifiedTime: string;
    webViewLink?: string;
}

interface LoadFromDriveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (newsletter: Newsletter, topics: string[]) => void;
    driveFolderName: string;
    accessToken: string;
}

export const LoadFromDriveModal: React.FC<LoadFromDriveModalProps> = ({
    isOpen,
    onClose,
    onLoad,
    driveFolderName,
    accessToken,
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
                const items = await googleApi.listNewslettersFromDrive(driveFolderName);
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
    }, [isOpen, driveFolderName]);

    const handleSelectNewsletter = async (fileId: string) => {
        setLoadingFileId(fileId);
        setError(null);
        try {
            const { newsletter, topics } = await googleApi.loadNewsletterFromDrive(fileId);
            onLoad(newsletter, topics);
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load newsletter';
            setError(errorMessage);
            console.error('Error loading newsletter:', err);
        } finally {
            setLoadingFileId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-light p-4">
                    <h2 className="text-xl font-bold text-primary-text">Load Newsletter from Google Drive</h2>
                    <button
                        onClick={onClose}
                        className="text-secondary-text hover:text-primary-text transition"
                        aria-label="Close modal"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                                <div className="inline-block mb-2">
                                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                                <p className="text-secondary-text">Loading newsletters...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-red-700 text-sm font-medium">Error</p>
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    {!loading && newsletters.length === 0 && !error && (
                        <div className="text-center py-8">
                            <p className="text-secondary-text">No newsletters found in Drive</p>
                        </div>
                    )}

                    {!loading && newsletters.length > 0 && (
                        <div className="space-y-2">
                            {newsletters.map((newsletter) => (
                                <button
                                    key={newsletter.fileId}
                                    onClick={() => handleSelectNewsletter(newsletter.fileId)}
                                    disabled={loadingFileId === newsletter.fileId}
                                    className={`w-full p-3 text-left border rounded-lg transition ${
                                        loadingFileId === newsletter.fileId
                                            ? 'bg-gray-100 border-gray-300 opacity-50'
                                            : 'border-border-light hover:bg-gray-50 hover:border-accent-muted-blue'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-primary-text truncate">
                                                {newsletter.fileName}
                                            </p>
                                            <p className="text-sm text-secondary-text">
                                                {new Date(newsletter.modifiedTime).toLocaleString()}
                                            </p>
                                        </div>
                                        {loadingFileId === newsletter.fileId && (
                                            <div className="ml-2">
                                                <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-border-light p-4 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-primary-text bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
