-- Add missing columns to api_keys table
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS encrypted_key TEXT;
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS key_valid BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns to api_key_audit_log
ALTER TABLE IF EXISTS api_key_audit_log ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE IF EXISTS api_key_audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE IF EXISTS api_key_audit_log ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE IF EXISTS api_key_audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE IF EXISTS api_key_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_email ON api_keys(user_email);
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON api_key_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON api_key_audit_log(created_at);
