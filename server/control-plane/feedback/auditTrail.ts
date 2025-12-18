/**
 * Audit Trail - Security-Sensitive Operation Logging
 *
 * Records security-relevant events for compliance and debugging.
 * Integrates with the database for persistent audit storage.
 *
 * ## Purpose
 * - Track authentication events (login, logout, API key validation)
 * - Record data access/modification for compliance
 * - Enable security incident investigation
 *
 * ## Usage
 * ```typescript
 * import { auditTrail } from './auditTrail';
 *
 * auditTrail.log({
 *   correlationId: 'req-abc123',
 *   action: 'api_key_validate',
 *   resourceType: 'api_key',
 *   success: true,
 *   userEmail: 'user@example.com',
 *   ipAddress: '127.0.0.1'
 * });
 * ```
 *
 * @module control-plane/feedback/auditTrail
 * @see docs/architecture/LOGGING_GUIDE.md
 */

import { AuditEntry, AuditAction } from '../types/index.ts';
import { logger, generateCorrelationId } from './logger.ts';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Audit trail configuration
 */
interface AuditConfig {
  /** Whether to enable audit logging */
  enabled: boolean;
  /** Whether to persist to database */
  persistToDb: boolean;
  /** Actions that should always be logged regardless of other settings */
  alwaysLogActions: AuditAction[];
  /** Callback for database persistence (injected from db service) */
  persistCallback?: (entry: AuditEntry) => Promise<void>;
}

const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  persistToDb: true,
  alwaysLogActions: ['auth_success', 'auth_failure', 'api_key_validate', 'oauth_grant', 'oauth_revoke'],
};

let config: AuditConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// IN-MEMORY BUFFER
// =============================================================================

/**
 * In-memory audit buffer for recent entries
 * Used for quick lookups and when DB is unavailable
 */
const AUDIT_BUFFER_SIZE = 500;
const auditBuffer: AuditEntry[] = [];

function addToBuffer(entry: AuditEntry): void {
  auditBuffer.push(entry);
  if (auditBuffer.length > AUDIT_BUFFER_SIZE) {
    auditBuffer.shift();
  }
}

// =============================================================================
// AUDIT ENTRY CREATION
// =============================================================================

/**
 * Generate a unique audit entry ID
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `audit-${timestamp}-${random}`;
}

/**
 * Create an audit entry
 */
function createAuditEntry(params: {
  correlationId?: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  success: boolean;
  ipAddress?: string;
  details?: Record<string, unknown>;
}): AuditEntry {
  return {
    id: generateAuditId(),
    timestamp: new Date(),
    correlationId: params.correlationId || generateCorrelationId(),
    userId: params.userId,
    userEmail: params.userEmail,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    success: params.success,
    ipAddress: params.ipAddress,
    details: params.details ? sanitizeDetails(params.details) : undefined,
  };
}

/**
 * Sanitize details to remove sensitive information
 */
function sanitizeDetails(
  details: Record<string, unknown>
): Record<string, unknown> {
  const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'credential', 'auth'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    const isSensitive = SENSITIVE_KEYS.some((sk) =>
      key.toLowerCase().includes(sk.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * Persist audit entry to database
 */
async function persist(entry: AuditEntry): Promise<void> {
  if (!config.persistToDb) {
    return;
  }

  if (!config.persistCallback) {
    logger.warn('auditTrail', 'persist', 'No persist callback configured, entry not saved to DB', {
      auditId: entry.id,
    });
    return;
  }

  try {
    await config.persistCallback(entry);
  } catch (error) {
    // Log but don't throw - audit should not break the request
    logger.error(
      'auditTrail',
      'persist',
      'Failed to persist audit entry',
      error instanceof Error ? error : new Error(String(error)),
      { auditId: entry.id }
    );
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Configure the audit trail
 */
export function configureAuditTrail(options: Partial<AuditConfig>): void {
  config = { ...config, ...options };
}

/**
 * Reset audit trail configuration to defaults
 */
export function resetAuditConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

/**
 * Get recent audit entries from buffer
 */
export function getRecentAuditEntries(
  filter?: {
    correlationId?: string;
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    since?: Date;
  },
  limit = 100
): AuditEntry[] {
  let filtered = [...auditBuffer];

  if (filter?.correlationId) {
    filtered = filtered.filter((e) => e.correlationId === filter.correlationId);
  }
  if (filter?.userId) {
    filtered = filtered.filter((e) => e.userId === filter.userId);
  }
  if (filter?.action) {
    filtered = filtered.filter((e) => e.action === filter.action);
  }
  if (filter?.resourceType) {
    filtered = filtered.filter((e) => e.resourceType === filter.resourceType);
  }
  if (filter?.since) {
    filtered = filtered.filter((e) => e.timestamp >= filter.since);
  }

  return filtered.slice(-limit);
}

/**
 * Clear audit buffer (for testing)
 */
export function clearAuditBuffer(): void {
  auditBuffer.length = 0;
}

/**
 * Audit trail service
 */
export const auditTrail = {
  /**
   * Log an audit entry
   */
  async log(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    success: boolean;
    ipAddress?: string;
    details?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    if (!config.enabled) {
      // Return a mock entry when disabled
      return createAuditEntry(params);
    }

    const entry = createAuditEntry(params);

    // Add to buffer
    addToBuffer(entry);

    // Also log to structured logger
    const logLevel = entry.success ? 'info' : 'warn';
    logger[logLevel](
      'audit',
      entry.action,
      `${entry.action} on ${entry.resourceType}${entry.resourceId ? ` (${entry.resourceId})` : ''}: ${entry.success ? 'success' : 'failed'}`,
      {
        auditId: entry.id,
        userEmail: entry.userEmail,
        resourceId: entry.resourceId,
      }
    );

    // Persist to database
    await persist(entry);

    return entry;
  },

  /**
   * Log authentication success
   */
  async logAuthSuccess(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    authMethod: 'api_key' | 'oauth' | 'token';
    details?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'auth_success',
      resourceType: 'authentication',
      success: true,
      ipAddress: params.ipAddress,
      details: {
        authMethod: params.authMethod,
        ...params.details,
      },
    });
  },

  /**
   * Log authentication failure
   */
  async logAuthFailure(params: {
    correlationId?: string;
    userEmail?: string;
    ipAddress?: string;
    authMethod: 'api_key' | 'oauth' | 'token';
    reason: string;
    details?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userEmail: params.userEmail,
      action: 'auth_failure',
      resourceType: 'authentication',
      success: false,
      ipAddress: params.ipAddress,
      details: {
        authMethod: params.authMethod,
        reason: params.reason,
        ...params.details,
      },
    });
  },

  /**
   * Log API key validation
   */
  async logApiKeyValidation(params: {
    correlationId?: string;
    userEmail?: string;
    ipAddress?: string;
    service: string;
    success: boolean;
    reason?: string;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userEmail: params.userEmail,
      action: 'api_key_validate',
      resourceType: 'api_key',
      resourceId: params.service,
      success: params.success,
      ipAddress: params.ipAddress,
      details: params.reason ? { reason: params.reason } : undefined,
    });
  },

  /**
   * Log OAuth grant
   */
  async logOAuthGrant(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    provider: string;
    scopes: string[];
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'oauth_grant',
      resourceType: 'oauth',
      resourceId: params.provider,
      success: true,
      ipAddress: params.ipAddress,
      details: {
        provider: params.provider,
        scopes: params.scopes,
      },
    });
  },

  /**
   * Log OAuth revocation
   */
  async logOAuthRevoke(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    provider: string;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'oauth_revoke',
      resourceType: 'oauth',
      resourceId: params.provider,
      success: true,
      ipAddress: params.ipAddress,
    });
  },

  /**
   * Log data export
   */
  async logExport(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    resourceType: string;
    resourceId?: string;
    format: string;
    recordCount?: number;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'export',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: true,
      ipAddress: params.ipAddress,
      details: {
        format: params.format,
        recordCount: params.recordCount,
      },
    });
  },

  /**
   * Log email send
   */
  async logEmailSend(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    newsletterId?: string;
    recipientCount: number;
    success: boolean;
    error?: string;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'send_email',
      resourceType: 'newsletter',
      resourceId: params.newsletterId,
      success: params.success,
      ipAddress: params.ipAddress,
      details: {
        recipientCount: params.recipientCount,
        error: params.error,
      },
    });
  },

  /**
   * Log data creation
   */
  async logCreate(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'create',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: true,
      ipAddress: params.ipAddress,
      details: params.details,
    });
  },

  /**
   * Log data deletion
   */
  async logDelete(params: {
    correlationId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return this.log({
      correlationId: params.correlationId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'delete',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: true,
      ipAddress: params.ipAddress,
      details: params.details,
    });
  },
};
