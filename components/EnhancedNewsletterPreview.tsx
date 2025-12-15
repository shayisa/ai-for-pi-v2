/**
 * Enhanced Newsletter Preview Component
 *
 * Renders the v2 enhanced newsletter format with:
 * - Editor's Note (editable)
 * - Tool of the Day
 * - Audience Sections with "Why It Matters"
 * - Practical Prompts with copy button
 * - Source Citations
 * - Section Images with edit/upload capability
 *
 * TODO: [LIMITATION] No drag-and-drop section reordering
 * Unlike NewsletterPreview (v1), this component doesn't support reordering sections.
 * Enhanced sections are audience-specific and order is determined by audience config.
 * If needed: Add onReorderSections prop and implement drag-drop like NewsletterPreview.tsx
 */

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { EnhancedNewsletter, EnhancedAudienceSection, PromptOfTheDay } from '../types';
import { EditableText } from './EditableText';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';
import { ToolOfTheDayCard } from './ToolOfTheDayCard';
import { PracticalPromptCard } from './PracticalPromptCard';
import { SourceCitations } from './SourceCitations';
import { WhyItMattersTag } from './WhyItMattersTag';
import { ImageIcon, EditIcon, UploadIcon, SparklesIcon } from './IconComponents';

interface EnhancedNewsletterPreviewProps {
  newsletter: EnhancedNewsletter;
  onUpdate?: (field: string, value: string, sectionIndex?: number) => void;
  onEditImage?: (index: number, src: string, prompt: string) => void;
  onImageUpload?: (sectionIndex: number, file: File) => void;
  onGenerateImage?: (sectionIndex: number, imagePrompt: string) => Promise<void>;
  isLoading?: boolean;
  topics?: string[];
}

const formatDate = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const parsePromptCode = (promptCode: string) => {
  const sections: { tag: string; content: string }[] = [];
  const regex = /<(\w+)>(.*?)<\/\1>/gs;
  let match;
  while ((match = regex.exec(promptCode)) !== null) {
    sections.push({ tag: match[1], content: match[2].trim() });
  }
  return sections;
};

export const EnhancedNewsletterPreview: React.FC<EnhancedNewsletterPreviewProps> = ({
  newsletter,
  onUpdate,
  onEditImage,
  onImageUpload,
  onGenerateImage,
  isLoading = false,
  topics = [],
}) => {
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingIndex !== null && onImageUpload) {
      onImageUpload(uploadingIndex, file);
    }
    if (e.target) {
      e.target.value = '';
    }
    setUploadingIndex(null);
  };

  const handleCopyPrompt = async (prompt: string, index: number) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPromptIndex(index);
      setTimeout(() => setCopiedPromptIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const handleUpdateEditorsNote = (value: string) => {
    onUpdate?.('editorsNote', value);
  };

  const handleUpdateConclusion = (value: string) => {
    onUpdate?.('conclusion', value);
  };

  const handleUpdateSectionField = (
    field: keyof EnhancedAudienceSection,
    value: string,
    sectionIndex: number
  ) => {
    onUpdate?.(`section.${field}`, value, sectionIndex);
  };

  const handleGenerateImage = async (sectionIndex: number, imagePrompt: string) => {
    if (!onGenerateImage || !imagePrompt) return;
    setGeneratingIndex(sectionIndex);
    try {
      await onGenerateImage(sectionIndex, imagePrompt);
    } finally {
      setGeneratingIndex(null);
    }
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="mt-12"
    >
      {/* Hidden file input for image uploads */}
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
            {topics.length > 0 && (
              <p className="text-caption text-slate font-sans">{topics.join(' · ')}</p>
            )}
          </div>

          {/* Newsletter Title */}
          <h1 className="font-display text-h1 text-ink leading-tight tracking-tight">
            {newsletter.subject || 'AI for PI Newsletter'}
          </h1>
        </header>

        {/* Article Body */}
        <div className="px-8 md:px-12 py-10">
          {/* Editor's Note */}
          <section className="mb-12 p-6 bg-pearl/50 border-l-4 border-editorial-red">
            <p className="text-overline text-slate uppercase tracking-widest font-sans mb-3">
              Editor's Note
            </p>
            <EditableText
              as="p"
              initialValue={newsletter.editorsNote?.message || ''}
              onSave={handleUpdateEditorsNote}
              className="font-serif text-body text-charcoal leading-relaxed italic"
            />
          </section>

          {/* Tool of the Day */}
          {newsletter.toolOfTheDay && (
            <section className="mb-12">
              <ToolOfTheDayCard tool={newsletter.toolOfTheDay} />
            </section>
          )}

          {/* Audience Sections */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {newsletter.audienceSections?.map((section, index) => (
              <motion.section
                key={`${section.audienceId}-${index}`}
                variants={staggerItem}
                className="mb-16"
              >
                {/* Section Divider */}
                {index > 0 && <hr className="section-divider mb-10" />}

                {/* Audience Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-ink text-paper font-sans text-xs uppercase tracking-wider">
                    For {section.audienceName}
                  </span>
                </div>

                {/* Section Title */}
                <EditableText
                  as="h2"
                  initialValue={section.title}
                  onSave={(value) => handleUpdateSectionField('title', value, index)}
                  className="font-display text-h2 text-ink mb-4"
                />

                {/* Why It Matters */}
                <WhyItMattersTag text={section.whyItMatters} />

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
                        {/* Hover overlay with edit/upload buttons */}
                        <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                          {onEditImage && (
                            <button
                              onClick={() => section.imageUrl && onEditImage(index, section.imageUrl, section.imagePrompt || '')}
                              disabled={isLoading}
                              className="flex items-center gap-2 bg-paper text-ink font-sans text-ui font-medium py-2 px-4 hover:bg-pearl transition-colors"
                            >
                              <EditIcon className="h-4 w-4" />
                              Edit
                            </button>
                          )}
                          {onImageUpload && (
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
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        {generatingIndex === index ? (
                          <>
                            <div className="animate-spin h-8 w-8 border-2 border-ink border-t-transparent rounded-full mb-3" />
                            <p className="text-caption text-slate font-sans">Generating image...</p>
                          </>
                        ) : section.imagePrompt && onGenerateImage ? (
                          <>
                            <ImageIcon className="h-10 w-10 text-silver mb-3" />
                            <p className="text-caption text-slate font-sans mb-4">No image</p>
                            <button
                              onClick={() => handleGenerateImage(index, section.imagePrompt || '')}
                              disabled={isLoading}
                              className="flex items-center gap-2 bg-ink text-paper font-sans text-ui font-medium py-2 px-4 hover:bg-charcoal transition-colors disabled:bg-silver disabled:cursor-not-allowed"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              Generate Image
                            </button>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-10 w-10 text-silver mb-3" />
                            <p className="text-caption text-slate font-sans">No image available</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {section.imagePrompt && (
                    <figcaption className="caption mt-2 text-center text-caption text-slate font-sans">
                      {section.imagePrompt}
                    </figcaption>
                  )}
                </figure>

                {/* Section Content */}
                <EditableText
                  isHtml
                  initialValue={section.content}
                  onSave={(value) => handleUpdateSectionField('content', value, index)}
                  className="prose-editorial font-serif text-body text-charcoal leading-relaxed mb-8"
                />

                {/* Practical Prompt */}
                {section.practicalPrompt && (
                  <PracticalPromptCard
                    prompt={section.practicalPrompt}
                    onCopy={() =>
                      handleCopyPrompt(section.practicalPrompt.prompt, index)
                    }
                    isCopied={copiedPromptIndex === index}
                  />
                )}

                {/* Source Citations */}
                {section.sources && section.sources.length > 0 && (
                  <SourceCitations sources={section.sources} />
                )}

                {/* CTA */}
                {section.cta && (
                  <div className="mt-6">
                    <button
                      onClick={() =>
                        section.cta.action === 'copy_prompt' &&
                        handleCopyPrompt(section.practicalPrompt?.prompt || '', index)
                      }
                      className="inline-flex items-center gap-2 bg-editorial-red text-paper font-sans text-ui font-medium py-2 px-6 hover:bg-red-700 transition-colors"
                    >
                      {section.cta.text}
                    </button>
                  </div>
                )}
              </motion.section>
            ))}
          </motion.div>

          {/* Prompt of the Day */}
          {newsletter.promptOfTheDay && (
            <div className="mt-12 p-6 bg-paper border border-border-subtle">
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
                {newsletter.promptOfTheDay.examplePrompts?.map((prompt, idx) => (
                  <li key={idx} className="mb-1">{prompt}</li>
                ))}
              </ul>

              <p className="font-sans text-caption font-semibold text-slate mb-2">
                Prompt Code:
              </p>
              <pre className="bg-ink text-pearl p-4 font-mono text-caption overflow-x-auto rounded">
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

          {/* Conclusion */}
          <div className="mt-12 pt-8 border-t border-border-subtle">
            <EditableText
              as="p"
              initialValue={newsletter.conclusion || ''}
              onSave={handleUpdateConclusion}
              className="font-serif text-body text-charcoal leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-pearl px-8 md:px-12 py-10 border-t border-border-subtle">
          {/* Share / Subscribe CTA */}
          <div className="text-center mb-8 py-6 border-y border-border-subtle">
            <p className="font-sans text-ui text-charcoal mb-4">
              Enjoying these insights? Share with a colleague.
            </p>
            <a
              href={`mailto:?subject=${encodeURIComponent(newsletter.subject || 'AI Newsletter')}&body=${encodeURIComponent(newsletter.editorsNote?.message || '')}`}
              className="inline-block bg-ink text-paper font-sans text-ui font-medium py-3 px-8 hover:bg-charcoal transition-colors"
            >
              Forward to a Friend
            </a>
          </div>

          {/* Legal */}
          <div className="text-center text-caption text-slate font-sans">
            <p>AI for PI Newsletter</p>
            <p className="mt-2">
              <a href="#" className="underline hover:text-charcoal">
                Unsubscribe
              </a>
              {' · '}
              <a href="#" className="underline hover:text-charcoal">
                Preferences
              </a>
            </p>
          </div>
        </footer>
      </article>
    </motion.div>
  );
};

export default EnhancedNewsletterPreview;
