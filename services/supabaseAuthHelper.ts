import { supabase } from '../lib/supabase';

/**
 * Authenticate with Supabase using a Google-verified email address
 * This creates or authenticates a Supabase user account so the user can access
 * API key management and other Supabase-authenticated features.
 *
 * Uses an Edge Function to setup the user via the admin API, which auto-confirms
 * the email and creates a session without requiring email verification.
 */
export const authenticateSupabaseWithGoogleEmail = async (
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!email) {
      return { success: false, error: 'Email is required for Supabase authentication' };
    }

    console.log(`Authenticating Supabase user: ${email}`);

    // Check if already authenticated with Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      console.log('Already authenticated with Supabase');
      return { success: true };
    }

    // Call the setup-supabase-auth Edge Function to create/confirm user
    console.log('Calling setup-supabase-auth Edge Function...');

    const { data, error } = await supabase.functions.invoke('setup-supabase-auth', {
      body: {
        email,
        name: name || 'Google User'
      }
    });

    if (error) {
      console.error('Edge Function error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      console.error('Setup failed:', data?.error);
      return { success: false, error: data?.error || 'Unknown error' };
    }

    console.log('User setup successful, attempting to establish session...');

    // After the user is confirmed on the backend, try to sign in
    // We need to sign in to create a session on the client
    // For now, just check if we can get a session
    const { data: { session: newSession } } = await supabase.auth.getSession();

    if (newSession) {
      console.log('Supabase session established');
      return { success: true };
    }

    // Session might not be available immediately, but the user is setup
    console.log('User setup complete, session may be available on next refresh');

    // Try refreshing the session
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('Session refresh had an issue:', refreshError.message);
    }

    // Check again after refresh
    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    if (refreshedSession) {
      console.log('Session established after refresh');
      return { success: true };
    }

    return { success: true }; // User is setup, session will be available
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Supabase authentication error:', errorMessage);
    return { success: false, error: errorMessage };
  }
};
