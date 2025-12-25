/**
 * Source Database Service
 * CRUD operations for saved inspiration sources stored in SQLite
 *
 * Phase: Topic/Source Persistence
 *
 * Sources can be saved from:
 * - 'hackernews' - Hacker News posts
 * - 'arxiv' - ArXiv papers
 * - 'github' - GitHub repositories/discussions
 * - 'reddit' - Reddit posts
 * - 'dev' - Dev.to and other developer blogs
 */

import db from '../db/init.ts';

// Types
export interface SavedSource {
  id: string;
  title: string;
  url: string;
  author: string | null;
  publication: string | null;
  date: string | null;
  category: 'hackernews' | 'arxiv' | 'github' | 'reddit' | 'dev';
  summary: string | null;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DbSourceRow {
  id: string;
  title: string;
  url: string;
  author: string | null;
  publication: string | null;
  date: string | null;
  category: string;
  summary: string | null;
  is_favorite: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to SavedSource object
 */
const rowToSource = (row: DbSourceRow): SavedSource => ({
  id: row.id,
  title: row.title,
  url: row.url,
  author: row.author,
  publication: row.publication,
  date: row.date,
  category: row.category as SavedSource['category'],
  summary: row.summary,
  isFavorite: row.is_favorite === 1,
  usageCount: row.usage_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Generate unique ID for sources
 */
const generateId = (): string => {
  return `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all saved sources
 * Returns sources sorted by favorites first, then by creation date
 */
export const getAllSources = (limit: number = 100): SavedSource[] => {
  const rows = db
    .prepare('SELECT * FROM saved_sources ORDER BY is_favorite DESC, created_at DESC LIMIT ?')
    .all(limit) as DbSourceRow[];

  return rows.map(rowToSource);
};

/**
 * Get source by ID
 */
export const getSourceById = (id: string): SavedSource | null => {
  const row = db
    .prepare('SELECT * FROM saved_sources WHERE id = ?')
    .get(id) as DbSourceRow | undefined;

  if (!row) return null;
  return rowToSource(row);
};

/**
 * Get source by URL (for duplicate detection)
 */
export const getSourceByUrl = (url: string): SavedSource | null => {
  const row = db
    .prepare('SELECT * FROM saved_sources WHERE url = ?')
    .get(url) as DbSourceRow | undefined;

  if (!row) return null;
  return rowToSource(row);
};

/**
 * Create a new saved source
 */
export const createSource = (source: {
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: SavedSource['category'];
  summary?: string;
}): SavedSource => {
  const id = generateId();

  db.prepare(`
    INSERT INTO saved_sources (id, title, url, author, publication, date, category, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    source.title,
    source.url,
    source.author || null,
    source.publication || null,
    source.date || null,
    source.category,
    source.summary || null
  );

  console.log(`[SourceDb] Saved source: ${source.title} (${id})`);

  return getSourceById(id)!;
};

/**
 * Update an existing source
 */
export const updateSource = (
  id: string,
  updates: Partial<{
    title: string;
    url: string;
    author: string;
    publication: string;
    date: string;
    category: SavedSource['category'];
    summary: string;
  }>
): SavedSource | null => {
  const existing = getSourceById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.url !== undefined) {
    fields.push('url = ?');
    values.push(updates.url);
  }
  if (updates.author !== undefined) {
    fields.push('author = ?');
    values.push(updates.author);
  }
  if (updates.publication !== undefined) {
    fields.push('publication = ?');
    values.push(updates.publication);
  }
  if (updates.date !== undefined) {
    fields.push('date = ?');
    values.push(updates.date);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updates.summary);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE saved_sources SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  console.log(`[SourceDb] Updated source: ${id}`);

  return getSourceById(id);
};

/**
 * Delete a source
 */
export const deleteSource = (id: string): boolean => {
  const result = db.prepare('DELETE FROM saved_sources WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[SourceDb] Deleted source: ${id}`);
    return true;
  }

  return false;
};

/**
 * Toggle source favorite status
 */
export const toggleSourceFavorite = (id: string): SavedSource | null => {
  const existing = getSourceById(id);
  if (!existing) return null;

  const newFavoriteStatus = existing.isFavorite ? 0 : 1;

  db.prepare('UPDATE saved_sources SET is_favorite = ? WHERE id = ?').run(newFavoriteStatus, id);
  console.log(`[SourceDb] Toggled favorite for ${id}: ${newFavoriteStatus === 1 ? 'favorited' : 'unfavorited'}`);

  return getSourceById(id);
};

/**
 * Increment usage count for a source
 */
export const incrementUsageCount = (id: string): SavedSource | null => {
  const existing = getSourceById(id);
  if (!existing) return null;

  db.prepare("UPDATE saved_sources SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?").run(id);
  console.log(`[SourceDb] Incremented usage for ${id}: ${existing.usageCount + 1}`);

  return getSourceById(id);
};

/**
 * Search sources by title
 */
export const searchSources = (query: string, limit: number = 20): SavedSource[] => {
  const rows = db
    .prepare('SELECT * FROM saved_sources WHERE title LIKE ? ORDER BY is_favorite DESC, created_at DESC LIMIT ?')
    .all(`%${query}%`, limit) as DbSourceRow[];

  return rows.map(rowToSource);
};

/**
 * Get source count
 */
export const getSourceCount = (): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM saved_sources').get() as { count: number };
  return result.count;
};

/**
 * Get sources by category
 */
export const getSourcesByCategory = (category: SavedSource['category'], limit: number = 50): SavedSource[] => {
  const rows = db
    .prepare('SELECT * FROM saved_sources WHERE category = ? ORDER BY is_favorite DESC, created_at DESC LIMIT ?')
    .all(category, limit) as DbSourceRow[];

  return rows.map(rowToSource);
};

/**
 * Get favorite sources
 */
export const getFavoriteSources = (limit: number = 50): SavedSource[] => {
  const rows = db
    .prepare('SELECT * FROM saved_sources WHERE is_favorite = 1 ORDER BY created_at DESC LIMIT ?')
    .all(limit) as DbSourceRow[];

  return rows.map(rowToSource);
};

/**
 * Phase 15.6: Batch create sources
 * Creates multiple sources at once, skipping duplicates by URL
 * Used for auto-saving trending sources
 */
export interface CreateSourceBatchInput {
  title: string;
  url: string;
  author?: string;
  publication?: string;
  date?: string;
  category: SavedSource['category'];
  summary?: string;
}

export interface CreateSourcesBatchResult {
  created: SavedSource[];
  duplicateCount: number;
}

export const createSourcesBatch = (sources: CreateSourceBatchInput[]): CreateSourcesBatchResult => {
  const created: SavedSource[] = [];
  let duplicateCount = 0;

  // Get existing URLs to check for duplicates (case-insensitive)
  const existingUrls = new Set(
    (db.prepare('SELECT url FROM saved_sources').all() as { url: string }[])
      .map(row => row.url.toLowerCase())
  );

  for (const source of sources) {
    // Skip if URL already exists (case-insensitive)
    if (existingUrls.has(source.url.toLowerCase())) {
      duplicateCount++;
      continue;
    }

    const id = generateId();

    db.prepare(`
      INSERT INTO saved_sources (id, title, url, author, publication, date, category, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      source.title,
      source.url,
      source.author || null,
      source.publication || null,
      source.date || null,
      source.category,
      source.summary || null
    );

    const savedSource = getSourceById(id);
    if (savedSource) {
      created.push(savedSource);
      existingUrls.add(source.url.toLowerCase()); // Prevent duplicates within batch
    }
  }

  console.log(`[SourceDb] Batch saved ${created.length} sources, ${duplicateCount} duplicates skipped`);

  return { created, duplicateCount };
};
