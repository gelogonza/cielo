-- Applied to the "cielo" Supabase project on 2026-09-11.
--
-- Cielo reaches Postgres through Prisma on a direct connection. Nothing is
-- meant to read these tables via PostgREST with the publishable key — but
-- Supabase grants the anon/authenticated roles access to the public schema by
-- default, so WITHOUT THIS the entire library is readable by anyone holding
-- the publishable key (which ships in the browser bundle).
--
-- RLS enabled with no general policies = deny everything through PostgREST.
-- The real tenant isolation stays in lib/auth/with-auth.ts + the services.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
