-- Applied to the "cielo" Supabase project on 2026-09-12.
--
-- Holds the captured text of a highlight (content_type = TEXT). Null for every
-- other kind of save. Nullable and additive, so existing rows are untouched.

ALTER TABLE items ADD COLUMN IF NOT EXISTS body text;
