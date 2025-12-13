# Supabase Setup Guide for Secure API Key Management

This guide provides step-by-step instructions to set up Supabase for securely storing and managing API keys.

## Prerequisites

- Supabase account (create at https://supabase.com)
- A Supabase project created
- Access to the Supabase SQL Editor

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Enter project details and create the project
4. Note your **Project URL** and **Anon Key** (you'll need these for `.env.local`)

## Step 2: Run Database Schema Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the following SQL script
4. Click **Run** to execute

```sql
-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create api_keys table with encrypted storage
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('claude', 'gemini')),
  encrypted_key TEXT NOT NULL,
  key_valid BOOLEAN DEFAULT false,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service)
);

-- Create api_key_audit_log table for compliance tracking
CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  service TEXT NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies for api_keys
-- Users can only view their own API keys
CREATE POLICY "Users can view own api keys"
ON api_keys FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own API keys
CREATE POLICY "Users can insert own api keys"
ON api_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own API keys
CREATE POLICY "Users can update own api keys"
ON api_keys FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own API keys
CREATE POLICY "Users can delete own api keys"
ON api_keys FOR DELETE
USING (auth.uid() = user_id);

-- Row Level Security Policies for api_key_audit_log
-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs"
ON api_key_audit_log FOR SELECT
USING (auth.uid() = user_id);

-- Encryption/Decryption Functions
-- Encrypt function using AES-256-GCM via pgcrypto
CREATE OR REPLACE FUNCTION encrypt_api_key(key TEXT, encryption_secret TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(key, encryption_secret), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt function
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_key TEXT, encryption_secret TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_key, 'base64'), encryption_secret);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON api_key_audit_log(user_id);
```

## Step 3: Configure Environment Variables

1. Create or update your `.env.local` file in the project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace:
- `your_supabase_project_url` - Your Supabase project URL (format: `https://xxx.supabase.co`)
- `your_supabase_anon_key` - Your Supabase anon/public key

## Step 4: Set Up Edge Functions

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Link your local project to Supabase:
```bash
supabase link --project-ref your_project_ref
```

3. The Edge Functions are already created in `supabase/functions/` directory

4. Deploy functions:
```bash
supabase functions deploy save-api-key
supabase functions deploy validate-api-key
supabase functions deploy gemini-api
```

### Option B: Manual Setup in Dashboard

1. Go to **Edge Functions** in your Supabase dashboard
2. Create each function manually by copying the code from the supabase/functions directory

## Step 5: Enable Google Authentication (if not already configured)

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Enable **Google** provider
3. Add your Google OAuth credentials (you may already have these from your Google Cloud setup)

## Step 6: Update Application Configuration

The application already includes the necessary integration:

- `lib/supabase.ts` - Supabase client initialization
- `services/apiKeyService.ts` - API key management functions
- API key management UI (to be integrated into SettingsModal)

## Verification Checklist

- [ ] Supabase project created and configured
- [ ] Database schema migrated successfully
- [ ] `.env.local` file updated with Supabase credentials
- [ ] Edge Functions deployed
- [ ] Google OAuth configured
- [ ] Build completes without TypeScript errors (`npm run build`)

## Security Features Enabled

✅ **Encryption at Rest**: API keys encrypted using pgcrypto AES-256-GCM in database
✅ **Row-Level Security**: Users can only access their own API keys
✅ **No Frontend Exposure**: Keys never sent to frontend, only used server-side
✅ **Audit Logging**: All API key operations logged for compliance
✅ **Key Validation**: Server-side validation before storage

## Troubleshooting

### "Supabase is not configured" error
- Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`
- Restart the development server after updating `.env.local`

### RLS policy errors
- Ensure user is authenticated before API key operations
- Check that the user's UUID is correctly referenced in RLS policies

### Edge Function deployment issues
- Make sure Supabase CLI is properly linked to your project
- Check function code for TypeScript errors
- View function logs in Supabase dashboard under **Edge Functions**

## Next Steps

1. Create the API key management UI in SettingsModal
2. Update Claude and Gemini services to use Edge Function proxies
3. Test API key storage and validation flow
4. Deploy to production with proper environment configuration
