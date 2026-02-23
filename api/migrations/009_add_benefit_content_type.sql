-- Add "benefit" content type support on submissions.content_type CHECK constraint.
DO $$
DECLARE
    existing_constraint_name text;
BEGIN
    SELECT conname
    INTO existing_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.submissions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%content_type%'
      AND pg_get_constraintdef(oid) ILIKE '%dhikr%dua%ayah%hadith%'
    LIMIT 1;

    IF existing_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.submissions DROP CONSTRAINT %I', existing_constraint_name);
    END IF;

    ALTER TABLE public.submissions
        ADD CONSTRAINT submissions_content_type_check
        CHECK (content_type IN ('dhikr', 'dua', 'ayah', 'hadith', 'benefit'));
END $$;
