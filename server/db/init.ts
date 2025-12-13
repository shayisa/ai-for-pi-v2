/**
 * SQLite Database Initialization
 * Creates and manages the local archives database
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('[SQLite] Created data directory:', DATA_DIR);
}

// Initialize database
const dbPath = path.join(DATA_DIR, 'archives.db');
const db = new Database(dbPath);
console.log('[SQLite] Database initialized:', dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Archives table (existing)
  CREATE TABLE IF NOT EXISTS archives (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    name TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_archives_date
    ON archives(created_at DESC);

  -- Newsletters table (full content)
  CREATE TABLE IF NOT EXISTS newsletters (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    subject TEXT NOT NULL,
    introduction TEXT,
    conclusion TEXT,
    sections TEXT NOT NULL,
    prompt_of_day TEXT,
    topics TEXT NOT NULL DEFAULT '[]',
    audience TEXT DEFAULT '[]',
    tone TEXT,
    image_style TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_newsletters_created
    ON newsletters(created_at DESC);

  -- Newsletter logs (action audit trail)
  CREATE TABLE IF NOT EXISTS newsletter_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    newsletter_id TEXT NOT NULL,
    action TEXT NOT NULL,
    action_at TEXT NOT NULL DEFAULT (datetime('now')),
    details TEXT,
    FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_logs_newsletter
    ON newsletter_logs(newsletter_id);

  -- Subscribers table
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    lists TEXT NOT NULL DEFAULT '',
    date_added TEXT NOT NULL DEFAULT (datetime('now')),
    date_removed TEXT,
    source TEXT DEFAULT 'manual'
  );

  CREATE INDEX IF NOT EXISTS idx_subscribers_email
    ON subscribers(email);
  CREATE INDEX IF NOT EXISTS idx_subscribers_status
    ON subscribers(status);

  -- Subscriber lists table
  CREATE TABLE IF NOT EXISTS subscriber_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    date_created TEXT NOT NULL DEFAULT (datetime('now')),
    subscriber_count INTEGER DEFAULT 0
  );

  -- API Keys table
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    service TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_valid INTEGER DEFAULT 0,
    last_validated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_email, service)
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_user_email
    ON api_keys(user_email);
  CREATE INDEX IF NOT EXISTS idx_api_keys_service
    ON api_keys(service);

  -- API Key Audit Log table
  CREATE TABLE IF NOT EXISTS api_key_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    service TEXT NOT NULL,
    action TEXT NOT NULL,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_log_user
    ON api_key_audit_log(user_email);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created
    ON api_key_audit_log(created_at DESC);
`);

console.log('[SQLite] Tables initialized (archives, newsletters, newsletter_logs, subscribers, subscriber_lists, api_keys, api_key_audit_log)');

export default db;
