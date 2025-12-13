

import React, { useState, useRef } from 'react';
import type { Newsletter, NewsletterSection, PromptOfTheDay } from '../types';
import { ImageIcon, EditIcon, GripVerticalIcon, UploadIcon } from './IconComponents';
import { EditableText } from './EditableText';

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
        // setTimeout to avoid flickering when dragging starts
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
        <div className="mt-8 md:mt-12">
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*"
            />
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-accent-light-blue to-accent-yellow">
                Your Generated Newsletter
            </h2>
            <div className="bg-white text-primary-text rounded-lg shadow-xl max-w-4xl mx-auto font-serif">
                <div className="p-8 md:p-12">
                    <style>
                        {`
                            .newsletter-content a {
                                color: #5DA2D5; /* accent-muted-blue */
                                text-decoration: underline;
                            }
                            .newsletter-content a:hover {
                                color: #4A8BBF; /* Darker shade of accent-muted-blue */
                            }
                            .newsletter-content p {
                                margin-bottom: 1rem;
                                line-height: 1.75;
                            }
                            .drop-indicator {
                                height: 4px;
                                background-color: #F3D250; /* accent-yellow */
                                border-radius: 2px;
                                margin: 8px 0;
                            }
                            .prompt-code-tag {
                                color: #F3D250; /* accent-yellow */
                                font-weight: bold;
                            }
                        `}
                    </style>
                    <header className="border-b border-border-light pb-6 mb-8">
                         {topics && topics.length > 0 && (
                            <div className="mb-4">
                                <span className="text-sm font-bold uppercase tracking-wider text-secondary-text">Topic</span>
                                <p className="text-lg text-primary-text font-sans">{topics.join(', ')}</p>
                            </div>
                        )}
                        <EditableText
                            as="h1"
                            initialValue={newsletter.subject}
                            onSave={(newValue) => onUpdate('subject', newValue)}
                            className="text-4xl font-extrabold text-primary-text"
                        />
                    </header>
                    <article className="newsletter-content">
                        <EditableText
                            as="p"
                            initialValue={newsletter.introduction}
                            onSave={(newValue) => onUpdate('introduction', newValue)}
                            className="text-lg text-secondary-text mb-8 leading-relaxed"
                        />

                        <div onDragLeave={() => setDropIndex(null)}>
                            {newsletter.sections.map((section, index) => (
                               <React.Fragment key={index}>
                                    {dropIndex === index && <div className="drop-indicator" />}
                                    <div
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={handleDrop}
                                        onDragEnd={handleDragEnd}
                                        className="flex gap-4 items-start mb-12 group transition-all"
                                    >
                                        <div className="text-gray-400 hover:text-primary-text cursor-move pt-3 hidden sm:block">
                                            <GripVerticalIcon className="h-6 w-6" />
                                        </div>
                                        <section className="flex-1">
                                            <EditableText
                                                as="h2"
                                                initialValue={section.title}
                                                onSave={(newValue) => onUpdate('title', newValue, index)}
                                                className="text-3xl font-bold text-primary-text mb-4 font-sans"
                                            />
                                            <EditableText
                                                isHtml
                                                initialValue={section.content}
                                                onSave={(newValue) => onUpdate('content', newValue, index)}
                                                className="text-lg text-secondary-text whitespace-pre-wrap leading-relaxed mb-6"
                                            />
                                            
                                            <div className="relative group/image-container aspect-video bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
                                                {section.imageUrl ? (
                                                    <>
                                                        <img src={section.imageUrl} alt={section.title} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image-container:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                            <button 
                                                                onClick={() => section.imageUrl && onEditImage(index, section.imageUrl, section.imagePrompt)} 
                                                                disabled={isLoading}
                                                                className="flex items-center gap-2 bg-white/80 hover:bg-white text-primary-text font-semibold py-2 px-4 rounded-lg backdrop-blur-sm transition">
                                                                <EditIcon className="h-5 w-5" />
                                                                Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setUploadingIndex(index);
                                                                    fileInputRef.current?.click();
                                                                }}
                                                                disabled={isLoading}
                                                                className="flex items-center gap-2 bg-white/80 hover:bg-white text-primary-text font-semibold py-2 px-4 rounded-lg backdrop-blur-sm transition">
                                                                <UploadIcon className="h-5 w-5" />
                                                                Upload
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full animate-pulse">
                                                        <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
                                                        <p className="text-sm text-gray-500">Generating image...</p>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                               </React.Fragment>
                            ))}
                             {dropIndex === newsletter.sections.length && <div className="drop-indicator" />}
                        </div>

                        <EditableText
                            as="p"
                            initialValue={newsletter.conclusion}
                            onSave={(newValue) => onUpdate('conclusion', newValue)}
                            className="text-lg text-secondary-text mt-8 leading-relaxed"
                        />
                    </article>
                </div>
                <footer className="bg-gray-50 p-8 md:p-12 mt-8 font-sans border-t border-border-light rounded-b-lg">
                    {/* From the AI's Desk */}
                    {firstImagePrompt && (
                        <>
                        <hr className="border-border-light my-6" />
                        <div className="bg-gray-100 rounded-lg p-4 text-center">
                            <p className="text-base font-bold text-primary-text">From the AI's Desk</p>
                            <p className="text-xs text-secondary-text mt-1 italic">This week's image prompt:</p>
                            <p className="text-xs text-secondary-text mt-1 italic">"{firstImagePrompt}"</p>
                        </div>
                        </>
                    )}

                    {/* Viral Loop */}
                    <hr className="border-border-light my-6" />
                    <div className="text-center mb-6">
                        <p className="text-base text-primary-text mb-4">Enjoying these insights? Share them with a colleague!</p>
                        <a href="#" className="inline-block bg-accent-salmon text-white font-bold text-sm py-3 px-6 rounded-md transition-transform hover:scale-105">
                            Subscribe Here
                        </a>
                        <p className="mt-4 text-sm">
                            <a href={`mailto:?subject=FW: ${encodeURIComponent(newsletter.subject)}&body=Hey, I thought you'd find this interesting. You can subscribe here: [Your Subscribe Link]`} className="text-accent-muted-blue font-bold underline">
                                Forward this email
                            </a>
                        </p>
                    </div>

                    <hr className="border-border-light my-6" />

                    {/* Explore Further */}
                     {topics && topics.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-primary-text text-center mb-4">Explore Further</h3>
                            <div className="space-y-4">
                                {topics.map((topic, index) => (
                                    <div key={index} className="text-center">
                                        <p className="text-sm text-primary-text font-semibold mb-1">{topic}</p>
                                        <div className="flex justify-center items-center gap-4 text-sm">
                                            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`} target="_blank" rel="noopener noreferrer" className="text-accent-muted-blue font-bold underline">YouTube</a>
                                            <span className="text-gray-300">|</span>
                                            <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}`} target="_blank" rel="noopener noreferrer" className="text-accent-muted-blue font-bold underline">Google Scholar</a>
                                             <span className="text-gray-300">|</span>
                                            <a href={`https://twitter.com/search?q=${encodeURIComponent(topic)}`} target="_blank" rel="noopener noreferrer" className="text-accent-muted-blue font-bold underline">X/Twitter</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Prompt of the Day Section */}
                    {newsletter.promptOfTheDay && (
                        <>
                            <hr className="border-border-light my-6" />
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-primary-text text-center mb-4">Prompt of the Day</h3>
                                <div className="bg-gray-100 rounded-lg p-6">
                                    <h4 className="text-lg font-bold text-primary-text mb-2">{newsletter.promptOfTheDay.title}</h4>
                                    <p className="text-base text-secondary-text mb-4">{newsletter.promptOfTheDay.summary}</p>
                                    
                                    <p className="text-sm font-semibold text-secondary-text mb-2">Three example prompts:</p>
                                    <ul className="list-disc list-inside text-base text-secondary-text mb-4 pl-4">
                                        {newsletter.promptOfTheDay.examplePrompts.map((prompt, idx) => (
                                            <li key={idx} className="mb-1">{prompt}</li>
                                        ))}
                                    </ul>

                                    <p className="text-sm font-semibold text-secondary-text mb-2">Prompt Code:</p>
                                    <pre className="bg-dark-code text-gray-200 p-4 rounded-md text-sm whitespace-pre-wrap overflow-x-auto">
                                        {parsePromptCode(newsletter.promptOfTheDay.promptCode).map((section, idx) => (
                                            <React.Fragment key={idx}>
                                                <span className="prompt-code-tag">&lt;{section.tag}&gt;</span>
                                                <p className="ml-4 mb-2">{section.content}</p>
                                                <span className="prompt-code-tag">&lt;/{section.tag}&gt;</span>
                                                <br/>
                                            </React.Fragment>
                                        ))}
                                    </pre>
                                </div>
                            </div>
                        </>
                    )}

                    <hr className="border-border-light my-6" />

                    {/* Professional Essentials */}
                    <div className="text-center text-xs text-secondary-text">
                        <p className="mb-2">© 2024 AI for PI</p>
                        <p className="mb-2">This newsletter was curated and generated with the assistance of AI.</p>
                        <p>
                            <a href="mailto:shayisa@gmail.com?subject=UNSUBSCRIBE" className="underline hover:text-accent-muted-blue">Unsubscribe</a>
                            <span className="mx-2">|</span>
                            <a href="mailto:shayisa@gmail.com" className="underline hover:text-accent-muted-blue">Contact Us</a>
                        </p>
                    </div>
                </footer>
            </div>
        </div>
    );
};