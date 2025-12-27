/**
 * Persistent RAG Service - Knowledge Base with Chat
 *
 * Unlike the ephemeral ragService.ts, this service:
 * 1. Keeps documents permanently until manually deleted
 * 2. Tracks all documents in SQLite for visibility
 * 3. Supports chat conversations with the knowledge base
 * 4. Can auto-index newsletter sources with deduplication
 *
 * @module services/persistentRagService
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getApiKey, getAdminEmail } from './credentialLoader';
import * as ragDb from './ragDbService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { ExtractedArticle } from './articleExtractorService';
import { extractArticle } from './articleExtractorService';
import type {
  RagDocument,
  RagChat,
  RagMessage,
  RagSourceReference,
  RagStorageStats,
  RagConfig,
} from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface PersistentRagConfig {
  modelName?: string;
  indexingDelayMs?: number;
  maxChunkSize?: number;
  storagePrefix?: string;
}

export interface ChatWithKnowledgeBaseResult {
  response: string;
  sources: RagSourceReference[];
  tokensUsed?: number;
}

export interface IndexDocumentResult {
  document: RagDocument;
  success: boolean;
  error?: string;
}

export interface FetchAndIndexResult {
  document: RagDocument | null;
  success: boolean;
  wasAlreadyIndexed: boolean;
  error?: string;
}

export interface FetchAndIndexBatchResult {
  indexed: number;
  alreadyIndexed: number;
  failed: number;
  results: Array<{
    url: string;
    status: 'indexed' | 'exists' | 'failed';
    document?: RagDocument;
    error?: string;
  }>;
}

const DEFAULT_CONFIG: Required<PersistentRagConfig> = {
  modelName: 'gemini-2.5-flash',
  indexingDelayMs: 3000,
  maxChunkSize: 100000, // ~25k tokens
  storagePrefix: 'ai-newsletter-kb',
};

// ============================================================================
// AI Client Management
// ============================================================================

let aiClient: GoogleGenAI | null = null;
let persistentStoreName: string | null = null;

/**
 * Initialize or retrieve the Gemini AI client
 */
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;

  const adminEmail = getAdminEmail();
  const apiKey = getApiKey('google_api_key', adminEmail || undefined);

  if (!apiKey) {
    console.warn('[PersistentRag] No Google API key found - RAG features disabled');
    return null;
  }

  try {
    aiClient = new GoogleGenAI({ apiKey });
    console.log('[PersistentRag] Gemini AI client initialized');
    return aiClient;
  } catch (error) {
    console.error('[PersistentRag] Failed to initialize Gemini client:', error);
    return null;
  }
}

/**
 * Check if RAG is available
 */
export function isRagAvailable(): boolean {
  const adminEmail = getAdminEmail();
  const apiKey = getApiKey('google_api_key', adminEmail || undefined);
  return !!apiKey;
}

// ============================================================================
// Persistent Store Management
// ============================================================================

/**
 * Get or create the persistent FileSearchStore
 * Unlike ephemeral sessions, this store persists across app restarts
 */
export async function getOrCreatePersistentStore(
  config: PersistentRagConfig = {}
): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) return null;

  // Check if we already have a store name in memory
  if (persistentStoreName) {
    return persistentStoreName;
  }

  // Check if store name is saved in config
  const dbConfig = ragDb.getConfig();
  if (dbConfig.geminiCacheName) {
    // Verify the store still exists
    try {
      await ai.fileSearchStores.get({ name: dbConfig.geminiCacheName });
      persistentStoreName = dbConfig.geminiCacheName;
      console.log(`[PersistentRag] Using existing store: ${persistentStoreName}`);
      return persistentStoreName;
    } catch (error) {
      console.warn('[PersistentRag] Stored FileSearchStore no longer exists, creating new one');
    }
  }

  // Create new persistent store
  try {
    const prefix = config.storagePrefix || DEFAULT_CONFIG.storagePrefix;
    const displayName = `${prefix}-${Date.now()}`;

    console.log(`[PersistentRag] Creating new persistent store: ${displayName}`);

    const store = await ai.fileSearchStores.create({
      config: { displayName },
    });

    persistentStoreName = store.name;

    // Save to database config
    ragDb.updateConfig({ geminiCacheName: store.name });

    console.log(`[PersistentRag] Store created: ${store.name}`);
    return persistentStoreName;
  } catch (error) {
    console.error('[PersistentRag] Failed to create persistent store:', error);
    return null;
  }
}

// ============================================================================
// Document Management
// ============================================================================

/**
 * Index a document into the persistent knowledge base
 *
 * @param content - The document content to index
 * @param options - Document metadata
 * @returns The indexed document record
 */
export async function indexDocument(
  content: string,
  options: {
    filename: string;
    contentType: ragDb.DocumentContentType;
    sourceType: ragDb.DocumentSourceType;
    sourceUrl?: string;
    newsletterId?: string;
    metadata?: Record<string, unknown>;
  },
  config: PersistentRagConfig = {}
): Promise<IndexDocumentResult> {
  // Check for duplicate content
  const contentHash = ragDb.generateContentHash(content);
  const existing = ragDb.getDocumentByContentHash(contentHash);

  if (existing) {
    console.log(`[PersistentRag] Document already exists: ${existing.filename}`);
    return { document: existing, success: true };
  }

  // Create document record in pending state
  const document = ragDb.createDocument({
    filename: options.filename,
    contentType: options.contentType,
    sourceType: options.sourceType,
    sizeBytes: Buffer.byteLength(content, 'utf-8'),
    sourceUrl: options.sourceUrl,
    newsletterId: options.newsletterId,
    contentHash,
    metadata: options.metadata,
  });

  // Get or create persistent store
  const storeName = await getOrCreatePersistentStore(config);
  if (!storeName) {
    ragDb.updateDocumentStatus(document.id, 'failed', {
      errorMessage: 'Failed to get or create persistent store',
    });
    return {
      document: ragDb.getDocumentById(document.id)!,
      success: false,
      error: 'Store not available',
    };
  }

  const ai = getAiClient();
  if (!ai) {
    ragDb.updateDocumentStatus(document.id, 'failed', {
      errorMessage: 'AI client not available',
    });
    return {
      document: ragDb.getDocumentById(document.id)!,
      success: false,
      error: 'AI client not available',
    };
  }

  // Create temp file for upload
  const tempDir = path.join(os.tmpdir(), 'persistent-rag');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Sanitize filename and limit length to avoid ENAMETOOLONG errors
  const safeFilename = options.filename.replace(/[^a-zA-Z0-9-_.]/g, '_').substring(0, 100);
  // Determine file extension for mimeType inference
  const extension = options.contentType === 'pdf' ? '.pdf' : '.txt';
  const tempFilePath = path.join(tempDir, `${document.id}-${safeFilename}${extension}`);

  try {
    fs.writeFileSync(tempFilePath, content, 'utf-8');

    // Upload to Gemini FileSearchStore
    const uploadResult = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: storeName,
      file: tempFilePath,
      config: {
        displayName: options.filename.substring(0, 100),
      },
    });

    // Update document status
    ragDb.updateDocumentStatus(document.id, 'indexed', {
      geminiFileId: uploadResult.name,
    });

    // Sync config stats
    ragDb.syncConfigStats();

    console.log(`[PersistentRag] Indexed document: ${options.filename}`);

    return {
      document: ragDb.getDocumentById(document.id)!,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ragDb.updateDocumentStatus(document.id, 'failed', { errorMessage });

    console.error(`[PersistentRag] Failed to index ${options.filename}:`, error);

    return {
      document: ragDb.getDocumentById(document.id)!,
      success: false,
      error: errorMessage,
    };
  } finally {
    // Cleanup temp file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Index content from a URL
 */
export async function indexFromUrl(
  url: string,
  content: string,
  title: string,
  metadata?: Record<string, unknown>
): Promise<IndexDocumentResult> {
  return indexDocument(content, {
    filename: title || url,
    contentType: 'html',
    sourceType: 'url',
    sourceUrl: url,
    metadata: { ...metadata, url, title },
  });
}

/**
 * Index pasted text content
 */
export async function indexPastedText(
  text: string,
  title: string,
  metadata?: Record<string, unknown>
): Promise<IndexDocumentResult> {
  return indexDocument(text, {
    filename: title,
    contentType: 'text',
    sourceType: 'paste',
    metadata: { ...metadata, title },
  });
}

/**
 * Fetch content from URL and index to knowledge base
 * Used for indexing trending sources, tools, and suggested topics
 */
export async function fetchAndIndexUrl(
  url: string,
  title: string,
  sourceType: 'trending' | 'tool' | 'suggestion' | 'archive' = 'trending',
  metadata?: Record<string, unknown>
): Promise<FetchAndIndexResult> {
  console.log(`[PersistentRag] fetchAndIndexUrl: ${url}`);

  // Check if URL is already indexed
  const existing = ragDb.getDocumentBySourceUrl(url);
  if (existing) {
    // Only treat as "already indexed" if the document was successfully indexed
    // If it failed previously, allow retry by deleting the failed record first
    if (existing.status === 'indexed') {
      console.log(`[PersistentRag] URL already indexed: ${url}`);
      return {
        document: existing,
        success: true,
        wasAlreadyIndexed: true,
      };
    } else if (existing.status === 'failed') {
      // Delete the failed record to allow retry
      console.log(`[PersistentRag] Removing failed record for retry: ${url}`);
      ragDb.deleteDocument(existing.id);
    }
    // If status is 'pending', we'll let it proceed (shouldn't happen normally)
  }

  // Fetch and extract article content
  const extracted = await extractArticle(url);
  if (!extracted.success || !extracted.content) {
    console.warn(`[PersistentRag] Failed to extract content from ${url}: ${extracted.error}`);
    return {
      document: null,
      success: false,
      wasAlreadyIndexed: false,
      error: extracted.error || 'Failed to extract content from URL',
    };
  }

  // Format content with metadata
  const content = `
TITLE: ${extracted.title || title}
URL: ${url}

CONTENT:
${extracted.content}
`.trim();

  // Map sourceType to document sourceType
  const docSourceType: ragDb.DocumentSourceType =
    sourceType === 'trending' ? 'url' :
    sourceType === 'tool' ? 'url' :
    sourceType === 'suggestion' ? 'url' :
    'archive';

  // Index the content
  const result = await indexDocument(content, {
    filename: extracted.title || title || url,
    contentType: 'html',
    sourceType: docSourceType,
    sourceUrl: url,
    metadata: {
      ...metadata,
      originalSourceType: sourceType,
      extractedTitle: extracted.title,
    },
  });

  return {
    document: result.document,
    success: result.success,
    wasAlreadyIndexed: false,
    error: result.error,
  };
}

/**
 * Fetch and index multiple URLs in batch
 * Processes in parallel with concurrency limit
 */
export async function fetchAndIndexBatch(
  sources: Array<{
    url: string;
    title: string;
    sourceType: 'trending' | 'tool' | 'suggestion' | 'archive';
    metadata?: Record<string, unknown>;
  }>,
  concurrency: number = 5
): Promise<FetchAndIndexBatchResult> {
  console.log(`[PersistentRag] fetchAndIndexBatch: ${sources.length} sources, concurrency=${concurrency}`);

  const results: FetchAndIndexBatchResult['results'] = [];
  let indexed = 0;
  let alreadyIndexed = 0;
  let failed = 0;

  // Process in batches for controlled concurrency
  for (let i = 0; i < sources.length; i += concurrency) {
    const batch = sources.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (source) => {
        const result = await fetchAndIndexUrl(
          source.url,
          source.title,
          source.sourceType,
          source.metadata
        );
        return { url: source.url, result };
      })
    );

    for (const settledResult of batchResults) {
      if (settledResult.status === 'fulfilled') {
        const { url, result } = settledResult.value;
        if (result.success) {
          if (result.wasAlreadyIndexed) {
            alreadyIndexed++;
            results.push({
              url,
              status: 'exists',
              document: result.document || undefined,
            });
          } else {
            indexed++;
            results.push({
              url,
              status: 'indexed',
              document: result.document || undefined,
            });
          }
        } else {
          failed++;
          results.push({
            url,
            status: 'failed',
            error: result.error,
          });
        }
      } else {
        // Promise rejected
        failed++;
        results.push({
          url: batch[batchResults.indexOf(settledResult)]?.url || 'unknown',
          status: 'failed',
          error: settledResult.reason?.message || 'Unknown error',
        });
      }
    }
  }

  console.log(
    `[PersistentRag] Batch complete: indexed=${indexed}, alreadyIndexed=${alreadyIndexed}, failed=${failed}`
  );

  return {
    indexed,
    alreadyIndexed,
    failed,
    results,
  };
}

/**
 * Get all indexed source URLs
 * Used by frontend to check which sources are already indexed
 */
export function getIndexedSourceUrls(): string[] {
  return ragDb.getIndexedSourceUrls();
}

/**
 * Auto-index articles from newsletter generation
 * Includes deduplication to avoid re-indexing same content
 */
export async function indexNewsletterSources(
  articles: ExtractedArticle[],
  newsletterId: string
): Promise<{ indexed: number; skipped: number; failed: number }> {
  const results = { indexed: 0, skipped: 0, failed: 0 };

  const validArticles = articles.filter(
    (a) => a.extractionSuccess && a.content && a.content.length > 100
  );

  console.log(`[PersistentRag] Auto-indexing ${validArticles.length} newsletter sources`);

  for (const article of validArticles) {
    const content = `
TITLE: ${article.title}
URL: ${article.url}
SOURCE: ${article.source}
${article.author ? `AUTHOR: ${article.author}` : ''}
${article.date ? `DATE: ${article.date}` : ''}

CONTENT:
${article.content}
`.trim();

    const result = await indexDocument(content, {
      filename: `${article.source}-${article.title.substring(0, 50)}`,
      contentType: 'text',
      sourceType: 'newsletter',
      sourceUrl: article.url,
      newsletterId,
      metadata: {
        source: article.source,
        author: article.author,
        date: article.date,
      },
    });

    if (result.success) {
      // Check if it was a duplicate (already existed)
      if (result.document.createdAt === result.document.indexedAt) {
        results.indexed++;
      } else {
        results.skipped++;
      }
    } else {
      results.failed++;
    }
  }

  console.log(
    `[PersistentRag] Newsletter sources: indexed=${results.indexed}, skipped=${results.skipped}, failed=${results.failed}`
  );

  return results;
}

/**
 * Delete a document from the knowledge base
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const document = ragDb.getDocumentById(documentId);
  if (!document) {
    console.warn(`[PersistentRag] Document not found: ${documentId}`);
    return false;
  }

  // If document was indexed in Gemini, we can't delete individual files from FileSearchStore
  // We can only track deletion locally and it will be excluded from future queries
  // Note: Gemini FileSearchStore doesn't support per-file deletion

  // Delete from local database
  const deleted = ragDb.deleteDocument(documentId);
  if (deleted) {
    ragDb.syncConfigStats();
    console.log(`[PersistentRag] Deleted document: ${document.filename}`);
  }

  return deleted;
}

/**
 * Get all documents with optional filters
 */
export function getDocuments(options?: {
  status?: ragDb.DocumentStatus;
  sourceType?: ragDb.DocumentSourceType;
  limit?: number;
  offset?: number;
}): RagDocument[] {
  return ragDb.getDocuments(options);
}

/**
 * Get storage statistics
 */
export function getStorageStats(): RagStorageStats {
  return ragDb.getStorageStats();
}

/**
 * Get RAG configuration
 */
export function getConfig(): RagConfig {
  return ragDb.getConfig();
}

// ============================================================================
// Chat with Knowledge Base
// ============================================================================

/**
 * Chat with the knowledge base using RAG
 *
 * @param message - User's message/question
 * @param chatHistory - Previous messages for context
 * @param config - Optional configuration
 * @returns Response with sources
 */
export async function chatWithKnowledgeBase(
  message: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  config: PersistentRagConfig = {}
): Promise<ChatWithKnowledgeBaseResult> {
  const ai = getAiClient();
  const storeName = await getOrCreatePersistentStore(config);

  if (!ai || !storeName) {
    return {
      response: 'Knowledge base is not available. Please check your API configuration.',
      sources: [],
    };
  }

  const modelName = config.modelName || DEFAULT_CONFIG.modelName;

  try {
    // Build conversation context
    const conversationContext = chatHistory
      .slice(-10) // Last 10 messages for context
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const prompt = conversationContext
      ? `Previous conversation:\n${conversationContext}\n\nUser: ${message}\n\nBased on the knowledge base documents, please respond to the user's message. If the information isn't in the knowledge base, say so clearly.`
      : `User question: ${message}\n\nBased on the knowledge base documents, please provide a helpful response. If the information isn't in the knowledge base, say so clearly.`;

    console.log(`[PersistentRag] Chat query: "${message.substring(0, 50)}..."`);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
            },
          },
        ],
      },
    });

    const responseText = response.text || 'No response generated.';

    // Extract grounding/source information
    const sources: RagSourceReference[] = [];
    const groundingMetadata = (response as any).groundingMetadata;

    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.retrievedContext) {
          sources.push({
            documentId: chunk.retrievedContext.uri || 'unknown',
            filename: chunk.retrievedContext.title || 'Unknown source',
            snippet: chunk.retrievedContext.text?.substring(0, 200),
          });
        }
      }
    }

    console.log(`[PersistentRag] Chat response generated with ${sources.length} sources`);

    return {
      response: responseText,
      sources,
    };
  } catch (error) {
    console.error('[PersistentRag] Chat failed:', error);
    return {
      response: 'An error occurred while querying the knowledge base. Please try again.',
      sources: [],
    };
  }
}

// ============================================================================
// Chat CRUD Operations (Delegated to ragDbService)
// ============================================================================

/**
 * Create a new chat
 */
export function createChat(title: string): RagChat {
  return ragDb.createChat(title);
}

/**
 * Get all chats
 */
export function getChats(limit?: number): RagChat[] {
  return ragDb.getChats(limit);
}

/**
 * Get a chat by ID
 */
export function getChatById(id: string): RagChat | null {
  return ragDb.getChatById(id);
}

/**
 * Update chat title
 */
export function updateChatTitle(id: string, title: string): boolean {
  return ragDb.updateChatTitle(id, title);
}

/**
 * Delete a chat
 */
export function deleteChat(id: string): boolean {
  return ragDb.deleteChat(id);
}

/**
 * Add a message to a chat
 */
export function addMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: RagSourceReference[]
): RagMessage {
  return ragDb.addMessage(chatId, role, content, sources as ragDb.SourceReference[]);
}

/**
 * Get messages for a chat
 */
export function getChatMessages(chatId: string): RagMessage[] {
  return ragDb.getChatMessages(chatId);
}

/**
 * Send a message and get AI response
 * This is the main chat interaction method
 */
export async function sendChatMessage(
  chatId: string,
  message: string
): Promise<{
  userMessage: RagMessage;
  assistantMessage: RagMessage;
}> {
  // Add user message
  const userMessage = addMessage(chatId, 'user', message);

  // Get chat history for context
  const allMessages = getChatMessages(chatId);
  const history = allMessages.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Get AI response with RAG
  const result = await chatWithKnowledgeBase(message, history);

  // Add assistant message
  const assistantMessage = addMessage(chatId, 'assistant', result.response, result.sources);

  return { userMessage, assistantMessage };
}

// ============================================================================
// Export
// ============================================================================

export default {
  // Availability
  isRagAvailable,

  // Store management
  getOrCreatePersistentStore,

  // Document operations
  indexDocument,
  indexFromUrl,
  indexPastedText,
  fetchAndIndexUrl,
  fetchAndIndexBatch,
  indexNewsletterSources,
  deleteDocument,
  getDocuments,
  getStorageStats,
  getConfig,
  getIndexedSourceUrls,

  // Chat operations
  chatWithKnowledgeBase,
  createChat,
  getChats,
  getChatById,
  updateChatTitle,
  deleteChat,
  addMessage,
  getChatMessages,
  sendChatMessage,
};
