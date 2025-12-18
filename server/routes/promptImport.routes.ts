/**
 * Prompt Import Routes
 *
 * Phase 11e: API endpoints for importing prompts from URLs and files.
 * Supports multi-strategy parsing with templates and AI fallback.
 *
 * @module routes/promptImport
 *
 * ## Endpoints
 * - POST   /api/prompts/import/url            - Import from URL
 * - POST   /api/prompts/import/file           - Import from file upload
 * - GET    /api/prompts/import/templates      - List parsing templates
 * - POST   /api/prompts/import/templates      - Create parsing template
 * - PUT    /api/prompts/import/templates/:id  - Update parsing template
 * - DELETE /api/prompts/import/templates/:id  - Delete parsing template
 * - GET    /api/prompts/import/logs           - Get import history
 * - GET    /api/prompts/import/stats          - Get import statistics
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

// Services
import { extractArticle } from '../services/articleExtractorService';
import { extractFromBuffer, isSupportedMimeType, getAcceptString, MAX_FILE_SIZE } from '../services/fileExtractorService';
import { parsePromptContent } from '../services/promptParserService';
import * as importDbService from '../services/promptImportDbService';
import type { ImportSourceType, ParsingMethod } from '../../types';

const router = Router();

// ============================================================================
// JavaScript-Rendered URL Detection
// ============================================================================

/**
 * Known domains that use JavaScript rendering and cannot be extracted with
 * standard article extractors. These require either:
 * 1. Official API integration (e.g., Notion API)
 * 2. Headless browser rendering
 * 3. Export and upload as file alternative
 */
const JS_RENDERED_DOMAINS = [
  // Notion
  { pattern: /notion\.site$/i, name: 'Notion', suggestion: 'Export the page as Markdown or PDF from Notion, then upload the file instead.' },
  { pattern: /notion\.so$/i, name: 'Notion', suggestion: 'Export the page as Markdown or PDF from Notion, then upload the file instead.' },
  // Google Docs/Sheets/Slides
  { pattern: /docs\.google\.com$/i, name: 'Google Docs', suggestion: 'Export as DOCX or PDF from Google Docs, then upload the file.' },
  { pattern: /sheets\.google\.com$/i, name: 'Google Sheets', suggestion: 'Export as XLSX or CSV from Google Sheets, then upload the file.' },
  { pattern: /slides\.google\.com$/i, name: 'Google Slides', suggestion: 'Export as PPTX or PDF from Google Slides, then upload the file.' },
  // Other SPAs
  { pattern: /figma\.com$/i, name: 'Figma', suggestion: 'Copy the content manually or use Figma\'s export feature.' },
  { pattern: /miro\.com$/i, name: 'Miro', suggestion: 'Export the board content and upload the file.' },
  { pattern: /airtable\.com$/i, name: 'Airtable', suggestion: 'Export to CSV and upload the file.' },
];

/**
 * Check if a URL is from a known JavaScript-rendered domain
 */
function checkJsRenderedUrl(url: string): { isJsRendered: boolean; name?: string; suggestion?: string } {
  try {
    const hostname = new URL(url).hostname;
    for (const domain of JS_RENDERED_DOMAINS) {
      if (domain.pattern.test(hostname)) {
        return { isJsRendered: true, name: domain.name, suggestion: domain.suggestion };
      }
    }
    return { isJsRendered: false };
  } catch {
    return { isJsRendered: false };
  }
}

// ============================================================================
// Multer Configuration for File Uploads
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // Check both MIME type and extension
    if (isSupportedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: ${getAcceptString()}`));
    }
  },
});

// ============================================================================
// Import Endpoints
// ============================================================================

/**
 * POST /api/prompts/import/url
 *
 * Import a prompt from a URL.
 * Uses article extractor to fetch content, then parses with fallback chain.
 *
 * @body {string} url - URL to import from (required)
 * @body {string} templateId - Optional template ID to use for parsing
 * @body {ParsingMethod} forceMethod - Optional: force specific parsing method
 * @body {string} userEmail - Optional: user email for API key lookup
 */
router.post('/url', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const startTime = Date.now();

  try {
    const { url, templateId, forceMethod, userEmail } = req.body;

    if (!url || typeof url !== 'string') {
      logger.warn('prompt-import', 'url_validation_error', 'URL is required', { correlationId });
      return sendError(res, 'URL is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      logger.warn('prompt-import', 'url_invalid', `Invalid URL format: ${url}`, { correlationId });
      return sendError(res, 'Invalid URL format', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    logger.info('prompt-import', 'url_import_start', `Importing from URL: ${url}`, { correlationId });

    // Check for known JavaScript-rendered URLs that can't be extracted
    const jsCheck = checkJsRenderedUrl(url);
    if (jsCheck.isJsRendered) {
      logger.warn('prompt-import', 'url_js_rendered', `URL is from JavaScript-rendered domain: ${jsCheck.name}`, {
        correlationId,
        url,
        domain: jsCheck.name,
      });
      return sendError(
        res,
        `Cannot extract content from ${jsCheck.name} pages directly. ${jsCheck.suggestion}`,
        ErrorCodes.VALIDATION_ERROR,
        correlationId,
        { domain: jsCheck.name, suggestion: jsCheck.suggestion }
      );
    }

    // Generate import ID for tracking
    const importId = importDbService.generateImportId();

    // Step 1: Extract content from URL
    const extractResult = await extractArticle(url);

    if (!extractResult.success || !extractResult.content) {
      logger.warn('prompt-import', 'url_extraction_failed', `Failed to extract content: ${extractResult.error}`, {
        correlationId,
        url,
      });

      // Log the failed import
      importDbService.logImport({
        importId,
        sourceType: 'url',
        sourceIdentifier: url,
        parsingMethod: 'regex',
        success: false,
        errorMessage: extractResult.error || 'Failed to extract content from URL',
        rawContentLength: 0,
        processingTimeMs: Date.now() - startTime,
      });

      return sendError(res, `Failed to extract content from URL: ${extractResult.error}`, ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    // Step 2: Find matching template if not specified
    let template = templateId ? importDbService.getTemplateById(templateId) : null;
    if (!template) {
      // Try to find a matching template by domain pattern
      const domain = new URL(url).hostname;
      template = importDbService.findMatchingTemplate('url', domain);
    }

    // Step 3: Parse the content
    const parseResult = await parsePromptContent(extractResult.content, {
      forceMethod: forceMethod as ParsingMethod | undefined,
      template: template || undefined,
      sourceHint: url,
      userEmail,
    });

    // Step 4: Log the import
    importDbService.logImport({
      importId,
      sourceType: 'url',
      sourceIdentifier: url,
      templateId: template?.id,
      parsingMethod: parseResult.parsingMethod,
      success: parseResult.success,
      errorMessage: parseResult.error,
      parsedFields: parseResult.fields,
      rawContentLength: extractResult.content.length,
      processingTimeMs: Date.now() - startTime,
    });

    logger.info('prompt-import', 'url_import_complete', `Import ${parseResult.success ? 'succeeded' : 'partially succeeded'}`, {
      correlationId,
      importId,
      parsingMethod: parseResult.parsingMethod,
      confidence: parseResult.confidence,
    });

    sendSuccess(res, {
      importId,
      ...parseResult,
      sourceUrl: url,
      templateUsed: template?.name,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'url_import_error', `URL import failed: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to import from URL', ErrorCodes.INTERNAL_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/prompts/import/file
 *
 * Import a prompt from an uploaded file.
 * Supports PDF, Office documents (docx, pptx, xlsx), and plain text.
 *
 * @body {File} file - File to import (multipart/form-data)
 * @body {string} templateId - Optional template ID to use for parsing
 * @body {ParsingMethod} forceMethod - Optional: force specific parsing method
 * @body {string} userEmail - Optional: user email for API key lookup
 */
router.post('/file', upload.single('file'), async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const startTime = Date.now();

  try {
    if (!req.file) {
      logger.warn('prompt-import', 'file_missing', 'No file uploaded', { correlationId });
      return sendError(res, 'No file uploaded', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const { templateId, forceMethod, userEmail } = req.body;
    const file = req.file;

    logger.info('prompt-import', 'file_import_start', `Importing file: ${file.originalname}`, {
      correlationId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });

    // Generate import ID for tracking
    const importId = importDbService.generateImportId();

    // Step 1: Extract text from file
    const extractResult = await extractFromBuffer(file.buffer, file.mimetype, file.originalname);

    if (!extractResult.success || !extractResult.content) {
      logger.warn('prompt-import', 'file_extraction_failed', `Failed to extract content: ${extractResult.error}`, {
        correlationId,
        filename: file.originalname,
      });

      // Log the failed import
      importDbService.logImport({
        importId,
        sourceType: 'file',
        sourceIdentifier: file.originalname,
        parsingMethod: 'regex',
        success: false,
        errorMessage: extractResult.error || 'Failed to extract content from file',
        rawContentLength: file.size,
        processingTimeMs: Date.now() - startTime,
      });

      return sendError(res, `Failed to extract content from file: ${extractResult.error}`, ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Step 2: Find matching template if not specified
    let template = templateId ? importDbService.getTemplateById(templateId) : null;
    if (!template) {
      // Try to find a matching template by file extension
      const ext = file.originalname.slice(file.originalname.lastIndexOf('.'));
      template = importDbService.findMatchingTemplate('file', ext);
    }

    // Step 3: Parse the content
    const parseResult = await parsePromptContent(extractResult.content, {
      forceMethod: forceMethod as ParsingMethod | undefined,
      template: template || undefined,
      sourceHint: `file:${file.originalname}`,
      userEmail,
    });

    // Step 4: Log the import
    importDbService.logImport({
      importId,
      sourceType: 'file',
      sourceIdentifier: file.originalname,
      templateId: template?.id,
      parsingMethod: parseResult.parsingMethod,
      success: parseResult.success,
      errorMessage: parseResult.error,
      parsedFields: parseResult.fields,
      rawContentLength: extractResult.content.length,
      processingTimeMs: Date.now() - startTime,
    });

    logger.info('prompt-import', 'file_import_complete', `Import ${parseResult.success ? 'succeeded' : 'partially succeeded'}`, {
      correlationId,
      importId,
      parsingMethod: parseResult.parsingMethod,
      confidence: parseResult.confidence,
    });

    sendSuccess(res, {
      importId,
      ...parseResult,
      filename: file.originalname,
      templateUsed: template?.name,
      pageCount: extractResult.pageCount,
    });
  } catch (error) {
    const err = error as Error;

    // Handle multer errors specifically
    if (err.message.includes('Unsupported file type') || err.message.includes('File too large')) {
      logger.warn('prompt-import', 'file_validation_error', err.message, { correlationId });
      return sendError(res, err.message, ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    logger.error('prompt-import', 'file_import_error', `File import failed: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to import file', ErrorCodes.INTERNAL_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Template Endpoints
// ============================================================================

/**
 * GET /api/prompts/import/templates
 *
 * List all parsing templates.
 *
 * @query {ImportSourceType} sourceType - Filter by source type
 * @query {number} limit - Maximum number of templates (default: 50)
 */
router.get('/templates', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const sourceType = req.query.sourceType as ImportSourceType | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const templates = importDbService.getTemplates({ sourceType, limit });

    logger.info('prompt-import', 'templates_list', `Listed ${templates.length} templates`, { correlationId });

    sendSuccess(res, { templates, count: templates.length });
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'templates_list_error', `Failed to list templates: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch templates', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * POST /api/prompts/import/templates
 *
 * Create a new parsing template.
 * Per user preference: User must confirm before saving.
 *
 * @body {string} name - Template name (required)
 * @body {ImportSourceType} sourceType - Source type: 'url' or 'file' (required)
 * @body {string} sourcePattern - Regex pattern to match sources (required)
 * @body {string} parsingInstructions - Instructions for using this template
 * @body {FieldPatterns} fieldPatterns - Regex patterns for each field
 * @body {string} createdBy - Creator identifier
 */
router.post('/templates', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { name, sourceType, sourcePattern, parsingInstructions, fieldPatterns, createdBy } = req.body;

    // Validation
    if (!name || !sourceType || !sourcePattern) {
      logger.warn('prompt-import', 'template_validation_error', 'name, sourceType, and sourcePattern are required', { correlationId });
      return sendError(res, 'name, sourceType, and sourcePattern are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    if (!['url', 'file'].includes(sourceType)) {
      return sendError(res, 'sourceType must be "url" or "file"', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Validate sourcePattern is valid regex
    try {
      new RegExp(sourcePattern);
    } catch {
      return sendError(res, 'sourcePattern must be a valid regular expression', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const template = importDbService.createTemplate({
      name,
      sourceType,
      sourcePattern,
      parsingInstructions: parsingInstructions || '',
      fieldPatterns: fieldPatterns || {},
      createdBy,
    });

    logger.info('prompt-import', 'template_create', `Created template: ${template.id}`, { correlationId, templateId: template.id });

    sendSuccess(res, template, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'template_create_error', `Failed to create template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create template', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * PUT /api/prompts/import/templates/:id
 *
 * Update an existing parsing template.
 *
 * @param {string} id - Template ID
 * @body {string} name - New template name
 * @body {string} sourcePattern - New source pattern
 * @body {string} parsingInstructions - New parsing instructions
 * @body {FieldPatterns} fieldPatterns - New field patterns
 */
router.put('/templates/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate sourcePattern if provided
    if (updates.sourcePattern) {
      try {
        new RegExp(updates.sourcePattern);
      } catch {
        return sendError(res, 'sourcePattern must be a valid regular expression', ErrorCodes.VALIDATION_ERROR, correlationId);
      }
    }

    const template = importDbService.updateTemplate(id, updates);

    if (!template) {
      logger.warn('prompt-import', 'template_not_found', `Template not found: ${id}`, { correlationId });
      return sendError(res, 'Template not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('prompt-import', 'template_update', `Updated template: ${id}`, { correlationId });

    sendSuccess(res, template);
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'template_update_error', `Failed to update template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update template', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * DELETE /api/prompts/import/templates/:id
 *
 * Delete a parsing template.
 *
 * @param {string} id - Template ID to delete
 */
router.delete('/templates/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { id } = req.params;

    const deleted = importDbService.deleteTemplate(id);

    if (!deleted) {
      logger.warn('prompt-import', 'template_delete_not_found', `Template not found for deletion: ${id}`, { correlationId });
      return sendError(res, 'Template not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('prompt-import', 'template_delete', `Deleted template: ${id}`, { correlationId });

    sendSuccess(res, { success: true, message: 'Template deleted successfully' });
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'template_delete_error', `Failed to delete template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete template', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

// ============================================================================
// Log Endpoints
// ============================================================================

/**
 * GET /api/prompts/import/logs
 *
 * Get import history logs.
 * Per user preference: Keep last 100 per user.
 *
 * @query {ImportSourceType} sourceType - Filter by source type
 * @query {ParsingMethod} parsingMethod - Filter by parsing method
 * @query {boolean} success - Filter by success status
 * @query {number} limit - Maximum number of logs (default: 100)
 * @query {number} offset - Pagination offset (default: 0)
 */
router.get('/logs', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const sourceType = req.query.sourceType as ImportSourceType | undefined;
    const parsingMethod = req.query.parsingMethod as ParsingMethod | undefined;
    const successParam = req.query.success;
    const success = successParam === 'true' ? true : successParam === 'false' ? false : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100); // Cap at 100
    const offset = parseInt(req.query.offset as string) || 0;

    const result = importDbService.getImportLogs({
      sourceType,
      parsingMethod,
      success,
      limit,
      offset,
    });

    logger.info('prompt-import', 'logs_list', `Listed ${result.logs.length} import logs`, { correlationId });

    sendSuccess(res, {
      logs: result.logs,
      total: result.total,
      hasMore: offset + result.logs.length < result.total,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'logs_list_error', `Failed to list logs: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch import logs', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

/**
 * GET /api/prompts/import/stats
 *
 * Get import statistics.
 */
router.get('/stats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const stats = importDbService.getImportStats();

    logger.info('prompt-import', 'stats_get', 'Retrieved import stats', { correlationId });

    sendSuccess(res, stats);
  } catch (error) {
    const err = error as Error;
    logger.error('prompt-import', 'stats_error', `Failed to get stats: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch import statistics', ErrorCodes.DATABASE_ERROR, correlationId, { details: err.message });
  }
});

export default router;
