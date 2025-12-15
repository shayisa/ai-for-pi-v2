/**
 * Google OAuth Service
 * Handles Authorization Code flow for Google APIs
 */

import db from '../db/init.ts';
import { getApiKey } from './apiKeyDbService.ts';

// OAuth Configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Scopes needed for Drive and Gmail
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

// Types
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: Date;
  scope: string;
}

interface DbOAuthTokenRow {
  id: number;
  user_email: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Get the redirect URI based on environment
 */
export const getRedirectUri = (): string => {
  return process.env.OAUTH_REDIRECT_URI || 'http://localhost:3001/api/oauth/google/callback';
};

/**
 * Generate authorization URL for OAuth consent screen
 */
export const getAuthorizationUrl = (userEmail: string): string | null => {
  const clientId = getApiKey(userEmail, 'google_client_id');

  if (!clientId) {
    console.error('[OAuth] Missing client ID for user:', userEmail);
    return null;
  }

  // Encode state with user email for CSRF protection
  const state = Buffer.from(JSON.stringify({ userEmail, timestamp: Date.now() })).toString('base64');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });

  const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  console.log('[OAuth] Generated authorization URL for:', userEmail);
  console.log('[OAuth] Using client_id:', clientId);
  console.log('[OAuth] Full URL:', url);
  return url;
};

/**
 * Parse state parameter from callback
 */
export const parseState = (state: string): { userEmail: string; timestamp: number } | null => {
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[OAuth] Failed to parse state:', error);
    return null;
  }
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (
  code: string,
  userEmail: string
): Promise<OAuthTokens | null> => {
  const clientId = getApiKey(userEmail, 'google_client_id');
  const clientSecret = getApiKey(userEmail, 'google_client_secret');

  if (!clientId || !clientSecret) {
    console.error('[OAuth] Missing client credentials for user:', userEmail);
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OAuth] Token exchange failed:', error);
      return null;
    }

    const data: GoogleTokenResponse = await response.json();

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };

    // Save tokens to database
    saveTokens(userEmail, tokens);
    console.log('[OAuth] Tokens saved for user:', userEmail);

    return tokens;
  } catch (error) {
    console.error('[OAuth] Token exchange error:', error);
    return null;
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (userEmail: string): Promise<OAuthTokens | null> => {
  const existingTokens = getTokens(userEmail);
  if (!existingTokens?.refreshToken) {
    console.error('[OAuth] No refresh token available for:', userEmail);
    return null;
  }

  const clientId = getApiKey(userEmail, 'google_client_id');
  const clientSecret = getApiKey(userEmail, 'google_client_secret');

  if (!clientId || !clientSecret) {
    console.error('[OAuth] Missing client credentials for refresh');
    return null;
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: existingTokens.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OAuth] Token refresh failed:', error);
      // Delete invalid tokens
      deleteTokens(userEmail);
      return null;
    }

    const data: GoogleTokenResponse = await response.json();

    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: existingTokens.refreshToken, // Refresh token doesn't change
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };

    // Update tokens in database
    saveTokens(userEmail, tokens);
    console.log('[OAuth] Tokens refreshed for user:', userEmail);

    return tokens;
  } catch (error) {
    console.error('[OAuth] Token refresh error:', error);
    return null;
  }
};

/**
 * Get valid access token (auto-refresh if expired)
 */
export const getValidAccessToken = async (userEmail: string): Promise<string | null> => {
  const tokens = getTokens(userEmail);

  if (!tokens) {
    console.log('[OAuth] No tokens found for:', userEmail);
    return null;
  }

  // Check if token is expired or will expire in next 5 minutes
  const expirationBuffer = 5 * 60 * 1000; // 5 minutes
  const isExpired = new Date(tokens.expiresAt).getTime() - expirationBuffer < Date.now();

  if (isExpired) {
    console.log('[OAuth] Token expired, refreshing for:', userEmail);
    const refreshedTokens = await refreshAccessToken(userEmail);
    return refreshedTokens?.accessToken || null;
  }

  return tokens.accessToken;
};

/**
 * Revoke tokens and delete from database
 */
export const revokeTokens = async (userEmail: string): Promise<boolean> => {
  const tokens = getTokens(userEmail);

  if (!tokens) {
    return true; // Already revoked
  }

  try {
    // Revoke the token with Google
    const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${tokens.accessToken}`, {
      method: 'POST',
    });

    // Delete from database regardless of revoke result
    deleteTokens(userEmail);
    console.log('[OAuth] Tokens revoked for user:', userEmail);

    return response.ok;
  } catch (error) {
    console.error('[OAuth] Token revoke error:', error);
    // Still delete local tokens
    deleteTokens(userEmail);
    return false;
  }
};

/**
 * Check if user has valid tokens
 */
export const hasValidTokens = (userEmail: string): boolean => {
  const tokens = getTokens(userEmail);
  if (!tokens) return false;

  // Check if tokens are not expired
  return new Date(tokens.expiresAt).getTime() > Date.now();
};

/**
 * Get user info from Google
 */
export const getUserInfo = async (userEmail: string): Promise<{
  email: string;
  name: string;
  picture: string;
} | null> => {
  const accessToken = await getValidAccessToken(userEmail);
  if (!accessToken) return null;

  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch (error) {
    console.error('[OAuth] Failed to get user info:', error);
    return null;
  }
};

// ============== Database Operations ==============

/**
 * Save tokens to database
 */
const saveTokens = (userEmail: string, tokens: OAuthTokens): void => {
  const stmt = db.prepare(`
    INSERT INTO oauth_tokens (user_email, access_token, refresh_token, token_type, expires_at, scope, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_email)
    DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
      token_type = excluded.token_type,
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      updated_at = datetime('now')
  `);

  stmt.run(
    userEmail,
    tokens.accessToken,
    tokens.refreshToken,
    tokens.tokenType,
    tokens.expiresAt.toISOString(),
    tokens.scope
  );
};

/**
 * Get tokens from database
 */
const getTokens = (userEmail: string): OAuthTokens | null => {
  const stmt = db.prepare(`
    SELECT * FROM oauth_tokens WHERE user_email = ?
  `);

  const row = stmt.get(userEmail) as DbOAuthTokenRow | undefined;
  if (!row) return null;

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenType: row.token_type,
    expiresAt: new Date(row.expires_at),
    scope: row.scope || '',
  };
};

/**
 * Delete tokens from database
 */
const deleteTokens = (userEmail: string): void => {
  const stmt = db.prepare(`
    DELETE FROM oauth_tokens WHERE user_email = ?
  `);

  stmt.run(userEmail);
  console.log('[OAuth] Tokens deleted for user:', userEmail);
};
