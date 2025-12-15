/**
 * API Key Database Service
 * CRUD operations for API keys stored in SQLite
 */

import db from '../db/init.ts';

// Types
export type ServiceType = 'claude' | 'stability' | 'brave' | 'google_api_key' | 'google_client_id' | 'google_client_secret';

export interface ApiKeyRecord {
  id: number;
  userEmail: string;
  service: ServiceType;
  isValid: boolean;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyStatus {
  service: ServiceType;
  isValid: boolean;
  lastValidated: string | null;
}

interface DbApiKeyRow {
  id: number;
  user_email: string;
  service: string;
  api_key: string;
  is_valid: number;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbAuditLogRow {
  id: number;
  user_email: string;
  service: string;
  action: string;
  ip_address: string | null;
  created_at: string;
}

/**
 * Save or update an API key
 */
export const saveApiKey = (
  userEmail: string,
  service: ServiceType,
  apiKey: string
): ApiKeyRecord => {
  const stmt = db.prepare(`
    INSERT INTO api_keys (user_email, service, api_key, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_email, service)
    DO UPDATE SET api_key = excluded.api_key, updated_at = datetime('now')
  `);

  stmt.run(userEmail, service, apiKey);

  // Log the action
  logAuditAction(userEmail, service, 'save');

  console.log(`[ApiKeyDb] Saved API key for ${service} (user: ${userEmail})`);

  // Return the saved record
  return getApiKeyRecord(userEmail, service)!;
};

/**
 * Get API key value (for backend use only)
 */
export const getApiKey = (userEmail: string, service: ServiceType): string | null => {
  const stmt = db.prepare(`
    SELECT api_key FROM api_keys WHERE user_email = ? AND service = ?
  `);

  const row = stmt.get(userEmail, service) as { api_key: string } | undefined;
  return row?.api_key || null;
};

/**
 * Get API key record (without exposing the key)
 */
export const getApiKeyRecord = (userEmail: string, service: ServiceType): ApiKeyRecord | null => {
  const stmt = db.prepare(`
    SELECT * FROM api_keys WHERE user_email = ? AND service = ?
  `);

  const row = stmt.get(userEmail, service) as DbApiKeyRow | undefined;
  if (!row) return null;

  return rowToApiKeyRecord(row);
};

/**
 * Check if API key exists
 */
export const hasApiKey = (userEmail: string, service: ServiceType): boolean => {
  const stmt = db.prepare(`
    SELECT 1 FROM api_keys WHERE user_email = ? AND service = ?
  `);

  const row = stmt.get(userEmail, service);
  return !!row;
};

/**
 * Delete API key
 */
export const deleteApiKey = (userEmail: string, service: ServiceType): boolean => {
  const stmt = db.prepare(`
    DELETE FROM api_keys WHERE user_email = ? AND service = ?
  `);

  const result = stmt.run(userEmail, service);

  if (result.changes > 0) {
    logAuditAction(userEmail, service, 'delete');
    console.log(`[ApiKeyDb] Deleted API key for ${service} (user: ${userEmail})`);
  }

  return result.changes > 0;
};

/**
 * Update validation status
 */
export const updateValidationStatus = (
  userEmail: string,
  service: ServiceType,
  isValid: boolean
): void => {
  const stmt = db.prepare(`
    UPDATE api_keys
    SET is_valid = ?, last_validated_at = datetime('now'), updated_at = datetime('now')
    WHERE user_email = ? AND service = ?
  `);

  stmt.run(isValid ? 1 : 0, userEmail, service);
  logAuditAction(userEmail, service, isValid ? 'validate_success' : 'validate_failure');

  console.log(`[ApiKeyDb] Validation status updated: ${service} = ${isValid}`);
};

/**
 * List all API key statuses for a user (without exposing keys)
 */
export const listApiKeyStatuses = (userEmail: string): ApiKeyStatus[] => {
  const stmt = db.prepare(`
    SELECT service, is_valid, last_validated_at FROM api_keys WHERE user_email = ?
  `);

  const rows = stmt.all(userEmail) as Array<{
    service: string;
    is_valid: number;
    last_validated_at: string | null;
  }>;

  return rows.map(row => ({
    service: row.service as ServiceType,
    isValid: row.is_valid === 1,
    lastValidated: row.last_validated_at
  }));
};

/**
 * Log an audit action
 */
export const logAuditAction = (
  userEmail: string,
  service: ServiceType,
  action: string,
  ipAddress?: string
): void => {
  const stmt = db.prepare(`
    INSERT INTO api_key_audit_log (user_email, service, action, ip_address)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(userEmail, service, action, ipAddress || null);
};

/**
 * Get audit logs for a user
 */
export const getAuditLogs = (userEmail: string, limit = 50): Array<{
  id: number;
  service: ServiceType;
  action: string;
  ipAddress: string | null;
  createdAt: string;
}> => {
  const stmt = db.prepare(`
    SELECT * FROM api_key_audit_log
    WHERE user_email = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(userEmail, limit) as DbAuditLogRow[];

  return rows.map(row => ({
    id: row.id,
    service: row.service as ServiceType,
    action: row.action,
    ipAddress: row.ip_address,
    createdAt: row.created_at
  }));
};

/**
 * Helper: Convert DB row to ApiKeyRecord
 */
const rowToApiKeyRecord = (row: DbApiKeyRow): ApiKeyRecord => ({
  id: row.id,
  userEmail: row.user_email,
  service: row.service as ServiceType,
  isValid: row.is_valid === 1,
  lastValidatedAt: row.last_validated_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
