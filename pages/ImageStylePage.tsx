import React from 'react';
import { motion } from 'framer-motion';
import { ImageIcon } from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

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
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="space-y-10"
        >
            {/* Page Header */}
            <header className="border-b-2 border-ink pb-6">
                <h1 className="font-display text-h1 text-ink">
                    Image Style
                </h1>
                <p className="font-serif text-body text-slate mt-2">
                    Choose the visual aesthetic for generated images
                </p>
            </header>

            {/* Image Style Selection */}
            <section className="bg-paper border border-border-subtle p-8">
                <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-overline text-slate uppercase tracking-widest font-sans">Select</span>
                    <h2 className="font-display text-h3 text-ink">Image Aesthetic</h2>
                </div>
                <p className="font-sans text-ui text-slate mb-6">
                    Determine the artistic style for all AI-generated images
                </p>

                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
                >
                    {Object.entries(imageStyleOptions).map(([key, { label, description }]) => (
                        <motion.div key={key} variants={staggerItem}>
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
                                className={`
                                    flex flex-col items-center text-center p-6 cursor-pointer transition-all duration-200
                                    border ${selectedImageStyle === key
                                        ? 'border-ink bg-ink text-paper'
                                        : 'border-border-subtle bg-paper hover:bg-pearl text-ink'}
                                `}
                            >
                                <ImageIcon className={`h-10 w-10 mb-3 ${selectedImageStyle === key ? 'text-silver' : 'text-slate'}`} />
                                <span className="font-sans text-ui font-medium block mb-1">{label}</span>
                                <p className={`font-sans text-caption ${selectedImageStyle === key ? 'text-silver' : 'text-slate'}`}>
                                    {description}
                                </p>
                            </label>
                        </motion.div>
                    ))}
                </motion.div>
            </section>
        </motion.div>
    );
};
