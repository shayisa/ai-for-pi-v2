/**
 * Archive Service
 * CRUD operations for trending data archives stored in SQLite
 */

import db from '../db/init.ts';
import { randomUUID } from 'crypto';

// Types
export interface ArchiveContent {
  trendingTopics?: Array<{ title: string; summary: string }>;
  compellingContent?: {
    actionableCapabilities?: Array<{
      title: string;
      description: string;
      implementationGuide?: string;
      relevantTools?: string[];
    }>;
    essentialTools?: Array<{
      name: string;
      purpose: string;
      url: string;
    }>;
  };
  trendingSources?: Array<{
    id: string;
    title: string;
    url: string;
    author?: string;
    publication?: string;
    date?: string;
    category: string;
    summary?: string;
  }>;
  metadata?: {
    sourceCount: number;
    generatedAt: string;
  };
}

export interface Archive {
  id: string;
  createdAt: string;
  name: string;
  audience: string[];
  content: ArchiveContent;
}

interface DbRow {
  id: string;
  created_at: string;
  name: string;
  audience: string;
  content: string;
}

/**
 * Save a new archive
 */
export const saveArchive = (
  content: ArchiveContent,
  audience: string[],
  name?: string
): Archive => {
  const id = randomUUID();
  const archiveName = name || `Insights - ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;

  // Add metadata
  const contentWithMetadata: ArchiveContent = {
    ...content,
    metadata: {
      sourceCount: content.trendingSources?.length || 0,
      generatedAt: new Date().toISOString()
    }
  };

  const stmt = db.prepare(`
    INSERT INTO archives (id, name, audience, content)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, archiveName, JSON.stringify(audience), JSON.stringify(contentWithMetadata));

  console.log(`[ArchiveService] Saved archive: ${archiveName} (${id})`);

  return {
    id,
    createdAt: new Date().toISOString(),
    name: archiveName,
    audience,
    content: contentWithMetadata
  };
};

/**
 * Get all archives (newest first)
 */
export const getArchives = (limit = 50): Archive[] => {
  const stmt = db.prepare(`
    SELECT * FROM archives ORDER BY created_at DESC LIMIT ?
  `);

  const rows = stmt.all(limit) as DbRow[];

  return rows.map(row => ({
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    audience: JSON.parse(row.audience),
    content: JSON.parse(row.content)
  }));
};

/**
 * Get a single archive by ID
 */
export const getArchiveById = (id: string): Archive | null => {
  const stmt = db.prepare(`SELECT * FROM archives WHERE id = ?`);
  const row = stmt.get(id) as DbRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    audience: JSON.parse(row.audience),
    content: JSON.parse(row.content)
  };
};

/**
 * Delete an archive by ID
 */
export const deleteArchive = (id: string): boolean => {
  const stmt = db.prepare(`DELETE FROM archives WHERE id = ?`);
  const result = stmt.run(id);

  if (result.changes > 0) {
    console.log(`[ArchiveService] Deleted archive: ${id}`);
  }

  return result.changes > 0;
};

/**
 * Search archives by name (case-insensitive)
 */
export const searchArchives = (query: string, limit = 20): Archive[] => {
  const stmt = db.prepare(`
    SELECT * FROM archives
    WHERE name LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(`%${query}%`, limit) as DbRow[];

  return rows.map(row => ({
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    audience: JSON.parse(row.audience),
    content: JSON.parse(row.content)
  }));
};

/**
 * Get archive count
 */
export const getArchiveCount = (): number => {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM archives`);
  const result = stmt.get() as { count: number };
  return result.count;
};
