/**
 * File Extractor Service
 *
 * Phase 11b: Extracts text content from various file formats for prompt import.
 * Supports PDF, Office documents (docx, pptx, xlsx), and plain text files.
 */

import { parseOfficeAsync } from 'officeparser';
import { PDFParse } from 'pdf-parse';
import { logger } from '../control-plane/feedback';

// ============================================================================
// Types
// ============================================================================

export interface FileExtractionResult {
  success: boolean;
  content?: string;
  contentLength?: number;
  pageCount?: number;
  error?: string;
  extractionTimeMs: number;
}

export interface SupportedMimeInfo {
  extension: string;
  category: 'pdf' | 'office' | 'text';
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Mapping of supported MIME types to their metadata
 */
export const SUPPORTED_MIME_TYPES: Record<string, SupportedMimeInfo> = {
  // PDF
  'application/pdf': { extension: '.pdf', category: 'pdf', description: 'PDF Document' },

  // Microsoft Office
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: '.docx',
    category: 'office',
    description: 'Word Document',
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    extension: '.pptx',
    category: 'office',
    description: 'PowerPoint Presentation',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extension: '.xlsx',
    category: 'office',
    description: 'Excel Spreadsheet',
  },

  // Legacy Office formats (less common but supported)
  'application/msword': { extension: '.doc', category: 'office', description: 'Word Document (Legacy)' },
  'application/vnd.ms-powerpoint': {
    extension: '.ppt',
    category: 'office',
    description: 'PowerPoint (Legacy)',
  },
  'application/vnd.ms-excel': { extension: '.xls', category: 'office', description: 'Excel (Legacy)' },

  // OpenDocument formats
  'application/vnd.oasis.opendocument.text': { extension: '.odt', category: 'office', description: 'OpenDocument Text' },
  'application/vnd.oasis.opendocument.presentation': {
    extension: '.odp',
    category: 'office',
    description: 'OpenDocument Presentation',
  },
  'application/vnd.oasis.opendocument.spreadsheet': {
    extension: '.ods',
    category: 'office',
    description: 'OpenDocument Spreadsheet',
  },

  // Plain text
  'text/plain': { extension: '.txt', category: 'text', description: 'Plain Text' },
  'text/markdown': { extension: '.md', category: 'text', description: 'Markdown' },
  'text/x-markdown': { extension: '.md', category: 'text', description: 'Markdown' },
};

/**
 * Extension-based fallback for cases where MIME type detection fails
 */
export const EXTENSION_FALLBACKS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc': 'application/msword',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.xls': 'application/vnd.ms-excel',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

// Maximum file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return mimeType in SUPPORTED_MIME_TYPES;
}

/**
 * Get MIME type from filename extension (fallback)
 */
export function getMimeTypeFromFilename(filename: string): string | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return EXTENSION_FALLBACKS[ext] || null;
}

/**
 * Get supported file info for a MIME type
 */
export function getMimeTypeInfo(mimeType: string): SupportedMimeInfo | null {
  return SUPPORTED_MIME_TYPES[mimeType] || null;
}

/**
 * Get list of supported extensions for UI display
 */
export function getSupportedExtensions(): string[] {
  return Object.values(SUPPORTED_MIME_TYPES).map((info) => info.extension);
}

/**
 * Get accept string for HTML file input
 */
export function getAcceptString(): string {
  const mimeTypes = Object.keys(SUPPORTED_MIME_TYPES);
  const extensions = Object.keys(EXTENSION_FALLBACKS);
  return [...mimeTypes, ...extensions].join(',');
}

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract text from PDF buffer using pdf-parse v2 API
 */
async function extractFromPdf(buffer: Buffer): Promise<FileExtractionResult> {
  const startTime = Date.now();
  let parser: PDFParse | null = null;

  try {
    // Convert Buffer to Uint8Array for pdf-parse v2
    const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    parser = new PDFParse({ data });

    // Get text content from all pages
    const textResult = await parser.getText();
    const fullText = textResult.text.trim();

    // Get page count from info
    const info = await parser.getInfo();
    const pageCount = info.pages?.length || textResult.pages?.length || undefined;

    return {
      success: true,
      content: fullText,
      contentLength: fullText.length,
      pageCount,
      extractionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('file-extractor', 'pdf_extraction_failed', err.message, err);

    return {
      success: false,
      error: `PDF extraction failed: ${err.message}`,
      extractionTimeMs: Date.now() - startTime,
    };
  } finally {
    // Clean up pdf-parse resources
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}

/**
 * Extract text from Office documents (docx, pptx, xlsx, odt, odp, ods)
 * Uses officeparser which handles all these formats
 */
async function extractFromOffice(buffer: Buffer): Promise<FileExtractionResult> {
  const startTime = Date.now();

  try {
    // officeparser's parseOfficeAsync accepts Buffer and returns string
    const text = await parseOfficeAsync(buffer);

    return {
      success: true,
      content: text.trim(),
      contentLength: text.length,
      extractionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('file-extractor', 'office_extraction_failed', err.message, err);

    return {
      success: false,
      error: `Office document extraction failed: ${err.message}`,
      extractionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract text from plain text files (txt, md)
 */
function extractFromText(buffer: Buffer): FileExtractionResult {
  const startTime = Date.now();

  try {
    const text = buffer.toString('utf-8');

    return {
      success: true,
      content: text.trim(),
      contentLength: text.length,
      extractionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('file-extractor', 'text_extraction_failed', err.message, err);

    return {
      success: false,
      error: `Text extraction failed: ${err.message}`,
      extractionTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Extract text content from a file buffer
 *
 * @param buffer - The file content as a Buffer
 * @param mimeType - The MIME type of the file
 * @param filename - Optional filename (used for extension fallback)
 * @returns Extraction result with content or error
 */
export async function extractFromBuffer(
  buffer: Buffer,
  mimeType: string,
  filename?: string
): Promise<FileExtractionResult> {
  const startTime = Date.now();

  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `File too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      extractionTimeMs: Date.now() - startTime,
    };
  }

  // Resolve MIME type (use filename extension as fallback)
  let resolvedMimeType = mimeType;
  if (!isSupportedMimeType(mimeType) && filename) {
    const fallbackMime = getMimeTypeFromFilename(filename);
    if (fallbackMime) {
      resolvedMimeType = fallbackMime;
      logger.info('file-extractor', 'mime_fallback', `Using extension-based MIME type: ${fallbackMime}`);
    }
  }

  // Check if MIME type is supported
  const mimeInfo = getMimeTypeInfo(resolvedMimeType);
  if (!mimeInfo) {
    return {
      success: false,
      error: `Unsupported file type: ${mimeType}. Supported formats: ${getSupportedExtensions().join(', ')}`,
      extractionTimeMs: Date.now() - startTime,
    };
  }

  logger.info('file-extractor', 'extraction_start', `Extracting ${mimeInfo.description} (${mimeInfo.extension})`, {
    fileSize: buffer.length,
    mimeType: resolvedMimeType,
  });

  // Route to appropriate extractor based on category
  let result: FileExtractionResult;

  switch (mimeInfo.category) {
    case 'pdf':
      result = await extractFromPdf(buffer);
      break;

    case 'office':
      result = await extractFromOffice(buffer);
      break;

    case 'text':
      result = extractFromText(buffer);
      break;

    default:
      result = {
        success: false,
        error: `Unknown file category: ${mimeInfo.category}`,
        extractionTimeMs: Date.now() - startTime,
      };
  }

  if (result.success) {
    logger.info('file-extractor', 'extraction_complete', `Extracted ${result.contentLength} characters`, {
      pageCount: result.pageCount,
      extractionTimeMs: result.extractionTimeMs,
    });
  }

  return result;
}

export default {
  extractFromBuffer,
  isSupportedMimeType,
  getMimeTypeInfo,
  getMimeTypeFromFilename,
  getSupportedExtensions,
  getAcceptString,
  SUPPORTED_MIME_TYPES,
  EXTENSION_FALLBACKS,
  MAX_FILE_SIZE,
};
