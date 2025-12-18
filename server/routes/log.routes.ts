/**
 * Log Routes
 *
 * Comprehensive endpoints for system logs with:
 * - Full Control Plane log access (system_logs table)
 * - Legacy unified logs (newsletter_logs + api_key_audit_log)
 * - User settings for retention and query limits
 * - Log cleanup controls
 *
 * @module routes/log
 *
 * ## Endpoints
 * ### System Logs (New - Full Visibility)
 * - GET /api/logs/system         - Get system logs with filtering
 * - GET /api/logs/system/export  - Export system logs to CSV
 * - GET /api/logs/system/stats   - Get system log statistics
 * - GET /api/logs/system/modules - Get list of modules with counts
 * - GET /api/logs/system/trace/:correlationId - Get logs by correlation ID
 *
 * ### User Settings
 * - GET /api/logs/settings       - Get user's log settings
 * - PUT /api/logs/settings       - Update user's log settings
 *
 * ### Cleanup
 * - POST /api/logs/cleanup       - Trigger manual cleanup
 * - GET /api/logs/cleanup/status - Get cleanup scheduler status
 *
 * ### Legacy Unified Logs (Backward Compatibility)
 * - GET /api/logs                - Get unified logs (newsletter + api_key)
 * - GET /api/logs/export         - Export unified logs to CSV
 * - GET /api/logs/stats          - Get unified log statistics
 */
import { Router, Request, Response } from 'express';
import * as logDbService from '../services/logDbService';
import * as systemLogDb from '../services/systemLogDbService';
import * as logCleanupService from '../services/logCleanupService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

// =============================================================================
// SYSTEM LOGS (New - Full Control Plane Visibility)
// =============================================================================

/**
 * GET /api/logs/system
 *
 * Get system logs with comprehensive filtering.
 *
 * @query {string} correlationId - Filter by correlation ID
 * @query {string} level - Filter by level (debug, info, warn, error)
 * @query {string} module - Filter by module name
 * @query {string} action - Filter by action
 * @query {string} userId - Filter by user ID
 * @query {string} search - Search in message, module, action
 * @query {string} startDate - Filter start date
 * @query {string} endDate - Filter end date
 * @query {number} limit - Maximum logs (default: 50, max: 1000)
 * @query {number} offset - Offset for pagination
 * @query {string} userEmail - User email for settings lookup
 */
router.get('/system', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    // Get user settings if email provided
    const userEmail = req.query.userEmail as string | undefined;
    const settings = userEmail ? systemLogDb.getUserLogSettings(userEmail) : undefined;

    const options: systemLogDb.SystemLogFilterOptions = {
      correlationId: req.query.correlationId as string | undefined,
      level: req.query.level as systemLogDb.LogLevel | undefined,
      module: req.query.module as string | undefined,
      action: req.query.action as string | undefined,
      userId: req.query.userId as string | undefined,
      search: req.query.search as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = systemLogDb.getSystemLogs(options, settings);

    logger.info('logs', 'system_list', `Listed ${result.logs.length} system logs`, {
      correlationId,
      total: result.total,
      queryLimit: result.queryLimit,
    });

    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'system_list_error', `Failed to list system logs: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch system logs', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/system/export
 *
 * Export system logs to CSV.
 */
router.get('/system/export', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const options: systemLogDb.SystemLogFilterOptions = {
      correlationId: req.query.correlationId as string | undefined,
      level: req.query.level as systemLogDb.LogLevel | undefined,
      module: req.query.module as string | undefined,
      action: req.query.action as string | undefined,
      search: req.query.search as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const csvContent = systemLogDb.exportLogsToCsv(options);
    const timestamp = new Date().toISOString().split('T')[0];

    logger.info('logs', 'system_export', `Exported system logs to CSV`, { correlationId });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=system-logs-${timestamp}.csv`);
    res.send(csvContent);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'system_export_error', `Failed to export system logs: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to export system logs', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/system/stats
 *
 * Get system log statistics.
 */
router.get('/system/stats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const stats = systemLogDb.getLogStats();

    logger.info('logs', 'system_stats', `Retrieved system log statistics`, {
      correlationId,
      totalLogs: stats.totalLogs,
    });

    sendSuccess(res, stats);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'system_stats_error', `Failed to get system log stats: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch system log stats', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/system/modules
 *
 * Get list of logged modules with counts.
 */
router.get('/system/modules', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const modules = systemLogDb.getModules();

    logger.info('logs', 'system_modules', `Retrieved ${modules.length} modules`, { correlationId });

    sendSuccess(res, { modules });
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'system_modules_error', `Failed to get modules: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch modules', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/system/actions/:module
 *
 * Get list of actions for a module with counts.
 */
router.get('/system/actions/:module', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const actions = systemLogDb.getActionsForModule(req.params.module);

    logger.info('logs', 'system_actions', `Retrieved ${actions.length} actions for ${req.params.module}`, {
      correlationId,
    });

    sendSuccess(res, { actions });
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'system_actions_error', `Failed to get actions: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch actions', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/system/trace/:correlationId
 *
 * Get all logs for a specific correlation ID (request tracing).
 */
router.get('/system/trace/:correlationId', (req: Request, res: Response) => {
  const currentCorrelationId = getCorrelationId();
  const targetCorrelationId = req.params.correlationId;

  try {
    const logs = systemLogDb.getLogsByCorrelationId(targetCorrelationId);

    logger.info('logs', 'system_trace', `Traced ${logs.length} logs for ${targetCorrelationId}`, {
      correlationId: currentCorrelationId,
    });

    sendSuccess(res, { logs, correlationId: targetCorrelationId });
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'system_trace_error', `Failed to trace logs: ${err.message}`, err, {
      correlationId: currentCorrelationId,
    });
    sendError(res, 'Failed to trace logs', ErrorCodes.DATABASE_ERROR, currentCorrelationId);
  }
});

// =============================================================================
// USER SETTINGS
// =============================================================================

/**
 * GET /api/logs/settings
 *
 * Get user's log settings.
 *
 * @query {string} userEmail - User email (required)
 */
router.get('/settings', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const userEmail = req.query.userEmail as string;

  try {
    if (!userEmail) {
      logger.warn('logs', 'settings_validation_error', 'userEmail is required', { correlationId });
      return sendError(res, 'userEmail query parameter is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const settings = systemLogDb.getUserLogSettings(userEmail);

    logger.info('logs', 'settings_get', `Retrieved log settings for ${userEmail}`, { correlationId });

    sendSuccess(res, settings);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'settings_get_error', `Failed to get log settings: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch log settings', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * PUT /api/logs/settings
 *
 * Update user's log settings.
 *
 * @body {string} userEmail - User email (required)
 * @body {number} retentionDays - Log retention in days (1-365)
 * @body {number} queryLimit - Max rows to query (10000-1000000)
 * @body {string} minLevel - Minimum log level to display (debug, info, warn, error)
 */
router.put('/settings', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const { userEmail, retentionDays, queryLimit, minLevel } = req.body;

  try {
    if (!userEmail) {
      logger.warn('logs', 'settings_update_validation_error', 'userEmail is required', { correlationId });
      return sendError(res, 'userEmail is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Validate retention days
    if (retentionDays !== undefined && (retentionDays < 1 || retentionDays > 365)) {
      logger.warn('logs', 'settings_update_validation_error', 'Invalid retentionDays', {
        correlationId,
        retentionDays,
      });
      return sendError(res, 'retentionDays must be between 1 and 365', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Validate query limit
    if (queryLimit !== undefined && (queryLimit < 10000 || queryLimit > 1000000)) {
      logger.warn('logs', 'settings_update_validation_error', 'Invalid queryLimit', {
        correlationId,
        queryLimit,
      });
      return sendError(res, 'queryLimit must be between 10,000 and 1,000,000', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Validate min level
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (minLevel !== undefined && !validLevels.includes(minLevel)) {
      logger.warn('logs', 'settings_update_validation_error', 'Invalid minLevel', {
        correlationId,
        minLevel,
      });
      return sendError(res, `minLevel must be one of: ${validLevels.join(', ')}`, ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const settings = systemLogDb.updateUserLogSettings(userEmail, {
      retentionDays,
      queryLimit,
      minLevel,
    });

    logger.info('logs', 'settings_update', `Updated log settings for ${userEmail}`, {
      correlationId,
      ...settings,
    });

    sendSuccess(res, settings);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'settings_update_error', `Failed to update log settings: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to update log settings', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * POST /api/logs/cleanup
 *
 * Trigger manual log cleanup.
 *
 * @body {number} retentionDays - Override retention days (optional)
 * @body {number} maxRows - Override max rows (optional)
 */
router.post('/cleanup', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();
  const { retentionDays, maxRows } = req.body;

  try {
    const result = logCleanupService.runCleanup(retentionDays, maxRows);

    logger.info('logs', 'cleanup', `Manual cleanup completed`, {
      correlationId,
      ...result,
    });

    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'cleanup_error', `Failed to run cleanup: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to run cleanup', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/cleanup/status
 *
 * Get cleanup scheduler status.
 */
router.get('/cleanup/status', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const status = logCleanupService.getStatus();

    logger.info('logs', 'cleanup_status', `Retrieved cleanup status`, { correlationId });

    sendSuccess(res, status);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'cleanup_status_error', `Failed to get cleanup status: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to get cleanup status', ErrorCodes.INTERNAL_ERROR, correlationId);
  }
});

// =============================================================================
// LEGACY UNIFIED LOGS (Backward Compatibility)
// =============================================================================

/**
 * GET /api/logs
 *
 * Get unified logs with filtering options (legacy - newsletter + api_key only).
 *
 * @query {string} source - Filter by source ('newsletter' | 'api_key')
 * @query {string} action - Filter by action type
 * @query {string} startDate - Filter start date
 * @query {string} endDate - Filter end date
 * @query {string} search - Search in log details
 * @query {number} limit - Maximum number of logs (default: 50)
 * @query {number} offset - Offset for pagination (default: 0)
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const options: logDbService.LogFilterOptions = {
      source: req.query.source as logDbService.LogSource | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const result = logDbService.getUnifiedLogs(options);

    logger.info('logs', 'list', `Listed ${result.logs?.length || 0} unified logs`, { correlationId, ...options });
    sendSuccess(res, result);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'list_error', `Failed to list logs: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch logs', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/export
 *
 * Export unified logs to CSV format (legacy).
 */
router.get('/export', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const options: logDbService.LogFilterOptions = {
      source: req.query.source as logDbService.LogSource | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      search: req.query.search as string | undefined,
    };

    const csvContent = logDbService.exportLogsToCsv(options);
    const timestamp = new Date().toISOString().split('T')[0];

    logger.info('logs', 'export', `Exported unified logs to CSV`, { correlationId });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=unified-logs-${timestamp}.csv`);
    res.send(csvContent);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'export_error', `Failed to export logs: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to export logs', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

/**
 * GET /api/logs/stats
 *
 * Get unified log statistics (legacy).
 */
router.get('/stats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const stats = logDbService.getLogStats();

    logger.info('logs', 'stats', `Retrieved unified log statistics`, { correlationId });
    sendSuccess(res, stats);
  } catch (error) {
    const err = error as Error;
    logger.error('logs', 'stats_error', `Failed to get log stats: ${err.message}`, err, { correlationId });
    sendError(res, 'Failed to fetch log stats', ErrorCodes.DATABASE_ERROR, correlationId);
  }
});

export default router;
