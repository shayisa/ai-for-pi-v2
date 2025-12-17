/**
 * Calendar Database Service
 * CRUD operations for content calendar entries in SQLite
 */

import db from '../db/init.ts';

// Types
export type CalendarStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface CalendarEntrySettings {
  selectedAudience?: Record<string, boolean>;
  selectedTone?: string;
  selectedFlavors?: Record<string, boolean>;
  selectedImageStyle?: string;
  personaId?: string | null;
}

export interface CalendarEntry {
  id: string;
  scheduledDate: string;
  title: string;
  description: string;
  topics: string[];
  status: CalendarStatus;
  newsletterId: string | null;
  settings: CalendarEntrySettings | null;
  createdAt: string;
  updatedAt: string;
}

interface DbCalendarRow {
  id: string;
  scheduled_date: string;
  title: string;
  description: string | null;
  topics: string;
  status: string;
  newsletter_id: string | null;
  settings: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to CalendarEntry object
 */
const rowToEntry = (row: DbCalendarRow): CalendarEntry => ({
  id: row.id,
  scheduledDate: row.scheduled_date,
  title: row.title,
  description: row.description || '',
  topics: JSON.parse(row.topics),
  status: row.status as CalendarStatus,
  newsletterId: row.newsletter_id,
  settings: row.settings ? JSON.parse(row.settings) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Get all calendar entries within a date range
 */
export const getEntries = (startDate?: string, endDate?: string): CalendarEntry[] => {
  let query = 'SELECT * FROM calendar_entries';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE scheduled_date >= ? AND scheduled_date <= ?';
    params.push(startDate, endDate);
  } else if (startDate) {
    query += ' WHERE scheduled_date >= ?';
    params.push(startDate);
  } else if (endDate) {
    query += ' WHERE scheduled_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY scheduled_date ASC';

  const rows = db.prepare(query).all(...params) as DbCalendarRow[];
  return rows.map(rowToEntry);
};

/**
 * Get calendar entry by ID
 */
export const getEntryById = (id: string): CalendarEntry | null => {
  const row = db
    .prepare('SELECT * FROM calendar_entries WHERE id = ?')
    .get(id) as DbCalendarRow | undefined;

  if (!row) return null;
  return rowToEntry(row);
};

/**
 * Get entries for a specific month
 */
export const getEntriesByMonth = (year: number, month: number): CalendarEntry[] => {
  // Month is 1-indexed (January = 1)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return getEntries(startDate, endDate);
};

/**
 * Create a new calendar entry
 */
export const createEntry = (
  title: string,
  scheduledDate: string,
  description = '',
  topics: string[] = [],
  status: CalendarStatus = 'planned',
  settings: CalendarEntrySettings | null = null
): CalendarEntry => {
  const id = `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.prepare(`
    INSERT INTO calendar_entries (id, title, scheduled_date, description, topics, status, settings)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, scheduledDate, description, JSON.stringify(topics), status, settings ? JSON.stringify(settings) : null);

  console.log(`[Calendar] Created entry: ${title} for ${scheduledDate}`);
  return getEntryById(id)!;
};

/**
 * Update a calendar entry
 */
export const updateEntry = (
  id: string,
  updates: Partial<{
    title: string;
    scheduledDate: string;
    description: string;
    topics: string[];
    status: CalendarStatus;
    settings: CalendarEntrySettings | null;
  }>
): CalendarEntry | null => {
  const existing = getEntryById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.scheduledDate !== undefined) {
    fields.push('scheduled_date = ?');
    values.push(updates.scheduledDate);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.topics !== undefined) {
    fields.push('topics = ?');
    values.push(JSON.stringify(updates.topics));
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.settings !== undefined) {
    fields.push('settings = ?');
    values.push(updates.settings ? JSON.stringify(updates.settings) : null);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`
    UPDATE calendar_entries
    SET ${fields.join(', ')}
    WHERE id = ?
  `).run(...values);

  console.log(`[Calendar] Updated entry: ${id}`);
  return getEntryById(id);
};

/**
 * Link a newsletter to a calendar entry
 */
export const linkNewsletter = (entryId: string, newsletterId: string): CalendarEntry | null => {
  const existing = getEntryById(entryId);
  if (!existing) return null;

  db.prepare(`
    UPDATE calendar_entries
    SET newsletter_id = ?, status = 'completed', updated_at = datetime('now')
    WHERE id = ?
  `).run(newsletterId, entryId);

  console.log(`[Calendar] Linked newsletter ${newsletterId} to entry ${entryId}`);
  return getEntryById(entryId);
};

/**
 * Unlink a newsletter from a calendar entry
 */
export const unlinkNewsletter = (entryId: string): CalendarEntry | null => {
  const existing = getEntryById(entryId);
  if (!existing) return null;

  db.prepare(`
    UPDATE calendar_entries
    SET newsletter_id = NULL, status = 'planned', updated_at = datetime('now')
    WHERE id = ?
  `).run(entryId);

  console.log(`[Calendar] Unlinked newsletter from entry ${entryId}`);
  return getEntryById(entryId);
};

/**
 * Delete a calendar entry
 */
export const deleteEntry = (id: string): boolean => {
  const result = db.prepare('DELETE FROM calendar_entries WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[Calendar] Deleted entry: ${id}`);
    return true;
  }

  return false;
};

/**
 * Get entries by status
 */
export const getEntriesByStatus = (status: CalendarStatus): CalendarEntry[] => {
  const rows = db
    .prepare('SELECT * FROM calendar_entries WHERE status = ? ORDER BY scheduled_date ASC')
    .all(status) as DbCalendarRow[];
  return rows.map(rowToEntry);
};

/**
 * Get upcoming entries (next N days)
 */
export const getUpcomingEntries = (days = 7): CalendarEntry[] => {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return getEntries(today, futureDate);
};
