/**
 * Thumbnail Database Service
 * CRUD operations for image style thumbnails stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface StyleThumbnail {
  id: number;
  styleName: string;
  thumbnailBase64: string;
  promptUsed: string | null;
  createdAt: string;
}

interface DbThumbnailRow {
  id: number;
  style_name: string;
  thumbnail_base64: string;
  prompt_used: string | null;
  created_at: string;
}

/**
 * Convert database row to StyleThumbnail object
 */
const rowToThumbnail = (row: DbThumbnailRow): StyleThumbnail => ({
  id: row.id,
  styleName: row.style_name,
  thumbnailBase64: row.thumbnail_base64,
  promptUsed: row.prompt_used,
  createdAt: row.created_at,
});

/**
 * Get all thumbnails
 */
export const getAllThumbnails = (): StyleThumbnail[] => {
  const rows = db
    .prepare('SELECT * FROM image_style_thumbnails ORDER BY style_name ASC')
    .all() as DbThumbnailRow[];

  console.log(`[ThumbnailDb] Retrieved ${rows.length} thumbnails`);
  return rows.map(rowToThumbnail);
};

/**
 * Get thumbnail by style name
 */
export const getThumbnailByStyle = (styleName: string): StyleThumbnail | null => {
  const row = db
    .prepare('SELECT * FROM image_style_thumbnails WHERE style_name = ?')
    .get(styleName) as DbThumbnailRow | undefined;

  if (!row) return null;
  return rowToThumbnail(row);
};

/**
 * Save or update a thumbnail (upsert)
 */
export const saveThumbnail = (
  styleName: string,
  base64: string,
  promptUsed: string
): StyleThumbnail => {
  // Use INSERT OR REPLACE for upsert behavior
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO image_style_thumbnails (style_name, thumbnail_base64, prompt_used, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `);

  stmt.run(styleName, base64, promptUsed);

  console.log(`[ThumbnailDb] Saved thumbnail for style: ${styleName}`);

  // Return the saved thumbnail
  const saved = db
    .prepare('SELECT * FROM image_style_thumbnails WHERE style_name = ?')
    .get(styleName) as DbThumbnailRow;

  return rowToThumbnail(saved);
};

/**
 * Get list of style names that are missing thumbnails
 */
export const getMissingStyles = (allStyleNames: string[]): string[] => {
  const existingRows = db
    .prepare('SELECT style_name FROM image_style_thumbnails')
    .all() as Array<{ style_name: string }>;

  const existingStyles = new Set(existingRows.map((row) => row.style_name));

  const missing = allStyleNames.filter((style) => !existingStyles.has(style));
  console.log(`[ThumbnailDb] Missing thumbnails for: ${missing.join(', ') || 'none'}`);

  return missing;
};

/**
 * Delete a thumbnail by style name
 */
export const deleteThumbnail = (styleName: string): boolean => {
  const result = db
    .prepare('DELETE FROM image_style_thumbnails WHERE style_name = ?')
    .run(styleName);

  if (result.changes > 0) {
    console.log(`[ThumbnailDb] Deleted thumbnail: ${styleName}`);
    return true;
  }

  return false;
};

/**
 * Delete all thumbnails (for regeneration)
 */
export const deleteAllThumbnails = (): number => {
  const result = db.prepare('DELETE FROM image_style_thumbnails').run();
  console.log(`[ThumbnailDb] Deleted all ${result.changes} thumbnails`);
  return result.changes;
};

/**
 * Get thumbnail count
 */
export const getThumbnailCount = (): number => {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM image_style_thumbnails')
    .get() as { count: number };

  return result.count;
};
