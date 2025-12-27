/**
 * Route Aggregator
 *
 * Centralizes all route modules for clean mounting in server.ts.
 * Routes are organized by domain and mounted under /api prefix.
 *
 * @module routes
 *
 * ## Migration Progress
 *
 * | Domain | Status | Endpoints |
 * |--------|--------|-----------|
 * | Health | Migrated | 1 |
 * | Archives | Migrated | 5 |
 * | Newsletters | Migrated | 8 |
 * | Prompts | Migrated | 4 |
 * | Subscribers | Migrated | 14 |
 * | Calendar | Migrated | 9 |
 * | Personas | Migrated | 9 |
 * | Templates | Migrated | 7 |
 * | Drafts | Migrated | 4 |
 * | Thumbnails | Migrated | 4 |
 * | API Keys | Migrated | 5 |
 * | Logs | Migrated | 3 |
 * | OAuth | Migrated | 4 |
 * | Drive | Migrated | 4 |
 * | Gmail | Migrated | 3 |
 * | Generation | Migrated | 11 (AI content generation) |
 * | Prompt Import | Migrated | 8 (Phase 11 multi-source import) |
 * | Topics | Migrated | 9 (saved topic library) |
 * | Sources | Migrated | 11 (saved sources library) |
 * | RAG | New | 14 (knowledge base & chat) |
 *
 * ## Usage
 * ```typescript
 * import apiRoutes from './server/routes';
 * app.use('/api', apiRoutes);
 * ```
 */
import { Router } from 'express';

// Import route modules (add as they are migrated)
import healthRoutes from './health.routes.ts';
import archiveRoutes from './archive.routes.ts';
import newsletterRoutes from './newsletter.routes.ts';
import promptRoutes from './prompt.routes.ts';
import { subscriberRouter, listRouter } from './subscriber.routes.ts';
import calendarRoutes from './calendar.routes.ts';
import personaRoutes from './persona.routes.ts';
import templateRoutes from './template.routes.ts';
import draftRoutes from './draft.routes.ts';
import thumbnailRoutes from './thumbnail.routes.ts';
import apiKeyRoutes from './apiKey.routes.ts';
import logRoutes from './log.routes.ts';
import oauthRoutes from './oauth.routes.ts';
import driveRoutes from './drive.routes.ts';
import gmailRoutes from './gmail.routes.ts';
import generationRoutes from './generation.routes.ts';
import promptImportRoutes from './promptImport.routes.ts';
import topicRoutes from './topic.routes.ts';
import sourceRoutes from './source.routes.ts';
import ragRoutes from './rag.routes.ts';

const router = Router();

// =============================================================================
// ROUTE MOUNTING
// =============================================================================

// Health check (migrated)
router.use('/health', healthRoutes);

// Archives (migrated)
router.use('/archives', archiveRoutes);

// Newsletters (migrated)
router.use('/newsletters', newsletterRoutes);

// Prompt Import (Phase 11) - MORE SPECIFIC, must come before /prompts
router.use('/prompts/import', promptImportRoutes);

// Prompts (migrated)
router.use('/prompts', promptRoutes);

// Subscribers and Lists (migrated)
router.use('/subscribers', subscriberRouter);
router.use('/lists', listRouter);

// Calendar (migrated)
router.use('/calendar', calendarRoutes);

// Personas (migrated)
router.use('/personas', personaRoutes);

// Templates (migrated)
router.use('/templates', templateRoutes);

// Drafts (migrated)
router.use('/drafts', draftRoutes);

// Thumbnails (migrated)
router.use('/thumbnails', thumbnailRoutes);

// API Keys (migrated)
router.use('/keys', apiKeyRoutes);

// Logs (migrated)
router.use('/logs', logRoutes);

// OAuth (migrated)
router.use('/oauth', oauthRoutes);

// Google Drive (migrated)
router.use('/drive', driveRoutes);

// Gmail (migrated)
router.use('/gmail', gmailRoutes);

// Topics (saved topic library)
router.use('/topics', topicRoutes);

// Sources (saved inspiration sources library)
router.use('/sources', sourceRoutes);

// RAG Knowledge Base (persistent document storage & chat)
router.use('/rag', ragRoutes);

// Generation (migrated - AI content generation endpoints)
// Mounted at root level since endpoints use direct paths like /fetchTrendingSources
router.use('/', generationRoutes);

export default router;
