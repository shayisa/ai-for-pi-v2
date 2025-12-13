import React, { useState, useEffect } from 'react';
import { Spinner } from './Spinner';
import { XIcon, CheckIcon, RefreshIcon } from './IconComponents';
import { generateImage } from '../services/claudeService';

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    imageMimeType: string;
    originalPrompt: string;
    onSave: (newImageUrl: string) => void;
}

type ErrorState = {
    message: string;
    onRetry?: () => void;
};

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, imageSrc, originalPrompt, onSave }) => {
    const [stagedImageSrc, setStagedImageSrc] = useState(imageSrc);
    const [error, setError] = useState<ErrorState | null>(null);
    const [regenerationPrompt, setRegenerationPrompt] = useState(originalPrompt);
    const [isRegenerating, setIsRegenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStagedImageSrc(imageSrc);
            setError(null);
            setRegenerationPrompt(originalPrompt);
        }
    }, [isOpen, imageSrc, originalPrompt]);

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

    if (!isOpen) return null;

    const handleRegenerate = async () => {
        if (!regenerationPrompt.trim()) return;

        setIsRegenerating(true);
        setError(null);
        try {
            const regeneratedImage = await generateImage(regenerationPrompt);
            setStagedImageSrc(`data:image/png;base64,${regeneratedImage}`);
        } catch (e) {
            console.error("Failed to regenerate image:", e);
            setError({
                message: "Failed to regenerate image. The prompt may have been blocked or a network error occurred.",
                onRetry: handleRegenerate,
            });
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleSave = () => {
        onSave(stagedImageSrc);
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white border border-border-light rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border-light">
                    <h2 className="text-xl font-semibold text-primary-text">Regenerate Image</h2>
                    <button onClick={onClose} className="text-secondary-text hover:text-primary-text transition">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-grow p-4 md:p-6 overflow-y-auto">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-center bg-gray-100 rounded-lg p-2 min-h-[200px] max-h-[400px]">
                            <img src={stagedImageSrc} alt="Image preview" className="max-w-full max-h-[350px] object-contain rounded" />
                        </div>

                        <div>
                            <label htmlFor="regenerate-prompt" className="text-lg font-medium text-primary-text mb-1 block">Image Prompt</label>
                            <p className="text-sm text-secondary-text mb-2">Modify the prompt to create a new image from scratch.</p>
                            <textarea
                                id="regenerate-prompt"
                                value={regenerationPrompt}
                                onChange={(e) => setRegenerationPrompt(e.target.value)}
                                className="w-full bg-gray-50 border border-border-light rounded-lg p-3 focus:ring-2 focus:ring-accent-yellow focus:outline-none transition duration-200 mb-2 resize-none text-primary-text"
                                rows={3}
                                disabled={isRegenerating}
                            />
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                disabled={isRegenerating || !regenerationPrompt.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-accent-yellow hover:bg-opacity-90 disabled:bg-accent-yellow/40 disabled:text-secondary-text disabled:cursor-not-allowed text-primary-text font-semibold py-2 px-4 rounded-lg transition duration-200"
                            >
                                {isRegenerating ? (
                                    <>
                                        <Spinner />
                                        <span>Regenerating...</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshIcon className="h-5 w-5" />
                                        <span>Regenerate</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="px-6 pb-2 text-sm text-red-600 text-center flex items-center justify-center gap-4">
                        <span>{error.message}</span>
                        {error.onRetry && (
                            <button onClick={error.onRetry} className="flex items-center gap-1 underline hover:text-red-500">
                                <RefreshIcon className="h-4 w-4" />
                                Retry
                            </button>
                        )}
                    </div>
                )}

                <div className="p-4 bg-gray-50 border-t border-border-light flex justify-end items-center gap-4">
                    <button onClick={onClose} className="text-secondary-text hover:text-primary-text font-medium py-2 px-4 rounded-lg transition">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-accent-salmon hover:bg-opacity-90 text-white font-semibold py-2 px-4 rounded-lg transition"
                        disabled={isRegenerating}
                    >
                        <CheckIcon className="h-5 w-5" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
