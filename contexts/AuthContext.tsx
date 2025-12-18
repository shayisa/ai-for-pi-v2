/**
 * AuthContext - Authentication state management
 *
 * Phase 6a: Extracted from App.tsx
 *
 * Handles:
 * - Google OAuth authentication state
 * - OAuth callback processing from URL params
 * - Sign in/out actions
 * - Google API initialization
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { GapiAuthData } from '../types';
import * as googleApi from '../services/googleApiService';
import { loadGoogleCredentialsFromBackend, checkGoogleAuthStatus } from '../services/googleApiService';

// Default admin email (consistent with original App.tsx)
const DEFAULT_EMAIL = 'shayisa@gmail.com';

interface AuthState {
  authData: GapiAuthData | null;
  isGoogleApiInitialized: boolean;
  isLoading: boolean;
}

interface AuthActions {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setAuthData: (data: GapiAuthData | null) => void;
  setIsGoogleApiInitialized: (initialized: boolean) => void;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authData, setAuthData] = useState<GapiAuthData | null>(null);
  const [isGoogleApiInitialized, setIsGoogleApiInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Sign in with Google OAuth
   * Redirects user to Google consent screen
   */
  const signIn = useCallback(async () => {
    try {
      const email = authData?.email || DEFAULT_EMAIL;
      await googleApi.signIn(email);
      // User will be redirected to Google consent screen
      // On return, OAuth callback in useEffect will handle the rest
    } catch (error) {
      console.error('[AuthContext] Error signing in:', error);
      throw error;
    }
  }, [authData?.email]);

  /**
   * Sign out from Google
   */
  const signOut = useCallback(async () => {
    try {
      const userEmail = authData?.email || DEFAULT_EMAIL;
      await googleApi.signOut(userEmail);
      setAuthData(null);
    } catch (error) {
      console.error('[AuthContext] Error signing out:', error);
      throw error;
    }
  }, [authData?.email]);

  /**
   * Initialize Google API and handle OAuth callback
   * CRITICAL: This preserves the exact OAuth callback handling from App.tsx
   */
  useEffect(() => {
    const initGoogleApi = async () => {
      setIsLoading(true);

      // Check for OAuth callback parameters in URL
      const urlParams = new URLSearchParams(window.location.search);
      const oauthSuccess = urlParams.get('oauth_success');
      const oauthError = urlParams.get('oauth_error');
      const oauthEmail = urlParams.get('email');

      // Clear URL parameters after reading
      if (oauthSuccess || oauthError) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (oauthError) {
        console.error('[AuthContext] OAuth error:', oauthError);
        alert(`Google sign-in failed: ${oauthError}`);
        setIsLoading(false);
        return;
      }

      if (oauthSuccess && oauthEmail) {
        console.log('[AuthContext] OAuth successful for:', oauthEmail);
        // Tokens are already stored in backend, check auth status
        const status = await checkGoogleAuthStatus(oauthEmail);
        if (status.authenticated && status.userInfo) {
          setAuthData({
            access_token: 'backend-managed',
            email: status.userInfo.email,
            name: status.userInfo.name,
          });
          setIsGoogleApiInitialized(true);
          setIsLoading(false);
          return;
        }
      }

      // Try to load credentials from backend
      await loadGoogleCredentialsFromBackend(DEFAULT_EMAIL);

      // Initialize Google API client with user email
      googleApi.initClient(
        (data) => {
          setAuthData(data);
        },
        () => {
          setIsGoogleApiInitialized(true);
          setIsLoading(false);
          console.log('[AuthContext] Google API initialized');
        },
        DEFAULT_EMAIL
      );
    };

    initGoogleApi();
  }, []);

  const value: AuthContextValue = {
    // State
    authData,
    isGoogleApiInitialized,
    isLoading,
    // Actions
    signIn,
    signOut,
    setAuthData,
    setIsGoogleApiInitialized,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to access auth context
 * Throws error if used outside AuthProvider
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  const { authData } = useAuth();
  return !!authData?.access_token;
};

export default AuthContext;
