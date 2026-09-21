# Save & Organize Tool — MVP Plan

## What it is

A Pinterest/Are.na/Cosmos/mymind-style moodboard app, but the differentiator is saving _from anywhere_ (TikTok, Instagram, X, any webpage, or direct upload) into one central library, instead of saves being scattered across each platform's native bookmark feature.

## Capstone framing

- **Problem:** saved/liked content is fragmented across platforms (Instagram saves, TikTok saves, X bookmarks, browser bookmarks) with no unified view
- **Users:** anyone who collects inspiration/reference content across multiple platforms — not designer-specific
- **Differentiator vs. Are.na/Cosmos/mymind:** frictionless cross-platform capture via browser extension, not just manual link entry

## MVP Scope (locked)

- **Platform:** desktop web app only — no mobile app, no PWA, no native wrapper for now
- **Save tiers:**
  1. Extension DOM-scrape (rich) — reads og:image/title/video poster directly off the loaded page, no server scraping needed
  2. Plain link paste (fallback) — for pages the extension can't scrape or manual entry in the web app
  3. Direct image upload/paste — no source URL, stored in Supabase Storage
- **Organization:** user-created custom sections (many-to-many with items) + every item auto-visible in "General" (computed view, not a real join row) + manual tags
- **Feed:** masonry grid, infinite scroll, newest-first, cursor-paginated
- **Search:** Postgres full-text search over title + tags (no third-party service)
- **Auth:** email/password + OAuth via Supabase Auth; extension auto-syncs session via browser cookies, with manual-login fallback

## Explicitly out of scope for MVP (parked as future work)

- Mobile app / PWA / native share-target integration
- Auto-classification / ML-based tagging (Cosmos/Pinterest-style auto-categorization)
- MCP server layer for Claude/ChatGPT to query saved items and assist with content recreation

## Stack (cost-conscious: free tier / pay-as-you-go)

- **Frontend:** Next.js on Vercel (free tier)
- **API:** Next.js API routes / Vercel serverless functions (free tier)
- **ORM:** Prisma — keeps the DB layer portable if Postgres ever needs to move off Supabase
- **Auth + DB:** Supabase Auth + Postgres (free tier — note: pauses on inactivity, known issue from other projects). Auth is the less portable piece if switching providers later (password reset flow needed on migration); DB itself is vanilla Postgres, fully portable via Prisma
- **Storage:** Supabase Storage — used for Tier 3 direct uploads only, via a
  private `item-images` bucket; everything else is hotlinked (zero storage /
  bandwidth cost). **Changed 2026-09-21, was AWS S3.** The S3 line below is
  kept because the reasoning is still the reasoning, it just lost: a second
  cloud account, a second bill and a fifth secret to leak, to store a handful
  of images the project already had somewhere to put. Uploads go browser →
  storage under the user's own session, so no service-role key exists to leak.
  - *Superseded:* AWS S3 (pay-as-you-go) — used for Tier 3 direct uploads only, via presigned URLs; everything else is hotlinked (zero storage/bandwidth cost). Small, contained AWS piece — resume value without RDS/Cognito/Lambda scope creep
- **Extension:** Chrome extension, Manifest V3 — permissions: `<all_urls>`, `contextMenus`, `storage`, `cookies`; right-click save only, no on-page UI overlay

## Key technical decisions

- `ITEM.url` is nullable (null for direct uploads) with `UNIQUE(user_id, url)` — re-saving a URL reuses the existing item and just adds a new section link, no duplicate rows
- `ITEM.source_type` = `web` or `direct` — determines whether a "visit original" link is shown
- Deleting a section only removes the `ITEM_SECTION` join row (`ON DELETE CASCADE`) — items themselves are untouched and remain visible in General
- Sections can be renamed anytime, items always follow via `section_id` reference
- Read path goes through a dedicated `/api/items` (paginated feed) and `/api/search` route — same auth-checked pattern as writes, not a direct DB query from the frontend

## Rough timeline estimate

- Web-only core (auth, paste-link save, upload, feed, sections, tags): ~1–2 weeks
- Chrome extension (DOM scraping across TikTok/IG/X + generic pages): ~1–2 weeks
- Search + polish: ~3–5 days
- **Full MVP: ~4–6 weeks** of part-time work around your semester schedule — realistically spans Capstone Pt 1 into Pt 2

## Still to design (post-architecture, pre-build)

- Actual UI/visual design (masonry card design, section navigation, save modal)
- `/api/save`, `/api/save-image`, `/api/items` request/response shapes
- Extension popup UI (login fallback state, section picker at save time)
