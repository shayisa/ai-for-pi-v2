/**
 * Persona Routes
 *
 * CRUD operations for writer personas.
 * Personas define the voice and style for newsletter content.
 *
 * @module routes/persona
 *
 * ## Endpoints
 * - GET    /api/personas              - List all personas
 * - GET    /api/personas/active       - Get active persona
 * - GET    /api/personas/stats        - Get persona statistics
 * - GET    /api/personas/:id          - Get persona by ID
 * - POST   /api/personas              - Create persona
 * - PUT    /api/personas/:id          - Update persona
 * - DELETE /api/personas/:id          - Delete persona
 * - POST   /api/personas/:id/activate - Set as active persona
 * - POST   /api/personas/:id/favorite - Toggle favorite status
 *
 * ## Migration Notes
 * - Original location: server.ts:2848-2990
 * - Service: personaDbService
 */
import { Router, Request, Response } from 'express';
import * as personaDbService from '../services/personaDbService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/personas
 *
 * List all personas.
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const personas = personaDbService.getAllPersonas();

    logger.info('personas', 'list', `Listed ${personas.length} personas`, { correlationId });
    sendSuccess(res, personas);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'list_error', `Failed to list personas: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch personas', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/personas/active
 *
 * Get the currently active persona.
 */
router.get('/active', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const persona = personaDbService.getActivePersona();

    logger.info('personas', 'get_active', `Retrieved active persona`, { correlationId, hasActive: !!persona });
    sendSuccess(res, persona);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'get_active_error', `Failed to get active persona: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch active persona', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/personas/stats
 *
 * Get persona statistics.
 */
router.get('/stats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const stats = personaDbService.getPersonaCount();
    const active = personaDbService.getActivePersona();

    const result = {
      total: stats.total,
      default: stats.default,
      custom: stats.custom,
      active: active?.id || null,
    };

    logger.info('personas', 'get_stats', `Retrieved persona stats`, { correlationId, ...result });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'get_stats_error', `Failed to get persona stats: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch persona stats', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/personas/:id/activate
 *
 * Set a persona as active, or deactivate all with id='none'.
 *
 * @param {string} id - Persona ID or 'none' to deactivate
 */
router.post('/:id/activate', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const id = req.params.id === 'none' ? null : req.params.id;
    personaDbService.setActivePersona(id);

    logger.info('personas', 'activate', `Activated persona: ${id || 'none'}`, { correlationId });
    sendSuccess(res, { success: true, activePersonaId: id });
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'activate_error', `Failed to activate persona: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to activate persona', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/personas/:id/favorite
 *
 * Toggle favorite status for a persona.
 *
 * @param {string} id - Persona ID
 */
router.post('/:id/favorite', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const persona = personaDbService.togglePersonaFavorite(req.params.id);

    if (!persona) {
      logger.warn('personas', 'favorite_not_found', `Persona not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Persona not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('personas', 'toggle_favorite', `Toggled favorite for persona: ${req.params.id}`, { correlationId });
    sendSuccess(res, persona);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'favorite_error', `Failed to toggle favorite: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to toggle favorite', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/personas/:id
 *
 * Get a persona by ID.
 *
 * @param {string} id - Persona ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const persona = personaDbService.getPersonaById(req.params.id);

    if (!persona) {
      logger.warn('personas', 'not_found', `Persona not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Persona not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('personas', 'get', `Retrieved persona: ${req.params.id}`, { correlationId });
    sendSuccess(res, persona);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'get_error', `Failed to get persona: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch persona', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * POST /api/personas
 *
 * Create a new persona.
 *
 * @body {string} name - Persona name (required)
 * @body {string} tagline - Short tagline
 * @body {string} expertise - Area of expertise
 * @body {string} values - Core values
 * @body {string} writingStyle - Writing style description
 * @body {string[]} signatureElements - Signature style elements
 * @body {string} sampleWriting - Sample writing example
 */
router.post('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { name, tagline, expertise, values, writingStyle, signatureElements, sampleWriting } = req.body;

    if (!name) {
      logger.warn('personas', 'validation_error', 'name is required', { correlationId });
      return sendError(res, 'name is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const persona = personaDbService.createPersona(
      name,
      tagline || '',
      expertise || '',
      values || '',
      writingStyle || '',
      signatureElements || [],
      sampleWriting || ''
    );

    logger.info('personas', 'create', `Created persona: ${persona.id}`, { correlationId, personaName: name });
    sendSuccess(res, persona, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'create_error', `Failed to create persona: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to create persona', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * PUT /api/personas/:id
 *
 * Update a persona.
 *
 * @param {string} id - Persona ID
 * @body {object} updates - Fields to update
 */
router.put('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const updates = req.body;
    const persona = personaDbService.updatePersona(req.params.id, updates);

    if (!persona) {
      logger.warn('personas', 'update_not_found', `Persona not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Persona not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('personas', 'update', `Updated persona: ${req.params.id}`, { correlationId });
    sendSuccess(res, persona);
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'update_error', `Failed to update persona: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to update persona', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * DELETE /api/personas/:id
 *
 * Delete a persona.
 *
 * @param {string} id - Persona ID
 */
router.delete('/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const success = personaDbService.deletePersona(req.params.id);

    if (!success) {
      logger.warn('personas', 'delete_not_found', `Persona not found or cannot be deleted: ${req.params.id}`, {
        correlationId,
      });
      return sendError(res, 'Persona not found or cannot be deleted', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('personas', 'delete', `Deleted persona: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Persona deleted' });
  } catch (error) {
    const err = error as Error;
    logger.error('personas', 'delete_error', `Failed to delete persona: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to delete persona', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
