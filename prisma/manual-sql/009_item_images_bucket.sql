-- Run in the Supabase SQL editor as the project owner.
--
-- Storage for Tier 3 direct uploads — an image you save straight into Cielo,
-- with no source page to hotlink from.
--
-- PRIVATE bucket, not public. A public bucket would make every uploaded image
-- readable by anyone who has the URL, and "this is a private library" is a
-- constraint, not a preference (docs/product-principles.md). Unguessable paths
-- are not privacy. Images are served through GET /api/items/:id/image, which
-- checks the session, so the URL the feed holds is stable and never expires.
--
-- The path is <user id>/<uuid>.<ext>, and every policy below keys off that
-- first segment, so one user can never read or write another's objects even
-- though they share a bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  false,
  10485760, -- 10 MB; these are saved images, not originals from a camera roll
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Uploads come straight from the browser with the user's own session, so these
-- policies are the only thing standing between users. The server never holds a
-- service-role key for storage.
DROP POLICY IF EXISTS "own item images: read" ON storage.objects;
CREATE POLICY "own item images: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own item images: write" ON storage.objects;
CREATE POLICY "own item images: write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own item images: delete" ON storage.objects;
CREATE POLICY "own item images: delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Deliberately no UPDATE policy: an upload writes once under a fresh uuid.
-- Replacing an object in place would silently change what an existing item
-- points at.
