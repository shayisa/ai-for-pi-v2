/**
 * Prompt Import Database Service
 *
 * Phase 11d: CRUD operations for import templates and import logs.
 * Templates store parsing patterns for reuse, logs provide audit trail.
 */

import db from '../db/init.ts';
import type {
  ImportSourceType,
  ParsingMethod,
  PromptImportTemplate,
  PromptImportLog,
  ImportedPromptFields,
  FieldPatterns,
} from '../../types';

// ============================================================================
// Types
// ============================================================================

interface DbTemplateRow {
  id: string;
  name: string;
  source_type: string;
  source_pattern: string;
  parsing_instructions: string;
  field_patterns: string;
  success_count: number;
  failure_count: number;
  is_default: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface DbLogRow {
  id: number;
  import_id: string;
  source_type: string;
  source_identifier: string;
  template_id: string | null;
  parsing_method: string;
  success: number;
  error_message: string | null;
  parsed_fields: string | null;
  raw_content_length: number;
  processing_time_ms: number;
  created_at: string;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID for an import template
 */
const generateTemplateId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `tmpl_${timestamp}_${random}`;
};

/**
 * Generate a unique ID for an import operation
 */
export const generateImportId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `imp_${timestamp}_${random}`;
};

// ============================================================================
// Row Converters
// ============================================================================

const rowToTemplate = (row: DbTemplateRow): PromptImportTemplate => ({
  id: row.id,
  name: row.name,
  sourceType: row.source_type as ImportSourceType,
  sourcePattern: row.source_pattern,
  parsingInstructions: row.parsing_instructions,
  fieldPatterns: JSON.parse(row.field_patterns) as FieldPatterns,
  successCount: row.success_count,
  failureCount: row.failure_count,
  isDefault: row.is_default === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by || undefined,
});

const rowToLog = (row: DbLogRow): PromptImportLog => ({
  id: row.id,
  importId: row.import_id,
  sourceType: row.source_type as ImportSourceType,
  sourceIdentifier: row.source_identifier,
  templateId: row.template_id || undefined,
  parsingMethod: row.parsing_method as ParsingMethod,
  success: row.success === 1,
  errorMessage: row.error_message || undefined,
  parsedFields: row.parsed_fields ? (JSON.parse(row.parsed_fields) as ImportedPromptFields) : undefined,
  rawContentLength: row.raw_content_length,
  processingTimeMs: row.processing_time_ms,
  createdAt: row.created_at,
});

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new import template
 */
export const createTemplate = (template: {
  name: string;
  sourceType: ImportSourceType;
  sourcePattern: string;
  parsingInstructions: string;
  fieldPatterns: FieldPatterns;
  isDefault?: boolean;
  createdBy?: string;
}): PromptImportTemplate => {
  const id = generateTemplateId();

  const stmt = db.prepare(`
    INSERT INTO prompt_import_templates
    (id, name, source_type, source_pattern, parsing_instructions, field_patterns, is_default, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    template.name,
    template.sourceType,
    template.sourcePattern,
    template.parsingInstructions,
    JSON.stringify(template.fieldPatterns),
    template.isDefault ? 1 : 0,
    template.createdBy || null
  );

  console.log(`[PromptImportDb] Created template: ${template.name}`);

  const saved = db.prepare('SELECT * FROM prompt_import_templates WHERE id = ?').get(id) as DbTemplateRow;
  return rowToTemplate(saved);
};

/**
 * Get all import templates
 */
export const getTemplates = (options?: {
  sourceType?: ImportSourceType;
  limit?: number;
}): PromptImportTemplate[] => {
  const { sourceType, limit = 50 } = options || {};

  let sql = 'SELECT * FROM prompt_import_templates';
  const params: (string | number)[] = [];

  if (sourceType) {
    sql += ' WHERE source_type = ?';
    params.push(sourceType);
  }

  sql += ' ORDER BY success_count DESC, created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as DbTemplateRow[];
  return rows.map(rowToTemplate);
};

/**
 * Get a template by ID
 */
export const getTemplateById = (id: string): PromptImportTemplate | null => {
  const row = db
    .prepare('SELECT * FROM prompt_import_templates WHERE id = ?')
    .get(id) as DbTemplateRow | undefined;

  if (!row) return null;
  return rowToTemplate(row);
};

/**
 * Find a matching template by source pattern
 * For URLs, matches domain patterns; for files, matches extension/type patterns
 */
export const findMatchingTemplate = (
  sourceType: ImportSourceType,
  identifier: string
): PromptImportTemplate | null => {
  // Get all templates for this source type, ordered by success rate
  const templates = getTemplates({ sourceType });

  for (const template of templates) {
    try {
      // Convert pattern to regex and test against identifier
      const regex = new RegExp(template.sourcePattern, 'i');
      if (regex.test(identifier)) {
        console.log(`[PromptImportDb] Found matching template: ${template.name} for ${identifier}`);
        return template;
      }
    } catch {
      // Invalid regex pattern, skip this template
      continue;
    }
  }

  return null;
};

/**
 * Update an existing template
 */
export const updateTemplate = (
  id: string,
  updates: Partial<{
    name: string;
    sourcePattern: string;
    parsingInstructions: string;
    fieldPatterns: FieldPatterns;
    isDefault: boolean;
  }>
): PromptImportTemplate | null => {
  const existing = getTemplateById(id);
  if (!existing) return null;

  const setClauses: string[] = ['updated_at = datetime(\'now\')'];
  const params: (string | number)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.sourcePattern !== undefined) {
    setClauses.push('source_pattern = ?');
    params.push(updates.sourcePattern);
  }
  if (updates.parsingInstructions !== undefined) {
    setClauses.push('parsing_instructions = ?');
    params.push(updates.parsingInstructions);
  }
  if (updates.fieldPatterns !== undefined) {
    setClauses.push('field_patterns = ?');
    params.push(JSON.stringify(updates.fieldPatterns));
  }
  if (updates.isDefault !== undefined) {
    setClauses.push('is_default = ?');
    params.push(updates.isDefault ? 1 : 0);
  }

  params.push(id);

  const sql = `UPDATE prompt_import_templates SET ${setClauses.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...params);

  console.log(`[PromptImportDb] Updated template: ${id}`);

  return getTemplateById(id);
};

/**
 * Delete a template
 */
export const deleteTemplate = (id: string): boolean => {
  const result = db.prepare('DELETE FROM prompt_import_templates WHERE id = ?').run(id);
  console.log(`[PromptImportDb] Deleted template: ${id}`);
  return result.changes > 0;
};

/**
 * Increment template success or failure count
 */
export const incrementTemplateStats = (id: string, success: boolean): void => {
  const column = success ? 'success_count' : 'failure_count';
  db.prepare(`UPDATE prompt_import_templates SET ${column} = ${column} + 1, updated_at = datetime('now') WHERE id = ?`).run(id);
};

// ============================================================================
// Import Log Operations
// ============================================================================

/**
 * Log an import operation
 */
export const logImport = (log: {
  importId: string;
  sourceType: ImportSourceType;
  sourceIdentifier: string;
  templateId?: string;
  parsingMethod: ParsingMethod;
  success: boolean;
  errorMessage?: string;
  parsedFields?: ImportedPromptFields;
  rawContentLength: number;
  processingTimeMs: number;
}): PromptImportLog => {
  const stmt = db.prepare(`
    INSERT INTO prompt_import_logs
    (import_id, source_type, source_identifier, template_id, parsing_method,
     success, error_message, parsed_fields, raw_content_length, processing_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    log.importId,
    log.sourceType,
    log.sourceIdentifier,
    log.templateId || null,
    log.parsingMethod,
    log.success ? 1 : 0,
    log.errorMessage || null,
    log.parsedFields ? JSON.stringify(log.parsedFields) : null,
    log.rawContentLength,
    log.processingTimeMs
  );

  // If template was used, update its stats
  if (log.templateId) {
    incrementTemplateStats(log.templateId, log.success);
  }

  const saved = db.prepare('SELECT * FROM prompt_import_logs WHERE id = ?').get(result.lastInsertRowid) as DbLogRow;
  return rowToLog(saved);
};

/**
 * Get import logs with optional filtering
 * Per user preference: Keep last 100 per user
 */
export const getImportLogs = (options?: {
  sourceType?: ImportSourceType;
  parsingMethod?: ParsingMethod;
  success?: boolean;
  limit?: number;
  offset?: number;
}): { logs: PromptImportLog[]; total: number } => {
  const { sourceType, parsingMethod, success, limit = 100, offset = 0 } = options || {};

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (sourceType) {
    whereClauses.push('source_type = ?');
    params.push(sourceType);
  }
  if (parsingMethod) {
    whereClauses.push('parsing_method = ?');
    params.push(parsingMethod);
  }
  if (success !== undefined) {
    whereClauses.push('success = ?');
    params.push(success ? 1 : 0);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) as count FROM prompt_import_logs ${whereClause}`;
  const { count: total } = db.prepare(countSql).get(...params) as { count: number };

  // Get paginated results
  const sql = `
    SELECT * FROM prompt_import_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params) as DbLogRow[];

  return {
    logs: rows.map(rowToLog),
    total,
  };
};

/**
 * Get a single import log by import ID
 */
export const getImportLogByImportId = (importId: string): PromptImportLog | null => {
  const row = db
    .prepare('SELECT * FROM prompt_import_logs WHERE import_id = ?')
    .get(importId) as DbLogRow | undefined;

  if (!row) return null;
  return rowToLog(row);
};

/**
 * Clean up old logs (keep last N per retention policy)
 * Per user preference: Keep last 100
 */
export const cleanupOldLogs = (keepCount: number = 100): number => {
  // Get the ID of the Nth most recent log
  const cutoffRow = db
    .prepare('SELECT id FROM prompt_import_logs ORDER BY created_at DESC LIMIT 1 OFFSET ?')
    .get(keepCount - 1) as { id: number } | undefined;

  if (!cutoffRow) {
    // Less than keepCount logs exist, nothing to clean
    return 0;
  }

  const result = db
    .prepare('DELETE FROM prompt_import_logs WHERE id < ?')
    .run(cutoffRow.id);

  if (result.changes > 0) {
    console.log(`[PromptImportDb] Cleaned up ${result.changes} old import logs`);
  }

  return result.changes;
};

/**
 * Get import statistics
 */
export const getImportStats = (): {
  totalImports: number;
  successfulImports: number;
  byMethod: Record<ParsingMethod, number>;
  bySource: Record<ImportSourceType, number>;
} => {
  const totalRow = db.prepare('SELECT COUNT(*) as count FROM prompt_import_logs').get() as { count: number };
  const successRow = db.prepare('SELECT COUNT(*) as count FROM prompt_import_logs WHERE success = 1').get() as { count: number };

  const methodRows = db.prepare(`
    SELECT parsing_method, COUNT(*) as count
    FROM prompt_import_logs
    GROUP BY parsing_method
  `).all() as { parsing_method: string; count: number }[];

  const sourceRows = db.prepare(`
    SELECT source_type, COUNT(*) as count
    FROM prompt_import_logs
    GROUP BY source_type
  `).all() as { source_type: string; count: number }[];

  const byMethod: Record<ParsingMethod, number> = { regex: 0, template: 0, ai: 0 };
  methodRows.forEach((row) => {
    byMethod[row.parsing_method as ParsingMethod] = row.count;
  });

  const bySource: Record<ImportSourceType, number> = { url: 0, file: 0, paste: 0 };
  sourceRows.forEach((row) => {
    bySource[row.source_type as ImportSourceType] = row.count;
  });

  return {
    totalImports: totalRow.count,
    successfulImports: successRow.count,
    byMethod,
    bySource,
  };
};

export default {
  // Template operations
  createTemplate,
  getTemplates,
  getTemplateById,
  findMatchingTemplate,
  updateTemplate,
  deleteTemplate,
  incrementTemplateStats,
  // Log operations
  generateImportId,
  logImport,
  getImportLogs,
  getImportLogByImportId,
  cleanupOldLogs,
  getImportStats,
};
