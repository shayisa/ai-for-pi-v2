/**
 * Topic Database Service
 * CRUD operations for saved topics stored in SQLite
 *
 * Phase: Topic/Source Persistence
 *
 * Topics can be saved from:
 * - 'suggested' - AI-generated from "Suggest Topics"
 * - 'trending' - Added from "What's Trending" section
 * - 'manual' - User-typed custom topic
 */

import db from '../db/init.ts';

// Types
export interface SavedTopic {
  id: string;
  title: string;
  description: string | null;
  category: 'suggested' | 'trending' | 'manual';
  sourceUrl: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DbTopicRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  source_url: string | null;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to SavedTopic object
 */
const rowToTopic = (row: DbTopicRow): SavedTopic => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category as SavedTopic['category'],
  sourceUrl: row.source_url,
  isFavorite: row.is_favorite === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Generate unique ID for topics
 */
const generateId = (): string => {
  return `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all saved topics
 * Returns topics sorted by favorites first, then by creation date
 */
export const getAllTopics = (limit: number = 100): SavedTopic[] => {
  const rows = db
    .prepare('SELECT * FROM saved_topics ORDER BY is_favorite DESC, created_at DESC LIMIT ?')
    .all(limit) as DbTopicRow[];

  return rows.map(rowToTopic);
};

/**
 * Get topic by ID
 */
export const getTopicById = (id: string): SavedTopic | null => {
  const row = db
    .prepare('SELECT * FROM saved_topics WHERE id = ?')
    .get(id) as DbTopicRow | undefined;

  if (!row) return null;
  return rowToTopic(row);
};

/**
 * Create a new saved topic
 */
export const createTopic = (topic: {
  title: string;
  description?: string;
  category: SavedTopic['category'];
  sourceUrl?: string;
}): SavedTopic => {
  const id = generateId();

  db.prepare(`
    INSERT INTO saved_topics (id, title, description, category, source_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, topic.title, topic.description || null, topic.category, topic.sourceUrl || null);

  console.log(`[TopicDb] Saved topic: ${topic.title} (${id})`);

  return getTopicById(id)!;
};

/**
 * Update an existing topic
 */
export const updateTopic = (
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    category: SavedTopic['category'];
    sourceUrl: string;
  }>
): SavedTopic | null => {
  const existing = getTopicById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.sourceUrl !== undefined) {
    fields.push('source_url = ?');
    values.push(updates.sourceUrl);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE saved_topics SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  console.log(`[TopicDb] Updated topic: ${id}`);

  return getTopicById(id);
};

/**
 * Delete a topic
 */
export const deleteTopic = (id: string): boolean => {
  const result = db.prepare('DELETE FROM saved_topics WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[TopicDb] Deleted topic: ${id}`);
    return true;
  }

  return false;
};

/**
 * Toggle topic favorite status
 */
export const toggleTopicFavorite = (id: string): SavedTopic | null => {
  const existing = getTopicById(id);
  if (!existing) return null;

  const newFavoriteStatus = existing.isFavorite ? 0 : 1;

  db.prepare('UPDATE saved_topics SET is_favorite = ? WHERE id = ?').run(newFavoriteStatus, id);
  console.log(`[TopicDb] Toggled favorite for ${id}: ${newFavoriteStatus === 1 ? 'favorited' : 'unfavorited'}`);

  return getTopicById(id);
};

/**
 * Search topics by title
 */
export const searchTopics = (query: string, limit: number = 20): SavedTopic[] => {
  const rows = db
    .prepare('SELECT * FROM saved_topics WHERE title LIKE ? ORDER BY is_favorite DESC, created_at DESC LIMIT ?')
    .all(`%${query}%`, limit) as DbTopicRow[];

  return rows.map(rowToTopic);
};

/**
 * Get topic count
 */
export const getTopicCount = (): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM saved_topics').get() as { count: number };
  return result.count;
};

/**
 * Get topics by category
 */
export const getTopicsByCategory = (category: SavedTopic['category'], limit: number = 50): SavedTopic[] => {
  const rows = db
    .prepare('SELECT * FROM saved_topics WHERE category = ? ORDER BY is_favorite DESC, created_at DESC LIMIT ?')
    .all(category, limit) as DbTopicRow[];

  return rows.map(rowToTopic);
};

/**
 * Phase 15.5: Batch create topics
 * Creates multiple topics at once, skipping duplicates by title
 * Used for auto-saving suggested topics
 */
export interface CreateTopicBatchInput {
  title: string;
  category: SavedTopic['category'];
  sourceUrl?: string;
  description?: string;
}

export interface CreateTopicsBatchResult {
  created: SavedTopic[];
  duplicateCount: number;
}

export const createTopicsBatch = (topics: CreateTopicBatchInput[]): CreateTopicsBatchResult => {
  const created: SavedTopic[] = [];
  let duplicateCount = 0;

  // Get existing titles to check for duplicates
  const existingTitles = new Set(
    (db.prepare('SELECT title FROM saved_topics').all() as { title: string }[])
      .map(row => row.title.toLowerCase())
  );

  for (const topic of topics) {
    // Skip if title already exists (case-insensitive)
    if (existingTitles.has(topic.title.toLowerCase())) {
      duplicateCount++;
      console.log(`[TopicDb] Skipped duplicate: ${topic.title}`);
      continue;
    }

    const id = generateId();

    db.prepare(`
      INSERT INTO saved_topics (id, title, description, category, source_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, topic.title, topic.description || null, topic.category, topic.sourceUrl || null);

    const savedTopic = getTopicById(id);
    if (savedTopic) {
      created.push(savedTopic);
      existingTitles.add(topic.title.toLowerCase()); // Add to set to prevent duplicates within batch
    }
  }

  console.log(`[TopicDb] Batch saved ${created.length} topics, ${duplicateCount} duplicates skipped`);

  return { created, duplicateCount };
};
