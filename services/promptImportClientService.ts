/**
 * Prompt Import Client Service
 *
 * Phase 11f: Frontend API client for importing prompts from URLs and files.
 * Supports multi-strategy parsing with templates and AI fallback.
 */

import { apiRequest, API_BASE } from './apiHelper.ts';
import type {
  PromptImportResult,
  PromptImportTemplate,
  PromptImportLog,
  ImportSourceType,
  ParsingMethod,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ImportFromUrlOptions {
  templateId?: string;
  forceMethod?: ParsingMethod;
  userEmail?: string;
}

export interface ImportFromFileOptions {
  templateId?: string;
  forceMethod?: ParsingMethod;
  userEmail?: string;
}

export interface UrlImportResponse extends PromptImportResult {
  importId: string;
  sourceUrl: string;
  templateUsed?: string;
}

export interface FileImportResponse extends PromptImportResult {
  importId: string;
  filename: string;
  templateUsed?: string;
  pageCount?: number;
}

export interface TemplatesResponse {
  templates: PromptImportTemplate[];
  count: number;
}

export interface LogsResponse {
  logs: PromptImportLog[];
  total: number;
  hasMore: boolean;
}

export interface LogsQueryOptions {
  sourceType?: ImportSourceType;
  parsingMethod?: ParsingMethod;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface ImportStats {
  totalImports: number;
  successfulImports: number;
  byMethod: Record<ParsingMethod, number>;
  bySource: Record<ImportSourceType, number>;
}

// ============================================================================
// Import Operations
// ============================================================================

/**
 * Import a prompt from a URL
 */
export const importFromUrl = async (
  url: string,
  options?: ImportFromUrlOptions
): Promise<UrlImportResponse> => {
  return apiRequest<UrlImportResponse>('/api/prompts/import/url', {
    method: 'POST',
    body: JSON.stringify({
      url,
      ...options,
    }),
  });
};

/**
 * Import a prompt from an uploaded file
 * Uses FormData for multipart upload
 */
export const importFromFile = async (
  file: File,
  options?: ImportFromFileOptions
): Promise<FileImportResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  if (options?.templateId) {
    formData.append('templateId', options.templateId);
  }
  if (options?.forceMethod) {
    formData.append('forceMethod', options.forceMethod);
  }
  if (options?.userEmail) {
    formData.append('userEmail', options.userEmail);
  }

  // Use fetch directly for FormData (no Content-Type header, browser sets it with boundary)
  const response = await fetch(`${API_BASE}/api/prompts/import/file`, {
    method: 'POST',
    body: formData,
  });

  const json = await response.json();

  if (!response.ok) {
    const errorMessage =
      json?.error?.message || json?.error || `Upload failed: ${response.status}`;
    throw new Error(errorMessage);
  }

  // Unwrap standardized response format
  if (json.success && json.data) {
    return json.data as FileImportResponse;
  }

  return json as FileImportResponse;
};

// ============================================================================
// Template Operations
// ============================================================================

/**
 * Get all parsing templates
 */
export const getTemplates = async (
  sourceType?: ImportSourceType,
  limit?: number
): Promise<TemplatesResponse> => {
  const params = new URLSearchParams();
  if (sourceType) params.append('sourceType', sourceType);
  if (limit) params.append('limit', limit.toString());

  const query = params.toString();
  return apiRequest<TemplatesResponse>(`/api/prompts/import/templates${query ? `?${query}` : ''}`);
};

/**
 * Create a new parsing template
 */
export const createTemplate = async (template: {
  name: string;
  sourceType: ImportSourceType;
  sourcePattern: string;
  parsingInstructions?: string;
  fieldPatterns?: PromptImportTemplate['fieldPatterns'];
  createdBy?: string;
}): Promise<PromptImportTemplate> => {
  return apiRequest<PromptImportTemplate>('/api/prompts/import/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  id: string,
  updates: Partial<{
    name: string;
    sourcePattern: string;
    parsingInstructions: string;
    fieldPatterns: PromptImportTemplate['fieldPatterns'];
    isDefault: boolean;
  }>
): Promise<PromptImportTemplate> => {
  return apiRequest<PromptImportTemplate>(`/api/prompts/import/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
};

/**
 * Delete a template
 */
export const deleteTemplate = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/prompts/import/templates/${id}`,
    {
      method: 'DELETE',
    }
  );
};

// ============================================================================
// Log Operations
// ============================================================================

/**
 * Get import history logs
 */
export const getImportLogs = async (options?: LogsQueryOptions): Promise<LogsResponse> => {
  const params = new URLSearchParams();
  if (options?.sourceType) params.append('sourceType', options.sourceType);
  if (options?.parsingMethod) params.append('parsingMethod', options.parsingMethod);
  if (options?.success !== undefined) params.append('success', options.success.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const query = params.toString();
  return apiRequest<LogsResponse>(`/api/prompts/import/logs${query ? `?${query}` : ''}`);
};

/**
 * Get import statistics
 */
export const getImportStats = async (): Promise<ImportStats> => {
  return apiRequest<ImportStats>('/api/prompts/import/stats');
};

export default {
  // Import operations
  importFromUrl,
  importFromFile,
  // Template operations
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // Log operations
  getImportLogs,
  getImportStats,
};
