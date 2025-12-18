/**
 * Subscriber Client Service
 * Frontend API client for managing subscribers and lists via SQLite backend
 */

import { apiRequest } from './apiHelper.ts';

// Types
export interface Subscriber {
  id?: number;
  email: string;
  name?: string;
  status: 'active' | 'inactive';
  lists: string;
  dateAdded: string;
  dateRemoved?: string;
  source?: string;
}

export interface SubscriberList {
  id: string;
  name: string;
  description?: string;
  dateCreated: string;
  subscriberCount: number;
}

export interface SubscriberListResponse {
  subscribers: Subscriber[];
  count: number;
}

export interface ListListResponse {
  lists: SubscriberList[];
  count: number;
}

// ======================
// SUBSCRIBER API
// ======================

/**
 * Get all subscribers with optional filters
 */
export const getSubscribers = async (filters?: {
  status?: 'active' | 'inactive' | 'all';
  listId?: string;
}): Promise<SubscriberListResponse> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.listId) params.append('listId', filters.listId);

  const queryString = params.toString();
  return apiRequest<SubscriberListResponse>(
    `/api/subscribers${queryString ? '?' + queryString : ''}`
  );
};

/**
 * Get a single subscriber by email
 */
export const getSubscriberByEmail = async (email: string): Promise<Subscriber> => {
  return apiRequest<Subscriber>(`/api/subscribers/${encodeURIComponent(email)}`);
};

/**
 * Add a new subscriber
 */
export const addSubscriber = async (subscriber: {
  email: string;
  name?: string;
  status?: 'active' | 'inactive';
  lists?: string;
  source?: string;
}): Promise<Subscriber> => {
  return apiRequest<Subscriber>('/api/subscribers', {
    method: 'POST',
    body: JSON.stringify(subscriber)
  });
};

/**
 * Update a subscriber
 */
export const updateSubscriber = async (
  email: string,
  updates: Partial<Omit<Subscriber, 'id' | 'email' | 'dateAdded'>>
): Promise<Subscriber> => {
  return apiRequest<Subscriber>(`/api/subscribers/${encodeURIComponent(email)}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

/**
 * Delete (deactivate) a subscriber
 */
export const deleteSubscriber = async (email: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/subscribers/${encodeURIComponent(email)}`,
    { method: 'DELETE' }
  );
};

/**
 * Bulk import subscribers
 */
export const importSubscribers = async (
  subscribers: Array<{ email: string; name?: string; listId?: string }>
): Promise<{ added: number; skipped: number }> => {
  return apiRequest<{ added: number; skipped: number }>('/api/subscribers/import', {
    method: 'POST',
    body: JSON.stringify({ subscribers })
  });
};

// ======================
// LIST API
// ======================

/**
 * Get all subscriber lists
 */
export const getLists = async (): Promise<ListListResponse> => {
  return apiRequest<ListListResponse>('/api/lists');
};

/**
 * Get a single list by ID
 */
export const getListById = async (id: string): Promise<SubscriberList> => {
  return apiRequest<SubscriberList>(`/api/lists/${id}`);
};

/**
 * Create a new list
 */
export const createList = async (name: string, description?: string): Promise<SubscriberList> => {
  return apiRequest<SubscriberList>('/api/lists', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  });
};

/**
 * Update a list
 */
export const updateList = async (
  id: string,
  updates: Partial<Omit<SubscriberList, 'id' | 'dateCreated' | 'subscriberCount'>>
): Promise<SubscriberList> => {
  return apiRequest<SubscriberList>(`/api/lists/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

/**
 * Delete a list
 */
export const deleteList = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/lists/${id}`, {
    method: 'DELETE'
  });
};

/**
 * Add a subscriber to a list
 */
export const addSubscriberToList = async (email: string, listId: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(`/api/lists/${listId}/subscribers`, {
    method: 'POST',
    body: JSON.stringify({ email })
  });
};

/**
 * Remove a subscriber from a list
 */
export const removeSubscriberFromList = async (email: string, listId: string): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/lists/${listId}/subscribers/${encodeURIComponent(email)}`,
    { method: 'DELETE' }
  );
};

/**
 * Get all subscribers in a list
 */
export const getSubscribersByList = async (listId: string): Promise<SubscriberListResponse> => {
  return apiRequest<SubscriberListResponse>(`/api/lists/${listId}/subscribers`);
};
