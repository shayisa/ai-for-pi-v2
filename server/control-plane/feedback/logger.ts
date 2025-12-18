/**
 * Structured Logger with Correlation ID Support
 *
 * Provides structured logging across the Control Plane.
 * Every log entry includes a correlationId for request tracing.
 *
 * ## Purpose
 * Enable debugging by tracing requests across all modules.
 *
 * ## Features
 * - Console output (development: formatted, production: JSON)
 * - SQLite persistence for user access via UI
 * - Configurable retention (default 90 days)
 * - Query limits for performance (default 500K rows)
 * - Log level filtering (skip debug in production)
 *
 * ## Usage
 * ```typescript
 * import { logger, createRequestLogger } from './logger';
 *
 * // For module-level logging
 * logger.info('newsletter', 'startup', 'Module initialized');
 *
 * // For request-scoped logging (includes correlationId)
 * const log = createRequestLogger('req-abc123', 'newsletter');
 * log.info('generate', 'Starting newsletter generation', { topics: 3 });
 * ```
 *
 * @module control-plane/feedback/logger
 * @see docs/architecture/LOGGING_GUIDE.md
 */

import { LogEntry, LogLevel, ErrorInfo } from '../types/index.ts';
import * as systemLogDb from '../../services/systemLogDbService.ts';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Logger configuration
 */
interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include stack traces in errors */
  includeStacks: boolean;
  /** Maximum metadata size in characters */
  maxMetadataSize: number;
  /** Whether to output as JSON */
  jsonOutput: boolean;
  /** Custom output handler (for testing) */
  outputHandler?: (entry: LogEntry) => void;
  /** Whether to persist logs to SQLite */
  persistToDb: boolean;
  /** Minimum level to persist to DB (can be different from console) */
  dbMinLevel: LogLevel;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  includeStacks: process.env.NODE_ENV !== 'production',
  maxMetadataSize: 10000,
  jsonOutput: process.env.NODE_ENV === 'production',
  persistToDb: true,  // Enable SQLite persistence by default
  dbMinLevel: 'info', // Only persist info and above (skip debug for storage efficiency)
};

let config: LoggerConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// LOG STORAGE (for audit trail integration)
// =============================================================================

/**
 * In-memory log buffer for recent logs
 * Limited to last 1000 entries to prevent memory issues
 */
const LOG_BUFFER_SIZE = 1000;
const logBuffer: LogEntry[] = [];

function addToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

// =============================================================================
// CORE LOGGING FUNCTIONS
// =============================================================================

/**
 * Create a log entry
 */
function createEntry(
  level: LogLevel,
  module: string,
  action: string,
  message: string,
  options: {
    correlationId?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
    userId?: string;
    error?: Error;
  } = {}
): LogEntry {
  const entry: LogEntry = {
    correlationId: options.correlationId || 'no-correlation',
    timestamp: new Date(),
    level,
    module,
    action,
    message,
    duration: options.duration,
    userId: options.userId,
    metadata: options.metadata ? sanitizeMetadata(options.metadata) : undefined,
  };

  if (options.error) {
    entry.error = extractErrorInfo(options.error);
  }

  return entry;
}

/**
 * Sanitize metadata to prevent sensitive data leakage and size issues
 */
function sanitizeMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const SENSITIVE_KEYS = [
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'credential',
  ];

  const sanitized: Record<string, unknown> = {};
  let serialized = '';

  for (const [key, value] of Object.entries(metadata)) {
    // Check for sensitive keys
    const isSensitive = SENSITIVE_KEYS.some(
      (sk) =>
        key.toLowerCase().includes(sk.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }

    // Check size limit
    serialized = JSON.stringify(sanitized);
    if (serialized.length > config.maxMetadataSize) {
      sanitized[key] = '[TRUNCATED]';
      break;
    }
  }

  return sanitized;
}

/**
 * Extract error info for logging
 */
function extractErrorInfo(error: Error): ErrorInfo {
  return {
    name: error.name,
    message: error.message,
    stack: config.includeStacks ? error.stack : undefined,
    code: (error as Error & { code?: string }).code,
  };
}

/**
 * Output a log entry
 */
function output(entry: LogEntry): void {
  // Check minimum level for console output
  const shouldOutputToConsole =
    LOG_LEVEL_PRIORITY[entry.level] >= LOG_LEVEL_PRIORITY[config.minLevel];

  // Check minimum level for DB persistence
  const shouldPersistToDb =
    config.persistToDb &&
    LOG_LEVEL_PRIORITY[entry.level] >= LOG_LEVEL_PRIORITY[config.dbMinLevel];

  // Skip if neither output is needed
  if (!shouldOutputToConsole && !shouldPersistToDb) {
    return;
  }

  // Add to in-memory buffer (always, for getRecentLogs)
  addToBuffer(entry);

  // Persist to SQLite (async, non-blocking)
  if (shouldPersistToDb) {
    try {
      systemLogDb.insertLog({
        correlationId: entry.correlationId,
        timestamp: entry.timestamp,
        level: entry.level,
        module: entry.module,
        action: entry.action,
        message: entry.message,
        durationMs: entry.duration,
        userId: entry.userId,
        metadata: entry.metadata,
        error: entry.error,
      });
    } catch (err) {
      // Don't let logging errors break the application
      console.error('[Logger] Failed to persist log to DB:', err);
    }
  }

  // Skip console output if below threshold
  if (!shouldOutputToConsole) {
    return;
  }

  // Use custom handler if provided
  if (config.outputHandler) {
    config.outputHandler(entry);
    return;
  }

  // Output to console
  if (config.jsonOutput) {
    outputJson(entry);
  } else {
    outputFormatted(entry);
  }
}

/**
 * Output as JSON (production)
 */
function outputJson(entry: LogEntry): void {
  const jsonEntry = {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  };
  console.log(JSON.stringify(jsonEntry));
}

/**
 * Output formatted (development)
 */
function outputFormatted(entry: LogEntry): void {
  const time = entry.timestamp.toISOString().split('T')[1].slice(0, 12);
  const level = entry.level.toUpperCase().padEnd(5);
  const correlation = entry.correlationId.slice(0, 12).padEnd(12);
  const module = entry.module.padEnd(15);
  const duration = entry.duration ? `(${entry.duration}ms)` : '';

  // Color codes for different levels
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const color = colors[entry.level];

  const prefix = `${dim}${time}${reset} ${color}${level}${reset} ${dim}[${correlation}]${reset} ${module}`;
  const message = `${entry.action}: ${entry.message} ${duration}`;

  console.log(`${prefix} ${message}`);

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    console.log(`${dim}  metadata:${reset}`, entry.metadata);
  }

  if (entry.error) {
    console.log(`${colors.error}  error:${reset}`, entry.error.name, '-', entry.error.message);
    if (entry.error.stack) {
      console.log(`${dim}${entry.error.stack}${reset}`);
    }
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Configure the logger
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset logger configuration to defaults
 */
export function resetLoggerConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

/**
 * Get recent logs from buffer
 *
 * @param filter - Optional filter criteria
 * @param limit - Maximum number of entries to return
 */
export function getRecentLogs(
  filter?: {
    correlationId?: string;
    module?: string;
    level?: LogLevel;
    since?: Date;
  },
  limit = 100
): LogEntry[] {
  let filtered = [...logBuffer];

  if (filter?.correlationId) {
    filtered = filtered.filter((e) => e.correlationId === filter.correlationId);
  }
  if (filter?.module) {
    filtered = filtered.filter((e) => e.module === filter.module);
  }
  if (filter?.level) {
    filtered = filtered.filter((e) => e.level === filter.level);
  }
  if (filter?.since) {
    filtered = filtered.filter((e) => e.timestamp >= filter.since);
  }

  return filtered.slice(-limit);
}

/**
 * Clear log buffer (for testing)
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Module-level logger instance
 *
 * Use this for logs not associated with a specific request.
 */
export const logger = {
  debug(module: string, action: string, message: string, metadata?: Record<string, unknown>): void {
    output(createEntry('debug', module, action, message, { metadata }));
  },

  info(module: string, action: string, message: string, metadata?: Record<string, unknown>): void {
    output(createEntry('info', module, action, message, { metadata }));
  },

  warn(module: string, action: string, message: string, metadata?: Record<string, unknown>): void {
    output(createEntry('warn', module, action, message, { metadata }));
  },

  error(
    module: string,
    action: string,
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>
  ): void {
    output(createEntry('error', module, action, message, { error, metadata }));
  },
};

/**
 * Request-scoped logger
 *
 * Automatically includes correlationId in all log entries.
 */
export interface RequestLogger {
  debug(action: string, message: string, metadata?: Record<string, unknown>): void;
  info(action: string, message: string, metadata?: Record<string, unknown>): void;
  warn(action: string, message: string, metadata?: Record<string, unknown>): void;
  error(action: string, message: string, error?: Error, metadata?: Record<string, unknown>): void;
  /** Log with duration measurement */
  timed<T>(action: string, message: string, fn: () => Promise<T>): Promise<T>;
  /** Get the correlation ID for this logger */
  correlationId: string;
}

/**
 * Create a request-scoped logger
 *
 * @param correlationId - Request correlation ID
 * @param module - Module name
 * @param userId - Optional user ID
 *
 * @example
 * const log = createRequestLogger('req-abc123', 'newsletter');
 * log.info('generate', 'Starting generation');
 * const result = await log.timed('ai-call', 'Calling Claude', () => claudeApi.generate());
 */
export function createRequestLogger(
  correlationId: string,
  module: string,
  userId?: string
): RequestLogger {
  return {
    correlationId,

    debug(action: string, message: string, metadata?: Record<string, unknown>): void {
      output(createEntry('debug', module, action, message, { correlationId, userId, metadata }));
    },

    info(action: string, message: string, metadata?: Record<string, unknown>): void {
      output(createEntry('info', module, action, message, { correlationId, userId, metadata }));
    },

    warn(action: string, message: string, metadata?: Record<string, unknown>): void {
      output(createEntry('warn', module, action, message, { correlationId, userId, metadata }));
    },

    error(
      action: string,
      message: string,
      error?: Error,
      metadata?: Record<string, unknown>
    ): void {
      output(
        createEntry('error', module, action, message, { correlationId, userId, error, metadata })
      );
    },

    async timed<T>(action: string, message: string, fn: () => Promise<T>): Promise<T> {
      const start = Date.now();
      try {
        const result = await fn();
        const duration = Date.now() - start;
        output(
          createEntry('info', module, action, `${message} completed`, {
            correlationId,
            userId,
            duration,
          })
        );
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        output(
          createEntry('error', module, action, `${message} failed`, {
            correlationId,
            userId,
            duration,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        );
        throw error;
      }
    },
  };
}

/**
 * Generate a new correlation ID
 *
 * Format: req-<timestamp>-<random>
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req-${timestamp}-${random}`;
}
