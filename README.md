# cielo

Save content from anywhere — TikTok, Instagram, X, any webpage, or a direct upload — into one
central, searchable library, instead of saves being scattered across each platform's native
bookmark feature.

## Tech stack

Next.js (Vercel) · Prisma · Supabase (Postgres + Auth) · AWS S3 · Chrome extension (Manifest V3)

Full rationale for each choice is in [`docs/bookmark-app-plan.md`](docs/bookmark-app-plan.md).

## Prerequisites

- Node.js 24+
- npm
- A Supabase project (Postgres + Auth) — [supabase.com](https://supabase.com)
- An AWS account with an S3 bucket and an IAM user scoped to it (for Tier 3 direct uploads)

## Setup

```bash
git clone <repo-url>
cd cielo
npm install
cp .env.example .env   # fill in values — see table below
npx prisma migrate dev # applies prisma/schema.prisma to your Supabase Postgres instance
npm run dev
```

The initial migration doesn't include the full-text search index (Prisma can't express generated
`tsvector` columns without a preview feature) — apply
[`prisma/manual-sql/001_search_vector.sql`](prisma/manual-sql/001_search_vector.sql) as a follow-up
migration once the base schema is in place; that file has the exact commands.

## Environment variables

| Variable                               | Description                                           | Where to get it                                  |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                         | Postgres connection string, used by Prisma            | Supabase dashboard → Project Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL, used by the Auth client SDK     | Supabase dashboard → Project Settings → API      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key, used by the Auth client SDK | Supabase dashboard → Project Settings → API      |
| `AWS_REGION`                           | Region of the S3 bucket used for direct uploads       | AWS S3 console                                   |
| `AWS_S3_BUCKET_NAME`                   | Bucket name for direct uploads                        | AWS S3 console                                   |
| `AWS_ACCESS_KEY_ID`                    | IAM user access key, scoped to the upload bucket only | AWS IAM console                                  |
| `AWS_SECRET_ACCESS_KEY`                | IAM user secret key                                   | AWS IAM console                                  |

## Project structure

```
app/         Next.js App Router — pages and API route handlers
lib/         Service/logic layer (e.g. lib/items/, lib/db.ts) — route handlers call into this
prisma/      schema.prisma, migrations, and manual-sql/ (raw SQL Prisma can't express)
extension/   Chrome extension (Manifest V3, Tier 1 DOM-scrape capture)
tests/       tests/unit (service-layer, isolated) and tests/integration (API routes, real test DB)
docs/        Product plan, data model diagrams, API contract, and engineering standards
```

## Tests

```bash
npm test               # full suite
npm run test:watch     # watch mode
npm run test:unit      # service-layer tests only
npm run test:integration  # API route tests against a test database only
```

## Running the extension locally

```bash
npm run build:extension   # bundles extension/src/content-script.js -> extension/content-script.js
```

Then in Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → select the
`extension/` folder. It targets `http://localhost:3000` by default (see
`extension/src/lib/config.js`) — run `npm run dev` first so right-click "Save to Cielo" and the
popup's login check have something to talk to. Re-run `build:extension` after editing
`extension/src/content-script.js` or its `lib/` imports; other extension files (`background.js`,
`popup.js`) are loaded as native ES modules and don't need bundling.

## Reference docs

- [`schema.prisma`](prisma/schema.prisma) — data model
- [`docs/api-contract.md`](docs/api-contract.md) — endpoint request/response shapes
- [`docs/bookmark-app-architecture.mmd`](docs/bookmark-app-architecture.mmd) /
  [`docs/bookmark-app-erd.mmd`](docs/bookmark-app-erd.mmd) — system and data diagrams
- [`docs/engineering-standards.md`](docs/engineering-standards.md) — process, review checklist,
  security checkpoints, build order
