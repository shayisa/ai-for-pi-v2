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

  -- OAuth Tokens table (for Authorization Code flow)
  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TEXT NOT NULL,
    scope TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_email
    ON oauth_tokens(user_email);

  -- Saved Prompts table (standalone prompt library)
  CREATE TABLE IF NOT EXISTS saved_prompts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    example_prompts TEXT NOT NULL DEFAULT '[]',
    prompt_code TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_saved_prompts_created
    ON saved_prompts(created_at DESC);

  -- Image Style Thumbnails table
  CREATE TABLE IF NOT EXISTS image_style_thumbnails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_name TEXT UNIQUE NOT NULL,
    thumbnail_base64 TEXT NOT NULL,
    prompt_used TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_thumbnails_style
    ON image_style_thumbnails(style_name);

  -- Writer Personas table
  CREATE TABLE IF NOT EXISTS writer_personas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    expertise TEXT,
    persona_values TEXT,
    writing_style TEXT,
    signature_elements TEXT,
    sample_writing TEXT,
    is_active INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_personas_active
    ON writer_personas(is_active);
  CREATE INDEX IF NOT EXISTS idx_personas_default
    ON writer_personas(is_default);

  -- Custom Audiences table
  CREATE TABLE IF NOT EXISTS custom_audiences (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    persona TEXT,
    relevance_keywords TEXT,
    subreddits TEXT,
    arxiv_categories TEXT,
    search_templates TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audiences_default
    ON custom_audiences(is_default);

  -- Newsletter Templates table
  CREATE TABLE IF NOT EXISTS newsletter_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    structure TEXT NOT NULL,
    default_settings TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_templates_created
    ON newsletter_templates(created_at DESC);

  -- Newsletter Drafts table (auto-save)
  CREATE TABLE IF NOT EXISTS newsletter_drafts (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    content TEXT NOT NULL,
    topics TEXT NOT NULL,
    settings TEXT NOT NULL,
    last_saved_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_drafts_user
    ON newsletter_drafts(user_email);

  -- Calendar Entries table (content planning)
  CREATE TABLE IF NOT EXISTS calendar_entries (
    id TEXT PRIMARY KEY,
    scheduled_date TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    topics TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'planned',
    newsletter_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_calendar_date
    ON calendar_entries(scheduled_date);
  CREATE INDEX IF NOT EXISTS idx_calendar_status
    ON calendar_entries(status);

  -- Scheduled Sends table
  CREATE TABLE IF NOT EXISTS scheduled_sends (
    id TEXT PRIMARY KEY,
    newsletter_id TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    recipient_lists TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TEXT,
    sent_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_status
    ON scheduled_sends(status);
  CREATE INDEX IF NOT EXISTS idx_scheduled_time
    ON scheduled_sends(scheduled_at);

  -- Email Tracking table
  CREATE TABLE IF NOT EXISTS email_tracking (
    id TEXT PRIMARY KEY,
    newsletter_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    tracking_type TEXT NOT NULL,
    link_url TEXT,
    tracked_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tracking_newsletter
    ON email_tracking(newsletter_id);

  -- Email Stats table
  CREATE TABLE IF NOT EXISTS email_stats (
    newsletter_id TEXT PRIMARY KEY,
    total_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
  );

  -- System Logs table (Control Plane logs persisted)
  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correlation_id TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    level TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    message TEXT NOT NULL,
    duration_ms INTEGER,
    user_id TEXT,
    metadata TEXT,
    error_name TEXT,
    error_message TEXT,
    error_stack TEXT,
    error_code TEXT
  );

  -- Indexes for system_logs (critical for query performance)
  CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp
    ON system_logs(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_system_logs_correlation
    ON system_logs(correlation_id);
  CREATE INDEX IF NOT EXISTS idx_system_logs_module
    ON system_logs(module);
  CREATE INDEX IF NOT EXISTS idx_system_logs_level
    ON system_logs(level);
  CREATE INDEX IF NOT EXISTS idx_system_logs_module_action
    ON system_logs(module, action);
  CREATE INDEX IF NOT EXISTS idx_system_logs_user
    ON system_logs(user_id);

  -- User Settings table (for preferences like log retention)
  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT UNIQUE NOT NULL,
    log_retention_days INTEGER DEFAULT 90,
    log_query_limit INTEGER DEFAULT 500000,
    log_min_level TEXT DEFAULT 'info',
    settings_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_user_settings_email
    ON user_settings(user_email);

  -- ============================================================================
  -- Prompt Import Tables (Phase 11)
  -- ============================================================================

  -- Prompt Import Templates table (remembers successful parsing patterns)
  CREATE TABLE IF NOT EXISTS prompt_import_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('url', 'file')),
    source_pattern TEXT NOT NULL,
    parsing_instructions TEXT NOT NULL,
    field_patterns TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT,
    UNIQUE(source_type, source_pattern)
  );

  CREATE INDEX IF NOT EXISTS idx_import_templates_source_type
    ON prompt_import_templates(source_type);
  CREATE INDEX IF NOT EXISTS idx_import_templates_pattern
    ON prompt_import_templates(source_pattern);

  -- Prompt Import Logs table (audit trail for imports)
  CREATE TABLE IF NOT EXISTS prompt_import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('url', 'file', 'paste')),
    source_identifier TEXT NOT NULL,
    template_id TEXT,
    parsing_method TEXT NOT NULL CHECK (parsing_method IN ('regex', 'ai', 'template')),
    success INTEGER NOT NULL,
    error_message TEXT,
    parsed_fields TEXT,
    raw_content_length INTEGER,
    processing_time_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (template_id) REFERENCES prompt_import_templates(id)
  );

  CREATE INDEX IF NOT EXISTS idx_import_logs_import_id
    ON prompt_import_logs(import_id);
  CREATE INDEX IF NOT EXISTS idx_import_logs_created
    ON prompt_import_logs(created_at DESC);
`);

console.log('[SQLite] Tables initialized (archives, newsletters, newsletter_logs, subscribers, subscriber_lists, api_keys, api_key_audit_log, oauth_tokens, saved_prompts, image_style_thumbnails, writer_personas, custom_audiences, newsletter_templates, newsletter_drafts, calendar_entries, scheduled_sends, email_tracking, email_stats, system_logs, user_settings, prompt_import_templates, prompt_import_logs)');

// ============================================================================
// Migration: Enhanced Newsletter Format (v2)
// ============================================================================

/**
 * Check if a column exists in a table
 */
function columnExists(tableName: string, columnName: string): boolean {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return tableInfo.some((col) => col.name === columnName);
}

/**
 * Run migrations for enhanced newsletter format
 */
function runEnhancedNewsletterMigration() {
  const migrations: Array<{ check: () => boolean; sql: string; name: string }> = [
    {
      name: 'Add editors_note column',
      check: () => !columnExists('newsletters', 'editors_note'),
      sql: 'ALTER TABLE newsletters ADD COLUMN editors_note TEXT',
    },
    {
      name: 'Add tool_of_day column',
      check: () => !columnExists('newsletters', 'tool_of_day'),
      sql: 'ALTER TABLE newsletters ADD COLUMN tool_of_day TEXT',
    },
    {
      name: 'Add audience_sections column',
      check: () => !columnExists('newsletters', 'audience_sections'),
      sql: 'ALTER TABLE newsletters ADD COLUMN audience_sections TEXT',
    },
    {
      name: 'Add format_version column',
      check: () => !columnExists('newsletters', 'format_version'),
      sql: "ALTER TABLE newsletters ADD COLUMN format_version TEXT DEFAULT 'v1'",
    },
    {
      name: 'Add updated_at column',
      check: () => !columnExists('newsletters', 'updated_at'),
      sql: 'ALTER TABLE newsletters ADD COLUMN updated_at TEXT',
    },
  ];

  let migrationsRun = 0;
  for (const migration of migrations) {
    if (migration.check()) {
      try {
        db.exec(migration.sql);
        console.log(`[SQLite Migration] ${migration.name}`);
        migrationsRun++;
      } catch (err) {
        console.error(`[SQLite Migration] Failed: ${migration.name}`, err);
      }
    }
  }

  // Create index for format version (if not exists)
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_newsletters_format
        ON newsletters(format_version);
    `);
  } catch {
    // Index may already exist
  }

  if (migrationsRun > 0) {
    console.log(`[SQLite Migration] Enhanced newsletter format: ${migrationsRun} migrations applied`);
  }
}

// Run migrations
runEnhancedNewsletterMigration();

// ============================================================================
// Migration: Persona Favorites
// ============================================================================

/**
 * Run migrations for persona favorites
 */
function runPersonaFavoritesMigration() {
  const migrations: Array<{ check: () => boolean; sql: string; name: string }> = [
    {
      name: 'Add is_favorite column to writer_personas',
      check: () => !columnExists('writer_personas', 'is_favorite'),
      sql: 'ALTER TABLE writer_personas ADD COLUMN is_favorite INTEGER DEFAULT 0',
    },
  ];

  let migrationsRun = 0;
  for (const migration of migrations) {
    if (migration.check()) {
      try {
        db.exec(migration.sql);
        console.log(`[SQLite Migration] ${migration.name}`);
        migrationsRun++;
      } catch (err) {
        console.error(`[SQLite Migration] Failed: ${migration.name}`, err);
      }
    }
  }

  // Create index for favorites (if not exists)
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_personas_favorite
        ON writer_personas(is_favorite);
    `);
  } catch {
    // Index may already exist
  }

  if (migrationsRun > 0) {
    console.log(`[SQLite Migration] Persona favorites: ${migrationsRun} migrations applied`);
  }
}

// Run persona favorites migration
runPersonaFavoritesMigration();

// ============================================================================
// Migration: Newsletter Persona Tracking
// ============================================================================

/**
 * Run migrations for newsletter persona tracking
 */
function runNewsletterPersonaMigration() {
  const migrations: Array<{ check: () => boolean; sql: string; name: string }> = [
    {
      name: 'Add persona_id column to newsletters',
      check: () => !columnExists('newsletters', 'persona_id'),
      sql: 'ALTER TABLE newsletters ADD COLUMN persona_id TEXT',
    },
  ];

  let migrationsRun = 0;
  for (const migration of migrations) {
    if (migration.check()) {
      try {
        db.exec(migration.sql);
        console.log(`[SQLite Migration] ${migration.name}`);
        migrationsRun++;
      } catch (err) {
        console.error(`[SQLite Migration] Failed: ${migration.name}`, err);
      }
    }
  }

  // Create index for persona_id (if not exists)
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_newsletters_persona
        ON newsletters(persona_id);
    `);
  } catch {
    // Index may already exist
  }

  if (migrationsRun > 0) {
    console.log(`[SQLite Migration] Newsletter persona tracking: ${migrationsRun} migrations applied`);
  }
}

// Run newsletter persona migration
runNewsletterPersonaMigration();

// ============================================================================
// Migration: Email Tracking Feature
// ============================================================================

/**
 * Run migrations for email tracking feature
 */
function runEmailTrackingMigration() {
  const migrations: Array<{ check: () => boolean; sql: string; name: string }> = [
    {
      name: 'Add tracking_enabled column to newsletters',
      check: () => !columnExists('newsletters', 'tracking_enabled'),
      sql: 'ALTER TABLE newsletters ADD COLUMN tracking_enabled INTEGER DEFAULT 1',
    },
  ];

  let migrationsRun = 0;
  for (const migration of migrations) {
    if (migration.check()) {
      try {
        db.exec(migration.sql);
        console.log(`[SQLite Migration] ${migration.name}`);
        migrationsRun++;
      } catch (err) {
        console.error(`[SQLite Migration] Failed: ${migration.name}`, err);
      }
    }
  }

  if (migrationsRun > 0) {
    console.log(`[SQLite Migration] Email tracking: ${migrationsRun} migrations applied`);
  }
}

// Run email tracking migration
runEmailTrackingMigration();

// ============================================================================
// Migration: Multi-language Support
// ============================================================================

/**
 * Run migrations for multi-language support
 */
function runMultiLanguageMigration() {
  const migrations: Array<{ check: () => boolean; sql: string; name: string }> = [
    {
      name: 'Add language column to newsletters',
      check: () => !columnExists('newsletters', 'language'),
      sql: "ALTER TABLE newsletters ADD COLUMN language TEXT DEFAULT 'en'",
    },
  ];

  let migrationsRun = 0;
  for (const migration of migrations) {
    if (migration.check()) {
      try {
        db.exec(migration.sql);
        console.log(`[SQLite Migration] ${migration.name}`);
        migrationsRun++;
      } catch (err) {
        console.error(`[SQLite Migration] Failed: ${migration.name}`, err);
      }
    }
  }

  if (migrationsRun > 0) {
    console.log(`[SQLite Migration] Multi-language support: ${migrationsRun} migrations applied`);
  }
}

// Run multi-language migration
runMultiLanguageMigration();

// ============================================================================
// Migration: Calendar Entry Settings
// ============================================================================

/**
 * Run migrations for calendar entry settings (tone, persona, etc.)
 */
function runCalendarSettingsMigration() {
  const migrations: Array<{ check: () => boolean; sql: string; name: string }> = [
    {
      name: 'Add settings column to calendar_entries',
      check: () => !columnExists('calendar_entries', 'settings'),
      sql: 'ALTER TABLE calendar_entries ADD COLUMN settings TEXT',
    },
  ];

  let migrationsRun = 0;
  for (const migration of migrations) {
    if (migration.check()) {
      try {
        db.exec(migration.sql);
        console.log(`[SQLite Migration] ${migration.name}`);
        migrationsRun++;
      } catch (err) {
        console.error(`[SQLite Migration] Failed: ${migration.name}`, err);
      }
    }
  }

  if (migrationsRun > 0) {
    console.log(`[SQLite Migration] Calendar entry settings: ${migrationsRun} migrations applied`);
  }
}

// Run calendar settings migration
runCalendarSettingsMigration();

export default db;
