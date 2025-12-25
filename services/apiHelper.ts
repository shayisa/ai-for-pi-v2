/**
 * API Helper
 * Utility functions for client services to handle standardized API responses
 *
 * Phase 15: Added ApiError class to preserve validation details
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Phase 15: Custom API error that preserves validation details
 */
export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  validationResults?: Array<{
    topic: string;
    isValid: boolean;
    confidence: string;
    suggestedAlternative?: string;
    error?: string;
  }>;
  invalidTopics?: string[];
  suggestions?: string[];

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;

    // Phase 15: Extract validation details if present
    if (details) {
      this.validationResults = details.validationResults as typeof this.validationResults;
      this.invalidTopics = details.invalidTopics as string[];
      this.suggestions = details.suggestions as string[];
    }
  }
}

/**
 * Standard API response format from the Control Plane
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  correlationId?: string;
  timestamp?: string;
}

/**
 * Unwrap data from standardized API response
 * Handles both wrapped { success, data } and legacy direct responses
 */
export function unwrapResponse<T>(json: ApiResponse<T> | T): T {
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as ApiResponse<T>).data as T;
  }
  return json as T;
}

/**
 * Extract error message from API error response
 */
export function extractErrorMessage(json: unknown, fallback: string): string {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    // Try error.message first (new format)
    if (obj.error && typeof obj.error === 'object') {
      const error = obj.error as Record<string, unknown>;
      if (typeof error.message === 'string') return error.message;
    }
    // Try error directly (legacy format)
    if (typeof obj.error === 'string') return obj.error;
  }
  return fallback;
}

/**
 * Make API request with standardized error handling and response unwrapping
 * Phase 15: Now throws ApiError to preserve validation details
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    // Phase 15: Throw ApiError with validation details preserved
    const message = extractErrorMessage(json, `Request failed: ${response.status}`);
    const errorObj = json?.error as Record<string, unknown> | undefined;
    const code = (errorObj?.code as string) || 'UNKNOWN_ERROR';
    const details = errorObj?.details as Record<string, unknown> | undefined;
    throw new ApiError(message, code, details);
  }

  return unwrapResponse<T>(json);
}

export { API_BASE };
