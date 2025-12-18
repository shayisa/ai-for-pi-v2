/**
 * Template Routes
 *
 * CRUD operations for newsletter templates.
 * Templates define reusable structures for newsletter generation.
 *
 * @module routes/template
 *
 * ## Endpoints
 * - GET    /api/templates              - List all templates
 * - GET    /api/templates/search       - Search templates by query
 * - GET    /api/templates/:id          - Get template by ID
 * - POST   /api/templates              - Create template
 * - POST   /api/templates/from-newsletter - Create template from existing newsletter
 * - PUT    /api/templates/:id          - Update template
 * - DELETE /api/templates/:id          - Delete template
 *
 * ## Migration Notes
 * - Original location: server.ts:2836-2962
 * - Service: templateDbService
 */
import { Router, Request, Response } from 'express';
import * as templateDbService from '../services/templateDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/templates
 *
 * List all templates with optional limit.
 *
 * @query {number} limit - Maximum number of templates to return (default: 50)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const templates = templateDbService.getTemplates(limit);

    logger.info('templates', 'list', `Listed ${templates.length} templates`, { correlationId, limit });
    sendSuccess(res, { templates, count: templates.length });
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'list_error', `Failed to list templates: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch templates', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/templates/search
 *
 * Search templates by query string.
 *
 * @query {string} q - Search query (required)
 * @query {number} limit - Maximum number of results (default: 20)
 */
router.get('/search', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      logger.warn('templates', 'search_validation_error', 'Search query (q) is required', { correlationId });
      return sendError(res, 'Search query (q) is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const templates = templateDbService.searchTemplates(query, limit);

    logger.info('templates', 'search', `Found ${templates.length} templates for query: ${query}`, { correlationId });
    sendSuccess(res, { templates, count: templates.length });
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'search_error', `Failed to search templates: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to search templates', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/templates/:id
 *
 * Get a template by ID.
 *
 * @param {string} id - Template ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const template = templateDbService.getTemplateById(req.params.id);

    if (!template) {
      logger.warn('templates', 'not_found', `Template not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Template not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('templates', 'get', `Retrieved template: ${req.params.id}`, { correlationId });
    sendSuccess(res, template);
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'get_error', `Failed to get template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch template', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/templates
 *
 * Create a new template.
 *
 * @body {string} name - Template name (required)
 * @body {string} description - Template description
 * @body {object} structure - Template structure (required)
 * @body {object} defaultSettings - Default settings for this template
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { name, description, structure, defaultSettings } = req.body;

    if (!name || !structure) {
      logger.warn('templates', 'validation_error', 'name and structure are required', { correlationId });
      return sendError(res, 'name and structure are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const template = templateDbService.createTemplate(
      name,
      description || '',
      structure,
      defaultSettings
    );

    logger.info('templates', 'create', `Created template: ${template.id}`, { correlationId, templateName: name });
    sendSuccess(res, template, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'create_error', `Failed to create template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create template', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/templates/from-newsletter
 *
 * Create a template from an existing newsletter.
 *
 * @body {string} name - Template name (required)
 * @body {string} description - Template description
 * @body {object} newsletter - Newsletter object with sections (required)
 * @body {object} settings - Settings to apply to template
 */
router.post('/from-newsletter', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { name, description, newsletter, settings } = req.body;

    if (!name || !newsletter || !newsletter.sections) {
      logger.warn('templates', 'from_newsletter_validation_error', 'name and newsletter with sections are required', {
        correlationId,
      });
      return sendError(res, 'name and newsletter with sections are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const template = templateDbService.createTemplateFromNewsletter(
      name,
      description || '',
      newsletter,
      settings
    );

    logger.info('templates', 'create_from_newsletter', `Created template from newsletter: ${template.id}`, {
      correlationId,
      templateName: name,
    });
    sendSuccess(res, template, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'create_from_newsletter_error', `Failed to create template from newsletter: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to create template from newsletter', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * PUT /api/templates/:id
 *
 * Update a template.
 *
 * @param {string} id - Template ID
 * @body {object} updates - Fields to update
 */
router.put('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updates = req.body;
    const template = templateDbService.updateTemplate(req.params.id, updates);

    if (!template) {
      logger.warn('templates', 'update_not_found', `Template not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Template not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('templates', 'update', `Updated template: ${req.params.id}`, { correlationId });
    sendSuccess(res, template);
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'update_error', `Failed to update template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update template', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/templates/:id
 *
 * Delete a template.
 *
 * @param {string} id - Template ID
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = templateDbService.deleteTemplate(req.params.id);

    if (!success) {
      logger.warn('templates', 'delete_not_found', `Template not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Template not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('templates', 'delete', `Deleted template: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Template deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('templates', 'delete_error', `Failed to delete template: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete template', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
