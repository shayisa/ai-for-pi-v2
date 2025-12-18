/**
 * Health Check Routes
 *
 * Simple health check endpoint for load balancer/monitoring.
 * First route migrated to validate the Control Plane pattern.
 *
 * @module routes/health
 *
 * ## Endpoints
 * - GET /api/health - Returns server health status
 *
 * ## Migration Notes
 * - Original location: server.ts:3821-3823
 * - Migrated to Control Plane architecture
 * - Added correlation ID support via context middleware
 */
import { Router, Request, Response } from 'express';
import { logger } from '../control-plane/feedback';
import { sendSuccess } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';

const router = Router();

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancers.
 *
 * @returns {object} Health status with timestamp
 *
 * @example
 * // Request
 * GET /api/health
 *
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "status": "ok",
 *     "timestamp": "2025-12-17T12:00:00.000Z"
 *   }
 * }
 */
router.get('/', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  logger.info('health', 'health_check', 'Health check requested', { correlationId });

  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
