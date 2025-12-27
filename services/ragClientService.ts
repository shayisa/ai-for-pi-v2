/**
 * RAG Client Service
 * Frontend API client for managing the RAG knowledge base via SQLite backend
 */

import { apiRequest } from './apiHelper.ts';
import type {
  RagDocument,
  RagChat,
  RagMessage,
  RagStorageStats,
  RagConfig,
  RagDocumentStatus,
  RagDocumentSourceType,
} from '../types.ts';

// ============================================================================
// Response Types
// ============================================================================

export interface DocumentsListResponse {
  documents: RagDocument[];
  stats: RagStorageStats;
}

export interface StorageResponse {
  stats: RagStorageStats;
  config: RagConfig;
}

export interface ConfigResponse {
  config: RagConfig;
  available: boolean;
}

export interface ChatsListResponse {
  chats: RagChat[];
}

export interface ChatWithMessagesResponse {
  chat: RagChat;
  messages: RagMessage[];
}

export interface ChatMessageResponse {
  chat: RagChat;
  userMessage: RagMessage;
  assistantMessage: RagMessage;
}

export interface DocumentUploadResponse {
  document: RagDocument;
  message: string;
}

export interface FetchAndIndexResponse {
  document: RagDocument | null;
  wasAlreadyIndexed: boolean;
  message: string;
}

export interface FetchAndIndexBatchResult {
  url: string;
  status: 'indexed' | 'exists' | 'failed';
  document?: RagDocument;
  error?: string;
}

export interface FetchAndIndexBatchResponse {
  indexed: number;
  alreadyIndexed: number;
  failed: number;
  results: FetchAndIndexBatchResult[];
}

export interface IndexedUrlsResponse {
  urls: string[];
}

export type SourceIndexType = 'trending' | 'tool' | 'suggestion' | 'archive';

// ============================================================================
// Document Operations
// ============================================================================

/**
 * Get all documents with optional filters
 */
export const getDocuments = async (options?: {
  status?: RagDocumentStatus;
  sourceType?: RagDocumentSourceType;
  limit?: number;
  offset?: number;
}): Promise<DocumentsListResponse> => {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.sourceType) params.set('sourceType', options.sourceType);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());

  const query = params.toString();
  return apiRequest<DocumentsListResponse>(`/api/rag/documents${query ? `?${query}` : ''}`);
};

/**
 * Get a single document by ID
 */
export const getDocumentById = async (id: string): Promise<RagDocument> => {
  return apiRequest<RagDocument>(`/api/rag/documents/${id}`);
};

/**
 * Index pasted text content
 */
export const indexText = async (
  content: string,
  title: string,
  metadata?: Record<string, unknown>
): Promise<DocumentUploadResponse> => {
  return apiRequest<DocumentUploadResponse>('/api/rag/documents/text', {
    method: 'POST',
    body: JSON.stringify({ content, title, metadata }),
  });
};

/**
 * Index content from a URL
 */
export const indexUrl = async (
  url: string,
  content: string,
  title: string,
  metadata?: Record<string, unknown>
): Promise<DocumentUploadResponse> => {
  return apiRequest<DocumentUploadResponse>('/api/rag/documents/url', {
    method: 'POST',
    body: JSON.stringify({ url, content, title, metadata }),
  });
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/rag/documents/${id}`, {
    method: 'DELETE',
  });
};

// ============================================================================
// Source Indexing Operations (Server-side fetch)
// ============================================================================

/**
 * Fetch URL content and index to knowledge base (server-side fetch)
 * Used for indexing trending sources, tools, and suggested topics
 */
export const fetchAndIndexUrl = async (
  url: string,
  title: string,
  sourceType: SourceIndexType = 'trending',
  metadata?: Record<string, unknown>
): Promise<FetchAndIndexResponse> => {
  return apiRequest<FetchAndIndexResponse>('/api/rag/fetch-and-index', {
    method: 'POST',
    body: JSON.stringify({ url, title, sourceType, metadata }),
  });
};

/**
 * Batch fetch and index multiple URLs
 */
export const fetchAndIndexBatch = async (
  sources: Array<{
    url: string;
    title: string;
    sourceType: SourceIndexType;
    metadata?: Record<string, unknown>;
  }>
): Promise<FetchAndIndexBatchResponse> => {
  return apiRequest<FetchAndIndexBatchResponse>('/api/rag/fetch-and-index-batch', {
    method: 'POST',
    body: JSON.stringify({ sources }),
  });
};

/**
 * Get list of all indexed source URLs
 * Used for checking which sources are already in the knowledge base
 */
export const getIndexedUrls = async (): Promise<Set<string>> => {
  const response = await apiRequest<IndexedUrlsResponse>('/api/rag/indexed-urls');
  return new Set(response.urls);
};

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Get storage statistics
 */
export const getStorage = async (): Promise<StorageResponse> => {
  return apiRequest<StorageResponse>('/api/rag/storage');
};

/**
 * Get RAG configuration
 */
export const getConfig = async (): Promise<ConfigResponse> => {
  return apiRequest<ConfigResponse>('/api/rag/config');
};

// ============================================================================
// Chat Operations
// ============================================================================

/**
 * Get all chats
 */
export const getChats = async (limit?: number): Promise<ChatsListResponse> => {
  const query = limit ? `?limit=${limit}` : '';
  return apiRequest<ChatsListResponse>(`/api/rag/chats${query}`);
};

/**
 * Create a new chat
 */
export const createChat = async (title?: string): Promise<{ chat: RagChat }> => {
  return apiRequest<{ chat: RagChat }>('/api/rag/chats', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
};

/**
 * Get a chat with all its messages
 */
export const getChat = async (id: string): Promise<ChatWithMessagesResponse> => {
  return apiRequest<ChatWithMessagesResponse>(`/api/rag/chats/${id}`);
};

/**
 * Update chat title
 */
export const updateChatTitle = async (id: string, title: string): Promise<{ chat: RagChat }> => {
  return apiRequest<{ chat: RagChat }>(`/api/rag/chats/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
};

/**
 * Delete a chat
 */
export const deleteChat = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/rag/chats/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Send a message to an existing chat
 */
export const sendMessage = async (
  chatId: string,
  message: string
): Promise<ChatMessageResponse> => {
  return apiRequest<ChatMessageResponse>(`/api/rag/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
};

/**
 * Create a new chat and send the first message in one call
 */
export const startNewChat = async (
  message: string,
  title?: string
): Promise<ChatMessageResponse> => {
  return apiRequest<ChatMessageResponse>('/api/rag/chats/new-with-message', {
    method: 'POST',
    body: JSON.stringify({ message, title }),
  });
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Documents
  getDocuments,
  getDocumentById,
  indexText,
  indexUrl,
  deleteDocument,

  // Source Indexing
  fetchAndIndexUrl,
  fetchAndIndexBatch,
  getIndexedUrls,

  // Storage
  getStorage,
  getConfig,

  // Chats
  getChats,
  createChat,
  getChat,
  updateChatTitle,
  deleteChat,
  sendMessage,
  startNewChat,
};
