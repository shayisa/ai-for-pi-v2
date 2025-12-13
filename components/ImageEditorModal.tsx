

import React, { useState, useEffect } from 'react';
import { Spinner } from './Spinner';
import { SparklesIcon, XIcon, FilterIcon, SunIcon, TypeIcon, CheckIcon, RefreshIcon } from './IconComponents';
import { editImage, generateImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

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

const quickEdits = [
    { name: 'Retro Filter', prompt: 'Apply a retro, vintage filter.', icon: FilterIcon },
    { name: 'B&W', prompt: 'Convert the image to black and white.', icon: FilterIcon },
    { name: 'Brighter', prompt: 'Increase the brightness and contrast.', icon: SunIcon },
    { name: 'Add Text', prompt: 'Add a text overlay that says "Your Text Here".', icon: TypeIcon },
];


export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, imageSrc, imageMimeType, originalPrompt, onSave }) => {
    const [prompt, setPrompt] = useState('');
    const [stagedImageSrc, setStagedImageSrc] = useState(imageSrc);
    const [isApplyingEdit, setIsApplyingEdit] = useState(false);
    const [error, setError] = useState<ErrorState | null>(null);

    const [regenerationPrompt, setRegenerationPrompt] = useState(originalPrompt);
    const [isRegenerating, setIsRegenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStagedImageSrc(imageSrc);
            setPrompt('');
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

    const handleApplyEdit = async () => {
        if (!prompt.trim()) return;

        setIsApplyingEdit(true);
        setError(null);
        try {
            const { base64, mimeType } = await fileToBase64(await (await fetch(stagedImageSrc)).blob());
            const editedImage = await editImage(base64, mimeType, prompt);
            setStagedImageSrc(`data:image/png;base64,${editedImage}`);
            setPrompt('');
        } catch (e) {
            console.error("Failed to apply image edit:", e);
            setError({
                message: "Failed to apply edit. The prompt may have been blocked or a network error occurred.",
                onRetry: handleApplyEdit,
            });
        } finally {
            setIsApplyingEdit(false);
        }
    };
    
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleApplyEdit();
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
                className="bg-white border border-border-light rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border-light">
                    <h2 className="text-xl font-semibold text-primary-text">Edit Image</h2>
                    <button onClick={onClose} className="text-secondary-text hover:text-primary-text transition">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="flex-grow p-4 md:p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center justify-center bg-gray-100 rounded-lg p-2 min-h-[200px] md:min-h-[400px]">
                            <img src={stagedImageSrc} alt="Image to edit" className="max-w-full max-h-[50vh] md:max-h-full object-contain rounded" />
                        </div>
                        <div className="flex flex-col gap-6">
                            <div>
                                <label htmlFor="regenerate-prompt" className="text-lg font-medium text-primary-text mb-1 block">Regenerate Image</label>
                                <p className="text-sm text-secondary-text mb-2">Modify the original prompt to create a new image from scratch.</p>
                                <textarea
                                    id="regenerate-prompt"
                                    value={regenerationPrompt}
                                    onChange={(e) => setRegenerationPrompt(e.target.value)}
                                    className="w-full bg-gray-50 border border-border-light rounded-lg p-3 focus:ring-2 focus:ring-accent-yellow focus:outline-none transition duration-200 mb-2 resize-none text-primary-text"
                                    rows={3}
                                    disabled={isRegenerating || isApplyingEdit}
                                />
                                <button
                                    type="button"
                                    onClick={handleRegenerate}
                                    disabled={isRegenerating || isApplyingEdit || !regenerationPrompt.trim()}
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

                            <hr className="border-border-light"/>

                            <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                                <h3 className="text-lg font-medium text-primary-text mb-1">Iterate on Current Image</h3>
                                <p className="text-sm text-secondary-text mb-3">Apply a small change to the image currently shown on the left.</p>
                                
                                <div className="mb-3">
                                    <h4 className="text-sm font-semibold text-secondary-text mb-2">Quick Edits</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {quickEdits.map(({ name, prompt, icon: Icon }) => (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => setPrompt(prompt)}
                                                disabled={isApplyingEdit || isRegenerating}
                                                className="flex items-center gap-2 text-sm bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-primary-text font-medium p-2 rounded-lg transition"
                                            >
                                                <Icon className="h-4 w-4" />
                                                <span>{name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <textarea
                                    id="edit-prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., Make the sky purple..."
                                    className="w-full flex-grow bg-gray-50 border border-border-light rounded-lg p-3 focus:ring-2 focus:ring-accent-light-blue focus:outline-none transition duration-200 mb-2 resize-none text-primary-text"
                                    rows={3}
                                    disabled={isApplyingEdit || isRegenerating}
                                />
                                
                                <button
                                    type="submit"
                                    disabled={isApplyingEdit || isRegenerating || !prompt.trim()}
                                    className="w-full flex items-center justify-center gap-2 bg-accent-light-blue hover:bg-opacity-90 disabled:bg-accent-light-blue/40 disabled:text-secondary-text disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                                >
                                    {isApplyingEdit ? (
                                        <>
                                            <Spinner />
                                            <span>Applying...</span>
                                        </>
                                    ) : (
                                       <>
                                            <SparklesIcon className="h-5 w-5" />
                                            <span>Apply Edit</span>
                                       </>
                                    )}
                                </button>
                            </form>
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
                        disabled={isApplyingEdit || isRegenerating}
                    >
                        <CheckIcon className="h-5 w-5" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};