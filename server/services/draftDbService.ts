/**
 * Draft Database Service
 * Auto-save and restore newsletter drafts in SQLite
 */

import db from '../db/init.ts';

// Types
export interface DraftContent {
  newsletter?: {
    subject?: string;
    introduction?: string;
    sections?: Array<{ title: string; content: string; imagePrompt?: string }>;
    conclusion?: string;
  };
  enhancedNewsletter?: unknown;
  formatVersion: 'v1' | 'v2';
}

export interface DraftSettings {
  selectedTone?: string;
  selectedImageStyle?: string;
  selectedAudiences?: string[];
  personaId?: string | null;
  promptOfTheDay?: unknown;
}

export interface NewsletterDraft {
  id: string;
  userEmail: string;
  content: DraftContent;
  topics: string[];
  settings: DraftSettings;
  lastSavedAt: string;
}

interface DbDraftRow {
  id: string;
  user_email: string;
  content: string;
  topics: string;
  settings: string;
  last_saved_at: string;
}

/**
 * Convert database row to NewsletterDraft object
 */
const rowToDraft = (row: DbDraftRow): NewsletterDraft => ({
  id: row.id,
  userEmail: row.user_email,
  content: JSON.parse(row.content),
  topics: JSON.parse(row.topics),
  settings: JSON.parse(row.settings),
  lastSavedAt: row.last_saved_at,
});

/**
 * Get draft for a user
 */
export const getDraft = (userEmail: string): NewsletterDraft | null => {
  const row = db
    .prepare('SELECT * FROM newsletter_drafts WHERE user_email = ?')
    .get(userEmail) as DbDraftRow | undefined;

  if (!row) return null;
  return rowToDraft(row);
};

/**
 * Save or update a draft
 */
export const saveDraft = (
  userEmail: string,
  content: DraftContent,
  topics: string[],
  settings: DraftSettings
): NewsletterDraft => {
  const existing = getDraft(userEmail);

  if (existing) {
    // Update existing draft
    db.prepare(`
      UPDATE newsletter_drafts
      SET content = ?, topics = ?, settings = ?, last_saved_at = datetime('now')
      WHERE user_email = ?
    `).run(
      JSON.stringify(content),
      JSON.stringify(topics),
      JSON.stringify(settings),
      userEmail
    );
    console.log(`[DraftDb] Updated draft for: ${userEmail}`);
  } else {
    // Create new draft
    const id = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    db.prepare(`
      INSERT INTO newsletter_drafts (id, user_email, content, topics, settings, last_saved_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      userEmail,
      JSON.stringify(content),
      JSON.stringify(topics),
      JSON.stringify(settings)
    );
    console.log(`[DraftDb] Created draft for: ${userEmail}`);
  }

  return getDraft(userEmail)!;
};

/**
 * Delete a draft
 */
export const deleteDraft = (userEmail: string): boolean => {
  const result = db.prepare('DELETE FROM newsletter_drafts WHERE user_email = ?').run(userEmail);

  if (result.changes > 0) {
    console.log(`[DraftDb] Deleted draft for: ${userEmail}`);
    return true;
  }

  return false;
};

/**
 * Check if draft exists
 */
export const hasDraft = (userEmail: string): boolean => {
  const result = db
    .prepare('SELECT 1 FROM newsletter_drafts WHERE user_email = ?')
    .get(userEmail);
  return !!result;
};
