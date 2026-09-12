-- Applied to the "cielo" Supabase project on 2026-09-11.
--
-- Prisma needs a role whose password we control. Supabase does not expose the
-- generated postgres password, and postgres is not superuser here so it cannot
-- reset its own. The app therefore gets its own least-privilege login role.
--
-- BYPASSRLS requires superuser, so 002's lockdown is opened back up for THIS
-- ROLE ONLY via policies; anon/authenticated remain denied.
--
-- Replace the placeholder before running, and put the same value in
-- DATABASE_URL. Never commit the real password.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cielo_app') THEN
    CREATE ROLE cielo_app LOGIN PASSWORD 'REPLACE_ME';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO cielo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cielo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cielo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cielo_app;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['users','sections','items','item_sections','tags','item_tags','notes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS cielo_app_all ON %I', target);
    EXECUTE format(
      'CREATE POLICY cielo_app_all ON %I FOR ALL TO cielo_app USING (true) WITH CHECK (true)',
      target
    );
  END LOOP;
END
$$;
