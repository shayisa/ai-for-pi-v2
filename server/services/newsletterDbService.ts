/**
 * Newsletter Database Service
 * CRUD operations for newsletters and action logs stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface NewsletterSection {
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
}

export interface PromptOfTheDay {
  title: string;
  summary: string;
  examplePrompts: string[];
  promptCode: string;
}

export interface Newsletter {
  id: string;
  createdAt: string;
  subject: string;
  introduction: string;
  conclusion: string;
  sections: NewsletterSection[];
  promptOfTheDay?: PromptOfTheDay;
  topics: string[];
  audience?: string[];
  tone?: string;
  imageStyle?: string;
}

export interface NewsletterLog {
  id: number;
  newsletterId: string;
  action: string;
  actionAt: string;
  details?: Record<string, unknown>;
}

export interface NewsletterSettings {
  audience?: string[];
  tone?: string;
  imageStyle?: string;
}

interface DbNewsletterRow {
  id: string;
  created_at: string;
  subject: string;
  introduction: string;
  conclusion: string;
  sections: string;
  prompt_of_day: string | null;
  topics: string;
  audience: string | null;
  tone: string | null;
  image_style: string | null;
}

interface DbLogRow {
  id: number;
  newsletter_id: string;
  action: string;
  action_at: string;
  details: string | null;
}

/**
 * Save a new newsletter
 */
export const saveNewsletter = (
  newsletter: {
    id: string;
    subject: string;
    introduction: string;
    sections: NewsletterSection[];
    conclusion: string;
    promptOfTheDay?: PromptOfTheDay;
  },
  topics: string[],
  settings?: NewsletterSettings
): Newsletter => {
  const stmt = db.prepare(`
    INSERT INTO newsletters (id, subject, introduction, conclusion, sections, prompt_of_day, topics, audience, tone, image_style)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newsletter.id,
    newsletter.subject,
    newsletter.introduction || '',
    newsletter.conclusion || '',
    JSON.stringify(newsletter.sections),
    newsletter.promptOfTheDay ? JSON.stringify(newsletter.promptOfTheDay) : null,
    JSON.stringify(topics),
    settings?.audience ? JSON.stringify(settings.audience) : null,
    settings?.tone || null,
    settings?.imageStyle || null
  );

  // Log the creation
  logAction(newsletter.id, 'created');

  console.log(`[NewsletterDb] Saved newsletter: ${newsletter.subject} (${newsletter.id})`);

  return {
    id: newsletter.id,
    createdAt: new Date().toISOString(),
    subject: newsletter.subject,
    introduction: newsletter.introduction || '',
    conclusion: newsletter.conclusion || '',
    sections: newsletter.sections,
    promptOfTheDay: newsletter.promptOfTheDay,
    topics,
    audience: settings?.audience,
    tone: settings?.tone,
    imageStyle: settings?.imageStyle
  };
};

/**
 * Get all newsletters (newest first)
 */
export const getNewsletters = (limit = 50): Newsletter[] => {
  const stmt = db.prepare(`
    SELECT * FROM newsletters ORDER BY created_at DESC LIMIT ?
  `);

  const rows = stmt.all(limit) as DbNewsletterRow[];

  return rows.map(rowToNewsletter);
};

/**
 * Get a single newsletter by ID
 */
export const getNewsletterById = (id: string): Newsletter | null => {
  const stmt = db.prepare(`SELECT * FROM newsletters WHERE id = ?`);
  const row = stmt.get(id) as DbNewsletterRow | undefined;

  if (!row) return null;

  return rowToNewsletter(row);
};

/**
 * Delete a newsletter by ID
 */
export const deleteNewsletter = (id: string): boolean => {
  // Delete logs first (foreign key)
  db.prepare(`DELETE FROM newsletter_logs WHERE newsletter_id = ?`).run(id);

  const stmt = db.prepare(`DELETE FROM newsletters WHERE id = ?`);
  const result = stmt.run(id);

  if (result.changes > 0) {
    console.log(`[NewsletterDb] Deleted newsletter: ${id}`);
  }

  return result.changes > 0;
};

/**
 * Search newsletters by subject
 */
export const searchNewsletters = (query: string, limit = 20): Newsletter[] => {
  const stmt = db.prepare(`
    SELECT * FROM newsletters
    WHERE subject LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(`%${query}%`, limit) as DbNewsletterRow[];

  return rows.map(rowToNewsletter);
};

/**
 * Log an action for a newsletter
 */
export const logAction = (
  newsletterId: string,
  action: 'created' | 'saved_to_drive' | 'sent_email',
  details?: Record<string, unknown>
): void => {
  const stmt = db.prepare(`
    INSERT INTO newsletter_logs (newsletter_id, action, details)
    VALUES (?, ?, ?)
  `);

  stmt.run(newsletterId, action, details ? JSON.stringify(details) : null);

  console.log(`[NewsletterDb] Logged action: ${action} for newsletter ${newsletterId}`);
};

/**
 * Get logs for a newsletter
 */
export const getNewsletterLogs = (newsletterId: string): NewsletterLog[] => {
  const stmt = db.prepare(`
    SELECT * FROM newsletter_logs
    WHERE newsletter_id = ?
    ORDER BY action_at DESC
  `);

  const rows = stmt.all(newsletterId) as DbLogRow[];

  return rows.map(row => ({
    id: row.id,
    newsletterId: row.newsletter_id,
    action: row.action,
    actionAt: row.action_at,
    details: row.details ? JSON.parse(row.details) : undefined
  }));
};

/**
 * Get newsletter count
 */
export const getNewsletterCount = (): number => {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM newsletters`);
  const result = stmt.get() as { count: number };
  return result.count;
};

/**
 * Helper: Convert DB row to Newsletter object
 */
const rowToNewsletter = (row: DbNewsletterRow): Newsletter => ({
  id: row.id,
  createdAt: row.created_at,
  subject: row.subject,
  introduction: row.introduction || '',
  conclusion: row.conclusion || '',
  sections: JSON.parse(row.sections),
  promptOfTheDay: row.prompt_of_day ? JSON.parse(row.prompt_of_day) : undefined,
  topics: JSON.parse(row.topics),
  audience: row.audience ? JSON.parse(row.audience) : undefined,
  tone: row.tone || undefined,
  imageStyle: row.image_style || undefined
});
