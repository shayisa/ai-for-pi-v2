-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('claude', 'gemini')),
  encrypted_key TEXT NOT NULL,
  key_valid BOOLEAN DEFAULT false,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_email, service)
);

-- Create api_key_audit_log table
CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  service TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_email ON api_keys(user_email);
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON api_key_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON api_key_audit_log(created_at);

-- Enable RLS on api_keys table
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for api_keys (allow service role to access)
CREATE POLICY "Allow service role access" ON api_keys
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on api_key_audit_log
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for audit log (allow service role to insert)
CREATE POLICY "Allow service role insert" ON api_key_audit_log
  FOR INSERT
  WITH CHECK (true);
