/**
 * RAG Knowledge Base Routes
 *
 * CRUD operations for documents, chats, and storage management.
 *
 * @module routes/rag
 *
 * ## Endpoints
 *
 * ### Documents
 * - GET    /api/rag/documents              - List all documents
 * - GET    /api/rag/documents/:id          - Get document by ID
 * - POST   /api/rag/documents/text         - Index pasted text
 * - POST   /api/rag/documents/url          - Index content from URL (client-fetched)
 * - DELETE /api/rag/documents/:id          - Delete document
 *
 * ### Source Indexing (Server-side fetch)
 * - POST   /api/rag/fetch-and-index        - Fetch URL and index content
 * - POST   /api/rag/fetch-and-index-batch  - Batch fetch and index URLs
 * - GET    /api/rag/indexed-urls           - Get list of indexed source URLs
 *
 * ### Storage
 * - GET    /api/rag/storage                - Get storage statistics
 * - GET    /api/rag/config                 - Get RAG configuration
 *
 * ### Chats
 * - GET    /api/rag/chats                  - List all chats
 * - POST   /api/rag/chats                  - Create new chat
 * - GET    /api/rag/chats/:id              - Get chat with messages
 * - PUT    /api/rag/chats/:id              - Update chat title
 * - DELETE /api/rag/chats/:id              - Delete chat
 * - POST   /api/rag/chats/:id/messages     - Send message and get response
 */

import { Router, Request, Response } from 'express';
import * as persistentRag from '../services/persistentRagService';
import { logger } from '../control-plane/feedback';
import { sendSuccess, sendError, ErrorCodes } from '../control-plane/invocation/responseBuilder';
import { getCorrelationId } from '../control-plane/invocation/contextManager';
import type {
  RagDocumentContentType,
  RagDocumentSourceType,
  RagDocumentStatus,
} from '../../types';

const router = Router();

// ============================================================================
// Document Endpoints
// ============================================================================

/**
 * GET /api/rag/documents
 *
 * List all documents in the knowledge base.
 *
 * @query {string} status - Filter by status (pending, indexed, failed)
 * @query {string} sourceType - Filter by source type
 * @query {number} limit - Maximum number of documents (default: 100)
 * @query {number} offset - Offset for pagination
 */
router.get('/documents', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const status = req.query.status as RagDocumentStatus | undefined;
    const sourceType = req.query.sourceType as RagDocumentSourceType | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const documents = persistentRag.getDocuments({ status, sourceType, limit, offset });
    const stats = persistentRag.getStorageStats();

    logger.info('rag', 'list_documents', `Listed ${documents.length} documents`, {
      correlationId,
      limit,
      offset,
      status,
      sourceType,
    });

    sendSuccess(res, { documents, stats });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'list_documents_error', `Failed to list documents: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch documents', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * GET /api/rag/documents/:id
 *
 * Get a single document by ID.
 */
router.get('/documents/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const documents = persistentRag.getDocuments();
    const document = documents.find((d) => d.id === req.params.id);

    if (!document) {
      logger.warn('rag', 'document_not_found', `Document not found: ${req.params.id}`, {
        correlationId,
      });
      return sendError(res, 'Document not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('rag', 'get_document', `Retrieved document: ${req.params.id}`, { correlationId });
    sendSuccess(res, document);
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'get_document_error', `Failed to get document: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch document', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/documents/text
 *
 * Index pasted text content.
 *
 * @body {string} content - Text content to index (required)
 * @body {string} title - Title for the document (required)
 * @body {object} metadata - Optional metadata
 */
router.post('/documents/text', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { content, title, metadata } = req.body;

    if (!content || !title) {
      logger.warn('rag', 'validation_error', 'Content and title are required', { correlationId });
      return sendError(res, 'Content and title are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await persistentRag.indexPastedText(content, title, metadata);

    if (!result.success) {
      logger.warn('rag', 'index_failed', `Failed to index text: ${result.error}`, { correlationId });
      return sendError(res, result.error || 'Failed to index text', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('rag', 'index_text', `Indexed text: ${title}`, {
      correlationId,
      documentId: result.document.id,
    });

    sendSuccess(res, {
      document: result.document,
      message: 'Text indexed successfully',
    }, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'index_text_error', `Failed to index text: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to index text', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/documents/url
 *
 * Index content from a URL.
 *
 * @body {string} url - URL to fetch and index (required)
 * @body {string} content - Pre-fetched content (required - client fetches to avoid CORS)
 * @body {string} title - Title for the document (required)
 * @body {object} metadata - Optional metadata
 */
router.post('/documents/url', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { url, content, title, metadata } = req.body;

    if (!url || !content || !title) {
      logger.warn('rag', 'validation_error', 'URL, content, and title are required', { correlationId });
      return sendError(res, 'URL, content, and title are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await persistentRag.indexFromUrl(url, content, title, metadata);

    if (!result.success) {
      logger.warn('rag', 'index_url_failed', `Failed to index URL: ${result.error}`, { correlationId });
      return sendError(res, result.error || 'Failed to index URL', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('rag', 'index_url', `Indexed URL: ${url}`, {
      correlationId,
      documentId: result.document.id,
    });

    sendSuccess(res, {
      document: result.document,
      message: 'URL content indexed successfully',
    }, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'index_url_error', `Failed to index URL: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to index URL', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/fetch-and-index
 *
 * Fetch content from URL and index to knowledge base.
 * Server-side fetching to avoid CORS issues.
 *
 * @body {string} url - URL to fetch and index (required)
 * @body {string} title - Title for the document (required)
 * @body {string} sourceType - Source type: 'trending' | 'tool' | 'suggestion' | 'archive' (default: 'trending')
 * @body {object} metadata - Optional metadata
 */
router.post('/fetch-and-index', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { url, title, sourceType = 'trending', metadata } = req.body;

    if (!url || !title) {
      logger.warn('rag', 'validation_error', 'URL and title are required', { correlationId });
      return sendError(res, 'URL and title are required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const validSourceTypes = ['trending', 'tool', 'suggestion', 'archive'];
    if (!validSourceTypes.includes(sourceType)) {
      logger.warn('rag', 'validation_error', `Invalid sourceType: ${sourceType}`, { correlationId });
      return sendError(res, 'Invalid sourceType', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const result = await persistentRag.fetchAndIndexUrl(url, title, sourceType, metadata);

    if (!result.success) {
      logger.warn('rag', 'fetch_index_failed', `Failed to fetch and index: ${result.error}`, { correlationId, url });
      return sendError(res, result.error || 'Failed to fetch and index URL', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId);
    }

    logger.info('rag', 'fetch_and_index', `Fetched and indexed: ${url}`, {
      correlationId,
      documentId: result.document?.id,
      wasAlreadyIndexed: result.wasAlreadyIndexed,
    });

    sendSuccess(res, {
      document: result.document,
      wasAlreadyIndexed: result.wasAlreadyIndexed,
      message: result.wasAlreadyIndexed ? 'Already in knowledge base' : 'Indexed successfully',
    }, correlationId, undefined, result.wasAlreadyIndexed ? 200 : 201);
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'fetch_index_error', `Failed to fetch and index: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch and index URL', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/fetch-and-index-batch
 *
 * Fetch and index multiple URLs in batch.
 *
 * @body {Array} sources - Array of sources to index
 * @body {string} sources[].url - URL to fetch and index (required)
 * @body {string} sources[].title - Title for the document (required)
 * @body {string} sources[].sourceType - Source type (default: 'trending')
 * @body {object} sources[].metadata - Optional metadata
 */
router.post('/fetch-and-index-batch', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { sources } = req.body;

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      logger.warn('rag', 'validation_error', 'Sources array is required', { correlationId });
      return sendError(res, 'Sources array is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Validate each source
    for (const source of sources) {
      if (!source.url || !source.title) {
        logger.warn('rag', 'validation_error', 'Each source must have url and title', { correlationId });
        return sendError(res, 'Each source must have url and title', ErrorCodes.VALIDATION_ERROR, correlationId);
      }
    }

    const result = await persistentRag.fetchAndIndexBatch(sources);

    logger.info('rag', 'fetch_and_index_batch', `Batch indexed: ${result.indexed} new, ${result.alreadyIndexed} existing, ${result.failed} failed`, {
      correlationId,
      indexed: result.indexed,
      alreadyIndexed: result.alreadyIndexed,
      failed: result.failed,
    });

    sendSuccess(res, {
      indexed: result.indexed,
      alreadyIndexed: result.alreadyIndexed,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'fetch_index_batch_error', `Batch indexing failed: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to batch index URLs', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * GET /api/rag/indexed-urls
 *
 * Get all indexed source URLs.
 * Used by frontend to check which sources are already indexed.
 */
router.get('/indexed-urls', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const urls = persistentRag.getIndexedSourceUrls();

    logger.info('rag', 'get_indexed_urls', `Retrieved ${urls.length} indexed URLs`, { correlationId });

    sendSuccess(res, { urls });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'indexed_urls_error', `Failed to get indexed URLs: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch indexed URLs', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * DELETE /api/rag/documents/:id
 *
 * Delete a document from the knowledge base.
 */
router.delete('/documents/:id', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const deleted = await persistentRag.deleteDocument(req.params.id);

    if (!deleted) {
      logger.warn('rag', 'delete_not_found', `Document not found for deletion: ${req.params.id}`, {
        correlationId,
      });
      return sendError(res, 'Document not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('rag', 'delete_document', `Deleted document: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Document deleted successfully' });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'delete_error', `Failed to delete document: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to delete document', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

// ============================================================================
// Storage Endpoints
// ============================================================================

/**
 * GET /api/rag/storage
 *
 * Get storage statistics.
 */
router.get('/storage', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const stats = persistentRag.getStorageStats();
    const config = persistentRag.getConfig();

    logger.info('rag', 'get_storage', `Storage stats: ${stats.totalDocuments} documents`, {
      correlationId,
    });

    sendSuccess(res, { stats, config });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'storage_error', `Failed to get storage stats: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch storage stats', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * GET /api/rag/config
 *
 * Get RAG configuration.
 */
router.get('/config', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const config = persistentRag.getConfig();
    const available = persistentRag.isRagAvailable();

    logger.info('rag', 'get_config', 'Retrieved RAG config', { correlationId, available });

    sendSuccess(res, { config, available });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'config_error', `Failed to get config: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch config', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

// ============================================================================
// Chat Endpoints
// ============================================================================

/**
 * GET /api/rag/chats
 *
 * List all chats.
 *
 * @query {number} limit - Maximum number of chats (default: 50)
 */
router.get('/chats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const chats = persistentRag.getChats(limit);

    logger.info('rag', 'list_chats', `Listed ${chats.length} chats`, { correlationId, limit });

    sendSuccess(res, { chats });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'list_chats_error', `Failed to list chats: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch chats', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/chats
 *
 * Create a new chat.
 *
 * @body {string} title - Chat title (default: "New Chat")
 */
router.post('/chats', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const title = req.body.title || 'New Chat';
    const chat = persistentRag.createChat(title);

    logger.info('rag', 'create_chat', `Created chat: ${chat.id}`, { correlationId, chatId: chat.id });

    sendSuccess(res, { chat }, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'create_chat_error', `Failed to create chat: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to create chat', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * GET /api/rag/chats/:id
 *
 * Get a chat with all its messages.
 */
router.get('/chats/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const chat = persistentRag.getChatById(req.params.id);

    if (!chat) {
      logger.warn('rag', 'chat_not_found', `Chat not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Chat not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    const messages = persistentRag.getChatMessages(req.params.id);

    logger.info('rag', 'get_chat', `Retrieved chat with ${messages.length} messages`, {
      correlationId,
      chatId: req.params.id,
    });

    sendSuccess(res, { chat, messages });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'get_chat_error', `Failed to get chat: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to fetch chat', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * PUT /api/rag/chats/:id
 *
 * Update chat title.
 *
 * @body {string} title - New chat title (required)
 */
router.put('/chats/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { title } = req.body;

    if (!title) {
      logger.warn('rag', 'validation_error', 'Title is required', { correlationId });
      return sendError(res, 'Title is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const updated = persistentRag.updateChatTitle(req.params.id, title);

    if (!updated) {
      logger.warn('rag', 'chat_not_found', `Chat not found for update: ${req.params.id}`, {
        correlationId,
      });
      return sendError(res, 'Chat not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    const chat = persistentRag.getChatById(req.params.id);

    logger.info('rag', 'update_chat', `Updated chat title: ${req.params.id}`, { correlationId });
    sendSuccess(res, { chat });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'update_chat_error', `Failed to update chat: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to update chat', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * DELETE /api/rag/chats/:id
 *
 * Delete a chat and all its messages.
 */
router.delete('/chats/:id', (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const deleted = persistentRag.deleteChat(req.params.id);

    if (!deleted) {
      logger.warn('rag', 'delete_chat_not_found', `Chat not found for deletion: ${req.params.id}`, {
        correlationId,
      });
      return sendError(res, 'Chat not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    logger.info('rag', 'delete_chat', `Deleted chat: ${req.params.id}`, { correlationId });
    sendSuccess(res, { success: true, message: 'Chat deleted successfully' });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'delete_chat_error', `Failed to delete chat: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to delete chat', ErrorCodes.DATABASE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/chats/:id/messages
 *
 * Send a message to a chat and get AI response.
 *
 * @body {string} message - User's message (required)
 */
router.post('/chats/:id/messages', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { message } = req.body;

    if (!message) {
      logger.warn('rag', 'validation_error', 'Message is required', { correlationId });
      return sendError(res, 'Message is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    const chat = persistentRag.getChatById(req.params.id);
    if (!chat) {
      logger.warn('rag', 'chat_not_found', `Chat not found: ${req.params.id}`, { correlationId });
      return sendError(res, 'Chat not found', ErrorCodes.NOT_FOUND, correlationId);
    }

    const result = await persistentRag.sendChatMessage(req.params.id, message);

    logger.info('rag', 'send_message', `Message sent to chat: ${req.params.id}`, {
      correlationId,
      userMessageId: result.userMessage.id,
      assistantMessageId: result.assistantMessage.id,
    });

    sendSuccess(res, {
      chat,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'send_message_error', `Failed to send message: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to send message', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

/**
 * POST /api/rag/chats/new-with-message
 *
 * Create a new chat and send the first message in one call.
 * Useful for starting a conversation without needing two API calls.
 *
 * @body {string} message - User's message (required)
 * @body {string} title - Optional chat title (auto-generated if not provided)
 */
router.post('/chats/new-with-message', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId();

  try {
    const { message, title } = req.body;

    if (!message) {
      logger.warn('rag', 'validation_error', 'Message is required', { correlationId });
      return sendError(res, 'Message is required', ErrorCodes.VALIDATION_ERROR, correlationId);
    }

    // Create chat with title from first message if not provided
    const chatTitle = title || message.substring(0, 50) + (message.length > 50 ? '...' : '');
    const chat = persistentRag.createChat(chatTitle);

    // Send message
    const result = await persistentRag.sendChatMessage(chat.id, message);

    logger.info('rag', 'new_chat_with_message', `Created chat with message: ${chat.id}`, {
      correlationId,
      chatId: chat.id,
    });

    sendSuccess(res, {
      chat: persistentRag.getChatById(chat.id), // Get updated chat
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    }, correlationId, undefined, 201);
  } catch (error) {
    const err = error as Error;
    logger.error('rag', 'new_chat_error', `Failed to create chat with message: ${err.message}`, err, {
      correlationId,
    });
    sendError(res, 'Failed to create chat', ErrorCodes.EXTERNAL_SERVICE_ERROR, correlationId, {
      details: err.message,
    });
  }
});

export default router;
