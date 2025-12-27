/**
 * Sent History Client Service
 * Frontend API client for sent newsletter history
 *
 * Phase 18: Enhanced Send Email with Recipient Selection & Sent History
 */

import { apiRequest } from './apiHelper.ts';

// Types (mirroring backend)
export interface SentHistoryItem {
  id: string;
  newsletterId: string;
  sentAt: string;
  subject: string;
  topics: string[];
  listNames: string[];
  listIds: string[];
  recipientCount: number;
  recipientEmails?: string[];
  stats: {
    totalSent: number;
    uniqueOpens: number;
    uniqueClicks: number;
    openRate: number;
    clickRate: number;
  } | null;
  newsletterContent?: Record<string, unknown>;
}

export interface SentHistoryOptions {
  limit?: number;
  offset?: number;
  listId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SentHistoryResponse {
  items: SentHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SentHistoryStats {
  totalSent: number;
  totalEmails: number;
  averageOpenRate: number;
  averageClickRate: number;
}

/**
 * Get sent newsletter history with pagination and filters
 */
export const getSentHistory = async (options: SentHistoryOptions = {}): Promise<SentHistoryResponse> => {
  const params = new URLSearchParams();

  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.listId) params.append('listId', options.listId);
  if (options.dateFrom) params.append('dateFrom', options.dateFrom);
  if (options.dateTo) params.append('dateTo', options.dateTo);

  const queryString = params.toString();
  return apiRequest<SentHistoryResponse>(
    `/api/sent-history${queryString ? '?' + queryString : ''}`
  );
};

/**
 * Get detailed sent history for a specific newsletter
 * Includes full newsletter content for preview
 */
export const getSentHistoryDetail = async (newsletterId: string): Promise<SentHistoryItem> => {
  return apiRequest<SentHistoryItem>(`/api/sent-history/${newsletterId}`);
};

/**
 * Get summary statistics for sent newsletters
 */
export const getSentHistoryStats = async (): Promise<SentHistoryStats> => {
  return apiRequest<SentHistoryStats>('/api/sent-history/stats');
};
