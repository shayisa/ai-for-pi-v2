import React from 'react';
import { ImageIcon } from '../components/IconComponents';

interface ImageStylePageProps {
    selectedImageStyle: string;
    setSelectedImageStyle: (style: string) => void;
    imageStyleOptions: Record<string, { label: string; description: string }>;
}

export const ImageStylePage: React.FC<ImageStylePageProps> = ({
    selectedImageStyle,
    setSelectedImageStyle,
    imageStyleOptions,
}) => {
    return (
        <div className="space-y-8">
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-salmon mb-6">
                Select Image Style
            </h1>

            {/* Select Image Style */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-border-light">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-muted-blue to-accent-salmon mb-4 flex items-center gap-2">
                    <ImageIcon className="h-6 w-6" />
                    1. Choose Image Aesthetic
                </h2>
                <p className="text-secondary-text mb-6">Determine the artistic style for all AI-generated images in your newsletter.</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {Object.entries(imageStyleOptions).map(([key, { label, description }]) => (
                        <div key={key}>
                            <input
                                type="radio"
                                id={`style-${key}`}
                                name="style"
                                value={key}
                                checked={selectedImageStyle === key}
                                onChange={() => setSelectedImageStyle(key)}
                                className="sr-only peer"
                            />
                            <label 
                                htmlFor={`style-${key}`}
                                className="flex flex-col items-center text-center p-3 rounded-lg bg-gray-50 border border-border-light hover:bg-gray-100 transition cursor-pointer peer-checked:bg-accent-salmon peer-checked:border-transparent"
                            >
                                {/* Removed image block, displaying ImageIcon and text directly */}
                                <div className="flex flex-col items-center justify-center mb-2">
                                    <ImageIcon className="h-10 w-10 text-gray-400 peer-checked:text-white mb-2" />
                                    <span className="font-medium text-primary-text peer-checked:text-white">{label}</span>
                                </div>
                                <p className="text-sm text-secondary-text peer-checked:text-white/90 mt-1">{description}</p>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};