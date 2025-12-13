/**
 * Subscriber Client Service
 * Frontend API client for managing subscribers and lists via SQLite backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  const url = `${API_BASE}/api/subscribers${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch subscribers');
  }

  return response.json();
};

/**
 * Get a single subscriber by email
 */
export const getSubscriberByEmail = async (email: string): Promise<Subscriber> => {
  const response = await fetch(`${API_BASE}/api/subscribers/${encodeURIComponent(email)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch subscriber');
  }

  return response.json();
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
  const response = await fetch(`${API_BASE}/api/subscribers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscriber)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add subscriber');
  }

  return response.json();
};

/**
 * Update a subscriber
 */
export const updateSubscriber = async (
  email: string,
  updates: Partial<Omit<Subscriber, 'id' | 'email' | 'dateAdded'>>
): Promise<Subscriber> => {
  const response = await fetch(`${API_BASE}/api/subscribers/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update subscriber');
  }

  return response.json();
};

/**
 * Delete (deactivate) a subscriber
 */
export const deleteSubscriber = async (email: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/subscribers/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete subscriber');
  }

  return response.json();
};

/**
 * Bulk import subscribers
 */
export const importSubscribers = async (
  subscribers: Array<{ email: string; name?: string; listId?: string }>
): Promise<{ added: number; skipped: number }> => {
  const response = await fetch(`${API_BASE}/api/subscribers/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscribers })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to import subscribers');
  }

  return response.json();
};

// ======================
// LIST API
// ======================

/**
 * Get all subscriber lists
 */
export const getLists = async (): Promise<ListListResponse> => {
  const response = await fetch(`${API_BASE}/api/lists`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch lists');
  }

  return response.json();
};

/**
 * Get a single list by ID
 */
export const getListById = async (id: string): Promise<SubscriberList> => {
  const response = await fetch(`${API_BASE}/api/lists/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch list');
  }

  return response.json();
};

/**
 * Create a new list
 */
export const createList = async (name: string, description?: string): Promise<SubscriberList> => {
  const response = await fetch(`${API_BASE}/api/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create list');
  }

  return response.json();
};

/**
 * Update a list
 */
export const updateList = async (
  id: string,
  updates: Partial<Omit<SubscriberList, 'id' | 'dateCreated' | 'subscriberCount'>>
): Promise<SubscriberList> => {
  const response = await fetch(`${API_BASE}/api/lists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update list');
  }

  return response.json();
};

/**
 * Delete a list
 */
export const deleteList = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/lists/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete list');
  }

  return response.json();
};

/**
 * Add a subscriber to a list
 */
export const addSubscriberToList = async (email: string, listId: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/lists/${listId}/subscribers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add subscriber to list');
  }

  return response.json();
};

/**
 * Remove a subscriber from a list
 */
export const removeSubscriberFromList = async (email: string, listId: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE}/api/lists/${listId}/subscribers/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove subscriber from list');
  }

  return response.json();
};

/**
 * Get all subscribers in a list
 */
export const getSubscribersByList = async (listId: string): Promise<SubscriberListResponse> => {
  const response = await fetch(`${API_BASE}/api/lists/${listId}/subscribers`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch list subscribers');
  }

  return response.json();
};
