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

// Extended row interface with v2 columns
interface DbNewsletterRowExtended extends DbNewsletterRow {
  editors_note: string | null;
  tool_of_day: string | null;
  audience_sections: string | null;
  format_version: string | null;
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
 * Update newsletter sections (to save imageUrls after client-side generation)
 */
export const updateNewsletterSections = (
  id: string,
  sections: NewsletterSection[]
): boolean => {
  const stmt = db.prepare(`
    UPDATE newsletters
    SET sections = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(JSON.stringify(sections), id);

  if (result.changes > 0) {
    console.log(`[NewsletterDb] Updated sections for newsletter: ${id}`);
  }

  return result.changes > 0;
};

/**
 * Update enhanced newsletter audienceSections (to save imageUrls after client-side generation)
 */
export const updateEnhancedNewsletterSections = (
  id: string,
  audienceSections: EnhancedAudienceSection[]
): boolean => {
  // Also update legacy sections for backward compatibility
  const legacySections: NewsletterSection[] = audienceSections.map(
    (section: EnhancedAudienceSection) => ({
      title: section.title,
      content: section.content,
      imagePrompt: section.imagePrompt || '',
      imageUrl: section.imageUrl,
    })
  );

  const stmt = db.prepare(`
    UPDATE newsletters
    SET sections = ?, audience_sections = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(
    JSON.stringify(legacySections),
    JSON.stringify(audienceSections),
    id
  );

  if (result.changes > 0) {
    console.log(`[NewsletterDb] Updated enhanced sections for newsletter: ${id}`);
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
  action: 'created' | 'saved_to_drive' | 'sent_email' | 'scheduled_send',
  details?: Record<string, unknown>
): void => {
  // Check if newsletter exists first (foreign key constraint)
  const exists = db.prepare(`SELECT 1 FROM newsletters WHERE id = ?`).get(newsletterId);

  if (!exists) {
    console.warn(`[NewsletterDb] Skipping log - newsletter ${newsletterId} not in database`);
    return;
  }

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

// ============================================================================
// Enhanced Newsletter (v2 Format) Support
// ============================================================================

import type { EnhancedNewsletter, EnhancedAudienceSection } from '../../types.ts';

interface EnhancedNewsletterSettings {
  audience?: string[];
  imageStyle?: string;
}

/**
 * Save an enhanced newsletter (v2 format)
 */
export const saveEnhancedNewsletter = (
  newsletter: EnhancedNewsletter,
  topics: string[],
  settings?: EnhancedNewsletterSettings
): void => {
  const stmt = db.prepare(`
    INSERT INTO newsletters (
      id, subject, introduction, conclusion, sections, prompt_of_day,
      topics, audience, tone, image_style,
      editors_note, tool_of_day, audience_sections, format_version
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // For backward compatibility, also populate legacy fields
  const legacySections: NewsletterSection[] = newsletter.audienceSections.map(
    (section: EnhancedAudienceSection) => ({
      title: section.title,
      content: section.content,
      imagePrompt: section.imagePrompt || '',
      imageUrl: section.imageUrl,
    })
  );

  stmt.run(
    newsletter.id,
    newsletter.subject || newsletter.audienceSections[0]?.title || 'Newsletter',
    newsletter.editorsNote?.message || '',
    newsletter.conclusion || '',
    JSON.stringify(legacySections),
    newsletter.promptOfTheDay ? JSON.stringify(newsletter.promptOfTheDay) : null,
    JSON.stringify(topics),
    settings?.audience ? JSON.stringify(settings.audience) : null,
    null, // tone not used in enhanced format
    settings?.imageStyle || null,
    // Enhanced format fields
    JSON.stringify(newsletter.editorsNote),
    JSON.stringify(newsletter.toolOfTheDay),
    JSON.stringify(newsletter.audienceSections),
    'v2'
  );

  // Log the creation
  logAction(newsletter.id!, 'created');

  console.log(`[NewsletterDb] Saved enhanced newsletter: ${newsletter.subject || newsletter.id}`);
};

// ============================================================================
// Format-Aware Newsletter Retrieval (v1 and v2 support)
// ============================================================================

/**
 * Newsletter with format version info for history loading
 */
export interface NewsletterWithFormat {
  formatVersion: 'v1' | 'v2';
  newsletter: Newsletter | EnhancedNewsletter;
  id: string;
  createdAt: string;
  subject: string;
  topics: string[];
}

/**
 * Helper: Convert DB row to EnhancedNewsletter object
 */
const rowToEnhancedNewsletter = (row: DbNewsletterRowExtended): EnhancedNewsletter => ({
  id: row.id,
  editorsNote: row.editors_note ? JSON.parse(row.editors_note) : { message: row.introduction || '' },
  toolOfTheDay: row.tool_of_day ? JSON.parse(row.tool_of_day) : { name: '', url: '', whyNow: '', quickStart: '' },
  audienceSections: row.audience_sections ? JSON.parse(row.audience_sections) : [],
  conclusion: row.conclusion || '',
  subject: row.subject,
  promptOfTheDay: row.prompt_of_day ? JSON.parse(row.prompt_of_day) : undefined,
});

/**
 * Get all newsletters with format version info (supports both v1 and v2)
 */
export const getNewslettersWithFormat = (limit = 50): NewsletterWithFormat[] => {
  const stmt = db.prepare(`
    SELECT id, created_at, subject, introduction, conclusion, sections, prompt_of_day,
           topics, audience, tone, image_style,
           editors_note, tool_of_day, audience_sections, format_version
    FROM newsletters
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as DbNewsletterRowExtended[];

  return rows.map((row): NewsletterWithFormat => {
    const isV2 = row.format_version === 'v2' && row.audience_sections;

    if (isV2) {
      return {
        formatVersion: 'v2',
        newsletter: rowToEnhancedNewsletter(row),
        id: row.id,
        createdAt: row.created_at,
        subject: row.subject,
        topics: JSON.parse(row.topics),
      };
    }

    return {
      formatVersion: 'v1',
      newsletter: rowToNewsletter(row),
      id: row.id,
      createdAt: row.created_at,
      subject: row.subject,
      topics: JSON.parse(row.topics),
    };
  });
};

/**
 * Get a single enhanced newsletter by ID (v2 format)
 */
export const getEnhancedNewsletterById = (id: string): EnhancedNewsletter | null => {
  const stmt = db.prepare(`
    SELECT id, created_at, subject, introduction, conclusion, sections, prompt_of_day,
           topics, audience, tone, image_style,
           editors_note, tool_of_day, audience_sections, format_version
    FROM newsletters
    WHERE id = ? AND format_version = 'v2'
  `);

  const row = stmt.get(id) as DbNewsletterRowExtended | undefined;

  if (!row) return null;

  return rowToEnhancedNewsletter(row);
};

/**
 * Phase 9c: Get newsletters that used a specific saved prompt
 * Uses SQLite json_extract to search the prompt_of_day JSON for savedPromptId
 */
export const getNewslettersBySavedPromptId = (promptId: string): NewsletterWithFormat[] => {
  const stmt = db.prepare(`
    SELECT id, created_at, subject, introduction, conclusion, sections, prompt_of_day,
           topics, audience, tone, image_style,
           editors_note, tool_of_day, audience_sections, format_version
    FROM newsletters
    WHERE json_extract(prompt_of_day, '$.savedPromptId') = ?
    ORDER BY created_at DESC
    LIMIT 50
  `);

  const rows = stmt.all(promptId) as DbNewsletterRowExtended[];

  return rows.map((row): NewsletterWithFormat => {
    const isV2 = row.format_version === 'v2' && row.audience_sections;

    if (isV2) {
      return {
        formatVersion: 'v2',
        newsletter: rowToEnhancedNewsletter(row),
        id: row.id,
        createdAt: row.created_at,
        subject: row.subject,
        topics: JSON.parse(row.topics),
      };
    }

    return {
      formatVersion: 'v1',
      newsletter: rowToNewsletter(row),
      id: row.id,
      createdAt: row.created_at,
      subject: row.subject,
      topics: JSON.parse(row.topics),
    };
  });
};

/**
 * Get a newsletter by ID with format detection
 */
export const getNewsletterByIdWithFormat = (id: string): NewsletterWithFormat | null => {
  const stmt = db.prepare(`
    SELECT id, created_at, subject, introduction, conclusion, sections, prompt_of_day,
           topics, audience, tone, image_style,
           editors_note, tool_of_day, audience_sections, format_version
    FROM newsletters
    WHERE id = ?
  `);

  const row = stmt.get(id) as DbNewsletterRowExtended | undefined;

  if (!row) return null;

  const isV2 = row.format_version === 'v2' && row.audience_sections;

  if (isV2) {
    return {
      formatVersion: 'v2',
      newsletter: rowToEnhancedNewsletter(row),
      id: row.id,
      createdAt: row.created_at,
      subject: row.subject,
      topics: JSON.parse(row.topics),
    };
  }

  return {
    formatVersion: 'v1',
    newsletter: rowToNewsletter(row),
    id: row.id,
    createdAt: row.created_at,
    subject: row.subject,
    topics: JSON.parse(row.topics),
  };
};
