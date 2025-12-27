/**
 * KnowledgeBasePage Component
 *
 * RAG Knowledge Base management with:
 * - Storage overview (documents, size, status)
 * - Document list with upload/delete
 * - Chat interface with full history
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRag } from '../hooks/useRag';
import type { RagDocument, RagChat, RagMessage } from '../types';
import {
  RefreshIcon,
  TrashIcon,
  PlusIcon,
  ChatIcon,
  DocumentIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from '../components/IconComponents';
import { fadeInUp, staggerContainer, staggerItem } from '../utils/animations';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'indexed':
      return { label: 'Indexed', className: 'bg-green-100 text-green-800' };
    case 'pending':
      return { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-100 text-red-800' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-800' };
  }
};

const getSourceBadge = (source: string) => {
  switch (source) {
    case 'manual':
      return { label: 'Manual', className: 'bg-blue-100 text-blue-800' };
    case 'newsletter':
      return { label: 'Newsletter', className: 'bg-purple-100 text-purple-800' };
    case 'url':
      return { label: 'URL', className: 'bg-teal-100 text-teal-800' };
    case 'paste':
      return { label: 'Paste', className: 'bg-orange-100 text-orange-800' };
    default:
      return { label: source, className: 'bg-gray-100 text-gray-800' };
  }
};

// =============================================================================
// STORAGE OVERVIEW COMPONENT
// =============================================================================

const StorageOverview: React.FC<{
  stats: ReturnType<typeof useRag>['stats'];
  isAvailable: boolean;
}> = ({ stats, isAvailable }) => {
  if (!stats) return null;

  const indexedCount = stats.documentsByStatus?.indexed || 0;
  const pendingCount = stats.documentsByStatus?.pending || 0;
  const failedCount = stats.documentsByStatus?.failed || 0;

  return (
    <div className="bg-paper border border-border-subtle p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-h4 text-ink">Storage Overview</h3>
        <span
          className={`px-2 py-1 text-caption ${
            isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {isAvailable ? 'Connected' : 'Unavailable'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-pearl p-4">
          <p className="font-display text-h3 text-ink">{stats.totalDocuments}</p>
          <p className="font-sans text-caption text-slate">Total Documents</p>
        </div>
        <div className="bg-pearl p-4">
          <p className="font-display text-h3 text-ink">{formatBytes(stats.totalSizeBytes)}</p>
          <p className="font-sans text-caption text-slate">Storage Used</p>
        </div>
        <div className="bg-pearl p-4">
          <p className="font-display text-h3 text-green-600">{indexedCount}</p>
          <p className="font-sans text-caption text-slate">Indexed</p>
        </div>
        <div className="bg-pearl p-4">
          <p className="font-display text-h3 text-yellow-600">
            {pendingCount}
            {failedCount > 0 && <span className="text-red-600 ml-1">/ {failedCount}</span>}
          </p>
          <p className="font-sans text-caption text-slate">Pending / Failed</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DOCUMENT ROW COMPONENT
// =============================================================================

const DocumentRow: React.FC<{
  document: RagDocument;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}> = ({ document, onDelete, isDeleting }) => {
  const statusBadge = getStatusBadge(document.status);
  const sourceBadge = getSourceBadge(document.sourceType);

  return (
    <motion.tr variants={staggerItem} className="hover:bg-pearl transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <DocumentIcon className="h-4 w-4 text-slate" />
          <span className="font-sans text-ui text-ink truncate max-w-[200px]" title={document.filename}>
            {document.filename}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 text-caption ${statusBadge.className}`}>{statusBadge.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 text-caption ${sourceBadge.className}`}>{sourceBadge.label}</span>
      </td>
      <td className="px-4 py-3 font-mono text-caption text-slate">{formatBytes(document.sizeBytes)}</td>
      <td className="px-4 py-3 font-mono text-caption text-slate">{formatDate(document.createdAt)}</td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onDelete(document.id)}
          disabled={isDeleting}
          className="p-1 text-slate hover:text-editorial-red transition-colors disabled:opacity-50"
          title="Delete document"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </td>
    </motion.tr>
  );
};

// =============================================================================
// UPLOAD MODAL COMPONENT
// =============================================================================

const UploadModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string, title: string) => Promise<void>;
  isSubmitting: boolean;
}> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    await onSubmit(content, title);
    setTitle('');
    setContent('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-paper border border-border-subtle p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-h4 text-ink">Add to Knowledge Base</h3>
          <button onClick={onClose} className="p-1 text-slate hover:text-ink">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title..."
              className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink"
              required
            />
          </div>

          <div>
            <label className="block font-sans text-caption text-slate uppercase tracking-wider mb-2">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your content here..."
              rows={12}
              className="w-full bg-pearl border border-border-subtle px-3 py-2 font-sans text-ui text-ink focus:outline-none focus:border-ink resize-y"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-sans text-ui text-slate hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="px-4 py-2 bg-ink text-paper font-sans text-ui hover:bg-charcoal transition-colors disabled:bg-silver"
            >
              {isSubmitting ? 'Adding...' : 'Add Document'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// =============================================================================
// CHAT MESSAGE COMPONENT
// =============================================================================

const ChatMessage: React.FC<{ message: RagMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isLoading = message.content === '...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] px-4 py-3 ${
          isUser ? 'bg-ink text-paper' : 'bg-pearl text-ink border border-border-subtle'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-75" />
            <div className="w-2 h-2 bg-current rounded-full animate-pulse delay-150" />
          </div>
        ) : (
          <>
            <p className="font-sans text-ui whitespace-pre-wrap">{message.content}</p>
            {message.sources && message.sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/20">
                <p className="font-sans text-caption opacity-70">Sources:</p>
                <ul className="mt-1 space-y-1">
                  {message.sources.map((source, i) => (
                    <li key={i} className="font-sans text-caption opacity-70">
                      • {source.filename}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

// =============================================================================
// CHAT SIDEBAR COMPONENT
// =============================================================================

const ChatSidebar: React.FC<{
  chats: RagChat[];
  activeChat: RagChat | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}> = ({ chats, activeChat, onSelectChat, onNewChat, onDeleteChat }) => {
  return (
    <div className="w-64 border-r border-border-subtle flex flex-col h-full">
      <div className="p-4 border-b border-border-subtle">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-ink text-paper px-4 py-2 font-sans text-ui hover:bg-charcoal transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.length === 0 ? (
          <p className="text-center font-sans text-caption text-silver py-4">No chats yet</p>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center justify-between p-2 cursor-pointer transition-colors ${
                activeChat?.id === chat.id ? 'bg-pearl' : 'hover:bg-pearl/50'
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChatIcon className="h-4 w-4 text-slate flex-shrink-0" />
                <span className="font-sans text-ui text-ink truncate">{chat.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate hover:text-editorial-red transition-all"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// =============================================================================
// CHAT INTERFACE COMPONENT
// =============================================================================

const ChatInterface: React.FC<{
  messages: RagMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  chatTitle: string;
}> = ({ messages, isLoading, onSendMessage, chatTitle }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput('');
    await onSendMessage(message);
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border-subtle bg-pearl">
        <h4 className="font-sans text-ui text-ink truncate">{chatTitle || 'New Chat'}</h4>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ChatIcon className="h-12 w-12 text-silver mx-auto mb-4" />
              <p className="font-serif text-body text-slate">
                Ask a question about your knowledge base
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 bg-pearl border border-border-subtle px-4 py-2 font-sans text-ui text-ink placeholder:text-silver focus:outline-none focus:border-ink disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 bg-ink text-paper hover:bg-charcoal transition-colors disabled:bg-silver"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

type TabType = 'documents' | 'chat';

export const KnowledgeBasePage: React.FC = () => {
  const rag = useRag();
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Load data on mount
  useEffect(() => {
    rag.loadDocuments();
    rag.loadChats();
  }, []);

  const handleUpload = async (content: string, title: string) => {
    setIsUploading(true);
    try {
      await rag.indexText(content, title);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    setDeletingId(id);
    try {
      await rag.deleteDocument(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectChat = async (id: string) => {
    await rag.loadChat(id);
  };

  const handleNewChat = () => {
    rag.clearActiveChat();
  };

  const handleDeleteChat = async (id: string) => {
    await rag.deleteChat(id);
  };

  const handleSendMessage = async (message: string) => {
    setIsSendingMessage(true);
    try {
      if (rag.activeChat) {
        await rag.sendMessage(message);
      } else {
        await rag.startNewChat(message);
      }
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      {/* Page Header */}
      <header className="border-b-2 border-ink pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-h1 text-ink">Knowledge Base</h1>
            <p className="font-serif text-body text-slate mt-2">
              Store documents and chat with your knowledge base using RAG
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                rag.loadDocuments();
                rag.loadStorage();
              }}
              disabled={rag.documentsLoading}
              className="flex items-center gap-2 border border-border-subtle px-4 py-2 font-sans text-ui text-ink hover:bg-pearl transition-colors disabled:opacity-50"
            >
              <RefreshIcon className={`h-4 w-4 ${rag.documentsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Storage Overview */}
      <StorageOverview stats={rag.stats} isAvailable={rag.isAvailable} />

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-3 font-sans text-ui transition-colors border-b-2 -mb-px ${
            activeTab === 'documents'
              ? 'border-ink text-ink'
              : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          Documents
          <span className="ml-2 text-caption text-silver">({rag.documents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-3 font-sans text-ui transition-colors border-b-2 -mb-px ${
            activeTab === 'chat' ? 'border-ink text-ink' : 'border-transparent text-slate hover:text-ink'
          }`}
        >
          Chat
          <span className="ml-2 text-caption text-silver">({rag.chats.length})</span>
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <>
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <p className="font-sans text-caption text-slate">
              {rag.documents.length} documents in knowledge base
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 bg-ink text-paper px-4 py-2 font-sans text-ui hover:bg-charcoal transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Document
            </button>
          </div>

          {/* Error Message */}
          {rag.documentsError && (
            <div className="bg-red-50 border-l-2 border-editorial-red p-4">
              <p className="font-sans text-ui text-charcoal">{rag.documentsError}</p>
            </div>
          )}

          {/* Loading State */}
          {rag.documentsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-ink border-t-transparent animate-spin" />
            </div>
          )}

          {/* Documents Table */}
          {!rag.documentsLoading && (
            <div className="bg-paper border border-border-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle bg-pearl">
                      <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-4 py-3 text-left font-sans text-caption text-slate uppercase tracking-wider">
                        Added
                      </th>
                      <th className="px-4 py-3 text-center font-sans text-caption text-slate uppercase tracking-wider w-12">

                      </th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-border-subtle"
                  >
                    {rag.documents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center font-serif text-body text-slate">
                          No documents yet. Add content to get started.
                        </td>
                      </tr>
                    ) : (
                      rag.documents.map((doc) => (
                        <DocumentRow
                          key={doc.id}
                          document={doc}
                          onDelete={handleDeleteDocument}
                          isDeleting={deletingId === doc.id}
                        />
                      ))
                    )}
                  </motion.tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="bg-paper border border-border-subtle flex h-[600px]">
          <ChatSidebar
            chats={rag.chats}
            activeChat={rag.activeChat}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
          />
          <ChatInterface
            messages={rag.activeChatMessages}
            isLoading={isSendingMessage || rag.activeChatLoading}
            onSendMessage={handleSendMessage}
            chatTitle={rag.activeChat?.title || 'New Chat'}
          />
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <UploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onSubmit={handleUpload}
            isSubmitting={isUploading}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default KnowledgeBasePage;
