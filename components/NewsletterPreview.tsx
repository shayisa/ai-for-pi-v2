import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Newsletter, NewsletterSection, PromptOfTheDay } from '../types';
import { ImageIcon, EditIcon, GripVerticalIcon, UploadIcon } from './IconComponents';
import { EditableText } from './EditableText';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

interface NewsletterPreviewProps {
    newsletter: Newsletter | null;
    onEditImage: (index: number, src: string, prompt: string) => void;
    onImageUpload: (sectionIndex: number, file: File) => void;
    onReorderSections: (newSections: NewsletterSection[]) => void;
    onUpdate: (field: keyof Newsletter | keyof NewsletterSection, value: string, sectionIndex?: number) => void;
    isLoading: boolean;
    topics: string[];
}

const parsePromptCode = (promptCode: string) => {
    const sections: { tag: string; content: string }[] = [];
    const regex = /<(\w+)>(.*?)<\/\1>/gs;
    let match;
    while ((match = regex.exec(promptCode)) !== null) {
        sections.push({ tag: match[1], content: match[2].trim() });
    }
    return sections;
};

const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

export const NewsletterPreview: React.FC<NewsletterPreviewProps> = ({
    newsletter,
    onEditImage,
    onImageUpload,
    onReorderSections,
    onUpdate,
    isLoading,
    topics,
}) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const dragItem = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

    if (!newsletter) return null;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDraggedIndex(index);
        dragItem.current = e.currentTarget;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            if (dragItem.current) {
                dragItem.current.classList.add('opacity-50');
            }
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) {
            setDropIndex(null);
            return;
        }
        setDropIndex(index);
    };

    const handleDrop = () => {
        if (draggedIndex !== null && dropIndex !== null) {
            const newSections = [...newsletter.sections];
            const [reorderedItem] = newSections.splice(draggedIndex, 1);
            newSections.splice(dropIndex, 0, reorderedItem);
            onReorderSections(newSections);
        }
        cleanupDragState();
    };

    const handleDragEnd = () => {
        cleanupDragState();
    };

    const cleanupDragState = () => {
        if (dragItem.current) {
            dragItem.current.classList.remove('opacity-50');
        }
        setDraggedIndex(null);
        setDropIndex(null);
        dragItem.current = null;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadingIndex !== null) {
            onImageUpload(uploadingIndex, file);
        }
        if (e.target) {
            e.target.value = '';
        }
        setUploadingIndex(null);
    };

    const firstImagePrompt = newsletter.sections.find(s => s.imagePrompt)?.imagePrompt;

    return (
        <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="mt-12"
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*"
            />

            {/* Article Container */}
            <article className="bg-paper max-w-article mx-auto shadow-editorial">
                {/* Masthead */}
                <header className="px-8 md:px-12 pt-10 pb-8 border-b-2 border-ink">
                    {/* Date & Topics */}
                    <div className="mb-6">
                        <p className="text-overline text-slate uppercase tracking-widest font-sans mb-1">
                            {formatDate()}
                        </p>
                        {topics && topics.length > 0 && (
                            <p className="text-caption text-slate font-sans">
                                {topics.join(' · ')}
                            </p>
                        )}
                    </div>

                    {/* Headline */}
                    <EditableText
                        as="h1"
                        initialValue={newsletter.subject}
                        onSave={(newValue) => onUpdate('subject', newValue)}
                        className="font-display text-h1 text-ink leading-tight tracking-tight"
                    />
                </header>

                {/* Article Body */}
                <div className="px-8 md:px-12 py-10">
                    {/* Introduction with Drop Cap */}
                    <div className="mb-12">
                        <EditableText
                            as="p"
                            initialValue={newsletter.introduction}
                            onSave={(newValue) => onUpdate('introduction', newValue)}
                            className="drop-cap font-serif text-body text-charcoal leading-relaxed"
                        />
                    </div>

                    {/* Sections */}
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        onDragLeave={() => setDropIndex(null)}
                    >
                        {newsletter.sections.map((section, index) => (
                            <React.Fragment key={index}>
                                {dropIndex === index && (
                                    <div className="h-0.5 bg-editorial-red my-4" />
                                )}
                                <motion.div
                                    variants={staggerItem}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e as any, index)}
                                    onDragOver={(e) => handleDragOver(e as any, index)}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDragEnd}
                                    className="group mb-16"
                                >
                                    {/* Section Divider */}
                                    {index > 0 && (
                                        <hr className="section-divider mb-10" />
                                    )}

                                    <div className="flex gap-3">
                                        {/* Drag Handle */}
                                        <div className="text-silver hover:text-slate cursor-move pt-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                                            <GripVerticalIcon className="h-5 w-5" />
                                        </div>

                                        <div className="flex-1">
                                            {/* Section Title */}
                                            <EditableText
                                                as="h2"
                                                initialValue={section.title}
                                                onSave={(newValue) => onUpdate('title', newValue, index)}
                                                className="font-display text-h2 text-ink mb-4"
                                            />

                                            {/* Section Content */}
                                            <EditableText
                                                isHtml
                                                initialValue={section.content}
                                                onSave={(newValue) => onUpdate('content', newValue, index)}
                                                className="prose-editorial font-serif text-body text-charcoal leading-relaxed mb-8"
                                            />

                                            {/* Section Image */}
                                            <figure className="my-8">
                                                <div className="relative group/image aspect-[16/10] bg-pearl overflow-hidden">
                                                    {section.imageUrl ? (
                                                        <>
                                                            <img
                                                                src={section.imageUrl}
                                                                alt={section.title}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                                                                <button
                                                                    onClick={() => section.imageUrl && onEditImage(index, section.imageUrl, section.imagePrompt)}
                                                                    disabled={isLoading}
                                                                    className="flex items-center gap-2 bg-paper text-ink font-sans text-ui font-medium py-2 px-4 hover:bg-pearl transition-colors"
                                                                >
                                                                    <EditIcon className="h-4 w-4" />
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setUploadingIndex(index);
                                                                        fileInputRef.current?.click();
                                                                    }}
                                                                    disabled={isLoading}
                                                                    className="flex items-center gap-2 bg-paper text-ink font-sans text-ui font-medium py-2 px-4 hover:bg-pearl transition-colors"
                                                                >
                                                                    <UploadIcon className="h-4 w-4" />
                                                                    Upload
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full animate-pulse-subtle">
                                                            <ImageIcon className="h-10 w-10 text-silver mb-3" />
                                                            <p className="text-caption text-slate font-sans">Generating image...</p>
                                                        </div>
                                                    )}
                                                </div>
                                                {section.imagePrompt && (
                                                    <figcaption className="caption mt-2 text-center">
                                                        {section.imagePrompt}
                                                    </figcaption>
                                                )}
                                            </figure>
                                        </div>
                                    </div>
                                </motion.div>
                            </React.Fragment>
                        ))}
                        {dropIndex === newsletter.sections.length && (
                            <div className="h-0.5 bg-editorial-red my-4" />
                        )}
                    </motion.div>

                    {/* Conclusion */}
                    <div className="mt-12 pt-8 border-t border-border-subtle">
                        <EditableText
                            as="p"
                            initialValue={newsletter.conclusion}
                            onSave={(newValue) => onUpdate('conclusion', newValue)}
                            className="font-serif text-body text-charcoal leading-relaxed"
                        />
                    </div>
                </div>

                {/* Footer */}
                <footer className="bg-pearl px-8 md:px-12 py-10 border-t border-border-subtle">
                    {/* From the AI's Desk */}
                    {firstImagePrompt && (
                        <div className="mb-8 p-6 bg-paper border border-border-subtle">
                            <p className="text-overline text-slate uppercase tracking-widest font-sans mb-2">
                                From the AI's Desk
                            </p>
                            <p className="font-serif text-ui text-charcoal italic">
                                This week's image prompt: "{firstImagePrompt}"
                            </p>
                        </div>
                    )}

                    {/* Share / Subscribe CTA */}
                    <div className="text-center mb-8 py-6 border-y border-border-subtle">
                        <p className="font-sans text-ui text-charcoal mb-4">
                            Enjoying these insights? Share with a colleague.
                        </p>
                        <a
                            href="#"
                            className="inline-block bg-ink text-paper font-sans text-ui font-medium py-3 px-8 hover:bg-charcoal transition-colors"
                        >
                            Subscribe
                        </a>
                        <p className="mt-4">
                            <a
                                href={`mailto:?subject=FW: ${encodeURIComponent(newsletter.subject)}&body=I thought you'd find this interesting.`}
                                className="editorial-link font-sans text-caption"
                            >
                                Forward this newsletter
                            </a>
                        </p>
                    </div>

                    {/* Explore Further */}
                    {topics && topics.length > 0 && (
                        <div className="mb-8">
                            <h3 className="font-display text-h3 text-ink text-center mb-4">
                                Explore Further
                            </h3>
                            <div className="space-y-4">
                                {topics.map((topic, index) => (
                                    <div key={index} className="text-center">
                                        <p className="font-sans text-ui font-medium text-ink mb-2">
                                            {topic}
                                        </p>
                                        <div className="flex justify-center items-center gap-4 text-caption font-sans">
                                            <a
                                                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="editorial-link"
                                            >
                                                YouTube
                                            </a>
                                            <span className="text-silver">·</span>
                                            <a
                                                href={`https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="editorial-link"
                                            >
                                                Google Scholar
                                            </a>
                                            <span className="text-silver">·</span>
                                            <a
                                                href={`https://twitter.com/search?q=${encodeURIComponent(topic)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="editorial-link"
                                            >
                                                X
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Prompt of the Day */}
                    {newsletter.promptOfTheDay && (
                        <div className="mb-8 p-6 bg-paper border border-border-subtle">
                            <h3 className="font-display text-h3 text-ink mb-4">
                                Prompt of the Day
                            </h3>
                            <h4 className="font-sans text-ui font-semibold text-ink mb-2">
                                {newsletter.promptOfTheDay.title}
                            </h4>
                            <p className="font-serif text-body text-charcoal mb-4">
                                {newsletter.promptOfTheDay.summary}
                            </p>

                            <p className="font-sans text-caption font-semibold text-slate mb-2">
                                Example prompts:
                            </p>
                            <ul className="list-disc list-inside font-serif text-ui text-charcoal mb-4 ml-2">
                                {newsletter.promptOfTheDay.examplePrompts.map((prompt, idx) => (
                                    <li key={idx} className="mb-1">{prompt}</li>
                                ))}
                            </ul>

                            <p className="font-sans text-caption font-semibold text-slate mb-2">
                                Prompt Code:
                            </p>
                            <pre className="bg-ink text-pearl p-4 font-mono text-caption overflow-x-auto">
                                {parsePromptCode(newsletter.promptOfTheDay.promptCode).map((section, idx) => (
                                    <React.Fragment key={idx}>
                                        <span className="text-editorial-gold">&lt;{section.tag}&gt;</span>
                                        <span className="block ml-4 mb-2 text-silver">{section.content}</span>
                                        <span className="text-editorial-gold">&lt;/{section.tag}&gt;</span>
                                        {idx < parsePromptCode(newsletter.promptOfTheDay!.promptCode).length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </pre>
                        </div>
                    )}

                    {/* Legal Footer */}
                    <div className="text-center pt-6 border-t border-border-subtle">
                        <p className="font-sans text-caption text-slate mb-2">
                            © {new Date().getFullYear()} AI for PI · Newsletter Studio
                        </p>
                        <p className="font-sans text-caption text-silver mb-3">
                            Curated and generated with AI assistance
                        </p>
                        <p className="font-sans text-caption">
                            <a
                                href="mailto:shayisa@gmail.com?subject=UNSUBSCRIBE"
                                className="editorial-link"
                            >
                                Unsubscribe
                            </a>
                            <span className="text-silver mx-2">·</span>
                            <a href="mailto:shayisa@gmail.com" className="editorial-link">
                                Contact
                            </a>
                        </p>
                    </div>
                </footer>
            </article>
        </motion.div>
    );
};
