/**
 * Credential Loader Service
 * Fetches API keys from SQLite for backend use
 * Falls back to environment variables if not found in database
 */

import * as apiKeyDbService from './apiKeyDbService.ts';

// Types for supported services
export type ServiceType = 'claude' | 'stability' | 'brave' | 'google_api_key' | 'google_client_id';

interface CredentialCache {
  [key: string]: {
    value: string;
    cachedAt: number;
    ttl: number;
  };
}

// Cache credentials for 5 minutes to reduce database calls
const CACHE_TTL = 5 * 60 * 1000;
const credentialCache: CredentialCache = {};

/**
 * Get a cached credential if still valid
 */
const getCachedCredential = (cacheKey: string): string | null => {
  const cached = credentialCache[cacheKey];
  if (cached && Date.now() - cached.cachedAt < cached.ttl) {
    return cached.value;
  }
  return null;
};

/**
 * Cache a credential value
 */
const cacheCredential = (cacheKey: string, value: string): void => {
  credentialCache[cacheKey] = {
    value,
    cachedAt: Date.now(),
    ttl: CACHE_TTL
  };
};

/**
 * Get API key for a service from SQLite
 * Falls back to environment variables if not found
 */
export const getApiKey = (service: ServiceType, userEmail?: string): string | null => {
  // Check cache first
  const cacheKey = `${service}:${userEmail || 'default'}`;
  const cached = getCachedCredential(cacheKey);
  if (cached) {
    return cached;
  }

  // Map service names to environment variable names
  const envVarMap: Record<ServiceType, string> = {
    'claude': 'VITE_ANTHROPIC_API_KEY',
    'stability': 'VITE_STABILITY_API_KEY',
    'brave': 'VITE_BRAVE_SEARCH_API_KEY',
    'google_api_key': 'GOOGLE_API_KEY',
    'google_client_id': 'GOOGLE_CLIENT_ID'
  };

  // Try to get from SQLite if userEmail provided
  if (userEmail) {
    try {
      const dbKey = apiKeyDbService.getApiKey(userEmail, service);
      if (dbKey) {
        cacheCredential(cacheKey, dbKey);
        return dbKey;
      }
    } catch (error) {
      console.error(`[CredentialLoader] Error fetching ${service} key from SQLite:`, error);
    }
  }

  // Fall back to environment variables
  const envVar = envVarMap[service];
  const envValue = process.env[envVar];

  if (envValue) {
    cacheCredential(cacheKey, envValue);
    return envValue;
  }

  console.warn(`[CredentialLoader] No API key found for ${service}`);
  return null;
};

/**
 * Get all required API keys for a user
 */
export const getAllApiKeys = (userEmail?: string): Record<ServiceType, string | null> => {
  const services: ServiceType[] = ['claude', 'stability', 'brave', 'google_api_key', 'google_client_id'];

  const keys: Record<ServiceType, string | null> = {
    claude: null,
    stability: null,
    brave: null,
    google_api_key: null,
    google_client_id: null
  };

  services.forEach(service => {
    keys[service] = getApiKey(service, userEmail);
  });

  return keys;
};

/**
 * Check if all required services have API keys configured
 */
export const checkRequiredKeys = (userEmail?: string): { isComplete: boolean; missing: ServiceType[] } => {
  const required: ServiceType[] = ['claude', 'stability'];
  const missing: ServiceType[] = [];

  for (const service of required) {
    const key = getApiKey(service, userEmail);
    if (!key) {
      missing.push(service);
    }
  }

  return {
    isComplete: missing.length === 0,
    missing
  };
};

/**
 * Clear credential cache (useful after key updates)
 */
export const clearCredentialCache = (): void => {
  Object.keys(credentialCache).forEach(key => delete credentialCache[key]);
  console.log('[CredentialLoader] Cache cleared');
};

/**
 * Get admin email from environment
 */
export const getAdminEmail = (): string | null => {
  return process.env.ADMIN_EMAIL || null;
};
