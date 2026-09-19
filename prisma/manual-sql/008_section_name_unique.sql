-- Applied to the "cielo" Supabase project on 2026-09-19.
--
-- One section per name, per user.
--
-- An import already reuses a section by NAME (resolveSectionsByName), and the
-- sidebar's rename had no check at all, so two sections called "Design" were
-- reachable from two directions — confusing rather than broken, but they would
-- each hold half the items the user thought were together.
--
-- Tags have had this constraint since the start, which is why TagService can
-- create optimistically and treat P2002 as "already exists" instead of racing
-- a check-then-create. Sections now work the same way.
--
-- If this fails, the project already has duplicate section names. Find them
-- with the query below, merge by hand, then re-run:
--
--   SELECT user_id, name, count(*), array_agg(id)
--   FROM sections GROUP BY user_id, name HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS sections_user_id_name_key ON sections (user_id, name);
