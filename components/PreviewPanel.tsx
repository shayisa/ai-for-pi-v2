/**
 * PreviewPanel Component
 *
 * Right panel of the Generate Newsletter page containing:
 * - Empty state (when no newsletter generated)
 * - Newsletter Preview (v1 or v2 based on format)
 * - Workflow Actions (Save to Drive, Send via Gmail)
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Newsletter, NewsletterSection, EnhancedNewsletter } from '../types';
import { NewsletterPreview } from './NewsletterPreview';
import { EnhancedNewsletterPreview } from './EnhancedNewsletterPreview';
import { BulkImageRegeneration } from './BulkImageRegeneration';
import { ActionButton } from './ActionButton';
import { DriveIcon, SendIcon, SparklesIcon, ImageIcon, CalendarIcon } from './IconComponents';
import { fadeInUp } from '../utils/animations';
import { useNewsletterSettings } from '../contexts';

interface PreviewPanelProps {
  // Newsletter content
  newsletter: Newsletter | null;
  enhancedNewsletter: EnhancedNewsletter | null;
  useEnhancedFormat: boolean;
  topics: string[];

  // Newsletter editing handlers
  onEditImage: (index: number, src: string, prompt: string) => void;
  onImageUpload: (sectionIndex: number, file: File) => void;
  onReorderSections: (newSections: NewsletterSection[]) => void;
  onUpdate: (field: keyof Newsletter | keyof NewsletterSection, value: string, sectionIndex?: number) => void;
  onEnhancedUpdate?: (field: string, value: string, sectionIndex?: number) => void;
  onGenerateImage?: (sectionIndex: number, imagePrompt: string) => Promise<void>;
  isLoading: boolean;

  // Phase 12.0: Bulk image regeneration
  onBulkUpdateSections?: (sections: NewsletterSection[]) => void;

  // Workflow actions
  onSaveToDrive?: () => Promise<void>;
  onSendViaGmail?: () => Promise<void>;
  isAuthenticated?: boolean;
  workflowStatus?: { savedToDrive: boolean; sentEmail: boolean };

  // Phase 16: Calendar entry linking
  calendarEntryId?: string | null;
  calendarEntryTitle?: string | null;
  onOpenCalendarPicker?: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  newsletter,
  enhancedNewsletter,
  useEnhancedFormat,
  topics,
  onEditImage,
  onImageUpload,
  onReorderSections,
  onUpdate,
  onEnhancedUpdate,
  onGenerateImage,
  isLoading,
  onBulkUpdateSections,
  onSaveToDrive,
  onSendViaGmail,
  isAuthenticated,
  workflowStatus,
  // Phase 16: Calendar entry linking
  calendarEntryId,
  calendarEntryTitle,
  onOpenCalendarPicker,
}) => {
  const hasNewsletter = useEnhancedFormat ? !!enhancedNewsletter : !!newsletter;

  // Phase 12.0: Get imageStyle from context for bulk regeneration
  const { selectedImageStyle } = useNewsletterSettings();

  // Phase 12.0: Bulk image regeneration modal state
  const [showBulkRegenModal, setShowBulkRegenModal] = useState(false);

  // Get sections for bulk regeneration (v1 format only for now)
  const sections = newsletter?.sections || [];

  // Handle bulk regeneration complete
  const handleBulkRegenComplete = (updatedSections: Array<{ title: string; imagePrompt?: string; imageUrl?: string }>) => {
    if (onBulkUpdateSections && newsletter) {
      // Map back to NewsletterSection format
      const newSections = sections.map((section, index) => ({
        ...section,
        imageUrl: updatedSections[index]?.imageUrl || section.imageUrl,
      }));
      onBulkUpdateSections(newSections);
    }
    setShowBulkRegenModal(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasNewsletter ? (
          // Empty State
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="h-full flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-pearl flex items-center justify-center mb-6">
              <SparklesIcon className="h-8 w-8 text-slate" />
            </div>
            <h3 className="font-display text-h3 text-ink mb-2">
              No Newsletter Yet
            </h3>
            <p className="font-serif text-body text-slate max-w-md">
              Configure your settings in the left panel and click "Generate Newsletter" to create your newsletter.
            </p>
          </motion.div>
        ) : (
          // Newsletter Preview
          <div className="p-4" id="newsletter-preview">
            {useEnhancedFormat && enhancedNewsletter ? (
              <EnhancedNewsletterPreview
                newsletter={enhancedNewsletter}
                topics={topics}
                onUpdate={onEnhancedUpdate}
                onEditImage={onEditImage}
                onImageUpload={onImageUpload}
                onGenerateImage={onGenerateImage}
                isLoading={isLoading}
              />
            ) : newsletter ? (
              <NewsletterPreview
                newsletter={newsletter}
                topics={topics}
                onEditImage={onEditImage}
                onImageUpload={onImageUpload}
                onReorderSections={onReorderSections}
                onUpdate={onUpdate}
                isLoading={isLoading}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Workflow Actions Footer - Only when newsletter exists and authenticated */}
      {hasNewsletter && isAuthenticated && (
        <div className="border-t border-border-subtle p-4 bg-paper flex-shrink-0">
          <div className="flex items-center gap-3">
            <p className="font-sans text-caption text-slate uppercase tracking-wider mr-auto">
              Actions
            </p>

            {/* Phase 12.0: Bulk Image Regeneration - only for v1 format */}
            {!useEnhancedFormat && sections.length > 0 && onBulkUpdateSections && (
              <button
                onClick={() => setShowBulkRegenModal(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 border border-editorial-navy text-editorial-navy font-sans text-sm hover:bg-editorial-navy hover:text-paper transition-colors disabled:opacity-50"
              >
                <ImageIcon className="h-4 w-4" />
                Regenerate Images
              </button>
            )}

            {/* Phase 16: Save to Calendar Entry / Linked Status */}
            {!calendarEntryId && onOpenCalendarPicker ? (
              <button
                onClick={onOpenCalendarPicker}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 border border-editorial-navy text-editorial-navy font-sans text-sm hover:bg-editorial-navy hover:text-paper transition-colors disabled:opacity-50"
              >
                <CalendarIcon className="h-4 w-4" />
                Save to Calendar
              </button>
            ) : calendarEntryId && calendarEntryTitle ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded">
                <CalendarIcon className="h-4 w-4" />
                <span>Linked: {calendarEntryTitle}</span>
              </div>
            ) : null}

            {/* Save to Drive */}
            {onSaveToDrive && (
              <ActionButton
                onClick={onSaveToDrive}
                idleText={workflowStatus?.savedToDrive ? 'Saved' : 'Save to Drive'}
                loadingText="Saving..."
                successText="Saved!"
                IdleIcon={DriveIcon}
                variant="secondary"
                className="text-sm py-2 px-4"
              />
            )}

            {/* Send via Gmail */}
            {onSendViaGmail && (
              <ActionButton
                onClick={onSendViaGmail}
                idleText={workflowStatus?.sentEmail ? 'Sent' : 'Send Email'}
                loadingText="Sending..."
                successText="Sent!"
                IdleIcon={SendIcon}
                variant="primary"
                className="text-sm py-2 px-4"
              />
            )}
          </div>
        </div>
      )}

      {/* Phase 12.0: Bulk Image Regeneration Modal */}
      <BulkImageRegeneration
        sections={sections}
        imageStyle={selectedImageStyle}
        isOpen={showBulkRegenModal}
        onClose={() => setShowBulkRegenModal(false)}
        onComplete={handleBulkRegenComplete}
      />
    </div>
  );
};

export default PreviewPanel;
