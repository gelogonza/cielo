# API Contract

All routes require an authenticated session (Supabase Auth session, checked via `AUTH_MW` in the
architecture diagram). `userId` is always taken from the session, never from the request body.

---

## POST /api/save

Used by: extension (Tier 1 rich scrape, Tier 2 fallback) and web app (Tier 2 manual link paste).

**Request**

```json
{
  "url": "https://tiktok.com/@user/video/123",
  "title": "string | null",
  "thumbnailUrl": "string | null",
  "contentType": "LINK | IMAGE | VIDEO | CAROUSEL | TEXT",
  "sourcePlatform": "tiktok | instagram | x | web | null",
  "sectionIds": ["uuid", "..."],
  "tagNames": ["string", "..."]
}
```

- If `thumbnailUrl` is `null`, the server falls back to `/api/scrape` internally before writing the item.
- If `(userId, url)` already exists, the existing item is reused — no new row is created. `sectionIds`
  and `tagNames` passed in are still applied (added) to the existing item.

**Response `201`**

```json
{
  "id": "uuid",
  "url": "string",
  "title": "string | null",
  "thumbnailUrl": "string | null",
  "contentType": "LINK | IMAGE | VIDEO | CAROUSEL | TEXT",
  "sourceType": "WEB",
  "sourcePlatform": "string | null",
  "savedAt": "ISO 8601 datetime",
  "sections": [{ "id": "uuid", "name": "string" }],
  "tags": [{ "id": "uuid", "name": "string" }],
  "reused": "boolean — true if this was an existing item, not newly created"
}
```

**Errors**: `400` missing `url`, `401` unauthenticated, `422` invalid `contentType` enum value.

---

## POST /api/save-image

Used by: web app / extension, Tier 3 direct upload (no source URL).

Two-step flow (presigned upload, not a raw multipart body):

**Step 1 — request a presigned URL**

```json
// Request
{ "fileName": "string", "fileType": "image/png | image/jpeg | ..." }

// Response 200
{ "uploadUrl": "string — presigned S3 PUT url", "objectKey": "string" }
```

**Step 2 — client uploads the file directly to S3 via `uploadUrl`, then confirms:**

```json
// Request
{
  "objectKey": "string — from step 1",
  "title": "string | null",
  "contentType": "IMAGE | VIDEO",
  "sectionIds": ["uuid", "..."],
  "tagNames": ["string", "..."]
}
```

**Response `201`**

```json
{
  "id": "uuid",
  "url": null,
  "title": "string | null",
  "thumbnailUrl": "string — S3 object url, derived from objectKey",
  "contentType": "IMAGE | VIDEO",
  "sourceType": "DIRECT",
  "sourcePlatform": null,
  "savedAt": "ISO 8601 datetime",
  "sections": [{ "id": "uuid", "name": "string" }],
  "tags": [{ "id": "uuid", "name": "string" }]
}
```

**Errors**: `400` missing `objectKey`/`fileType`, `401` unauthenticated, `413` file too large (cap TBD).

---

## GET /api/items

Used by: web app feed (masonry, infinite scroll, newest-first).

**Query params**

```
?cursor=<ISO 8601 savedAt of last item from previous page>   // omit for first page
&limit=20                                                     // default 20, max 50
&sectionId=<uuid>                                              // omit = General (all items)
&tagId=<uuid>                                                   // optional additional filter
```

**Response `200`**

```json
{
  "items": [
    {
      "id": "uuid",
      "url": "string | null",
      "title": "string | null",
      "thumbnailUrl": "string | null",
      "contentType": "LINK | IMAGE | VIDEO | CAROUSEL | TEXT",
      "sourceType": "WEB | DIRECT",
      "sourcePlatform": "string | null",
      "savedAt": "ISO 8601 datetime",
      "sections": [{ "id": "uuid", "name": "string" }],
      "tags": [{ "id": "uuid", "name": "string" }]
    }
  ],
  "nextCursor": "ISO 8601 datetime | null — pass as `cursor` for the next page"
}
```

---

## GET /api/search

Postgres full-text search over `items.search_vector` (title) unioned with a tag-name match.
See `schema.prisma` bottom comment for the required raw SQL migration this depends on.

**Query params**

```
?q=<search string>
&cursor=<ISO 8601 savedAt>   // same pagination pattern as /api/items
&limit=20
```

**Response `200`**: same shape as `GET /api/items`.

---

## Sections

**POST /api/sections** — create

```json
// Request
{ "name": "string" }

// Response 201
{ "id": "uuid", "name": "string", "createdAt": "ISO 8601 datetime" }
```

**GET /api/sections** — list all sections for the current user

```json
// Response 200
{ "sections": [{ "id": "uuid", "name": "string", "itemCount": "number" }] }
```

**PATCH /api/sections/:id** — rename

```json
// Request
{ "name": "string" }

// Response 200
{ "id": "uuid", "name": "string" }
```

**DELETE /api/sections/:id**

- Deletes only the `ItemSection` join rows for this section (`onDelete: Cascade` in schema).
  Items themselves are untouched and remain visible via `GET /api/items` with no `sectionId` filter.
- **Response `204`**, no body.

---

## Tags

**POST /api/tags** — create (or return existing if name already exists for this user, since
`Tag` has a `@@unique([userId, name])` constraint)

```json
// Request
{ "name": "string" }

// Response 201 (or 200 if it already existed)
{ "id": "uuid", "name": "string" }
```

**GET /api/tags** — list all tags for the current user

```json
{ "tags": [{ "id": "uuid", "name": "string", "itemCount": "number" }] }
```

**DELETE /api/tags/:id** — deletes only `ItemTag` join rows (`onDelete: Cascade`), items untouched.

---

## Notes

**PUT /api/items/:id/note** — create or replace the single note on an item (1:1 relation in schema)

```json
// Request
{ "body": "string" }

// Response 200
{ "id": "uuid", "itemId": "uuid", "body": "string", "createdAt": "ISO 8601 datetime" }
```

**DELETE /api/items/:id/note**

- **Response `204`**, no body.

---

## Auth

Not custom routes — handled directly by the Supabase Auth client SDK (signup, login, OAuth,
session refresh) on both the web app and the extension. No `/api/auth/*` routes needed.
