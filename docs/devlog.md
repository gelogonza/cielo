# Devlog

Running record of what changed in Cielo and **why**. Newest entry first.

This file is the fastest way to load context on a codebase you have not touched
before: the code shows what is true now, the devlog shows how it got that way
and which decisions are already settled (so you do not relitigate them).

## How to use it

**Before writing any code**, read:

1. This file — at minimum the three newest entries, plus any entry whose
   **Touched** list overlaps the files you are about to change.
2. `docs/bookmark-app-plan.md` for scope, and `docs/api-contract.md` for any
   route you are adding or calling.
3. The actual code you are about to modify, and its tests.

**After making a change**, add an entry at the top of the log. One entry per
coherent change, not per file — then commit the code and that entry **together**
in a single commit with a one-line subject, so the log can never drift from the
history. See "Required after you make a change" in `AGENTS.md`.

### Entry format

```markdown
## YYYY-MM-DD — Short title

**What:** one or two sentences on what now exists that did not before.
**Why:** the reason, including the option you rejected if it was close.
**Touched:** `path/one.ts`, `path/two/` — brief note on each if not obvious.
**Follow-ups:** anything knowingly left undone, or "none".
```

Keep entries short. If an entry needs more than ~12 lines, the change was
probably two changes.

---

## 2026-09-12 — Save highlighted text as a quote

**What:** Highlight text on any page, right-click → **Save selection to Cielo**,
and it saves as a `TEXT` item rendered as a quote card. Added `Item.body` for
the captured text.

**Why:** Saving the page loses the sentence you actually wanted. `ContentType.TEXT`
and the extension's `selection` context already existed but were inert — the
selection was read and thrown away.

**How the url works (the interesting part):** every highlight on a page shares
that page's url, which would collide under `unique(user_id, url)` and silently
dedupe all of them into one item. Each quote instead gets a
[text fragment](https://wicg.github.io/scroll-to-text-fragment)
(`#:~:text=…`) naming it, so highlights stay distinct, the _same_ quote saved
twice still dedupes, and "Visit original" scrolls straight to the passage.
Quotes over 200 chars use the spec's `textStart,textEnd` form, trimmed to word
boundaries because fragments match exact text.

**Touched:** `prisma/schema.prisma` + `prisma/manual-sql/005_item_body.sql`,
`lib/items/{item-service,serialize}.ts`, `app/api/save/route.ts`,
`docs/api-contract.md`, `extension/src/{content-script,background}.js`,
`extension/src/lib/save-payload.js`, `components/library/{item-card,item-detail}.tsx`.

**Decisions worth not relitigating:**

- The content script reads `window.getSelection()` rather than trusting
  `info.selectionText`, which Chrome truncates. Chrome's copy is the fallback.
- A `TEXT` save skips the scrape entirely — the quote is the content, so a
  fetch of the page has nothing to add.

**Verified:** against the live database — two quotes from one page stayed
distinct, the same quote twice deduped (`reused: true`), and both render as
quote cards in the feed.

**Follow-ups:** No way to save a highlight from the web app itself, only the
extension. Quote cards clamp at 12 lines with no "show more".

---

## 2026-09-12 — Backfill script for saves with no thumbnail

**What:** `npm run backfill:thumbnails` re-scrapes items whose `thumbnail_url`
is NULL and fills it using the new fallback chain. Supports `--dry-run` and
`--limit=N`.

**Why:** The fallback chain only helps _new_ saves; anything saved before it
kept a blank card forever. Re-saving by hand does not scale past one item.

**Safety:** It only ever fills a NULL — never replaces an existing thumbnail —
and the write re-checks `thumbnailUrl: null` in its `where`, so a save that
landed mid-run wins instead of being clobbered. Items with no `url` (direct
uploads) are skipped since there is nothing to scrape. 500ms between pages so a
backfill does not hammer one host. Re-running is a no-op.

**Touched:** `scripts/backfill-thumbnails.ts`, `package.json`.

**Worth knowing:** the script is bundled with esbuild (already a dep, same as
the extension build) rather than run through a new TS runner — `@/` aliases are
resolved with `--alias:@=.`. It must be bundled as **ESM**: the generated Prisma
client uses `import.meta.url`, which is `undefined` once esbuild rewrites it to
CJS, and the script dies before it starts.

**Verified:** nulled a real row, ran `--dry-run` (reported, wrote nothing),
ran for real (filled it), ran again (clean no-op). All 7 items in the live
library now have a thumbnail.

**Follow-ups:** Pinterest saves come back with the title "Pinterest" and
sometimes its generic share image rather than the pin itself — the site serves
placeholder metadata to logged-out scrapers. Per-platform scraping was rejected
earlier as brittle; a screenshot thumbnail would sidestep it.

---

## 2026-09-12 — Thumbnails for pages that publish no og:image

**What:** Saves no longer land without a picture. Both extractors now fall
through `og:image` → `og:image:url` → `twitter:image` → `twitter:image:src` →
apple-touch-icon → largest declared icon, and resolve relative URLs to absolute.
The extension additionally borrows the largest suitable `<img>` off the rendered
page — something only a content script can see. The feed falls back to a
typographic card when there is still nothing.

**Why:** Reported as "the thumbnail didn't save" on
`https://www.priyamwada.me/`. Nothing had malfunctioned — that page publishes
**zero** og and twitter tags, so there was no image to find and the column was
correctly null. The gap was that we only ever looked at `og:image`, and a miss
produced a blank grey card, which reads as a loading failure in a visual library.

**Touched:**

- `lib/scrape/scrape-url.ts` — fallback chain, `twitter:title`, and absolute-URL
  resolution against the _final_ response URL so redirects resolve correctly.
- `extension/src/lib/extract-metadata.js` — same chain plus `largestContentImage`
  (min 200px per edge; skips spacers, tracking pixels and `data:` URIs).
- `components/library/item-card.tsx` — `TextCard` fallback; also demotes a
  thumbnail to it when the image 404s or turns out to be favicon-sized.
- `components/library/item-detail.tsx` — matching fallback in the media pane.

**Decisions worth not relitigating:**

- Icons and borrowed page images are kept **out of** the `images` array that
  drives `contentType`. A favicon must never make a save look like an `IMAGE`,
  and two of them must never make it a `CAROUSEL`.
- Size is judged at render time, not at save time. A site's "favicon.png" can be
  1600px (priyamwada.me's is), so the card checks `naturalWidth` and only
  demotes genuinely small images.

**Verified:** re-saved the reported URL against the live database — it now
stores an icon instead of null, and all three items in the library render with
a picture.

**Follow-ups:** No backfill — items saved before this keep their null thumbnail
until re-saved. A screenshot-based thumbnail (`chrome.tabs.captureVisibleTab`)
would beat an icon, but needs a permission the plan deliberately locked down.

---

## 2026-09-11 — Extension verified end to end in Chrome

**What:** Loaded the extension unpacked in real Chrome and saved a page with it.
The right-click save reached `/api/save` authenticated and the item landed in
the library. This closes the "extension unverified against a live session"
follow-up from the extension entry below.

**Why it was in doubt:** `@supabase/ssr` sets the auth cookie `SameSite=Lax`, so
it was an open question whether Chrome would attach it to a request initiated by
the extension service worker rather than a page. **It does** — the `<all_urls>`
host permission is enough, and no cookie-policy change was needed.

**Worth knowing:** the first attempt looked like a bug (popup showed "Log in to
start saving"). It was not. The session had been created in a different browser
profile; the extension was reading its own Chrome's cookie jar, correctly found
nothing, and said so. **The extension needs a login in the same browser it is
installed in** — there is no separate extension sign-in.

**Touched:** nothing — verification only.

**Follow-ups:** Firefox still unsupported. `config.js` still hardcodes
`http://localhost:3000`, so this needs changing before any real deployment.

---

## 2026-09-11 — One commit per feature, devlog entry inside it

**What:** Defined the per-feature workflow in `AGENTS.md`: verify, write the
devlog entry, then commit the code **and that entry together** under a one-line
subject (≤72 chars, `type: what changed`, no body).

**Why:** The devlog only stays trustworthy if it lands in the same commit as the
change — logged separately it drifts, and a later reader cannot tell which
commit an entry describes. Detail lives in the entry, so the commit subject does
not need a body.

**Touched:** `AGENTS.md` (post-change section), `docs/devlog.md` (how-to).

**Follow-ups:** The work from this session predates the convention and is being
committed retroactively in feature-sized chunks. Those commits are ordered so
dependencies land first, but only the final tree was verified — individual
commits were not built in isolation.

---

## 2026-09-11 — First real end-to-end save (live Supabase)

**What:** Cielo now actually runs. Created the Supabase project `cielo`
(ref `qriozsqytvyhypybccnf`, free tier, $0/mo), applied the schema, and ran the
whole flow against it in a browser: log in → save a link → the card appears →
add a note → re-save the same link → it does **not** duplicate.

Saved <https://mymind.com>; the scraper pulled back the real title
("mymind is the extension for your mind.") and og:image, and both are in
Postgres, not just on screen.

**Two blocking bugs only a live run could have found:**

1. **Signup created no `public.users` row.** Supabase writes `auth.users`;
   nothing wrote the mirror row our FKs point at, so the _first save by every
   new user_ would have failed on `items_user_id_fkey`. Fixed with a trigger on
   `auth.users` (`003_auth_user_sync.sql`) — a trigger, not app code, so every
   entry point is covered (web signup, Google OAuth, the extension).
2. **The whole library was readable with the publishable key.** Supabase exposes
   the public schema to `anon`/`authenticated` by default and the publishable
   key ships in the browser bundle, so PostgREST would have served every user's
   items to anyone. Fixed by enabling RLS with no general policies
   (`002_rls_lockdown.sql`). Directly contradicted "private by construction".

**Touched:** `prisma/manual-sql/002..004`, `.env` (gitignored), `docs/devlog.md`.

**Notes for whoever runs this next:**

- Prisma connects as a dedicated `cielo_app` role, not `postgres` — Supabase
  will not hand over the postgres password and postgres cannot reset itself.
  `004_app_role.sql` creates it; the password lives only in `.env`.
- The test account is `founder@cielo.app`, created directly in `auth.users` and
  pre-confirmed. Its password is deliberately **not** recorded here — reset it
  from the Supabase dashboard (Authentication → Users) if you need it. A
  hand-made auth row **must** have its
  token columns set to `''` rather than NULL, or login fails with "Database
  error querying schema" — GoTrue scans them into non-nullable Go strings.

**Not a bug, recorded so nobody "fixes" it:** creating a section via the browser
automation's synthetic Return key does nothing, because that key event never
reaches React's handler. A genuine `keydown` with `key: "Enter"` works — the
section was created that way.

**Follow-ups:** Extension still unverified against a live session (next thing to
test). No password reset. `/api/search` unimplemented. Direct upload needs
`/api/save-image`.

---

## 2026-09-11 — Product principles written down (corrects an earlier entry)

**What:** Added `docs/product-principles.md` and pointed AGENTS.md at it. Cielo
is a private operating system for your saves and the notes on them, in the
spirit of [mymind](https://mymind.com); the banned list is explicit — no ads, no
social features, no collaboration, no tracking, no metrics, no pressure.

**Why:** These constraints were only living in conversation, which meant any
agent could have "improved" the product by adding a share button or an
engagement counter. They are constraints, not preferences, so they need to be
somewhere enforceable.

**Correction to the 2026-09-11 "Library wired to the real API" entry:** that
entry recorded "there is no classifier and **none is planned**". That is wrong
and is now fixed. AI/ML auto-classification **is wanted**, deliberately deferred
past the MVP. When it lands it must _suggest_ — never silently overwrite a
user's own sections or tags. Manual organisation is the intended MVP
experience, not a gap.

Worth keeping straight: **counts are not metrics.** The sidebar's `Type 24` is a
navigational fact like a folder size. The banned thing is a number that exists
to make the user feel something about their own behaviour.

**Touched:** `docs/product-principles.md` (new), `AGENTS.md` (ground rules),
`docs/devlog.md`.

**Verified:** `package.json` has no analytics or telemetry dependency and no
source file loads a third-party script — the "no tracking" principle is
currently true, not aspirational.

**Follow-ups:** Auto-classification unbuilt by design. **Nothing has been run
end to end against a real database yet** — see the next entry to write.

---

## 2026-09-11 — Browser extension finished

**What:** The extension now saves for real. Three right-click contexts (page /
link / image), a default-section picker, a toolbar badge reporting the result,
and the popup rebuilt to the design's three states (Figma node `1:9`: signed
out, ready, after saving). Added toolbar icons and `extension/README.md`.

**Why:** The manifest, service worker, metadata scraper and session-cookie check
already existed; what was missing was everything the user actually sees. The
badge matters more than it looks — a context-menu save happens with the popup
closed, so without it a save gives no feedback at all.

Link and image contexts were added because "save from anywhere" fails on a feed
page: you are looking at a list of posts, not standing on the post's own page.
An image save sends the image URL as both `url` and `thumbnailUrl`; a link save
sends only the URL and lets `/api/save` scrape the rest, rather than saving the
anchor's link text as if it were the page title.

**Touched:**

- `extension/src/background.js` — per-context menu items, default section,
  badge feedback. Menus are `removeAll`-ed on install so an upgrade cannot
  duplicate them.
- `extension/src/lib/save-payload.js`, `default-section.js`, `popup-state.js` —
  new pure modules holding the decisions, so they are testable without a browser.
- `extension/src/popup.{html,js}` — rebuilt to the design, tokens duplicated
  from `app/globals.css` (the extension ships standalone and cannot import them).
- `extension/icons/`, `extension/manifest.json` — icons; permissions unchanged.
- `tests/unit/extension/` — 57 tests.

**Decisions worth not relitigating:**

- The stored default section is **always re-checked against the live list**
  (`resolveDefaultSection`), because sections are renamed and deleted in the web
  app and the extension would otherwise save into a section that no longer exists.
- A `401` recorded during a save **outranks** the cookie check when choosing the
  popup state: a stale cookie can outlive the session it stands for.
- The popup clears `lastSaveOutcome` after showing it once, so reopening later
  falls back to the ready state instead of re-confirming an old save.

**Follow-ups:** **Not verified in a real browser** — the popup's three states
were rendered through a stubbed-`chrome` harness, and the save path has never
run against a live session, so the cookie actually crossing the extension →
`/api/save` boundary is still unproven. Firefox unsupported (needs a `browser.*`
shim and `background.scripts`). `config.js` still hardcodes localhost. No
options page. Direct upload still needs `/api/save-image`.

---

## 2026-09-11 — Mobile responsive pass + OS share-sheet target

**What:** Every screen now works on a phone. The feed drops to a 2-column
masonry, the library sidebar collapses from a 240px column into horizontally
scrolling section/tag strips, and both overlays go full-bleed instead of
floating. Added a web app manifest that registers Cielo as a **Web Share
Target**, plus `/save` — the page the OS share sheet posts into, which doubles
as the paste-a-link fallback.

**Why:** Bookmarks get _consumed_ on a phone even though they are mostly saved
from desktop, so read-only mobile was the gap. For capture, Web Share Target is
the only way to appear in the native share sheet from a web app — but it is
Chromium-only. iOS Safari implements Web Share (sending) and not Web Share
Target (receiving), so there is no way to appear in the iOS share sheet from a
web app at all; `/save` accepts a pasted link so iOS is not dead-ended. An iOS
Shortcut pointed at `/save?url=` would close that gap natively — not built.

**Touched:**

- `app/manifest.ts` — manifest + `share_target` (GET, `title`/`text`/`url`).
- `app/save/`, `components/save/` — share-target landing and paste fallback.
- `lib/share/shared-link.ts` — normalises the share payload; apps disagree about
  whether the link arrives in `url` or buried in `text`, so both are searched.
- `components/auth/login-form.tsx` — split out of `app/login/page.tsx` so it can
  read `?next=`, letting a shared link survive the login round-trip. Only
  same-origin paths are honoured, so it cannot become an open redirect.
- `components/brand/logo.tsx` — sizing moved from a `size` prop to `className`
  so callers can go responsive.
- `public/brand/icon-{192,512}.png` — generated from the mark via `sharp`.
- Responsive passes: `app/page.tsx`, `app/globals.css` (safe-area insets),
  `components/auth/auth-card.tsx`, `components/library/*`, `components/ui/overlay.tsx`.

**Follow-ups:** `/save` has no upload tab (needs `/api/save-image`). No iOS
Shortcut. No offline service worker — install works, offline does not.

---

## 2026-09-11 — Library wired to the real API

**What:** `/library` is an auth-gated server component reading real data. Added
`GET /api/items` (cursor pagination, section/tag filters), `GET|PATCH|DELETE
/api/items/:id`, and `PUT|DELETE /api/items/:id/note`. Demo fixtures deleted.
Added `POST /auth/signout`.

**Why:** `docs/api-contract.md` already specified these routes, so they were
implemented to that spec rather than to a new shape. `PATCH` uses _replace_
semantics on sections/tags because the detail panel's chips need to both attach
and detach — an add-only endpoint would have needed a second delete route.

**Touched:**

- `lib/items/item-service.ts` — `list`, `countAll`, `get`, `remove`,
  `setSectionsAndTags`, `setNote`, `removeNote`. Every method is scoped to the
  session user; ownership is re-checked server-side, never trusted from the body.
- `lib/items/serialize.ts` — the one place the wire shape is defined.
- `lib/items/platform.ts` — pure source-platform helpers, extracted from the
  components so they are testable without JSX.
- `app/api/items/`, `app/auth/signout/`, `app/library/page.tsx`,
  `components/library/*`.
- `tests/integration/` — 19 flow tests running the real routes and services
  against an in-memory Prisma (`fake-prisma.ts`).

**Decisions worth not relitigating:**

- Thumbnails render via a plain `<img>`, **not** `next/image`. The MVP plan's
  cost model depends on hotlinking; routing them through the image optimizer
  would spend the bandwidth that choice exists to avoid. Hosts are arbitrary, so
  `remotePatterns` cannot enumerate them either.
- Sections are **only ever user-named**. There is no classifier and none is
  planned — "General" stays a computed view over every item for the user.

**Follow-ups:** No password reset. `/login` and `/signup` do not bounce an
already-signed-in user. `GET /api/search` still unimplemented (needs the raw
tsvector migration noted at the bottom of `schema.prisma`).

---

## 2026-09-11 — Figma desktop designs implemented

**What:** The five desktop frames from the `cielo` Figma file
(key `7yeCPsJJD9ta3SCzx70zis`) exist as real screens: landing, auth, library,
item detail, save modal. Added the design tokens, the logo/icon assets, and a
process marquee on the landing page.

**Why:** The app was unstyled `create-next-app` scaffolding. Tokens live in
`app/globals.css` as a Tailwind v4 `@theme` block so the palette has one home.

**Touched:**

- `app/globals.css` — tokens (`--color-ink` `#121212`, `--color-accent`
  `#95FF00`, panel/field/row radii) and the keyframes.
- `components/` — `brand/`, `ui/`, `library/`, `landing/`, `auth/`.
- `public/brand/`, `public/icons/` — real exported assets, not hand-drawn SVG.

**Decisions worth not relitigating:**

- Standardised on **Inter**. The landing frame mixed in Helvetica Neue, which is
  not a webfont we can serve.
- The app is **dark-only by design** — every frame sits on `--color-ink`. There
  is no light palette to maintain.
- Verified against Figma numerically, not by eye: sidebar `x=36 w=240 h=830`,
  feed `316→1404`, card `257×330`.

**Follow-ups:** The extension popup frame (`1:9`) is not built. "Sign out" in
the library header is **not in the Figma** — the design has no account
affordance, and login without logout was not shippable.
