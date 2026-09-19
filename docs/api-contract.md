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
  "body": "string | null",
  "thumbnailUrl": "string | null",
  "contentType": "LINK | IMAGE | VIDEO | CAROUSEL | TEXT",
  "sourcePlatform": "tiktok | instagram | x | web | null",
  "sectionIds": ["uuid", "..."],
  "tagNames": ["string", "..."]
}
```

- `url` may be **null when `contentType` is `TEXT`** — a highlight written or
  pasted in the web app need not come from anywhere. Every other kind of save
  still requires it (`400` otherwise). A `TEXT` save with no `body` is a `400`.
  A sourceless quote is stored with `sourceType: DIRECT`; because Postgres
  treats a null url as distinct under `unique(user_id, url)`, each one is its
  own item rather than colliding.
- `body` carries the captured text of a highlight and is only set when
  `contentType` is `TEXT`. The extension sends the page's own URL with a
  `#:~:text=` fragment naming the quote, so multiple highlights from one page
  stay distinct under `unique(user_id, url)` instead of deduping into a single
  item — and "Visit original" scrolls straight to the quote.
- A `TEXT` save is never scraped: the quote is the content, so there is nothing
  a fetch of the page could add.

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

## POST /api/import

Bulk import from an exported bookmark file. The file is parsed **in the
browser** — it never reaches the server — and posted in chunks so a large
export reports progress instead of hanging on one request.

**Request** (max 500 entries per call)

```json
{
  "entries": [
    {
      "url": "https://are.na/block/1",
      "title": "string | null",
      "folder": "string | null",
      "tags": ["string", "..."],
      "savedAt": "ISO 8601 datetime | null"
    }
  ]
}
```

- `folder` becomes a section of the same name, created if it does not exist.
- `savedAt` is preserved, so the feed's order reflects when things were
  originally saved rather than when they were migrated.
- Existing urls are left untouched rather than duplicated or overwritten.
- Imported items are **not scraped** — they arrive with no thumbnail, which is
  what `npm run backfill:thumbnails` fills in afterwards.

**Response `200`**

```json
{
  "imported": "number",
  "reused": "number",
  "sectionsCreated": "number",
  "batchId": "uuid — pass to DELETE /api/import/:batchId to undo this run"
}
```

---

## DELETE /api/import/:batchId

Undoes one import. Only rows that import **created** carry its batch id, so a
bookmark that was already in the library is never removed. A section the import
created is dropped only if it is now empty — if the user has since filed
something into it by hand, it stays.

**Response `200`**

```json
{ "itemsRemoved": "number", "sectionsRemoved": "number" }
```

---

## GET /api/export

**Implemented.** The whole library in one file, as an attachment. Deliberately
unpaginated and uncached — a partial export is not an export, and the body is
the user's entire library.

| Query    | Values           | Default |
| -------- | ---------------- | ------- |
| `format` | `json` \| `html` | `json`  |

Any other `format` is a `400`.

**`format=json`** — `application/json`, filename `cielo-YYYY-MM-DD.json`. The
lossless copy: items in the same shape as `GET /api/items`, each with its
`note`, so highlights saved without a URL survive.

```json
{
  "format": "cielo-export",
  "version": 1,
  "exportedAt": "ISO-8601",
  "itemCount": "number",
  "items": ["…same shape as GET /api/items, plus note"]
}
```

**`format=html`** — `text/html`, filename `cielo-bookmarks-YYYY-MM-DD.html`.
Netscape bookmark HTML, the format browsers and other bookmarking tools import.
Sections become folders, tags go in `TAGS`, the original `savedAt` goes in
`ADD_DATE`, and a note becomes `<DD>`. Lossy by construction: an item with no
URL cannot be an `<A HREF>` and is left out. An item in two sections is written
under both — re-importing reunites the copies rather than duplicating the item.

Both responses carry `Content-Disposition: attachment` and
`Cache-Control: no-store, private`.

---

## DELETE /api/items

Bulk delete, for the library's selection mode.

```json
// Request (1-500 ids)
{ "ids": ["uuid", "..."] }

// Response 200 — the count that actually matched this user
{ "deleted": "number" }
```

Ids belonging to another user simply do not match rather than erroring, so
`deleted` is the truthful count.

---

## GET /api/search

**Implemented.** Postgres full-text search over `items.search_vector` (title +
a highlight's captured `body`), plus a tag-name match and a url match. Applied
by `prisma/manual-sql/006_search_vector.sql`.

Uses `websearch_to_tsquery`, so a user can quote `"an exact phrase"` and use
`or` / `-` the way they would in a search engine. Results stay **newest-first**
rather than relevance-ranked, which keeps the cursor contract identical to
`/api/items`. An empty or whitespace `q` returns an empty result set, not a
`400` — the field starts empty and the UI should not have to special-case it.

Search and the section/tag filters are alternatives: there is no `sectionId`
parameter here, and issuing a query clears whatever filter was active.

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
