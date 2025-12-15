import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Spinner } from './Spinner';
import { XIcon, CheckIcon, RefreshIcon } from './IconComponents';
import { generateImage } from '../services/claudeService';
import { modalOverlay, modalContent } from '../utils/animations';

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
                        className="bg-paper border border-border-subtle w-full max-w-3xl max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
                            <div>
                                <h2 className="font-display text-h2 text-ink">Regenerate Image</h2>
                                <p className="font-sans text-caption text-slate mt-1">
                                    Modify the prompt to create a new image
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate hover:text-ink transition-colors p-2"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-grow px-8 py-6 overflow-y-auto">
                            <div className="space-y-6">
                                {/* Image Preview */}
                                <div className="flex items-center justify-center bg-pearl p-4 min-h-[200px] max-h-[400px]">
                                    <img
                                        src={stagedImageSrc}
                                        alt="Image preview"
                                        className="max-w-full max-h-[350px] object-contain"
                                    />
                                </div>

                                {/* Prompt Input */}
                                <div>
                                    <label
                                        htmlFor="regenerate-prompt"
                                        className="block font-sans text-ui font-medium text-ink mb-2"
                                    >
                                        Image Prompt
                                    </label>
                                    <p className="font-sans text-caption text-slate mb-3">
                                        Modify the prompt to create a new image from scratch.
                                    </p>
                                    <textarea
                                        id="regenerate-prompt"
                                        value={regenerationPrompt}
                                        onChange={(e) => setRegenerationPrompt(e.target.value)}
                                        className="w-full bg-pearl border border-border-subtle px-4 py-3 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink transition-colors resize-none"
                                        rows={3}
                                        disabled={isRegenerating}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRegenerate}
                                        disabled={isRegenerating || !regenerationPrompt.trim()}
                                        className="w-full mt-4 flex items-center justify-center gap-2 bg-ink text-paper font-sans text-ui py-3 px-4 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
                                    >
                                        {isRegenerating ? (
                                            <>
                                                <Spinner size="sm" />
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

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="px-8 pb-4"
                                >
                                    <div className="bg-red-50 border-l-2 border-editorial-red p-3 flex items-center justify-between">
                                        <span className="font-sans text-ui text-editorial-red">{error.message}</span>
                                        {error.onRetry && (
                                            <button
                                                onClick={error.onRetry}
                                                className="flex items-center gap-1 font-sans text-caption text-editorial-red hover:underline"
                                            >
                                                <RefreshIcon className="h-4 w-4" />
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-pearl border-t border-border-subtle flex justify-end items-center gap-4">
                            <button
                                onClick={onClose}
                                className="font-sans text-ui text-slate hover:text-ink transition-colors px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-ink text-paper font-sans text-ui font-medium px-6 py-2 hover:bg-charcoal transition-colors disabled:bg-silver"
                                disabled={isRegenerating}
                            >
                                <CheckIcon className="h-5 w-5" />
                                Save Changes
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
