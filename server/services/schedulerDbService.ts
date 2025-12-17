/**
 * Scheduler Database Service
 * CRUD operations for scheduled newsletter sends
 */

import db from '../db/init.ts';

// Types
export type ScheduledSendStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledSend {
  id: string;
  newsletterId: string;
  scheduledAt: string;
  recipientLists: string[];
  status: ScheduledSendStatus;
  errorMessage: string | null;
  sentAt: string | null;
  sentCount: number;
  createdAt: string;
}

interface DbScheduledSendRow {
  id: string;
  newsletter_id: string;
  scheduled_at: string;
  recipient_lists: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
}

/**
 * Convert database row to ScheduledSend object
 */
const rowToScheduledSend = (row: DbScheduledSendRow): ScheduledSend => ({
  id: row.id,
  newsletterId: row.newsletter_id,
  scheduledAt: row.scheduled_at,
  recipientLists: JSON.parse(row.recipient_lists),
  status: row.status as ScheduledSendStatus,
  errorMessage: row.error_message,
  sentAt: row.sent_at,
  sentCount: row.sent_count,
  createdAt: row.created_at,
});

/**
 * Get all scheduled sends
 */
export const getAllScheduledSends = (): ScheduledSend[] => {
  const rows = db
    .prepare('SELECT * FROM scheduled_sends ORDER BY scheduled_at ASC')
    .all() as DbScheduledSendRow[];
  return rows.map(rowToScheduledSend);
};

/**
 * Get scheduled send by ID
 */
export const getScheduledSendById = (id: string): ScheduledSend | null => {
  const row = db
    .prepare('SELECT * FROM scheduled_sends WHERE id = ?')
    .get(id) as DbScheduledSendRow | undefined;

  if (!row) return null;
  return rowToScheduledSend(row);
};

/**
 * Get scheduled sends by status
 */
export const getScheduledSendsByStatus = (status: ScheduledSendStatus): ScheduledSend[] => {
  const rows = db
    .prepare('SELECT * FROM scheduled_sends WHERE status = ? ORDER BY scheduled_at ASC')
    .all(status) as DbScheduledSendRow[];
  return rows.map(rowToScheduledSend);
};

/**
 * Get pending sends that are due for execution
 */
export const getPendingSendsDue = (): ScheduledSend[] => {
  const now = new Date().toISOString();
  const rows = db
    .prepare(`
      SELECT * FROM scheduled_sends
      WHERE status = 'pending' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `)
    .all(now) as DbScheduledSendRow[];
  return rows.map(rowToScheduledSend);
};

/**
 * Get scheduled sends for a specific newsletter
 */
export const getScheduledSendsForNewsletter = (newsletterId: string): ScheduledSend[] => {
  const rows = db
    .prepare('SELECT * FROM scheduled_sends WHERE newsletter_id = ? ORDER BY scheduled_at ASC')
    .all(newsletterId) as DbScheduledSendRow[];
  return rows.map(rowToScheduledSend);
};

/**
 * Create a new scheduled send
 */
export const createScheduledSend = (
  newsletterId: string,
  scheduledAt: string,
  recipientLists: string[]
): ScheduledSend => {
  const id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.prepare(`
    INSERT INTO scheduled_sends (id, newsletter_id, scheduled_at, recipient_lists, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(id, newsletterId, scheduledAt, JSON.stringify(recipientLists));

  console.log(`[Scheduler] Created scheduled send: ${id} for ${scheduledAt}`);
  return getScheduledSendById(id)!;
};

/**
 * Update scheduled send status
 */
export const updateScheduledSendStatus = (
  id: string,
  status: ScheduledSendStatus,
  errorMessage?: string | null,
  sentCount?: number
): ScheduledSend | null => {
  const existing = getScheduledSendById(id);
  if (!existing) return null;

  const updates: string[] = ['status = ?'];
  const values: (string | number | null)[] = [status];

  if (errorMessage !== undefined) {
    updates.push('error_message = ?');
    values.push(errorMessage);
  }

  if (sentCount !== undefined) {
    updates.push('sent_count = ?');
    values.push(sentCount);
  }

  if (status === 'sent') {
    updates.push("sent_at = datetime('now')");
  }

  values.push(id);

  db.prepare(`
    UPDATE scheduled_sends
    SET ${updates.join(', ')}
    WHERE id = ?
  `).run(...values);

  console.log(`[Scheduler] Updated send ${id} status to ${status}`);
  return getScheduledSendById(id);
};

/**
 * Cancel a scheduled send
 */
export const cancelScheduledSend = (id: string): ScheduledSend | null => {
  const existing = getScheduledSendById(id);
  if (!existing) return null;

  if (existing.status !== 'pending') {
    console.log(`[Scheduler] Cannot cancel send ${id} with status ${existing.status}`);
    return null;
  }

  return updateScheduledSendStatus(id, 'cancelled');
};

/**
 * Reschedule a send
 */
export const rescheduleScheduledSend = (
  id: string,
  newScheduledAt: string
): ScheduledSend | null => {
  const existing = getScheduledSendById(id);
  if (!existing) return null;

  if (existing.status !== 'pending') {
    console.log(`[Scheduler] Cannot reschedule send ${id} with status ${existing.status}`);
    return null;
  }

  db.prepare(`
    UPDATE scheduled_sends
    SET scheduled_at = ?
    WHERE id = ?
  `).run(newScheduledAt, id);

  console.log(`[Scheduler] Rescheduled send ${id} to ${newScheduledAt}`);
  return getScheduledSendById(id);
};

/**
 * Delete a scheduled send
 */
export const deleteScheduledSend = (id: string): boolean => {
  const result = db.prepare('DELETE FROM scheduled_sends WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[Scheduler] Deleted scheduled send: ${id}`);
    return true;
  }

  return false;
};

/**
 * Get upcoming scheduled sends (next N days)
 */
export const getUpcomingScheduledSends = (days = 7): ScheduledSend[] => {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const rows = db
    .prepare(`
      SELECT * FROM scheduled_sends
      WHERE status = 'pending' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `)
    .all(futureDate) as DbScheduledSendRow[];

  return rows.map(rowToScheduledSend);
};

/**
 * Get scheduler statistics
 */
export const getSchedulerStats = (): {
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
} => {
  const stats = db
    .prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM scheduled_sends
    `)
    .get() as { pending: number; sent: number; failed: number; cancelled: number };

  return {
    pending: stats.pending || 0,
    sent: stats.sent || 0,
    failed: stats.failed || 0,
    cancelled: stats.cancelled || 0,
  };
};
