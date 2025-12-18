/**
 * Performance Metrics Collection
 *
 * Tracks performance metrics for all Control Plane operations.
 * Enables performance monitoring and optimization.
 *
 * ## Purpose
 * - Track operation latencies
 * - Monitor error rates
 * - Identify performance bottlenecks
 * - Provide data for dashboards
 *
 * ## Usage
 * ```typescript
 * import { metrics } from './metrics';
 *
 * // Record a metric
 * const timer = metrics.startTimer('newsletter', 'generate');
 * try {
 *   await generateNewsletter();
 *   timer.success();
 * } catch (error) {
 *   timer.failure();
 * }
 *
 * // Get metrics
 * const stats = metrics.getMetrics('newsletter', 'generate');
 * console.log(`Avg duration: ${stats.avgDuration}ms`);
 * ```
 *
 * @module control-plane/feedback/metrics
 * @see docs/architecture/LOGGING_GUIDE.md
 */

import { Metrics, RateLimitStatus } from '../types/index.ts';
import { logger } from './logger.ts';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Metrics configuration
 */
interface MetricsConfig {
  /** Whether to enable metrics collection */
  enabled: boolean;
  /** How often to log summary metrics (ms) */
  summaryInterval: number;
  /** Whether to automatically log slow operations */
  logSlowOperations: boolean;
  /** Threshold for slow operations (ms) */
  slowOperationThreshold: number;
}

const DEFAULT_CONFIG: MetricsConfig = {
  enabled: true,
  summaryInterval: 60000, // 1 minute
  logSlowOperations: true,
  slowOperationThreshold: 5000, // 5 seconds
};

let config: MetricsConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// METRICS STORAGE
// =============================================================================

/**
 * Metrics storage keyed by module:operation
 */
interface MetricsData {
  count: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  /** Histogram buckets for percentile calculation */
  durations: number[];
}

const metricsStore = new Map<string, MetricsData>();

/**
 * Maximum durations to keep in histogram (for percentiles)
 */
const MAX_HISTOGRAM_SIZE = 1000;

/**
 * Get or create metrics data for a module:operation
 */
function getOrCreateMetricsData(module: string, operation: string): MetricsData {
  const key = `${module}:${operation}`;
  let data = metricsStore.get(key);

  if (!data) {
    data = {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errorCount: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      durations: [],
    };
    metricsStore.set(key, data);
  }

  return data;
}

/**
 * Record a metric
 */
function record(
  module: string,
  operation: string,
  duration: number,
  success: boolean
): void {
  if (!config.enabled) {
    return;
  }

  const data = getOrCreateMetricsData(module, operation);

  data.count++;
  data.totalDuration += duration;
  data.minDuration = Math.min(data.minDuration, duration);
  data.maxDuration = Math.max(data.maxDuration, duration);
  data.lastUpdatedAt = new Date();

  if (!success) {
    data.errorCount++;
  }

  // Add to histogram (with size limit)
  data.durations.push(duration);
  if (data.durations.length > MAX_HISTOGRAM_SIZE) {
    data.durations.shift();
  }

  // Log slow operations
  if (config.logSlowOperations && duration > config.slowOperationThreshold) {
    logger.warn(
      'metrics',
      'slow_operation',
      `Slow operation detected: ${module}:${operation} took ${duration}ms`,
      { module, operation, duration, threshold: config.slowOperationThreshold }
    );
  }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Rate limit tracking
 */
interface RateLimitTracker {
  requests: number;
  windowStart: number;
  windowSize: number; // ms
  limit: number;
}

const rateLimits = new Map<string, RateLimitTracker>();

/**
 * Check and update rate limit
 */
function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitStatus {
  const now = Date.now();
  let tracker = rateLimits.get(key);

  // Create new tracker or reset if window expired
  if (!tracker || now - tracker.windowStart >= tracker.windowSize) {
    tracker = {
      requests: 0,
      windowStart: now,
      windowSize: windowMs,
      limit,
    };
    rateLimits.set(key, tracker);
  }

  // Check if limit exceeded
  const exceeded = tracker.requests >= limit;
  const remaining = Math.max(0, limit - tracker.requests);
  const resetAtMs = tracker.windowStart + tracker.windowSize;
  const retryAfter = exceeded ? Math.ceil((resetAtMs - now) / 1000) : undefined;

  // Increment counter
  tracker.requests++;

  return {
    allowed: !exceeded,
    exceeded,
    remaining,
    limit,
    resetAt: new Date(resetAtMs),
    retryAfter,
  };
}

// =============================================================================
// PERCENTILE CALCULATION
// =============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Configure metrics collection
 */
export function configureMetrics(options: Partial<MetricsConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset metrics configuration to defaults
 */
export function resetMetricsConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

/**
 * Clear all metrics (for testing)
 */
export function clearMetrics(): void {
  metricsStore.clear();
  rateLimits.clear();
}

/**
 * Metrics service
 */
export const metrics = {
  /**
   * Start a timer for an operation
   *
   * @returns Timer object with success() and failure() methods
   */
  startTimer(
    module: string,
    operation: string
  ): { success: () => number; failure: () => number } {
    const start = Date.now();

    return {
      success(): number {
        const duration = Date.now() - start;
        record(module, operation, duration, true);
        return duration;
      },
      failure(): number {
        const duration = Date.now() - start;
        record(module, operation, duration, false);
        return duration;
      },
    };
  },

  /**
   * Record a completed operation
   * Can be called with (key, duration, metadata) or (module, operation, duration, success)
   */
  record(
    moduleOrKey: string,
    durationOrOperation: number | string,
    metadataOrDuration?: Record<string, unknown> | number,
    success = true
  ): void {
    // Handle both signatures:
    // record(key, duration, { success: true }) - new style
    // record(module, operation, duration, success) - old style
    if (typeof durationOrOperation === 'number') {
      // New style: record(key, duration, metadata)
      const [module, operation] = moduleOrKey.includes(':')
        ? moduleOrKey.split(':')
        : [moduleOrKey, 'default'];
      const metadata = metadataOrDuration as Record<string, unknown> | undefined;
      const succeeded = metadata?.success !== false;
      record(module, operation, durationOrOperation, succeeded);
    } else {
      // Old style: record(module, operation, duration, success)
      const module = moduleOrKey;
      const operation = durationOrOperation;
      const duration = metadataOrDuration as number;
      record(module, operation, duration, success);
    }
  },

  /**
   * Get metrics for a specific operation
   */
  getMetrics(module: string, operation: string): Metrics {
    const key = `${module}:${operation}`;
    const data = metricsStore.get(key);

    if (!data) {
      return {
        module,
        operation,
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        errorCount: 0,
        errorRate: 0,
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };
    }

    return {
      module,
      operation,
      count: data.count,
      totalDuration: data.totalDuration,
      avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
      minDuration: data.minDuration === Infinity ? 0 : data.minDuration,
      maxDuration: data.maxDuration,
      errorCount: data.errorCount,
      errorRate: data.count > 0 ? data.errorCount / data.count : 0,
      startedAt: data.startedAt,
      lastUpdatedAt: data.lastUpdatedAt,
    };
  },

  /**
   * Get detailed metrics with percentiles
   */
  getDetailedMetrics(
    module: string,
    operation: string
  ): Metrics & { p50: number; p90: number; p99: number } {
    const basic = this.getMetrics(module, operation);
    const key = `${module}:${operation}`;
    const data = metricsStore.get(key);

    if (!data || data.durations.length === 0) {
      return { ...basic, p50: 0, p90: 0, p99: 0 };
    }

    const sorted = [...data.durations].sort((a, b) => a - b);

    return {
      ...basic,
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      p99: percentile(sorted, 99),
    };
  },

  /**
   * Get all metrics
   */
  getAllMetrics(): Metrics[] {
    const result: Metrics[] = [];
    const keys = Array.from(metricsStore.keys());

    for (const key of keys) {
      const [module, operation] = key.split(':');
      result.push(this.getMetrics(module, operation));
    }

    return result;
  },

  /**
   * Get metrics summary for logging/dashboards
   */
  getSummary(): {
    totalOperations: number;
    totalErrors: number;
    overallErrorRate: number;
    slowestOperation: string;
    mostErrors: string;
    byModule: Record<
      string,
      { operations: number; errors: number; avgDuration: number }
    >;
  } {
    let totalOps = 0;
    let totalErrors = 0;
    let slowestOp = '';
    let slowestDuration = 0;
    let mostErrorsOp = '';
    let mostErrorsCount = 0;
    const byModule: Record<
      string,
      { operations: number; errors: number; totalDuration: number }
    > = {};

    const entries = Array.from(metricsStore.entries());
    for (const [key, data] of entries) {
      const [module] = key.split(':');

      totalOps += data.count;
      totalErrors += data.errorCount;

      if (data.maxDuration > slowestDuration) {
        slowestDuration = data.maxDuration;
        slowestOp = key;
      }

      if (data.errorCount > mostErrorsCount) {
        mostErrorsCount = data.errorCount;
        mostErrorsOp = key;
      }

      if (!byModule[module]) {
        byModule[module] = { operations: 0, errors: 0, totalDuration: 0 };
      }
      byModule[module].operations += data.count;
      byModule[module].errors += data.errorCount;
      byModule[module].totalDuration += data.totalDuration;
    }

    const result: Record<
      string,
      { operations: number; errors: number; avgDuration: number }
    > = {};
    for (const [module, stats] of Object.entries(byModule)) {
      result[module] = {
        operations: stats.operations,
        errors: stats.errors,
        avgDuration:
          stats.operations > 0 ? stats.totalDuration / stats.operations : 0,
      };
    }

    return {
      totalOperations: totalOps,
      totalErrors: totalErrors,
      overallErrorRate: totalOps > 0 ? totalErrors / totalOps : 0,
      slowestOperation: slowestOp,
      mostErrors: mostErrorsOp,
      byModule: result,
    };
  },

  /**
   * Check rate limit for a key
   */
  checkRateLimit(
    key: string,
    limit: number,
    windowMs: number = 60000
  ): RateLimitStatus {
    return checkRateLimit(key, limit, windowMs);
  },

  /**
   * Reset rate limit for a key (for testing)
   */
  resetRateLimit(key: string): void {
    rateLimits.delete(key);
  },
};

// =============================================================================
// AUTOMATIC SUMMARY LOGGING
// =============================================================================

let summaryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start automatic summary logging
 */
export function startMetricsSummaryLogging(): void {
  if (summaryInterval) {
    return;
  }

  summaryInterval = setInterval(() => {
    if (!config.enabled) {
      return;
    }

    const summary = metrics.getSummary();

    if (summary.totalOperations > 0) {
      logger.info(
        'metrics',
        'summary',
        `Metrics summary: ${summary.totalOperations} ops, ${summary.totalErrors} errors (${(summary.overallErrorRate * 100).toFixed(2)}% error rate)`,
        {
          totalOperations: summary.totalOperations,
          totalErrors: summary.totalErrors,
          errorRate: summary.overallErrorRate,
          slowest: summary.slowestOperation,
          mostErrors: summary.mostErrors,
        }
      );
    }
  }, config.summaryInterval);
}

/**
 * Stop automatic summary logging
 */
export function stopMetricsSummaryLogging(): void {
  if (summaryInterval) {
    clearInterval(summaryInterval);
    summaryInterval = null;
  }
}
