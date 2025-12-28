-- ═══════════════════════════════════════════════════════════════════════════
-- أجر لا ينقطع - Database Migration
-- Add message_hash column for duplicate detection
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this migration in your Supabase SQL Editor
-- This adds a column for storing SHA-256 hashes of messages to prevent duplicates

-- 1. Add message_hash column
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS message_hash TEXT;

-- 2. Create unique index on message_hash for efficient duplicate checking
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_message_hash 
ON submissions (message_hash) 
WHERE message_hash IS NOT NULL;

-- 3. Generate hashes for existing records (if any)
-- This uses MD5 as a fallback since SHA-256 requires an extension
-- New submissions will use SHA-256 from the backend
UPDATE submissions 
SET message_hash = md5(message) 
WHERE message_hash IS NULL;

-- 4. Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'message_hash';

-- ═══════════════════════════════════════════════════════════════════════════
-- Expected submissions table structure:
-- ═══════════════════════════════════════════════════════════════════════════
-- CREATE TABLE submissions (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     message TEXT NOT NULL,
--     content_type TEXT NOT NULL CHECK (content_type IN ('dhikr', 'dua', 'ayah', 'hadith')),
--     author_name TEXT,
--     status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
--     message_hash TEXT,
--     post_count INTEGER DEFAULT 0,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--     reviewed_at TIMESTAMP WITH TIME ZONE
-- );
-- ═══════════════════════════════════════════════════════════════════════════
