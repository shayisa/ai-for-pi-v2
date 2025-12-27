/**
 * RAG Service - Gemini File Search Integration
 *
 * Phase 18: Integrates Gemini File Search for RAG-based content retrieval.
 * Uses Google's hosted semantic search to ground newsletter content in sources.
 *
 * @module services/ragService
 *
 * ## Key Operations
 * 1. Create session-specific FileSearchStore (corpus)
 * 2. Upload extracted articles for indexing
 * 3. Query corpus for relevant content
 * 4. Clean up corpus after generation
 *
 * ## Costs (as of 2025)
 * - Indexing: $0.15 per million tokens
 * - Storage: FREE
 * - Query embeddings: FREE
 */

import { GoogleGenAI } from '@google/genai';
import { getApiKey, getAdminEmail } from './credentialLoader';
import type { ExtractedArticle } from './articleExtractorService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Types
export interface RagSession {
  storeId: string;
  storeName: string;
  documentsIndexed: number;
  createdAt: Date;
}

export interface RagQueryResult {
  query: string;
  response: string;
  retrievedChunks: number;
  hasGrounding: boolean;
  sources: string[];
  queryTimeMs: number;
}

export interface RagServiceConfig {
  modelName?: string;
  indexingDelayMs?: number;
  maxDocsPerSession?: number;
}

const DEFAULT_CONFIG: RagServiceConfig = {
  modelName: 'gemini-2.5-flash',
  indexingDelayMs: 5000,  // Wait for indexing
  maxDocsPerSession: 20,
};

// Session storage
let activeSession: RagSession | null = null;
let aiClient: GoogleGenAI | null = null;

/**
 * Initialize the Gemini AI client
 */
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;

  const adminEmail = getAdminEmail();
  const apiKey = getApiKey('google_api_key', adminEmail || undefined);

  if (!apiKey) {
    console.warn('[RagService] No Google API key found - RAG features disabled');
    return null;
  }

  try {
    aiClient = new GoogleGenAI({ apiKey });
    console.log('[RagService] Gemini AI client initialized');
    return aiClient;
  } catch (error) {
    console.error('[RagService] Failed to initialize Gemini client:', error);
    return null;
  }
}

/**
 * Create a new RAG session with a FileSearchStore
 *
 * @param sessionId - Unique identifier for this session (e.g., newsletterId)
 * @returns The created session or null if RAG is unavailable
 */
export async function createRagSession(sessionId: string): Promise<RagSession | null> {
  const ai = getAiClient();
  if (!ai) {
    console.log('[RagService] Skipping RAG session - no client available');
    return null;
  }

  try {
    console.log(`[RagService] Creating FileSearchStore for session: ${sessionId}`);

    const store = await ai.fileSearchStores.create({
      config: { displayName: `newsletter-session-${sessionId}` },
    });

    activeSession = {
      storeId: sessionId,
      storeName: store.name,
      documentsIndexed: 0,
      createdAt: new Date(),
    };

    console.log(`[RagService] Store created: ${store.name}`);
    return activeSession;
  } catch (error) {
    console.error('[RagService] Failed to create FileSearchStore:', error);
    return null;
  }
}

/**
 * Upload articles to the active RAG session
 *
 * @param articles - Extracted articles to index
 * @param config - Optional configuration
 * @returns Number of successfully indexed documents
 */
export async function uploadToRagSession(
  articles: ExtractedArticle[],
  config: RagServiceConfig = DEFAULT_CONFIG
): Promise<number> {
  const ai = getAiClient();
  if (!ai || !activeSession) {
    console.log('[RagService] Skipping upload - no active session');
    return 0;
  }

  const maxDocs = config.maxDocsPerSession || DEFAULT_CONFIG.maxDocsPerSession!;
  const articlesToIndex = articles
    .filter((a) => a.extractionSuccess && a.content && a.content.length > 50)
    .slice(0, maxDocs);

  console.log(`[RagService] Uploading ${articlesToIndex.length} articles to store`);

  let indexedCount = 0;

  // Create temp directory for upload files
  const tempDir = path.join(os.tmpdir(), `rag-session-${activeSession.storeId}`);
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  } catch (mkdirError) {
    console.error('[RagService] Failed to create temp directory:', mkdirError);
  }

  for (const article of articlesToIndex) {
    try {
      // Create content for indexing
      const documentContent = `
TITLE: ${article.title}
URL: ${article.url}
SOURCE: ${article.source}
${article.author ? `AUTHOR: ${article.author}` : ''}
${article.date ? `DATE: ${article.date}` : ''}

CONTENT:
${article.content}
`.trim();

      // Write to temp file (Gemini API requires file path, not buffer)
      const safeFilename = `${article.source}-${Date.now()}-${indexedCount}.txt`.replace(/[^a-zA-Z0-9-_.]/g, '_');
      const tempFilePath = path.join(tempDir, safeFilename);
      fs.writeFileSync(tempFilePath, documentContent, 'utf-8');

      // Upload file to store
      await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: activeSession.storeName,
        file: tempFilePath,
        config: {
          displayName: `${article.source}-${article.title.substring(0, 50)}`.replace(/[^a-zA-Z0-9-_]/g, '_'),
        },
      });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch { /* ignore cleanup errors */ }

      indexedCount++;
      console.log(`[RagService] Indexed: ${article.title.substring(0, 50)}...`);
    } catch (error) {
      console.error(`[RagService] Failed to index "${article.title}":`, error);
    }
  }

  // Clean up temp directory
  try {
    fs.rmdirSync(tempDir, { recursive: true });
  } catch { /* ignore cleanup errors */ }

  activeSession.documentsIndexed = indexedCount;
  console.log(`[RagService] Indexed ${indexedCount}/${articlesToIndex.length} documents`);

  // Wait for indexing to complete
  if (indexedCount > 0) {
    const delayMs = config.indexingDelayMs || DEFAULT_CONFIG.indexingDelayMs!;
    console.log(`[RagService] Waiting ${delayMs}ms for indexing to complete...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return indexedCount;
}

/**
 * Query the RAG corpus for content relevant to a topic
 *
 * @param query - The search query (e.g., topic title or question)
 * @param config - Optional configuration
 * @returns Query result with retrieved content
 */
export async function queryRagSession(
  query: string,
  config: RagServiceConfig = DEFAULT_CONFIG
): Promise<RagQueryResult | null> {
  const ai = getAiClient();
  if (!ai || !activeSession) {
    console.log('[RagService] Skipping query - no active session');
    return null;
  }

  const startTime = Date.now();

  try {
    console.log(`[RagService] Querying: "${query.substring(0, 50)}..."`);

    const response = await ai.models.generateContent({
      model: config.modelName || DEFAULT_CONFIG.modelName!,
      contents: `Based on the indexed documents, provide a detailed summary of information about: ${query}

Focus on:
1. Key facts and data points
2. Specific examples mentioned
3. Expert opinions or quotes
4. Relevant URLs for citations

If no relevant information is found, say "No relevant information found in indexed sources."`,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [activeSession.storeName],
            },
          },
        ],
      },
    });

    const queryTimeMs = Date.now() - startTime;
    const responseText = response.text || '';

    // Extract grounding metadata if available
    const groundingMetadata = (response as any).groundingMetadata;
    const sources = groundingMetadata?.groundingChunks?.map(
      (chunk: any) => chunk.retrievedContext?.uri || 'unknown'
    ) || [];

    const result: RagQueryResult = {
      query,
      response: responseText,
      retrievedChunks: sources.length,
      hasGrounding: sources.length > 0,
      sources,
      queryTimeMs,
    };

    console.log(`[RagService] Query complete. Grounded: ${result.hasGrounding}, Time: ${queryTimeMs}ms`);
    return result;
  } catch (error) {
    console.error('[RagService] Query failed:', error);
    return {
      query,
      response: '',
      retrievedChunks: 0,
      hasGrounding: false,
      sources: [],
      queryTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Get RAG-augmented content for multiple topics
 *
 * @param topics - Array of topic titles to retrieve content for
 * @returns Map of topic -> retrieved content
 */
export async function getRagContentForTopics(
  topics: string[]
): Promise<Map<string, string>> {
  const contentMap = new Map<string, string>();

  if (!activeSession) {
    console.log('[RagService] No active session - returning empty content');
    return contentMap;
  }

  console.log(`[RagService] Retrieving RAG content for ${topics.length} topics`);

  for (const topic of topics) {
    const result = await queryRagSession(topic);
    if (result && result.hasGrounding && result.response) {
      contentMap.set(topic, result.response);
    }
  }

  console.log(`[RagService] Retrieved content for ${contentMap.size}/${topics.length} topics`);
  return contentMap;
}

/**
 * Close and cleanup the active RAG session
 */
export async function closeRagSession(): Promise<void> {
  const ai = getAiClient();
  if (!ai || !activeSession) {
    console.log('[RagService] No active session to close');
    return;
  }

  try {
    console.log(`[RagService] Deleting store: ${activeSession.storeName}`);
    await ai.fileSearchStores.delete({ name: activeSession.storeName });
    console.log('[RagService] Store deleted successfully');
  } catch (error) {
    console.error('[RagService] Failed to delete store (may require manual cleanup):', error);
  }

  activeSession = null;
}

/**
 * Get the current active session info
 */
export function getActiveSession(): RagSession | null {
  return activeSession;
}

/**
 * Check if RAG is available (API key configured)
 */
export function isRagAvailable(): boolean {
  const adminEmail = getAdminEmail();
  const apiKey = getApiKey('google_api_key', adminEmail || undefined);
  return !!apiKey;
}

export default {
  createRagSession,
  uploadToRagSession,
  queryRagSession,
  getRagContentForTopics,
  closeRagSession,
  getActiveSession,
  isRagAvailable,
};
