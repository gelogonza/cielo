-- Applied to the "cielo" Supabase project on 2026-09-12.
-- Supersedes the never-applied 001_search_vector.sql, which predated
-- items.body (005) and so indexed titles only.
--
-- Full-text search over an item's own words: its title plus, for a highlight,
-- the captured quote. Tag names live in another table and are matched
-- separately in the query rather than denormalised into here.
--
-- The two-argument to_tsvector(regconfig, text) is IMMUTABLE, which a generated
-- column requires; the one-argument form is not and would be rejected.

ALTER TABLE items ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS items_search_idx ON items USING GIN (search_vector);

-- Tag and url matching use ILIKE, which the GIN index above cannot serve.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS tags_name_trgm_idx ON tags USING GIN (name gin_trgm_ops);
