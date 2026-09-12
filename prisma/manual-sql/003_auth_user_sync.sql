-- Applied to the "cielo" Supabase project on 2026-09-11.
--
-- schema.prisma expects public.users.id to equal the Supabase auth.users.id,
-- but nothing created that row: signup only writes auth.users, so the very
-- first save died on items_user_id_fkey. A trigger covers every entry point
-- (web signup, Google OAuth, the extension) rather than one code path.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (
    NEW.id::text,
    -- users.email is NOT NULL + UNIQUE; some providers return no address, so
    -- fall back to something unique rather than failing the signup.
    COALESCE(NULLIF(NEW.email, ''), NEW.id::text || '@no-email.local')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill anyone who signed up before this trigger existed.
INSERT INTO public.users (id, email)
SELECT id::text, COALESCE(NULLIF(email, ''), id::text || '@no-email.local')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
