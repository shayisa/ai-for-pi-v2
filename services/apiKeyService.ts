import { getSupabaseClient, isSupabaseReady, ApiKey } from '../lib/supabase';

/**
 * API Key Service
 * Handles secure storage and retrieval of API keys using Supabase
 * Keys are encrypted at rest using pgcrypto in the database
 * Uses email-based identification instead of Supabase auth
 */

export interface ApiKeyCredentials {
  service: 'claude' | 'gemini' | 'stability';
  key: string;
}

export interface StoredApiKey {
  service: 'claude' | 'gemini' | 'stability';
  isValid: boolean;
  lastValidated: string | null;
}

/**
 * Save API key to Supabase (encrypted at database level)
 * Uses email-based identification
 */
export const saveApiKey = async (credentials: ApiKeyCredentials, userEmail: string): Promise<boolean> => {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured');
  }

  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const supabase = getSupabaseClient();
    const supabaseUrl = (supabase as any).supabaseUrl;

    // Call the Edge Function directly using fetch to bypass auth requirements
    const response = await fetch(`${supabaseUrl}/functions/v1/save-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: credentials.service,
        key: credentials.key,
        userEmail: userEmail
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error saving API key:', error);
      return false;
    }

    const data = await response.json();
    console.log(`API key for ${credentials.service} saved successfully`);
    return true;
  } catch (error) {
    console.error('Error in saveApiKey:', error);
    throw error;
  }
};

/**
 * Retrieve stored API key (server-side only, for Edge Functions use)
 * Frontend should never directly retrieve decrypted keys
 * Uses email-based identification
 */
export const getApiKey = async (service: 'claude' | 'gemini', userEmail: string): Promise<string | null> => {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured');
  }

  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const supabase = getSupabaseClient();

    // This should only be called server-side through Edge Functions
    // Direct client-side calls will fail due to RLS policies
    const { data, error } = await supabase
      .from('api_keys')
      .select('encrypted_key')
      .eq('service', service)
      .eq('user_email', userEmail)
      .single();

    if (error) {
      console.error('Error retrieving API key:', error);
      return null;
    }

    // In production, this should only be called server-side
    // The encrypted_key needs to be decrypted by the Edge Function
    return data?.encrypted_key || null;
  } catch (error) {
    console.error('Error in getApiKey:', error);
    throw error;
  }
};

/**
 * Check if API key exists for a service
 */
export const hasApiKey = async (service: 'claude' | 'gemini' | 'stability', userEmail: string): Promise<boolean> => {
  if (!isSupabaseReady()) {
    return false;
  }

  if (!userEmail) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('api_keys')
      .select('id')
      .eq('service', service)
      .eq('user_email', userEmail)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking API key:', error);
    return false;
  }
};

/**
 * Delete API key
 */
export const deleteApiKey = async (service: 'claude' | 'gemini' | 'stability', userEmail: string): Promise<boolean> => {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured');
  }

  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('service', service)
      .eq('user_email', userEmail);

    if (error) {
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
export const getApiKeyStatus = async (service: 'claude' | 'gemini' | 'stability', userEmail: string): Promise<StoredApiKey | null> => {
  if (!isSupabaseReady()) {
    return null;
  }

  if (!userEmail) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('api_keys')
      .select('key_valid, last_validated_at')
      .eq('service', service)
      .eq('user_email', userEmail)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      service,
      isValid: data.key_valid || false,
      lastValidated: data.last_validated_at
    };
  } catch (error) {
    console.error('Error getting API key status:', error);
    return null;
  }
};

/**
 * List all API key statuses (without exposing actual keys)
 */
export const listApiKeyStatuses = async (userEmail: string): Promise<StoredApiKey[]> => {
  if (!isSupabaseReady()) {
    return [];
  }

  if (!userEmail) {
    return [];
  }

  try {
    const supabase = getSupabaseClient();
    const supabaseUrl = (supabase as any).supabaseUrl;

    // Call the Edge Function to retrieve API key statuses
    const response = await fetch(`${supabaseUrl}/functions/v1/get-api-key-statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail })
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
 * Validate API key (calls Edge Function to test the key)
 */
export const validateApiKey = async (service: 'claude' | 'gemini' | 'stability', userEmail: string): Promise<boolean> => {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured');
  }

  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const supabase = getSupabaseClient();
    const supabaseUrl = (supabase as any).supabaseUrl;

    // Call the Edge Function directly using fetch to bypass auth requirements
    const response = await fetch(`${supabaseUrl}/functions/v1/validate-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ service, userEmail })
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
