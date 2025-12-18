/**
 * FileDropZone Component
 *
 * Phase 11g: Drag-and-drop file upload for prompt import.
 * Supports PDF, Office documents (docx, pptx, xlsx), and plain text files.
 */

import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { UploadIcon } from './IconComponents';

// Supported file extensions and MIME types
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.doc', '.ppt', '.xls', '.odt', '.odp', '.ods', '.txt', '.md'];
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
  compact?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileSelect,
  isLoading = false,
  error = null,
  disabled = false,
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`;
    }

    // Check MIME type
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      // Try extension fallback
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        return `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`;
      }
    }

    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const validationResult = validateFile(file);
      if (validationResult) {
        setValidationError(validationResult);
        return;
      }

      setValidationError(null);
      onFileSelect(file);
    },
    [validateFile, onFileSelect]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) {
        setIsDragging(true);
      }
    },
    [disabled, isLoading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isLoading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, isLoading, handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isLoading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isLoading]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input to allow selecting the same file again
      e.target.value = '';
    },
    [handleFile]
  );

  const displayError = error || validationError;

  return (
    <div className="w-full">
      <motion.div
        initial={false}
        animate={{
          borderColor: isDragging ? 'rgb(var(--color-ink))' : 'rgb(var(--color-charcoal))',
          backgroundColor: isDragging ? 'rgb(var(--color-paper))' : 'transparent',
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg transition-colors cursor-pointer
          ${compact ? 'p-3' : 'p-6'}
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-ink hover:bg-paper'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="sr-only"
          disabled={disabled || isLoading}
        />

        <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center gap-2'}`}>
          <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center text-slate`}>
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" strokeDasharray="50" strokeLinecap="round" />
                </svg>
              </motion.div>
            ) : (
              <UploadIcon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
            )}
          </div>

          <div className={compact ? 'flex-1 min-w-0' : 'text-center'}>
            <p className={`font-sans text-ink ${compact ? 'text-caption' : 'text-ui'}`}>
              {isLoading
                ? 'Importing...'
                : isDragging
                  ? 'Drop file here'
                  : compact
                    ? 'Drop file or click to browse'
                    : 'Drag & drop a file or click to browse'}
            </p>
            {!compact && !isLoading && (
              <p className="font-sans text-caption text-slate mt-1">
                PDF, Word, PowerPoint, Excel, or text files (max 10MB)
              </p>
            )}
          </div>
        </div>

        {/* Drag overlay */}
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-paper/80 rounded-lg flex items-center justify-center"
          >
            <p className="font-sans text-ui font-medium text-ink">Drop to import</p>
          </motion.div>
        )}
      </motion.div>

      {/* Error display */}
      {displayError && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-sans text-caption text-coral mt-2"
        >
          {displayError}
        </motion.p>
      )}
    </div>
  );
};

export default FileDropZone;
