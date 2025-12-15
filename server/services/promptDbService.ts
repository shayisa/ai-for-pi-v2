/**
 * Prompt Database Service
 * CRUD operations for saved prompts stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface SavedPrompt {
  id: string;
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
  createdAt: string;
}

interface DbPromptRow {
  id: string;
  title: string;
  summary: string | null;
  example_prompts: string;
  prompt_code: string;
  created_at: string;
}

/**
 * Generate a unique ID for a saved prompt
 */
const generatePromptId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `prm_${timestamp}_${random}`;
};

/**
 * Convert database row to SavedPrompt object
 */
const rowToPrompt = (row: DbPromptRow): SavedPrompt => ({
  id: row.id,
  title: row.title,
  summary: row.summary || '',
  examplePrompts: JSON.parse(row.example_prompts || '[]'),
  promptCode: row.prompt_code,
  createdAt: row.created_at,
});

/**
 * Save a new prompt to the library
 */
export const savePrompt = (prompt: {
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
}): SavedPrompt => {
  const id = generatePromptId();

  const stmt = db.prepare(`
    INSERT INTO saved_prompts (id, title, summary, example_prompts, prompt_code)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    prompt.title,
    prompt.summary || null,
    JSON.stringify(prompt.examplePrompts),
    prompt.promptCode
  );

  // Log the action
  console.log(`[PromptDb] Saved prompt: ${prompt.title}`);

  // Return the saved prompt with generated fields
  const saved = db.prepare('SELECT * FROM saved_prompts WHERE id = ?').get(id) as DbPromptRow;
  return rowToPrompt(saved);
};

/**
 * Get all saved prompts (newest first)
 */
export const getPrompts = (limit: number = 50): SavedPrompt[] => {
  const rows = db
    .prepare('SELECT * FROM saved_prompts ORDER BY created_at DESC LIMIT ?')
    .all(limit) as DbPromptRow[];

  return rows.map(rowToPrompt);
};

/**
 * Get a single prompt by ID
 */
export const getPromptById = (id: string): SavedPrompt | null => {
  const row = db.prepare('SELECT * FROM saved_prompts WHERE id = ?').get(id) as DbPromptRow | undefined;

  if (!row) return null;
  return rowToPrompt(row);
};

/**
 * Delete a prompt by ID
 */
export const deletePrompt = (id: string): boolean => {
  const result = db.prepare('DELETE FROM saved_prompts WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[PromptDb] Deleted prompt: ${id}`);
    return true;
  }

  return false;
};

/**
 * Get the count of saved prompts
 */
export const getPromptCount = (): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM saved_prompts').get() as { count: number };
  return result.count;
};

/**
 * Search prompts by title
 */
export const searchPrompts = (query: string, limit: number = 20): SavedPrompt[] => {
  const rows = db
    .prepare('SELECT * FROM saved_prompts WHERE title LIKE ? ORDER BY created_at DESC LIMIT ?')
    .all(`%${query}%`, limit) as DbPromptRow[];

  return rows.map(rowToPrompt);
};
