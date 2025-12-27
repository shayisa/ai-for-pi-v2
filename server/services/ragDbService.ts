/**
 * RAG Database Service
 * CRUD operations for RAG documents, chats, and messages stored in SQLite
 */

import db from '../db/init.ts';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type DocumentStatus = 'pending' | 'indexed' | 'failed';
export type DocumentSourceType = 'manual' | 'newsletter' | 'archive' | 'url' | 'paste';
export type DocumentContentType = 'pdf' | 'txt' | 'md' | 'html' | 'text';
export type MessageRole = 'user' | 'assistant';

export interface RagDocument {
  id: string;
  geminiFileId: string | null;
  filename: string;
  contentType: DocumentContentType;
  sourceType: DocumentSourceType;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  indexedAt: string | null;
  sourceUrl: string | null;
  newsletterId: string | null;
  contentHash: string | null;
}

export interface RagChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface RagMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  sources: SourceReference[] | null;
  createdAt: string;
}

export interface SourceReference {
  documentId: string;
  filename: string;
  relevance?: number;
  snippet?: string;
}

export interface RagConfig {
  geminiCacheName: string | null;
  totalDocuments: number;
  totalSizeBytes: number;
  createdAt: string;
  lastSyncAt: string | null;
}

export interface StorageStats {
  totalDocuments: number;
  totalSizeBytes: number;
  documentsByStatus: Record<DocumentStatus, number>;
  documentsBySource: Record<string, number>;
}

// ============================================================================
// Database Row Types
// ============================================================================

interface DbDocumentRow {
  id: string;
  gemini_file_id: string | null;
  filename: string;
  content_type: string;
  source_type: string;
  size_bytes: number;
  status: string;
  error_message: string | null;
  metadata: string | null;
  created_at: string;
  indexed_at: string | null;
  source_url: string | null;
  newsletter_id: string | null;
  content_hash: string | null;
}

interface DbChatRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DbMessageRow {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  sources: string | null;
  created_at: string;
}

interface DbConfigRow {
  id: number;
  gemini_cache_name: string | null;
  total_documents: number;
  total_size_bytes: number;
  created_at: string;
  last_sync_at: string | null;
}

// ============================================================================
// ID Generators
// ============================================================================

const generateDocumentId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `doc_${timestamp}_${random}`;
};

const generateChatId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `chat_${timestamp}_${random}`;
};

const generateMessageId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `msg_${timestamp}_${random}`;
};

/**
 * Generate a content hash for deduplication
 */
export const generateContentHash = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
};

// ============================================================================
// Row Converters
// ============================================================================

const rowToDocument = (row: DbDocumentRow): RagDocument => ({
  id: row.id,
  geminiFileId: row.gemini_file_id,
  filename: row.filename,
  contentType: row.content_type as DocumentContentType,
  sourceType: row.source_type as DocumentSourceType,
  sizeBytes: row.size_bytes,
  status: row.status as DocumentStatus,
  errorMessage: row.error_message,
  metadata: row.metadata ? JSON.parse(row.metadata) : null,
  createdAt: row.created_at,
  indexedAt: row.indexed_at,
  sourceUrl: row.source_url,
  newsletterId: row.newsletter_id,
  contentHash: row.content_hash,
});

const rowToChat = (row: DbChatRow): RagChat => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToMessage = (row: DbMessageRow): RagMessage => ({
  id: row.id,
  chatId: row.chat_id,
  role: row.role as MessageRole,
  content: row.content,
  sources: row.sources ? JSON.parse(row.sources) : null,
  createdAt: row.created_at,
});

// ============================================================================
// Document CRUD Operations
// ============================================================================

/**
 * Create a new document record
 */
export const createDocument = (doc: {
  filename: string;
  contentType: DocumentContentType;
  sourceType: DocumentSourceType;
  sizeBytes: number;
  sourceUrl?: string;
  newsletterId?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}): RagDocument => {
  const id = generateDocumentId();

  const stmt = db.prepare(`
    INSERT INTO rag_documents (id, filename, content_type, source_type, size_bytes, source_url, newsletter_id, content_hash, metadata, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  stmt.run(
    id,
    doc.filename,
    doc.contentType,
    doc.sourceType,
    doc.sizeBytes,
    doc.sourceUrl || null,
    doc.newsletterId || null,
    doc.contentHash || null,
    doc.metadata ? JSON.stringify(doc.metadata) : null
  );

  console.log(`[RagDb] Created document: ${doc.filename} (${id})`);

  const row = db.prepare('SELECT * FROM rag_documents WHERE id = ?').get(id) as DbDocumentRow;
  return rowToDocument(row);
};

/**
 * Get all documents with optional filters
 */
export const getDocuments = (options?: {
  status?: DocumentStatus;
  sourceType?: DocumentSourceType;
  limit?: number;
  offset?: number;
}): RagDocument[] => {
  let query = 'SELECT * FROM rag_documents WHERE 1=1';
  const params: (string | number)[] = [];

  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  if (options?.sourceType) {
    query += ' AND source_type = ?';
    params.push(options.sourceType);
  }

  query += ' ORDER BY created_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = db.prepare(query).all(...params) as DbDocumentRow[];
  return rows.map(rowToDocument);
};

/**
 * Get a document by ID
 */
export const getDocumentById = (id: string): RagDocument | null => {
  const row = db.prepare('SELECT * FROM rag_documents WHERE id = ?').get(id) as DbDocumentRow | undefined;
  if (!row) return null;
  return rowToDocument(row);
};

/**
 * Check if a document with given content hash already exists
 */
export const getDocumentByContentHash = (hash: string): RagDocument | null => {
  const row = db.prepare('SELECT * FROM rag_documents WHERE content_hash = ?').get(hash) as DbDocumentRow | undefined;
  if (!row) return null;
  return rowToDocument(row);
};

/**
 * Check if a document with given source URL already exists
 */
export const getDocumentBySourceUrl = (url: string): RagDocument | null => {
  const row = db.prepare('SELECT * FROM rag_documents WHERE source_url = ?').get(url) as DbDocumentRow | undefined;
  if (!row) return null;
  return rowToDocument(row);
};

/**
 * Get all indexed source URLs as a Set
 * Used for quick duplicate checking on the frontend
 */
export const getIndexedSourceUrls = (): string[] => {
  const rows = db.prepare(`
    SELECT source_url FROM rag_documents
    WHERE source_url IS NOT NULL AND status = 'indexed'
  `).all() as { source_url: string }[];
  return rows.map((row) => row.source_url);
};

/**
 * Update document status
 */
export const updateDocumentStatus = (
  id: string,
  status: DocumentStatus,
  options?: { geminiFileId?: string; errorMessage?: string }
): boolean => {
  let query = 'UPDATE rag_documents SET status = ?';
  const params: (string | null)[] = [status];

  if (status === 'indexed') {
    query += ", indexed_at = datetime('now')";
  }

  if (options?.geminiFileId) {
    query += ', gemini_file_id = ?';
    params.push(options.geminiFileId);
  }

  if (options?.errorMessage) {
    query += ', error_message = ?';
    params.push(options.errorMessage);
  } else if (status === 'indexed') {
    query += ', error_message = NULL';
  }

  query += ' WHERE id = ?';
  params.push(id);

  const result = db.prepare(query).run(...params);

  if (result.changes > 0) {
    console.log(`[RagDb] Updated document status: ${id} -> ${status}`);
    return true;
  }
  return false;
};

/**
 * Delete a document
 */
export const deleteDocument = (id: string): boolean => {
  const result = db.prepare('DELETE FROM rag_documents WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[RagDb] Deleted document: ${id}`);
    return true;
  }
  return false;
};

/**
 * Get document count
 */
export const getDocumentCount = (): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM rag_documents').get() as { count: number };
  return result.count;
};

/**
 * Get storage statistics
 */
export const getStorageStats = (): StorageStats => {
  const totalDocs = db.prepare('SELECT COUNT(*) as count FROM rag_documents').get() as { count: number };
  const totalSize = db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM rag_documents').get() as { total: number };

  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM rag_documents GROUP BY status
  `).all() as { status: string; count: number }[];

  const sourceCounts = db.prepare(`
    SELECT source_type, COUNT(*) as count FROM rag_documents GROUP BY source_type
  `).all() as { source_type: string; count: number }[];

  const documentsByStatus: Record<DocumentStatus, number> = {
    pending: 0,
    indexed: 0,
    failed: 0,
  };
  statusCounts.forEach(({ status, count }) => {
    documentsByStatus[status as DocumentStatus] = count;
  });

  const documentsBySource: Record<string, number> = {};
  sourceCounts.forEach(({ source_type, count }) => {
    documentsBySource[source_type] = count;
  });

  return {
    totalDocuments: totalDocs.count,
    totalSizeBytes: totalSize.total,
    documentsByStatus,
    documentsBySource,
  };
};

// ============================================================================
// Chat CRUD Operations
// ============================================================================

/**
 * Create a new chat
 */
export const createChat = (title: string): RagChat => {
  const id = generateChatId();

  db.prepare(`
    INSERT INTO rag_chats (id, title)
    VALUES (?, ?)
  `).run(id, title);

  console.log(`[RagDb] Created chat: ${title} (${id})`);

  const row = db.prepare('SELECT * FROM rag_chats WHERE id = ?').get(id) as DbChatRow;
  return rowToChat(row);
};

/**
 * Get all chats (most recently updated first)
 */
export const getChats = (limit: number = 50): RagChat[] => {
  const rows = db.prepare(`
    SELECT * FROM rag_chats ORDER BY updated_at DESC LIMIT ?
  `).all(limit) as DbChatRow[];

  return rows.map(rowToChat);
};

/**
 * Get a chat by ID
 */
export const getChatById = (id: string): RagChat | null => {
  const row = db.prepare('SELECT * FROM rag_chats WHERE id = ?').get(id) as DbChatRow | undefined;
  if (!row) return null;
  return rowToChat(row);
};

/**
 * Update chat title
 */
export const updateChatTitle = (id: string, title: string): boolean => {
  const result = db.prepare(`
    UPDATE rag_chats SET title = ?, updated_at = datetime('now') WHERE id = ?
  `).run(title, id);

  if (result.changes > 0) {
    console.log(`[RagDb] Updated chat title: ${id} -> ${title}`);
    return true;
  }
  return false;
};

/**
 * Update chat's updated_at timestamp
 */
export const touchChat = (id: string): boolean => {
  const result = db.prepare(`
    UPDATE rag_chats SET updated_at = datetime('now') WHERE id = ?
  `).run(id);
  return result.changes > 0;
};

/**
 * Delete a chat (messages are cascade deleted)
 */
export const deleteChat = (id: string): boolean => {
  const result = db.prepare('DELETE FROM rag_chats WHERE id = ?').run(id);

  if (result.changes > 0) {
    console.log(`[RagDb] Deleted chat: ${id}`);
    return true;
  }
  return false;
};

/**
 * Get chat count
 */
export const getChatCount = (): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM rag_chats').get() as { count: number };
  return result.count;
};

// ============================================================================
// Message CRUD Operations
// ============================================================================

/**
 * Add a message to a chat
 */
export const addMessage = (
  chatId: string,
  role: MessageRole,
  content: string,
  sources?: SourceReference[]
): RagMessage => {
  const id = generateMessageId();

  db.prepare(`
    INSERT INTO rag_messages (id, chat_id, role, content, sources)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    chatId,
    role,
    content,
    sources ? JSON.stringify(sources) : null
  );

  // Update chat's updated_at
  touchChat(chatId);

  console.log(`[RagDb] Added ${role} message to chat ${chatId}`);

  const row = db.prepare('SELECT * FROM rag_messages WHERE id = ?').get(id) as DbMessageRow;
  return rowToMessage(row);
};

/**
 * Get all messages for a chat (oldest first for conversation display)
 */
export const getChatMessages = (chatId: string): RagMessage[] => {
  const rows = db.prepare(`
    SELECT * FROM rag_messages WHERE chat_id = ? ORDER BY created_at ASC
  `).all(chatId) as DbMessageRow[];

  return rows.map(rowToMessage);
};

/**
 * Get the last N messages for a chat (for context window)
 */
export const getRecentMessages = (chatId: string, limit: number = 10): RagMessage[] => {
  const rows = db.prepare(`
    SELECT * FROM (
      SELECT * FROM rag_messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?
    ) ORDER BY created_at ASC
  `).all(chatId, limit) as DbMessageRow[];

  return rows.map(rowToMessage);
};

/**
 * Delete a message
 */
export const deleteMessage = (id: string): boolean => {
  const result = db.prepare('DELETE FROM rag_messages WHERE id = ?').run(id);
  return result.changes > 0;
};

/**
 * Get message count for a chat
 */
export const getMessageCount = (chatId: string): number => {
  const result = db.prepare('SELECT COUNT(*) as count FROM rag_messages WHERE chat_id = ?').get(chatId) as { count: number };
  return result.count;
};

// ============================================================================
// Config Operations
// ============================================================================

/**
 * Get or create the RAG config singleton
 */
export const getConfig = (): RagConfig => {
  let row = db.prepare('SELECT * FROM rag_config WHERE id = 1').get() as DbConfigRow | undefined;

  if (!row) {
    db.prepare(`
      INSERT INTO rag_config (id, total_documents, total_size_bytes)
      VALUES (1, 0, 0)
    `).run();
    row = db.prepare('SELECT * FROM rag_config WHERE id = 1').get() as DbConfigRow;
  }

  return {
    geminiCacheName: row.gemini_cache_name,
    totalDocuments: row.total_documents,
    totalSizeBytes: row.total_size_bytes,
    createdAt: row.created_at,
    lastSyncAt: row.last_sync_at,
  };
};

/**
 * Update the RAG config
 */
export const updateConfig = (updates: {
  geminiCacheName?: string | null;
  totalDocuments?: number;
  totalSizeBytes?: number;
}): void => {
  // Ensure config exists
  getConfig();

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.geminiCacheName !== undefined) {
    setClauses.push('gemini_cache_name = ?');
    params.push(updates.geminiCacheName);
  }

  if (updates.totalDocuments !== undefined) {
    setClauses.push('total_documents = ?');
    params.push(updates.totalDocuments);
  }

  if (updates.totalSizeBytes !== undefined) {
    setClauses.push('total_size_bytes = ?');
    params.push(updates.totalSizeBytes);
  }

  if (setClauses.length > 0) {
    setClauses.push("last_sync_at = datetime('now')");
    const query = `UPDATE rag_config SET ${setClauses.join(', ')} WHERE id = 1`;
    db.prepare(query).run(...params);
    console.log('[RagDb] Updated config');
  }
};

/**
 * Sync config with actual document stats
 */
export const syncConfigStats = (): void => {
  const stats = getStorageStats();
  updateConfig({
    totalDocuments: stats.totalDocuments,
    totalSizeBytes: stats.totalSizeBytes,
  });
};
