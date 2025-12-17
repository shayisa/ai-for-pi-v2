/**
 * Template Database Service
 * CRUD operations for newsletter templates stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface TemplateSection {
  title: string;
  placeholderContent: string;
  imagePrompt?: string;
}

export interface TemplateStructure {
  introduction: string;
  sections: TemplateSection[];
  conclusion: string;
  includePromptOfDay: boolean;
}

export interface TemplateSettings {
  tone?: string;
  imageStyle?: string;
  personaId?: string;
  audiences?: string[];
}

export interface NewsletterTemplate {
  id: string;
  name: string;
  description: string;
  structure: TemplateStructure;
  defaultSettings?: TemplateSettings;
  createdAt: string;
  updatedAt: string;
}

interface DbTemplateRow {
  id: string;
  name: string;
  description: string | null;
  structure: string;
  default_settings: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to NewsletterTemplate object
 */
const rowToTemplate = (row: DbTemplateRow): NewsletterTemplate => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  structure: JSON.parse(row.structure),
  defaultSettings: row.default_settings ? JSON.parse(row.default_settings) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Generate unique ID for templates
 */
const generateId = (): string => {
  return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all templates (newest first)
 */
export const getTemplates = (limit = 50): NewsletterTemplate[] => {
  const rows = db
    .prepare('SELECT * FROM newsletter_templates ORDER BY created_at DESC LIMIT ?')
    .all(limit) as DbTemplateRow[];

  return rows.map(rowToTemplate);
};

/**
 * Get template by ID
 */
export const getTemplateById = (id: string): NewsletterTemplate | null => {
  const row = db
    .prepare('SELECT * FROM newsletter_templates WHERE id = ?')
    .get(id) as DbTemplateRow | undefined;

  if (!row) return null;
  return rowToTemplate(row);
};

/**
 * Create a new template
 */
export const createTemplate = (
  name: string,
  description: string,
  structure: TemplateStructure,
  defaultSettings?: TemplateSettings
): NewsletterTemplate => {
  const id = generateId();

  db.prepare(`
    INSERT INTO newsletter_templates (id, name, description, structure, default_settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    id,
    name,
    description,
    JSON.stringify(structure),
    defaultSettings ? JSON.stringify(defaultSettings) : null
  );

  console.log(`[TemplateDb] Created template: ${name} (${id})`);

  return getTemplateById(id)!;
};

/**
 * Create template from existing newsletter
 */
export const createTemplateFromNewsletter = (
  name: string,
  description: string,
  newsletter: {
    introduction?: string;
    sections: Array<{ title: string; content: string; imagePrompt?: string }>;
    conclusion?: string;
    promptOfTheDay?: unknown;
  },
  settings?: TemplateSettings
): NewsletterTemplate => {
  const structure: TemplateStructure = {
    introduction: newsletter.introduction || '',
    sections: newsletter.sections.map(s => ({
      title: s.title,
      placeholderContent: s.content,
      imagePrompt: s.imagePrompt,
    })),
    conclusion: newsletter.conclusion || '',
    includePromptOfDay: !!newsletter.promptOfTheDay,
  };

  return createTemplate(name, description, structure, settings);
};

/**
 * Update an existing template
 */
export const updateTemplate = (
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    structure: TemplateStructure;
    defaultSettings: TemplateSettings;
  }>
): NewsletterTemplate | null => {
  const existing = getTemplateById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.structure !== undefined) {
    fields.push('structure = ?');
    values.push(JSON.stringify(updates.structure));
  }
  if (updates.defaultSettings !== undefined) {
    fields.push('default_settings = ?');
    values.push(JSON.stringify(updates.defaultSettings));
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE newsletter_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  console.log(`[TemplateDb] Updated template: ${id}`);

  return getTemplateById(id);
};

/**
 * Delete a template
 */
export const deleteTemplate = (id: string): boolean => {
  const result = db.prepare('DELETE FROM newsletter_templates WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[TemplateDb] Deleted template: ${id}`);
    return true;
  }

  return false;
};

/**
 * Search templates by name
 */
export const searchTemplates = (query: string, limit = 20): NewsletterTemplate[] => {
  const rows = db
    .prepare('SELECT * FROM newsletter_templates WHERE name LIKE ? ORDER BY created_at DESC LIMIT ?')
    .all(`%${query}%`, limit) as DbTemplateRow[];

  return rows.map(rowToTemplate);
};

/**
 * Get template count
 */
export const getTemplateCount = (): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM newsletter_templates').get() as { count: number };
  return result.count;
};
