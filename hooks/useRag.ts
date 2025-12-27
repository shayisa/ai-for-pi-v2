/**
 * useRag Hook
 *
 * Manages RAG Knowledge Base functionality:
 * - Documents: List, upload, delete
 * - Chats: Create, list, load messages
 * - Storage: View stats and config
 *
 * Provides optimistic updates and error handling.
 */

import { useState, useCallback, useEffect } from 'react';
import * as ragApi from '../services/ragClientService';
import type {
  RagDocument,
  RagChat,
  RagMessage,
  RagStorageStats,
  RagConfig,
  RagDocumentStatus,
  RagDocumentSourceType,
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface UseRagReturn {
  // Documents
  documents: RagDocument[];
  documentsLoading: boolean;
  documentsError: string | null;
  loadDocuments: (options?: DocumentFilterOptions) => Promise<void>;
  indexText: (content: string, title: string) => Promise<RagDocument>;
  indexUrl: (url: string, content: string, title: string) => Promise<RagDocument>;
  deleteDocument: (id: string) => Promise<void>;

  // Storage
  stats: RagStorageStats | null;
  config: RagConfig | null;
  isAvailable: boolean;
  loadStorage: () => Promise<void>;

  // Chats
  chats: RagChat[];
  chatsLoading: boolean;
  loadChats: () => Promise<void>;
  createChat: (title?: string) => Promise<RagChat>;
  deleteChat: (id: string) => Promise<void>;

  // Active Chat
  activeChat: RagChat | null;
  activeChatMessages: RagMessage[];
  activeChatLoading: boolean;
  loadChat: (id: string) => Promise<void>;
  sendMessage: (message: string) => Promise<RagMessage>;
  startNewChat: (message: string) => Promise<RagMessage>;
  clearActiveChat: () => void;
}

interface DocumentFilterOptions {
  status?: RagDocumentStatus;
  sourceType?: RagDocumentSourceType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRag(): UseRagReturn {
  // Document state
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  // Storage state
  const [stats, setStats] = useState<RagStorageStats | null>(null);
  const [config, setConfig] = useState<RagConfig | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Chat list state
  const [chats, setChats] = useState<RagChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  // Active chat state
  const [activeChat, setActiveChat] = useState<RagChat | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<RagMessage[]>([]);
  const [activeChatLoading, setActiveChatLoading] = useState(false);

  // ============================================================================
  // Document Operations
  // ============================================================================

  const loadDocuments = useCallback(async (options?: DocumentFilterOptions) => {
    setDocumentsLoading(true);
    setDocumentsError(null);

    try {
      const response = await ragApi.getDocuments(options);
      setDocuments(response.documents);
      setStats(response.stats);
      console.log(`[useRag] Loaded ${response.documents.length} documents`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load documents';
      console.error('[useRag] Error loading documents:', e);
      setDocumentsError(msg);
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  const indexText = useCallback(async (content: string, title: string): Promise<RagDocument> => {
    try {
      const response = await ragApi.indexText(content, title);

      // Add to local state optimistically
      setDocuments((prev) => [response.document, ...prev]);

      // Refresh stats
      loadStorage();

      console.log(`[useRag] Indexed text: ${title}`);
      return response.document;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to index text';
      console.error('[useRag] Error indexing text:', e);
      throw new Error(msg);
    }
  }, []);

  const indexUrl = useCallback(
    async (url: string, content: string, title: string): Promise<RagDocument> => {
      try {
        const response = await ragApi.indexUrl(url, content, title);

        // Add to local state optimistically
        setDocuments((prev) => [response.document, ...prev]);

        // Refresh stats
        loadStorage();

        console.log(`[useRag] Indexed URL: ${url}`);
        return response.document;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to index URL';
        console.error('[useRag] Error indexing URL:', e);
        throw new Error(msg);
      }
    },
    []
  );

  const deleteDocument = useCallback(async (id: string): Promise<void> => {
    try {
      await ragApi.deleteDocument(id);

      // Remove from local state
      setDocuments((prev) => prev.filter((d) => d.id !== id));

      // Refresh stats
      loadStorage();

      console.log(`[useRag] Deleted document: ${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete document';
      console.error('[useRag] Error deleting document:', e);
      throw new Error(msg);
    }
  }, []);

  // ============================================================================
  // Storage Operations
  // ============================================================================

  const loadStorage = useCallback(async () => {
    try {
      const [storageResponse, configResponse] = await Promise.all([
        ragApi.getStorage(),
        ragApi.getConfig(),
      ]);

      setStats(storageResponse.stats);
      setConfig(configResponse.config);
      setIsAvailable(configResponse.available);

      console.log(`[useRag] Loaded storage stats: ${storageResponse.stats.totalDocuments} documents`);
    } catch (e) {
      console.error('[useRag] Error loading storage:', e);
      setIsAvailable(false);
    }
  }, []);

  // ============================================================================
  // Chat List Operations
  // ============================================================================

  const loadChats = useCallback(async () => {
    setChatsLoading(true);

    try {
      const response = await ragApi.getChats();
      setChats(response.chats);
      console.log(`[useRag] Loaded ${response.chats.length} chats`);
    } catch (e) {
      console.error('[useRag] Error loading chats:', e);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  const createChat = useCallback(async (title?: string): Promise<RagChat> => {
    try {
      const response = await ragApi.createChat(title);

      // Add to local state
      setChats((prev) => [response.chat, ...prev]);

      console.log(`[useRag] Created chat: ${response.chat.id}`);
      return response.chat;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create chat';
      console.error('[useRag] Error creating chat:', e);
      throw new Error(msg);
    }
  }, []);

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      try {
        await ragApi.deleteChat(id);

        // Remove from local state
        setChats((prev) => prev.filter((c) => c.id !== id));

        // Clear active chat if it was deleted
        if (activeChat?.id === id) {
          setActiveChat(null);
          setActiveChatMessages([]);
        }

        console.log(`[useRag] Deleted chat: ${id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete chat';
        console.error('[useRag] Error deleting chat:', e);
        throw new Error(msg);
      }
    },
    [activeChat]
  );

  // ============================================================================
  // Active Chat Operations
  // ============================================================================

  const loadChat = useCallback(async (id: string) => {
    setActiveChatLoading(true);

    try {
      const response = await ragApi.getChat(id);
      setActiveChat(response.chat);
      setActiveChatMessages(response.messages);
      console.log(`[useRag] Loaded chat with ${response.messages.length} messages`);
    } catch (e) {
      console.error('[useRag] Error loading chat:', e);
      setActiveChat(null);
      setActiveChatMessages([]);
    } finally {
      setActiveChatLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string): Promise<RagMessage> => {
      if (!activeChat) {
        throw new Error('No active chat');
      }

      // Optimistically add user message
      const tempUserMsg: RagMessage = {
        id: `temp_${Date.now()}`,
        chatId: activeChat.id,
        role: 'user',
        content: message,
        sources: null,
        createdAt: new Date().toISOString(),
      };
      setActiveChatMessages((prev) => [...prev, tempUserMsg]);

      // Add loading indicator for assistant
      const tempAssistantMsg: RagMessage = {
        id: `temp_assistant_${Date.now()}`,
        chatId: activeChat.id,
        role: 'assistant',
        content: '...',
        sources: null,
        createdAt: new Date().toISOString(),
      };
      setActiveChatMessages((prev) => [...prev, tempAssistantMsg]);

      try {
        const response = await ragApi.sendMessage(activeChat.id, message);

        // Replace temp messages with actual messages
        setActiveChatMessages((prev) =>
          prev
            .filter((m) => !m.id.startsWith('temp_'))
            .concat([response.userMessage, response.assistantMessage])
        );

        // Update chat in list (for updated_at)
        setChats((prev) =>
          prev.map((c) => (c.id === activeChat.id ? response.chat : c))
        );
        setActiveChat(response.chat);

        console.log(`[useRag] Sent message, received response`);
        return response.assistantMessage;
      } catch (e) {
        // Remove temp messages on error
        setActiveChatMessages((prev) => prev.filter((m) => !m.id.startsWith('temp_')));

        const msg = e instanceof Error ? e.message : 'Failed to send message';
        console.error('[useRag] Error sending message:', e);
        throw new Error(msg);
      }
    },
    [activeChat]
  );

  const startNewChat = useCallback(async (message: string): Promise<RagMessage> => {
    // Optimistically create temp messages
    const tempChatId = `temp_chat_${Date.now()}`;
    const tempUserMsg: RagMessage = {
      id: `temp_user_${Date.now()}`,
      chatId: tempChatId,
      role: 'user',
      content: message,
      sources: null,
      createdAt: new Date().toISOString(),
    };
    const tempAssistantMsg: RagMessage = {
      id: `temp_assistant_${Date.now()}`,
      chatId: tempChatId,
      role: 'assistant',
      content: '...',
      sources: null,
      createdAt: new Date().toISOString(),
    };

    setActiveChatMessages([tempUserMsg, tempAssistantMsg]);

    try {
      const response = await ragApi.startNewChat(message);

      // Set the actual chat and messages
      setActiveChat(response.chat);
      setActiveChatMessages([response.userMessage, response.assistantMessage]);

      // Add to chat list
      setChats((prev) => [response.chat, ...prev]);

      console.log(`[useRag] Started new chat: ${response.chat.id}`);
      return response.assistantMessage;
    } catch (e) {
      // Clear on error
      setActiveChatMessages([]);

      const msg = e instanceof Error ? e.message : 'Failed to start chat';
      console.error('[useRag] Error starting chat:', e);
      throw new Error(msg);
    }
  }, []);

  const clearActiveChat = useCallback(() => {
    setActiveChat(null);
    setActiveChatMessages([]);
  }, []);

  // ============================================================================
  // Initial Load
  // ============================================================================

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Documents
    documents,
    documentsLoading,
    documentsError,
    loadDocuments,
    indexText,
    indexUrl,
    deleteDocument,

    // Storage
    stats,
    config,
    isAvailable,
    loadStorage,

    // Chats
    chats,
    chatsLoading,
    loadChats,
    createChat,
    deleteChat,

    // Active Chat
    activeChat,
    activeChatMessages,
    activeChatLoading,
    loadChat,
    sendMessage,
    startNewChat,
    clearActiveChat,
  };
}

export default useRag;
