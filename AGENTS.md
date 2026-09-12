<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Read this before writing any code

This project keeps a **devlog** at `docs/devlog.md`. It records what changed and
_why_ — including decisions that are already settled, so you do not spend a
session relitigating one.

## Required before you write code

1. **Read `docs/devlog.md` first.** At minimum the three newest entries, plus
   any entry whose **Touched** list overlaps the files you are about to change.
   Pay attention to the "Decisions worth not relitigating" and "Follow-ups"
   sections — they will usually tell you whether the thing you are about to
   "fix" is deliberate, and what is genuinely still missing.
2. **Read the code you are about to change, and its tests.** The devlog explains
   intent; only the code is authoritative about what is true right now. If the
   two disagree, the code wins — and say so, then correct the devlog.
3. **Check `docs/api-contract.md` before adding or calling any route**, and
   `docs/bookmark-app-plan.md` before adding scope. Several routes are already
   specified there but not yet implemented; implement to the spec rather than
   inventing a new shape.
4. **Check `prisma/schema.prisma` and `docs/bookmark-app-erd.mmd`** before
   touching data. The schema carries correction notes explaining where it
   deliberately diverges from the ERD.

## Required after you make a change

Every feature follows the same three steps, in this order.

### 1. Verify

Run `npm run type-check`, `npm run lint`, and `npm test`. A feature is not done
until these pass.

### 2. Log it

Add an entry to the **top** of `docs/devlog.md`, using the format documented in
that file: **What / Why / Touched / Follow-ups**. One entry per coherent change,
not one per file. Be honest in **Follow-ups** about what you knowingly left
undone — that section is the main thing the next agent relies on.

Keep entries short. If an entry runs past ~12 lines, it was probably two changes.

### 3. Commit it

**One commit per feature**, and the devlog entry ships _inside that same commit_
— so the history and the log can never drift apart.

The message subject is **a single line**:

```
<type>: <what changed, imperative, lower case, no trailing period>
```

- Keep it to **72 characters or fewer**. If it will not fit, you are committing
  two features — split them.
- `type` is one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Say what changed, not what you did: `feat: add cursor pagination to items API`,
  not `feat: worked on the API`.
- No body. Detail belongs in the devlog entry, which is in the same commit.
- If your attribution trailer is configured, it goes after a blank line — a
  trailer is not part of the subject, so the message is still one line.

Good:

```
feat: add cursor pagination to items API
fix: stop feed refetching page one on mount
chore: add SQL migrations for RLS and auth user sync
```

Commit only when the work is verified. Do not push unless asked.

## Project ground rules

- **Read `docs/product-principles.md` before adding any user-facing feature.**
  Cielo is a private library: **no ads, no social features, no collaboration, no
  tracking, no metrics, no pressure.** These are constraints, not preferences.
- **Sections are user-named**, and "General" is a computed view over every item,
  not a stored section. AI auto-classification is a **wanted future feature,
  deliberately not in the MVP** — when built it must suggest, never overwrite.
- The app renders on a **light ground**. Design tokens are the only place
  colours live — `--color-accent` is for FILLS only; use `--color-accent-strong`
  for anything drawn as text, an icon, or a border, because the acid green is
  1.27:1 on white. Check contrast when adding a colour; do not eyeball it.
- Design tokens live in `app/globals.css` as a Tailwind v4 `@theme` block. Use
  the tokens, not raw hex.
- Every protected route wraps itself in `withAuth` (`lib/auth/with-auth.ts`).
  `proxy.ts` only refreshes the session cookie — it is **not** the security
  boundary. `userId` always comes from the session, never from the request body.
- Run `npm run type-check`, `npm run lint`, and `npm test` before you call a
  change done.
