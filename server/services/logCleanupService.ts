/**
 * Log Cleanup Service
 *
 * Handles automatic cleanup of old system logs based on retention policy.
 * Runs on server startup and then periodically (every 6 hours).
 *
 * Features:
 * - Retention-based cleanup (default 90 days)
 * - Row limit enforcement (default 500K rows)
 * - Automatic VACUUM after significant cleanup
 * - Configurable per-user settings
 */

import * as systemLogDb from './systemLogDbService.ts';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** How often to run cleanup (in milliseconds) - default 6 hours */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Minimum time between cleanups (prevent rapid execution) */
const MIN_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

let cleanupIntervalId: NodeJS.Timeout | null = null;
let lastCleanupTime = 0;
let isInitialized = false;

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

/**
 * Run the cleanup process
 */
export const runCleanup = (
  retentionDays?: number,
  maxRows?: number
): { deletedByAge: number; deletedByLimit: number; duration: number } => {
  const startTime = Date.now();

  // Prevent too-frequent cleanups
  if (startTime - lastCleanupTime < MIN_CLEANUP_INTERVAL_MS) {
    console.log('[LogCleanup] Skipping cleanup - ran too recently');
    return { deletedByAge: 0, deletedByLimit: 0, duration: 0 };
  }

  console.log('[LogCleanup] Starting cleanup...');

  const result = systemLogDb.runCleanup(retentionDays, maxRows);

  const duration = Date.now() - startTime;
  lastCleanupTime = Date.now();

  console.log(
    `[LogCleanup] Completed in ${duration}ms: ` +
    `${result.deletedByAge} by age, ${result.deletedByLimit} by limit`
  );

  return { ...result, duration };
};

/**
 * Start the periodic cleanup scheduler
 */
export const startScheduler = (intervalMs: number = CLEANUP_INTERVAL_MS): void => {
  if (cleanupIntervalId) {
    console.log('[LogCleanup] Scheduler already running');
    return;
  }

  // Run initial cleanup
  runCleanup();

  // Schedule periodic cleanup
  cleanupIntervalId = setInterval(() => {
    runCleanup();
  }, intervalMs);

  console.log(`[LogCleanup] Scheduler started (interval: ${intervalMs / 1000 / 60} minutes)`);
};

/**
 * Stop the periodic cleanup scheduler
 */
export const stopScheduler = (): void => {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[LogCleanup] Scheduler stopped');
  }
};

/**
 * Initialize the cleanup service
 * Called once on server startup
 */
export const initialize = (): void => {
  if (isInitialized) {
    console.log('[LogCleanup] Already initialized');
    return;
  }

  console.log('[LogCleanup] Initializing...');

  // Get current stats
  const stats = systemLogDb.getLogStats();
  console.log(
    `[LogCleanup] Current state: ${stats.totalLogs} logs, ` +
    `~${stats.storageEstimateKb} KB`
  );

  // Start the scheduler
  startScheduler();

  isInitialized = true;
};

/**
 * Get cleanup status
 */
export const getStatus = (): {
  isInitialized: boolean;
  isSchedulerRunning: boolean;
  lastCleanupTime: number | null;
  nextCleanupTime: number | null;
} => {
  return {
    isInitialized,
    isSchedulerRunning: cleanupIntervalId !== null,
    lastCleanupTime: lastCleanupTime || null,
    nextCleanupTime: lastCleanupTime
      ? lastCleanupTime + CLEANUP_INTERVAL_MS
      : null,
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

export { CLEANUP_INTERVAL_MS };
