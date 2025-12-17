/**
 * Subscriber Database Service
 * CRUD operations for subscribers and lists stored in SQLite
 */

import db from '../db/init.ts';

// Types
export interface Subscriber {
  id?: number;
  email: string;
  name?: string;
  status: 'active' | 'inactive';
  lists: string;
  dateAdded: string;
  dateRemoved?: string;
  source?: string;
}

export interface SubscriberList {
  id: string;
  name: string;
  description?: string;
  dateCreated: string;
  subscriberCount: number;
}

interface DbSubscriberRow {
  id: number;
  email: string;
  name: string | null;
  status: string;
  lists: string;
  date_added: string;
  date_removed: string | null;
  source: string | null;
}

interface DbListRow {
  id: string;
  name: string;
  description: string | null;
  date_created: string;
  subscriber_count: number;
}

// ======================
// SUBSCRIBER CRUD
// ======================

/**
 * Add a new subscriber
 */
export const addSubscriber = (subscriber: Omit<Subscriber, 'id' | 'dateAdded'>): Subscriber => {
  // Check for duplicate
  const existing = getSubscriberByEmail(subscriber.email);
  if (existing) {
    throw new Error(`Subscriber with email ${subscriber.email} already exists`);
  }

  const stmt = db.prepare(`
    INSERT INTO subscribers (email, name, status, lists, source)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    subscriber.email,
    subscriber.name || null,
    subscriber.status || 'active',
    subscriber.lists || '',
    subscriber.source || 'manual'
  );

  console.log(`[SubscriberDb] Added subscriber: ${subscriber.email}`);

  // Sync list counts for any lists the subscriber was added to
  if (subscriber.lists) {
    const listIds = subscriber.lists.split(',').filter(Boolean);
    for (const listId of listIds) {
      syncListCount(listId.trim());
    }
  }

  return {
    id: Number(result.lastInsertRowid),
    email: subscriber.email,
    name: subscriber.name,
    status: subscriber.status || 'active',
    lists: subscriber.lists || '',
    dateAdded: new Date().toISOString(),
    source: subscriber.source || 'manual'
  };
};

/**
 * Update a subscriber
 */
export const updateSubscriber = (
  email: string,
  updates: Partial<Omit<Subscriber, 'id' | 'email' | 'dateAdded'>>
): Subscriber | null => {
  const existing = getSubscriberByEmail(email);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name || null);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
    if (updates.status === 'inactive' && !updates.dateRemoved) {
      fields.push('date_removed = ?');
      values.push(new Date().toISOString());
    }
  }
  if (updates.lists !== undefined) {
    fields.push('lists = ?');
    values.push(updates.lists);
  }
  if (updates.dateRemoved !== undefined) {
    fields.push('date_removed = ?');
    values.push(updates.dateRemoved || null);
  }
  if (updates.source !== undefined) {
    fields.push('source = ?');
    values.push(updates.source || null);
  }

  if (fields.length === 0) return existing;

  values.push(email);
  const stmt = db.prepare(`UPDATE subscribers SET ${fields.join(', ')} WHERE email = ?`);
  stmt.run(...values);

  console.log(`[SubscriberDb] Updated subscriber: ${email}`);

  // Sync list counts if lists field was changed
  if (updates.lists !== undefined) {
    const oldListIds = existing.lists ? existing.lists.split(',').filter(Boolean).map(l => l.trim()) : [];
    const newListIds = updates.lists ? updates.lists.split(',').filter(Boolean).map(l => l.trim()) : [];
    const allAffectedLists = new Set([...oldListIds, ...newListIds]);
    for (const listId of allAffectedLists) {
      syncListCount(listId);
    }
  }

  return getSubscriberByEmail(email);
};

/**
 * Soft delete a subscriber (set status to inactive)
 */
export const deleteSubscriber = (email: string): boolean => {
  // Get subscriber's lists before deleting to sync counts
  const subscriber = getSubscriberByEmail(email);
  const listIds = subscriber?.lists ? subscriber.lists.split(',').filter(Boolean).map(l => l.trim()) : [];

  const stmt = db.prepare(`
    UPDATE subscribers
    SET status = 'inactive', date_removed = ?
    WHERE email = ?
  `);

  const result = stmt.run(new Date().toISOString(), email);

  if (result.changes > 0) {
    console.log(`[SubscriberDb] Soft deleted subscriber: ${email}`);
    // Sync list counts after status change (inactive subscribers don't count)
    for (const listId of listIds) {
      syncListCount(listId);
    }
  }

  return result.changes > 0;
};

/**
 * Hard delete a subscriber (permanently remove)
 */
export const hardDeleteSubscriber = (email: string): boolean => {
  // Get subscriber's lists before deleting to sync counts
  const subscriber = getSubscriberByEmail(email);
  const listIds = subscriber?.lists ? subscriber.lists.split(',').filter(Boolean).map(l => l.trim()) : [];

  const stmt = db.prepare(`DELETE FROM subscribers WHERE email = ?`);
  const result = stmt.run(email);

  if (result.changes > 0) {
    console.log(`[SubscriberDb] Hard deleted subscriber: ${email}`);
    // Sync list counts after removal
    for (const listId of listIds) {
      syncListCount(listId);
    }
  }

  return result.changes > 0;
};

/**
 * Get all subscribers with optional filters
 */
export const getSubscribers = (filters?: {
  status?: 'active' | 'inactive' | 'all';
  listId?: string;
}): Subscriber[] => {
  let query = 'SELECT * FROM subscribers';
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters?.status && filters.status !== 'all') {
    conditions.push('status = ?');
    values.push(filters.status);
  }

  if (filters?.listId) {
    // Match list ID in comma-separated lists field
    conditions.push("(',' || lists || ',') LIKE ?");
    values.push(`%,${filters.listId},%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY date_added DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all(...values) as DbSubscriberRow[];

  return rows.map(rowToSubscriber);
};

/**
 * Get a single subscriber by email
 */
export const getSubscriberByEmail = (email: string): Subscriber | null => {
  const stmt = db.prepare(`SELECT * FROM subscribers WHERE email = ?`);
  const row = stmt.get(email) as DbSubscriberRow | undefined;

  if (!row) return null;

  return rowToSubscriber(row);
};

/**
 * Bulk import subscribers
 */
export const importSubscribers = (
  subscribers: Array<{ email: string; name?: string; listId?: string }>
): { added: number; skipped: number } => {
  let added = 0;
  let skipped = 0;

  const insertStmt = db.prepare(`
    INSERT INTO subscribers (email, name, status, lists, source)
    VALUES (?, ?, 'active', ?, 'import')
  `);

  const checkStmt = db.prepare(`SELECT email FROM subscribers WHERE email = ?`);

  const transaction = db.transaction(() => {
    for (const sub of subscribers) {
      // Check if exists
      const existing = checkStmt.get(sub.email);
      if (existing) {
        skipped++;
        continue;
      }

      insertStmt.run(sub.email, sub.name || null, sub.listId || '');
      added++;
    }
  });

  transaction();

  console.log(`[SubscriberDb] Import complete: ${added} added, ${skipped} skipped`);

  // Sync list counts if listId was provided
  const listIds = [...new Set(subscribers.filter(s => s.listId).map(s => s.listId!))];
  for (const listId of listIds) {
    syncListCount(listId);
  }

  return { added, skipped };
};

/**
 * Get subscriber count
 */
export const getSubscriberCount = (status?: 'active' | 'inactive'): number => {
  let query = 'SELECT COUNT(*) as count FROM subscribers';
  if (status) {
    query += ' WHERE status = ?';
    const stmt = db.prepare(query);
    const result = stmt.get(status) as { count: number };
    return result.count;
  }

  const stmt = db.prepare(query);
  const result = stmt.get() as { count: number };
  return result.count;
};

// ======================
// LIST CRUD
// ======================

/**
 * Generate a unique 5-character list ID
 */
const generateListId = (): string => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

/**
 * Create a new subscriber list
 */
export const createList = (name: string, description?: string): SubscriberList => {
  const id = generateListId();

  const stmt = db.prepare(`
    INSERT INTO subscriber_lists (id, name, description)
    VALUES (?, ?, ?)
  `);

  stmt.run(id, name, description || null);

  console.log(`[SubscriberDb] Created list: ${name} (${id})`);

  return {
    id,
    name,
    description,
    dateCreated: new Date().toISOString(),
    subscriberCount: 0
  };
};

/**
 * Update a list
 */
export const updateList = (
  id: string,
  updates: Partial<Omit<SubscriberList, 'id' | 'dateCreated' | 'subscriberCount'>>
): SubscriberList | null => {
  const existing = getListById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description || null);
  }

  if (fields.length === 0) return existing;

  values.push(id);
  const stmt = db.prepare(`UPDATE subscriber_lists SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  console.log(`[SubscriberDb] Updated list: ${id}`);

  return getListById(id);
};

/**
 * Delete a list (and remove from all subscribers)
 */
export const deleteList = (id: string): boolean => {
  // Remove list from all subscribers
  const subscribers = getSubscribers({ listId: id });
  for (const sub of subscribers) {
    removeSubscriberFromList(sub.email, id);
  }

  // Delete the list
  const stmt = db.prepare(`DELETE FROM subscriber_lists WHERE id = ?`);
  const result = stmt.run(id);

  if (result.changes > 0) {
    console.log(`[SubscriberDb] Deleted list: ${id}`);
  }

  return result.changes > 0;
};

/**
 * Get all lists
 */
export const getLists = (): SubscriberList[] => {
  const stmt = db.prepare(`SELECT * FROM subscriber_lists ORDER BY date_created DESC`);
  const rows = stmt.all() as DbListRow[];

  return rows.map(rowToList);
};

/**
 * Get a single list by ID
 */
export const getListById = (id: string): SubscriberList | null => {
  const stmt = db.prepare(`SELECT * FROM subscriber_lists WHERE id = ?`);
  const row = stmt.get(id) as DbListRow | undefined;

  if (!row) return null;

  return rowToList(row);
};

// ======================
// LIST MEMBERSHIP
// ======================

/**
 * Add a subscriber to a list
 */
export const addSubscriberToList = (email: string, listId: string): boolean => {
  const subscriber = getSubscriberByEmail(email);
  if (!subscriber) return false;

  const list = getListById(listId);
  if (!list) return false;

  // Parse current lists
  const currentLists = subscriber.lists ? subscriber.lists.split(',').filter(Boolean) : [];

  // Check if already in list
  if (currentLists.includes(listId)) return true;

  // Add to list
  currentLists.push(listId);
  updateSubscriber(email, { lists: currentLists.join(',') });

  // Update list count
  syncListCount(listId);

  console.log(`[SubscriberDb] Added ${email} to list ${listId}`);

  return true;
};

/**
 * Remove a subscriber from a list
 */
export const removeSubscriberFromList = (email: string, listId: string): boolean => {
  const subscriber = getSubscriberByEmail(email);
  if (!subscriber) return false;

  // Parse current lists
  const currentLists = subscriber.lists ? subscriber.lists.split(',').filter(Boolean) : [];

  // Check if in list
  const index = currentLists.indexOf(listId);
  if (index === -1) return true;

  // Remove from list
  currentLists.splice(index, 1);
  updateSubscriber(email, { lists: currentLists.join(',') });

  // Update list count
  syncListCount(listId);

  console.log(`[SubscriberDb] Removed ${email} from list ${listId}`);

  return true;
};

/**
 * Get all active subscribers in a list
 */
export const getSubscribersByList = (listId: string): Subscriber[] => {
  return getSubscribers({ status: 'active', listId });
};

/**
 * Sync subscriber count for a list
 */
export const syncListCount = (listId: string): number => {
  const count = getSubscribersByList(listId).length;

  const stmt = db.prepare(`UPDATE subscriber_lists SET subscriber_count = ? WHERE id = ?`);
  stmt.run(count, listId);

  return count;
};

// ======================
// HELPERS
// ======================

/**
 * Helper: Convert DB row to Subscriber object
 */
const rowToSubscriber = (row: DbSubscriberRow): Subscriber => ({
  id: row.id,
  email: row.email,
  name: row.name || undefined,
  status: row.status as 'active' | 'inactive',
  lists: row.lists || '',
  dateAdded: row.date_added,
  dateRemoved: row.date_removed || undefined,
  source: row.source || undefined
});

/**
 * Helper: Convert DB row to SubscriberList object
 */
const rowToList = (row: DbListRow): SubscriberList => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  dateCreated: row.date_created,
  subscriberCount: row.subscriber_count
});
