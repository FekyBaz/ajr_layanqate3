-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع - Rate Limits Table
-- Used for serverless rate limiting (Netlify Functions)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this migration in your Supabase SQL Editor

-- Create rate_limits table for tracking request counts
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_hash_created 
ON rate_limits (ip_hash, created_at DESC);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role full access" ON rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Cleanup function: Remove old records (optional - run periodically)
-- ═══════════════════════════════════════════════════════════════════════════
-- DELETE FROM rate_limits WHERE created_at < now() - interval '48 hours';

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify table was created
-- ═══════════════════════════════════════════════════════════════════════════
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'rate_limits';
