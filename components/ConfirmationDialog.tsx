/**
 * ConfirmationDialog Component
 *
 * A reusable modal dialog for confirming destructive or important actions.
 * Features:
 * - Animated overlay and content
 * - Customizable title, message, and button text
 * - Destructive action styling option
 * - Keyboard support (Escape to close)
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalOverlay, modalContent } from '../utils/animations';
import { XIcon } from './IconComponents';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={!isLoading ? onClose : undefined}
            className="absolute inset-0 bg-ink/60"
          />

          {/* Dialog Content */}
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative bg-paper border border-border-subtle shadow-xl max-w-md w-full"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2
                id="dialog-title"
                className="font-display text-h3 text-ink"
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="p-1 text-slate hover:text-ink transition-colors disabled:opacity-50"
                aria-label="Close dialog"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="font-serif text-body text-charcoal">
                {message}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border-subtle bg-pearl/50">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="font-sans text-ui text-charcoal hover:text-ink py-2 px-4 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`font-sans text-ui font-medium py-2 px-6 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDestructive
                    ? 'bg-editorial-red text-paper hover:bg-red-700'
                    : 'bg-ink text-paper hover:bg-charcoal'
                }`}
              >
                {isLoading ? 'Processing...' : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmationDialog;
