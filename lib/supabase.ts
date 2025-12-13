import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const IS_SUPABASE_CONFIGURED = !!supabaseUrl && !!supabaseAnonKey;

// Create Supabase client
let supabase: SupabaseClient | null = null;

if (IS_SUPABASE_CONFIGURED) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}

export { supabase };

// Database Types
export interface ApiKey {
  id: string;
  user_id: string;
  service: 'claude' | 'gemini';
  encrypted_key: string;
  key_valid: boolean;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyAuditLog {
  id: string;
  user_id: string;
  action: string;
  service: string;
  ip_address: string | null;
  created_at: string;
}

// Helper functions
export const isSupabaseReady = (): boolean => {
  return IS_SUPABASE_CONFIGURED && supabase !== null;
};

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.');
  }
  return supabase;
};
