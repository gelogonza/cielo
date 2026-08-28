-- Full-text search index (title) referenced by /api/search in api-contract.md.
-- Not expressible in schema.prisma — Prisma has no generated-tsvector-column
-- support without the postgresqlExtensions preview feature. Apply this as a
-- follow-up migration after the initial `prisma migrate dev`:
--
--   npx prisma migrate dev --create-only --name add_search_vector
--   (paste this file's contents into the generated migration.sql)
--   npx prisma migrate dev
--
-- Tag-name search is a separate query (join item_tags -> tags, ILIKE or
-- to_tsvector on tags.name) unioned/combined with this in the API layer,
-- since tags live in a different table than items.search_vector.

ALTER TABLE items ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;

CREATE INDEX items_search_idx ON items USING GIN (search_vector);
