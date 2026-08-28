# Engineering Standards & Build Order

Companion doc to `bookmark-app-plan.md`, `schema.prisma`, and `api-contract.md`. This defines
_how_ the build happens — process, guardrails, and task order — not the product decisions
themselves (those are locked in the other docs).

---

## 1. Engineering Principles

- **Test-Driven Development (TDD):** for every unit of backend logic (API route handler, DB
  query function, validation function), write the failing test first, then the minimum code to
  pass it, then refactor. No implementation code is merged without tests that were written
  before or alongside it — tests written after the fact to "cover" existing code don't satisfy TDD
  and should be flagged in review.
- **No spaghetti code:** every API route is a thin handler that calls into a separate service/
  logic layer (e.g. `lib/items/createItem.ts`), not inline business logic mixed with request
  parsing. Route handlers should be readable top-to-bottom as a sequence of named steps, not
  nested conditionals.
- **Optimal solution unless it adds disproportionate complexity:** default to the correct,
  efficient approach (e.g. cursor pagination over offset, a single indexed query over N+1
  queries). If the "optimal" version requires meaningfully more infrastructure or time than the
  MVP timeline allows, document the simpler choice and _why_ in a code comment or ADR
  (Architecture Decision Record) rather than silently taking a shortcut.
- **Object-oriented where it earns its keep:** service-layer logic (e.g. an `ItemService`,
  `SectionService`) is organized as classes/modules with clear single responsibilities. Don't
  force OOP onto things that are naturally functional (pure validation/transform functions stay
  as plain functions) — pick whichever is clearer per case, but be consistent within a layer.
- **Type safety end to end:** TypeScript strict mode on. Prisma-generated types flow from DB →
  service layer → API response types, no `any`, no untyped request bodies.

---

## 2. Code Review Process

Modeled on standard industry practice — every change goes through this before merging to `main`:

1. **Self-review first:** author re-reads their own diff before requesting review, checking for
   leftover debug code, missing tests, and unclear naming.
2. **At least one reviewer approval required** before merge (if solo, treat this as a mandatory
   "cool-down" pass — step away, come back, re-review your own PR as if it were someone else's).
3. **Review checklist:**
   - [ ] Tests exist and were written before/alongside the implementation (TDD)
   - [ ] No business logic inside route handlers
   - [ ] No hardcoded secrets, URLs, or magic numbers (use env vars / named constants)
   - [ ] Error cases handled explicitly, not swallowed silently
   - [ ] Types are correct and specific (no `any`)
   - [ ] Naming is clear enough that comments aren't compensating for bad names
4. **CI must pass** before merge: lint, type-check, full test suite, build.
5. **Squash-merge with a clear commit message** summarizing the change, referencing the task/
   issue it closes.

---

## 3. Security Audit Checkpoints

Backend security gets an explicit review pass at these points, not just "at the end":

- **After auth is wired up (Phase 2):** confirm every API route actually enforces the auth
  middleware — a route that forgets to check the session is the single most common real-world
  vulnerability in apps like this. Write a test that asserts each protected route returns `401`
  with no session, not just a test that it works _with_ one.
- **After the save routes are built (Phase 3):** confirm `userId` is always taken from the
  session, never trusted from the request body — otherwise a user could save items under another
  user's account by editing the payload.
- **After S3 upload is wired up (Phase 4):** confirm presigned URLs are scoped (short expiry,
  correct content-type restrictions, bucket policy denies public write) so the upload endpoint
  can't be abused to upload arbitrary files or overwrite others' objects.
- **Before demo/deploy (Phase 6):** run a dependency vulnerability scan (`npm audit` or
  equivalent), confirm no secrets are committed to the repo (`.env` gitignored, secrets only in
  Vercel/Supabase/AWS environment config), and confirm rate limiting exists on write routes
  (`/api/save`, `/api/save-image`) to prevent abuse.

---

## 4. Testing Strategy

- **Unit tests:** every service-layer function (`createItem`, `findOrReuseByUrl`, `deleteSection`,
  etc.) tested in isolation with a test database or mocked Prisma client. Cover the happy path
  _and_ every edge case already documented in the other docs — e.g. re-saving a duplicate URL
  reuses the item, deleting a section doesn't delete items, `url = null` is valid for direct
  uploads.
- **Integration tests:** each API route tested end-to-end against a real (test) database —
  request in, response + DB state out. This is where the `401` auth-guard tests and duplicate-URL
  behavior get verified at the HTTP layer, not just the service layer.
- **Coverage target:** aim for high coverage on the service/API layer (this is where bugs are
  expensive); UI component tests are lower priority for MVP and can be lighter.

---

## 5. README Requirements

The repo's `README.md` must let a new team member go from clone to running locally without
asking a question. It should include, in this order:

1. **One-paragraph project description** (what this app does, in plain language)
2. **Tech stack summary** (link to `bookmark-app-plan.md` for full rationale, just list the
   stack here)
3. **Prerequisites** (Node version, pnpm/npm, Postgres access via Supabase, AWS credentials)
4. **Setup steps**, numbered, copy-pasteable commands:
   - clone → install deps → copy `.env.example` to `.env` and fill in values → run Prisma
     migrations → run dev server
5. **Environment variables table** — name, description, where to get it (Supabase dashboard, AWS
   IAM console, etc.), never actual secret values
6. **Project structure** — brief tree of top-level folders and what lives where (`/app`, `/lib`,
   `/prisma`, `/extension`, `/tests`)
7. **How to run tests** (`npm test`, `npm run test:watch`, how to run just integration tests)
8. **How to run the extension locally** (load unpacked in Chrome, point at local API)
9. **Link out** to `schema.prisma` (data model) and `api-contract.md` (endpoint reference) instead
   of duplicating them in the README

---

## 6. Build Order / Task Breakdown

Each phase follows the TDD loop internally: write failing tests for that phase's behavior first,
then implement, then refactor, then move on. No phase starts until the previous phase's tests
are green and reviewed.

### Phase 0 — Project Setup

- [ ] Initialize Next.js + TypeScript (strict mode) project
- [ ] Set up Prisma, connect to Supabase Postgres, run initial migration from `schema.prisma`
- [ ] Apply the raw SQL migration for the `search_vector` column (see bottom of `schema.prisma`)
- [ ] Configure ESLint + Prettier, wire into CI
- [ ] Set up test runner (e.g. Vitest or Jest) + test database
- [ ] Write `README.md` skeleton (fill in as later phases complete)

### Phase 1 — Auth

- [ ] Wire Supabase Auth (email/password + OAuth) into the web app
- [ ] Build the shared auth middleware used by all protected API routes
- [ ] **Tests first:** middleware rejects requests with no session (`401`), accepts valid sessions
- [ ] Security checkpoint: confirm middleware is applied consistently (see Section 3)

### Phase 2 — Sections & Tags CRUD

- [ ] `/api/sections` (POST, GET, PATCH, DELETE) + `/api/tags` (POST, GET, DELETE)
- [ ] **Tests first:** create/list/rename/delete, and specifically that deleting a section leaves
      items intact (cascade only removes the join row)

### Phase 3 — Core Save Path (Web-Only)

- [ ] `/api/save` — plain link paste flow (Tier 2), including `/api/scrape` fallback
- [ ] **Tests first:** duplicate URL reuses existing item instead of creating a new row; new
      sections/tags get attached correctly on reuse
- [ ] Security checkpoint: `userId` sourced only from session (see Section 3)

### Phase 4 — Direct Upload (Tier 3)

- [ ] S3 bucket + IAM policy setup (least-privilege, presigned URL only)
- [ ] `/api/save-image` two-step presigned upload flow
- [ ] **Tests first:** presigned URL generation, confirm-upload writes correct `sourceType: DIRECT`
      and `url: null`
- [ ] Security checkpoint: presigned URL scoping (see Section 3)

### Phase 5 — Read Path

- [ ] `/api/items` cursor-paginated feed (newest-first, section/tag filters)
- [ ] `/api/search` full-text search over title + tags
- [ ] **Tests first:** pagination cursor correctness, filter combinations, search relevance on
      known fixture data
- [ ] Build the masonry grid UI, infinite scroll, wired to `/api/items`

### Phase 6 — Extension (Tier 1 Rich Scrape)

- [ ] Manifest V3 scaffold with permissions from `bookmark-app-architecture.mermaid`
- [ ] Content script: generic `og:image`/`og:title` extraction
- [ ] Platform-specific extraction: TikTok, Instagram (carousel-aware), X (multi-image aware)
- [ ] Right-click context menu save flow, background script → `/api/save`
- [ ] Auth sync via browser cookies, with manual-login fallback state in the popup
- [ ] **Tests first:** where feasible, unit test the DOM-parsing functions against saved HTML
      fixtures per platform (since live-page testing is inherently manual/exploratory)

### Phase 7 — Pre-Deploy Hardening

- [ ] Full security audit pass (Section 3, final checkpoint)
- [ ] Dependency vulnerability scan
- [ ] Rate limiting on write routes
- [ ] Full README review — can a teammate actually follow it cold?
- [ ] Deploy: Vercel (frontend/API), confirm Supabase + S3 env config in production

---

_This doc governs process. For product scope see `bookmark-app-plan.md`, for data model see
`schema.prisma`, for endpoint shapes see `api-contract.md`, for system diagrams see
`bookmark-app-architecture.mermaid` and `bookmark-app-erd.mermaid`._
