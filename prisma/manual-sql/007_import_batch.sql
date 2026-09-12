-- Applied to the "cielo" Supabase project on 2026-09-12.
--
-- Stamps everything a single import created, so it can be undone later —
-- after a reload, not just while the tab is open.
--
-- Set only on rows the import CREATED. A bookmark that was already in the
-- library is left unstamped, so undoing an import never deletes something the
-- user had before it ran.

ALTER TABLE items ADD COLUMN IF NOT EXISTS import_batch uuid;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS import_batch uuid;

CREATE INDEX IF NOT EXISTS items_import_batch_idx ON items (import_batch) WHERE import_batch IS NOT NULL;
CREATE INDEX IF NOT EXISTS sections_import_batch_idx ON sections (import_batch) WHERE import_batch IS NOT NULL;
