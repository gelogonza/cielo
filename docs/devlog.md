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

## 2026-09-12 — Save a highlight from the web app

**What:** The save dialog has a **Quote** tab: paste or write text, optionally
name where it came from. Previously a highlight could only be captured by the
extension.

**Why:** The notes half of "saves and the notes on them" had no entry point in
the app itself.

**The model change:** `/api/save` now accepts `url: null` **when contentType is
TEXT** — a thought you write down need not come from anywhere. Postgres treats
a null url as distinct under `unique(user_id, url)`, so sourceless quotes never
collide with each other; `saveLink` skips the dedup lookup entirely when there
is no url, and stores them as `sourceType: DIRECT`.

**Touched:** `components/library/save-modal.tsx`, `app/api/save/route.ts`,
`lib/items/item-service.ts`, `docs/api-contract.md`, tests.

**Regression caught by an existing test:** making `url` optional broke the
contract's 400-vs-422 split — Zod stops before object-level refinements once a
field fails, so a missing url alongside an invalid contentType looked
contentType-only and answered 422. The handler now checks the raw body for that
case. The test that caught it was pinning documented behaviour, not an
implementation detail.

**Also worth remembering:** the new tests initially "passed the wrong way" — a
`describe` block without its own `beforeEach` inherits mock call counts from
the block above, so `not.toHaveBeenCalled()` assertions were meaningless.

**Verified live:** a sourceless quote saved with `url: null`,
`sourceType: DIRECT`; two of them got distinct ids.

**Follow-ups:** Quote cards still clamp at 12 lines in the feed — opening the
item shows the whole thing, which seems right for a grid.

---

## 2026-09-12 — Pinterest saves get real titles

**What:** An image save now takes its title from the **right-clicked image's own
`alt`**, and any title that is merely the site's own name is dropped.

**Why:** Every Pinterest save came back titled "Pinterest". Pinterest answers
`og:title: "Pinterest"` on its feed and pin pages, so an image save inherited
the brand — and on a feed page _every_ image would have shared that one title
anyway. The thumbnails were always correct; only the titles were wrong.

**Kept general on purpose:** no Pinterest special-casing. An image's `alt`
describes that image better than the page title on any site, and `og:site_name`
is a published, standard way to recognise a brand-only title. Per-platform DOM
scraping was rejected earlier as brittle and still is.

A dropped title is stored as `null`, which shows the domain on the card — worse
than a real title, better than a false one.

**Touched:** `extension/src/content-script.js` (resolves the clicked image by
src), `extension/src/background.js` (passes `srcUrl` through),
`extension/src/lib/{extract-metadata,save-payload}.js`, tests.

**Also:** backfilled the four existing "Pinterest"-titled rows to `null`.

**Follow-ups:** A page save of a Pinterest _feed_ still gets their generic share
image as its thumbnail. Nothing general fixes that — the site publishes it
deliberately for logged-out scrapers.

---

## 2026-09-12 — Password reset

**What:** `/forgot-password` emails a reset link; `/reset-password` sets the new
password. Linked from the login form. Also routed `/auth/callback`'s `next`
through `safeNext`.

**Why:** Without it a forgotten password locked someone out of their library
permanently — the last genuine hole in auth.

**How it hangs together:** the emailed link points at `/auth/callback`, which
already exchanges a code for a session, then forwards to `/reset-password`.
**There is no token in the reset page** — the session _is_ the authorisation,
so the page just calls `updateUser({ password })`. That reuses the OAuth
callback rather than adding a second token-handling path.

**Touched:** `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` (both
new), `components/auth/login-form.tsx`, `app/auth/callback/route.ts`,
`tests/unit/auth/callback.test.ts`.

**Security note:** the callback pasted `next` straight onto the origin. The
reset flow makes that parameter attacker-reachable, so it now goes through the
same `safeNext` guard the login form uses, with tests for an absolute URL and a
protocol-relative one.

**Verified against live Supabase:** requesting a reset issued a real recovery
token (`recovery_sent_at` and `recovery_token` set on `auth.users`); the
mismatch guard fired; a matching pair changed the password; and signing out and
logging back in **with the new password** worked.

**Follow-ups:** No rate limiting of our own on the request form — Supabase
throttles, but a deployed app should not rely only on that.

---

## 2026-09-12 — Page shimmer

**What:** A slow white/silver band drifts diagonally across the landing's
ground, so the page reads as faintly lit rather than flat. 18s, eased, at 70%
opacity.

**Why:** Requested. Kept "slight" — on a `#f7f7f8` ground the white half is
nearly invisible and the silver half does the work, which is what makes it read
as sheen instead of a moving stripe.

**Decisions worth not relitigating:**

- **Landing only.** A drifting highlight behind the library would be a
  distraction while someone is actually working. Extending it is one class on
  another page if that changes.
- Sits at `z-index: 0` with the landing's `<main>` lifted to `z-10`, so it is
  above the page ground and below everything readable — never between a reader
  and the text. `pointer-events: none`, `aria-hidden`.
- `prefers-reduced-motion` removes it (`display: none`).

**Touched:** `app/globals.css`, `app/page.tsx`.

**Verified:** the band's `translateX` measured moving (-724 → -739 over 1.5s),
no overflow at 1440px.

---

## 2026-09-12 — Hero glow and tagline

**What:** The hero wash is now a real blurred radial glow in the accent green,
centred behind the wordmark, with "Save everything all to one place" beneath it.

**Why:** Requested. The previous wash was a soft gradient with no `filter`, so
it read as a faint tint rather than a glow.

**The bug worth remembering:** the first attempt appeared not to change
anything. There were **two `.hero-wash::before` rules** in `globals.css` — an
earlier edit inserted the new block but left the original further down the file,
and the later rule won. Computed `top` came back as `-204px` when the source
said `50%`, which is what gave it away. When a CSS change seems to do nothing,
read the _computed_ value before re-editing the source.

**Also:** the revealed section's "All your bookmarks in one place" is gone. With
the hero carrying its own tagline, the two lines were saying the same thing
twice; the section keeps the descriptive copy and the CTAs.

**Touched:** `app/globals.css`, `app/page.tsx`.

**Decisions worth not relitigating:**

- The hero is `overflow-x-clip` so a 64px blur cannot widen the page. Safe here
  specifically because nothing inside the hero uses a `view()` timeline — see
  the collage entry for why that distinction matters.
- `h1` stays "Cielo" and the tagline is a `p`.

**Positioning, after trying both:** the glow sits **high, bleeding up behind the
navbar** — it reads as light entering the page from above. Centring it on the
wordmark was tried and rejected: it turned into a backdrop for the text rather
than atmosphere.

**Wordmark size:** `13vw` at lg (187px at 1440), down from `18vw`.

**Verified:** computed wash `top: -143px`, `blur(72px)`, `h1` 187px desktop /
79px mobile, no overflow at 1440px or 375px.

---

## 2026-09-12 — Wordmark-only hero and scroll-driven reveals

**What:** The first screen is now just "Cielo" filling the viewport. Everything
below — tagline, CTAs, collage, sections — fades up as it scrolls in, and the
collage tiles slide in from alternating sides. Dropped the "Welcome to Cielo"
pill.

**Why:** Requested. `All your bookmarks in one place` moved from the `h1` into
the first revealed section, so the page still has a real heading.

**Decisions worth not relitigating:**

- **CSS scroll-driven animations, not IntersectionObserver.** The whole block
  sits inside `@supports (animation-timeline: view())`, so everything is fully
  visible by default: a browser without scroll timelines (Firefox, currently)
  shows a normal page, and nothing needs JavaScript to become readable. An IO
  implementation has to start elements hidden, which breaks exactly that.
- Reveals end at ~30% cover so content settles before you read it, rather than
  still drifting.

**The bug worth remembering:** the tile animations completed instantly and never
played. `.collage-fade` had `overflow-hidden`, which makes an element a **scroll
container** — so each tile's `view()` timeline resolved against that
never-scrolling box instead of the page, and every tile was permanently "fully
in view". `overflow-x-clip` clips without creating a scroll container. Anything
using `view()` must not sit inside an `overflow: hidden` ancestor.

**Touched:** `app/page.tsx`, `app/globals.css`,
`components/landing/hero-collage.tsx`.

**Verified:** tiles measured mid-scroll at `translateX ±56 / opacity 0` before
entry and `±2 / 0.97` settling, alternating sides, all 15 animating. No overflow
at 1440px or 375px.

---

## 2026-09-12 — Landing splash and a welcome line

**What:** A full page load of the landing now opens with a splash — the mark
spins in, "Cielo" rises beneath it, the panel clears after ~2.1s — and the hero
carries a "Welcome to Cielo" line above the headline.

**Why:** Requested. The splash is on the landing route only; it never sits
between a signed-in user and their library.

**Decisions worth not relitigating:**

- **CSS-only, no JS state.** A JS-gated splash has to decide whether to show
  _during_ render, which either mismatches hydration or flashes the page before
  covering it. An animation with `forwards` just plays and gets out of the way.
- It plays on **every full page load**, not once per session. Client-side
  navigation within the app does not retrigger it, so it stays a page-load
  moment rather than something you hit repeatedly.
- The spin lands on `-160.69deg` — the same angle the mark wears everywhere
  else — so the splash resolves into the nav logo rather than snapping.
- `prefers-reduced-motion` removes it entirely (`display: none`), not just the
  animation. Content is in the DOM underneath the whole time.

**Touched:** `components/landing/splash.tsx` (new), `app/page.tsx`,
`app/globals.css`.

**Verified:** caught mid-spin and at the wordmark, then confirmed it ends at
`opacity: 0`, `visibility: hidden`, intercepting no pointer events, with
`aria-hidden="true"`.

**Follow-ups:** ~2.1s is a guess at the right length; shorten it in
`globals.css` if it starts to feel long on repeat visits.

---

## 2026-09-12 — Landing rebuilt; logo back to the exact accent green

**What:** New landing composition — editorial hero with a soft accent wash and
two CTAs, then a masonry collage of abstract tiles that dissolves into the page,
then How to / Features / About. Logo reverted to `cielo-mark.svg`.

**Why:** Asked for a mix of mymind, Cosmos and Pinterest in our colours. What
those three share is that **the grid is the argument** — so the collage sits
directly under the hero rather than being described in copy.

**Decisions worth not relitigating:**

- **The collage is abstract gradients, not imagery.** It must never show real
  saves: a library is private (`docs/product-principles.md`), and stock photos
  would misrepresent what the product holds.
- The logo uses the **exact accent `#95FF00`**, matching every other accent.
  That is 1.27:1 on white, so it reads as a soft brand shape — a deliberate
  brand call, made twice, not an oversight. The earlier dark disc and the
  darkened `#569400` lockup were both rejected; `cielo-mark-light-bg.svg` is
  deleted so there is one mark, not two.

**Touched:** `components/landing/hero-collage.tsx` (new), `app/page.tsx`,
`app/globals.css` (`.hero-wash`, `.collage-fade`), `components/brand/logo.tsx`.

**Verified:** 1440px and 375px, no overflow at either. The wash was `120%` wide
and pushed mobile scroll width to 413px — now capped at `100%`.

**Follow-ups:** Landing copy is still my first draft and wants a rewrite in your
voice. No footer.

---

## 2026-09-12 — Search actually works

**What:** `GET /api/search` is implemented and the library's search field is
wired to it — debounced, and it replaces the feed. Matches an item's title, a
highlight's captured text, its tag names and its url.

**Why:** The field had been decorative since it was built; the animated
placeholder was advertising a feature that did not exist.

**Touched:** `prisma/manual-sql/006_search_vector.sql` (new — supersedes the
never-applied 001, which predated `items.body`), `lib/items/item-service.ts`
(`search`), `app/api/search/route.ts` (new), `components/library/{search-field,library-view}.tsx`,
`docs/api-contract.md`, `prisma/schema.prisma` (comment).

**Decisions worth not relitigating:**

- The tsvector column is **deliberately absent from `schema.prisma`**. Prisma
  cannot express a generated column, and nothing should read or write it
  through the client — matching ids come from `$queryRaw`, then the rows are
  loaded through Prisma so relation loading and the wire shape stay identical
  to `list()`.
- `websearch_to_tsquery`, not `plainto_tsquery`: users get quoted phrases and
  `-exclusion` for free.
- Results are **newest-first, not relevance-ranked**, so the `savedAt` cursor
  contract is the same one `/api/items` uses.
- Search **replaces** the section/tag filter rather than combining — a query is
  a whole-library question, and `/api/search` has no section parameter.

**Verified:** against the live database — a title word returned 4, a word from
inside a saved quote returned 1, a tag name 1, a url host 3, and the quoted
phrase `"personal search engine"` 1. Then through the UI end to end.

**Also verified:** the route-level skeleton. `loading.tsx` completes too fast
locally to see, so the streamed HTML was inspected directly: 40 skeleton nodes
and the busy label arrive **before** the real content.

**Follow-ups:** No relevance ranking. No integration coverage — the in-memory
`FakePrisma` has no `$queryRaw`, so search is covered by route unit tests plus
the live check above.

---

## 2026-09-12 — Search bar: animated ring and typed placeholder

**What:** The library's search field gained a slow glint travelling around its
hairline border, and a placeholder that types and deletes example searches
("graphic design", "ocean", "windows xp", …).

**Why:** Requested, and it hints at what the field is for while it is still
empty. Deliberately muted: a 7s rotation and an accent mixed 40% into the line
colour, not a bright chase.

**Touched:** `components/library/search-field.tsx`, `app/globals.css`.

**Decisions worth not relitigating:**

- `aria-label` stays `"Search anything"` while the visible placeholder changes,
  so a screen reader never has the field's accessible name shift mid-sentence.
- Both animations **stop permanently** on first focus or input. Resuming a demo
  while someone is composing their own query would be maddening.
- The ring's rotation needs `@property` to interpolate an angle. Browsers
  without it render the gradient's first frame, which is an ordinary border —
  so the fallback is the previous design, not a broken one.
- `prefers-reduced-motion` drops both: static border, static "Search anything".

**Verified:** in the browser — placeholder observed mid-word, ring animation
`running`, both held after a real `focusin`.

**Follow-ups:** Still presentational. Typing in it filters nothing;
`GET /api/search` remains unimplemented.

---

## 2026-09-12 — Logo: light-ground lockup instead of a dark disc

**What:** Removed the dark disc added behind the logo in the light-theme commit.
The mark now uses `cielo-mark-light-bg.svg` — the same artwork with the green
darkened from `#95FF00` to `#569400`.

**Why:** The disc read as a badge rather than a logo. Neon on white is 1.27:1,
so the mark still needed help; a darker lockup for light backgrounds is the
normal answer for a neon brand colour, and 3.73:1 keeps it clearly visible
without going muddy.

**Touched:** `public/brand/cielo-mark-light-bg.svg` (new), `components/brand/logo.tsx`,
`app/globals.css` (dropped the now-unused `--color-brand-ground`).

**Worth knowing:** the variant is a **palette swap of the exported asset** —
four `fill` values, same geometry. The neon original is still what the favicon
and PWA icons composite onto dark, so both files are live and should stay in
step if the mark is ever redrawn.

---

## 2026-09-12 — Light theme, skeleton loaders, smaller nav and search

**What:** The app now sits on a light ground. Added skeleton loaders (route-level
for the library's first paint, inline for filter changes and paging). Shrank the
search field again and the navbar's links and buttons.

**Why:** Requested. **This reverses a rule I had written into `AGENTS.md` and
`docs/product-principles.md` ("dark-only by design, do not add a light theme").
That was my inference from the Figma, not a product decision — both files are
corrected.**

**What a light ground actually broke** (none of it was a simple inversion):

- `muted` at `#9e9e9e` is **2.68:1** on white — fails AA. Darkened to `#6b6b70`
  (5.30:1). Contrast was measured, not eyeballed.
- The accent is **1.27:1** as text on white. `--color-accent` is now fills only;
  `--color-accent-strong` (`#3f6e00`, 6.10:1) is its text/border/focus sibling.
- "Selected" chips were `bg-white` — invisible on a light ground. Now `bg-accent`,
  matching the sidebar's active row.
- The logo is acid green on transparent and vanished on white. It now wears the
  same dark disc it already had as a favicon and app icon.
- Cards needed a hairline: a white-backed thumbnail has no edge against a white
  page, which dark mode got for free from fill contrast.
- The marquee's tints were hardcoded dark greys — twelve dark rectangles.

**Touched:** `app/globals.css` (tokens), `app/library/loading.tsx` (new),
`components/library/card-skeleton.tsx` (new), `components/brand/logo.tsx`,
`components/landing/{landing-nav,process-marquee}.tsx`,
`components/library/{item-card,library-view,search-field,sidebar}.tsx`,
`components/ui/chip.tsx`, `components/auth/auth-card.tsx`,
`extension/src/popup.html`, `AGENTS.md`, `docs/product-principles.md`.

**Decisions worth not relitigating:**

- Switching section now **clears the feed** before loading. Leaving the previous
  section's items up while the sidebar already highlights the new one shows
  content that does not belong to the active filter.
- The extension popup keeps its own copy of the tokens (it ships standalone) and
  was flipped to match. The two must be changed together.

**Follow-ups:** No dark mode — this is a straight swap, not a theme toggle. If
one is ever wanted, the tokens are the only place to branch.

---

## 2026-09-12 — Landing gets a floating navbar; search moves to the library

**What:** The landing page's search field is replaced by a floating pill navbar
— logo, How to / Features / About, Log in, Sign Up — and the page gained the
three sections those links point at. The search field now renders only in the
library, and is roughly half its old size there.

**Why:** A search box on a signed-out landing page has nothing to search. The
anchors point at real sections rather than dead links.

**Touched:** `components/landing/landing-nav.tsx` (new), `app/page.tsx`,
`components/library/search-field.tsx`. Auth screens untouched.

**Decisions worth not relitigating:**

- The nav scrolls horizontally rather than wrapping. A wrapped link makes the
  pill two rows tall and pushes Sign Up off a 375px screen — which is exactly
  what the first attempt did.
- Landing copy for Features/About is drawn from `docs/product-principles.md`
  rather than invented. **It is a first draft and should be rewritten** by
  someone who wants to own the voice.

**Verified:** at 1440px and 375px — nav single-row on mobile with Sign Up fully
on screen and no page overflow; login unchanged apart from the new typeface.

**Follow-ups:** The search field is still presentational — typing in it filters
nothing. `GET /api/search` remains unimplemented.

---

## 2026-09-12 — Typeface switched to Satoshi

**What:** The app now renders in Satoshi, self-hosted via `next/font/local`,
replacing Inter. The `--font-sans` token is the only place the family is named.

**Why:** Requested. Self-hosted rather than loaded from Fontshare's CDN because
a webfont request to a third party is a request we do not control, and
`docs/product-principles.md` means "no tracking" literally. It also removes a
render-blocking dependency on someone else's uptime.

**Touched:** `public/fonts/Satoshi-{400,500,700,900}.woff2` (from Fontshare,
free licence), `app/layout.tsx`, `app/globals.css`.

**Verified:** `document.fonts` reports the 400/500/700 faces loaded in the
browser — not silently falling back to system sans.

**Follow-ups:** 900 is bundled but unused; drop it if the weight never gets
used. No italic faces.

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
