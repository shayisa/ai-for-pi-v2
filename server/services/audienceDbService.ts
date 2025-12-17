/**
 * Audience Database Service
 * CRUD operations for custom audiences stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface AudienceGenerated {
  persona: string;
  relevance_keywords: string[];
  subreddits?: string[];
  arxiv_categories?: string[];
  search_templates?: string[];
}

export interface CustomAudience {
  id: string;
  name: string;
  description: string;
  generated?: AudienceGenerated;
  isDefault: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DbAudienceRow {
  id: string;
  name: string;
  description: string | null;
  persona: string | null;
  relevance_keywords: string | null;
  subreddits: string | null;
  arxiv_categories: string | null;
  search_templates: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to CustomAudience object
 */
const rowToAudience = (row: DbAudienceRow): CustomAudience => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  generated: row.persona
    ? {
        persona: row.persona,
        relevance_keywords: row.relevance_keywords ? JSON.parse(row.relevance_keywords) : [],
        subreddits: row.subreddits ? JSON.parse(row.subreddits) : undefined,
        arxiv_categories: row.arxiv_categories ? JSON.parse(row.arxiv_categories) : undefined,
        search_templates: row.search_templates ? JSON.parse(row.search_templates) : undefined,
      }
    : undefined,
  isDefault: row.is_default === 1,
  isCustom: row.is_default === 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Generate unique ID for audiences
 */
const generateId = (): string => {
  return `audience_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all custom audiences (non-default)
 */
export const getCustomAudiences = (): CustomAudience[] => {
  const rows = db
    .prepare('SELECT * FROM custom_audiences WHERE is_default = 0 ORDER BY created_at DESC')
    .all() as DbAudienceRow[];

  return rows.map(rowToAudience);
};

/**
 * Get all audiences (including defaults)
 */
export const getAllAudiences = (): CustomAudience[] => {
  const rows = db
    .prepare('SELECT * FROM custom_audiences ORDER BY is_default DESC, created_at DESC')
    .all() as DbAudienceRow[];

  return rows.map(rowToAudience);
};

/**
 * Get audience by ID
 */
export const getAudienceById = (id: string): CustomAudience | null => {
  const row = db
    .prepare('SELECT * FROM custom_audiences WHERE id = ?')
    .get(id) as DbAudienceRow | undefined;

  if (!row) return null;
  return rowToAudience(row);
};

/**
 * Create a new custom audience
 */
export const createAudience = (
  name: string,
  description: string,
  generated?: AudienceGenerated
): CustomAudience => {
  const id = generateId();

  db.prepare(`
    INSERT INTO custom_audiences
    (id, name, description, persona, relevance_keywords, subreddits, arxiv_categories, search_templates, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
  `).run(
    id,
    name,
    description,
    generated?.persona || null,
    generated?.relevance_keywords ? JSON.stringify(generated.relevance_keywords) : null,
    generated?.subreddits ? JSON.stringify(generated.subreddits) : null,
    generated?.arxiv_categories ? JSON.stringify(generated.arxiv_categories) : null,
    generated?.search_templates ? JSON.stringify(generated.search_templates) : null
  );

  console.log(`[AudienceDb] Created audience: ${name} (${id})`);

  return getAudienceById(id)!;
};

/**
 * Save a full audience object (for migration from localStorage)
 */
export const saveAudience = (audience: {
  id: string;
  name: string;
  description: string;
  generated?: AudienceGenerated;
  isCustom?: boolean;
}): CustomAudience => {
  const existing = getAudienceById(audience.id);

  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE custom_audiences
      SET name = ?, description = ?, persona = ?, relevance_keywords = ?,
          subreddits = ?, arxiv_categories = ?, search_templates = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      audience.name,
      audience.description,
      audience.generated?.persona || null,
      audience.generated?.relevance_keywords ? JSON.stringify(audience.generated.relevance_keywords) : null,
      audience.generated?.subreddits ? JSON.stringify(audience.generated.subreddits) : null,
      audience.generated?.arxiv_categories ? JSON.stringify(audience.generated.arxiv_categories) : null,
      audience.generated?.search_templates ? JSON.stringify(audience.generated.search_templates) : null,
      audience.id
    );
    console.log(`[AudienceDb] Updated audience: ${audience.name}`);
  } else {
    // Insert new
    db.prepare(`
      INSERT INTO custom_audiences
      (id, name, description, persona, relevance_keywords, subreddits, arxiv_categories, search_templates, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).run(
      audience.id,
      audience.name,
      audience.description,
      audience.generated?.persona || null,
      audience.generated?.relevance_keywords ? JSON.stringify(audience.generated.relevance_keywords) : null,
      audience.generated?.subreddits ? JSON.stringify(audience.generated.subreddits) : null,
      audience.generated?.arxiv_categories ? JSON.stringify(audience.generated.arxiv_categories) : null,
      audience.generated?.search_templates ? JSON.stringify(audience.generated.search_templates) : null
    );
    console.log(`[AudienceDb] Saved audience: ${audience.name} (${audience.id})`);
  }

  return getAudienceById(audience.id)!;
};

/**
 * Delete a custom audience
 */
export const deleteAudience = (id: string): boolean => {
  const existing = getAudienceById(id);
  if (!existing) return false;

  // Don't allow deleting default audiences
  if (existing.isDefault) {
    console.warn(`[AudienceDb] Cannot delete default audience: ${id}`);
    return false;
  }

  const result = db.prepare('DELETE FROM custom_audiences WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[AudienceDb] Deleted audience: ${id}`);
    return true;
  }

  return false;
};

/**
 * Get audience count
 */
export const getAudienceCount = (): { total: number; default: number; custom: number } => {
  const total = (db.prepare('SELECT COUNT(*) as count FROM custom_audiences').get() as { count: number }).count;
  const defaultCount = (db.prepare('SELECT COUNT(*) as count FROM custom_audiences WHERE is_default = 1').get() as { count: number }).count;

  return {
    total,
    default: defaultCount,
    custom: total - defaultCount,
  };
};
