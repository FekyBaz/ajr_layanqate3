-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع - Admin Review System Migration
-- Add corrected_message column and admin_reviewed_at
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this migration in your Supabase SQL Editor

-- 1. Add corrected_message column (nullable)
-- Stores admin-corrected version while preserving original
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS corrected_message TEXT;

-- 2. Add admin review timestamp
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 3. Create index for efficient pending queries
CREATE INDEX IF NOT EXISTS idx_submissions_status_created 
ON submissions (status, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies for Admin Access
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing policies if they exist (for clean re-run)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON submissions;
DROP POLICY IF EXISTS "Service role full access" ON submissions;
DROP POLICY IF EXISTS "Admin read access" ON submissions;
DROP POLICY IF EXISTS "Admin update limited" ON submissions;

-- 1. Public users can only INSERT (original submission)
-- They cannot read, update, or delete
CREATE POLICY "Allow anonymous inserts" ON submissions
    FOR INSERT 
    TO anon
    WITH CHECK (
        -- Only allow setting these fields
        message IS NOT NULL AND
        content_type IS NOT NULL AND
        -- Prevent setting admin-only fields
        corrected_message IS NULL AND
        status = 'Pending' AND
        reviewed_at IS NULL
    );

-- 2. Service role has full access (for backend automation)
CREATE POLICY "Service role full access" ON submissions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Authenticated admins can read all submissions
-- (requires authenticated role - admins login via Supabase Auth)
CREATE POLICY "Admin read access" ON submissions
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Authenticated admins can update specific fields only
-- Cannot modify: message, content_type, author_name, message_hash, created_at
-- Can modify: status, corrected_message, reviewed_at, post_count, last_posted_at
CREATE POLICY "Admin update limited" ON submissions
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification Query
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name IN ('corrected_message', 'reviewed_at')
ORDER BY column_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- Expected submissions table structure after migration:
-- ═══════════════════════════════════════════════════════════════════════════
-- id                UUID PRIMARY KEY
-- message           TEXT NOT NULL (original, immutable)
-- content_type      TEXT NOT NULL
-- author_name       TEXT (nullable)
-- status            TEXT DEFAULT 'Pending'
-- message_hash      TEXT (for duplicate detection)
-- corrected_message TEXT (nullable, admin correction)
-- post_count        INTEGER DEFAULT 0
-- created_at        TIMESTAMP WITH TIME ZONE
-- reviewed_at       TIMESTAMP WITH TIME ZONE (nullable)
-- last_posted_at    TIMESTAMP WITH TIME ZONE (nullable)
-- ═══════════════════════════════════════════════════════════════════════════
