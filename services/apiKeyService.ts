/**
 * API Key Service
 * Handles API key management via local backend endpoints
 */

// Supported service types for API keys
export type ServiceType = 'claude' | 'stability' | 'brave' | 'google_api_key' | 'google_client_id';

export interface ApiKeyCredentials {
  service: ServiceType;
  key: string;
}

export interface StoredApiKey {
  service: ServiceType;
  isValid: boolean;
  lastValidated: string | null;
}

const API_BASE = 'http://localhost:3001';

/**
 * Save API key to backend
 */
export const saveApiKey = async (credentials: ApiKeyCredentials, userEmail: string): Promise<boolean> => {
  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const response = await fetch(`${API_BASE}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail,
        service: credentials.service,
        key: credentials.key
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error saving API key:', error);
      return false;
    }

    console.log(`API key for ${credentials.service} saved successfully`);
    return true;
  } catch (error) {
    console.error('Error in saveApiKey:', error);
    throw error;
  }
};

/**
 * Check if API key exists for a service
 */
export const hasApiKey = async (service: ServiceType, userEmail: string): Promise<boolean> => {
  if (!userEmail) {
    return false;
  }

  try {
    const statuses = await listApiKeyStatuses(userEmail);
    return statuses.some(s => s.service === service);
  } catch (error) {
    console.error('Error checking API key:', error);
    return false;
  }
};

/**
 * Delete API key
 */
export const deleteApiKey = async (service: ServiceType, userEmail: string): Promise<boolean> => {
  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const response = await fetch(`${API_BASE}/api/keys/${service}?userEmail=${encodeURIComponent(userEmail)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error deleting API key:', error);
      return false;
    }

    console.log(`API key for ${service} deleted successfully`);
    return true;
  } catch (error) {
    console.error('Error in deleteApiKey:', error);
    throw error;
  }
};

/**
 * Get API key status
 */
export const getApiKeyStatus = async (service: ServiceType, userEmail: string): Promise<StoredApiKey | null> => {
  if (!userEmail) {
    return null;
  }

  try {
    const statuses = await listApiKeyStatuses(userEmail);
    return statuses.find(s => s.service === service) || null;
  } catch (error) {
    console.error('Error getting API key status:', error);
    return null;
  }
};

/**
 * List all API key statuses (without exposing actual keys)
 */
export const listApiKeyStatuses = async (userEmail: string): Promise<StoredApiKey[]> => {
  if (!userEmail) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/api/keys?userEmail=${encodeURIComponent(userEmail)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Error retrieving API key statuses: HTTP', response.status);
      return [];
    }

    const data = await response.json();
    return data.statuses || [];
  } catch (error) {
    console.error('Error listing API key statuses:', error);
    return [];
  }
};

/**
 * Validate API key (calls backend to test the key)
 */
export const validateApiKey = async (service: ServiceType, userEmail: string): Promise<boolean> => {
  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const response = await fetch(`${API_BASE}/api/keys/${service}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail })
    });

    if (!response.ok) {
      console.error('Error validating API key: HTTP', response.status);
      return false;
    }

    const data = await response.json();
    return data.isValid || false;
  } catch (error) {
    console.error('Error in validateApiKey:', error);
    throw error;
  }
};
