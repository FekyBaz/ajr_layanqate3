-- Add lightweight view counter for approved community submissions
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
