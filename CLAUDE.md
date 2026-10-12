# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project location

`/Users/josh/Code/fox-excel-recruiter` — moved out of `~/Desktop` on 2026-07-02 to avoid macOS TCC permission restrictions that caused the PM2 daemon to lose filesystem access after several days of uptime.

## What this app is

**Fox Excel Recruiter** is an internal kitchen staff screening tool for Fox Excel — a 1,200-capacity gastro pub and events venue next to ExCeL London. It screens candidate CVs using Claude AI against one role:

- **CDP** — Chef de Partie in a pub kitchen (section ownership, busy service, working under a Head Chef)

The app is live and in active use. There is no test environment — changes affect the real Neon database.

## Commands

```bash
npm run dev          # Start dev server (runs on port 3000 by default; use -- --port 3002 to avoid conflicts)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type-check without building

# Database
npx prisma migrate dev --name <name>   # Create + apply a migration interactively
npx prisma migrate deploy              # Apply existing migrations non-interactively (used when interactive fails)
npx prisma generate                    # Regenerate Prisma client after schema changes
npx prisma studio                      # Browse database
```

## Architecture

### Stack
- **Next.js 14** (App Router, all server components except `/recruit` which is `"use client"`)
- **Prisma 7** with `@prisma/adapter-pg` driver adapter — connection URL goes in the `PrismaClient` constructor, NOT in `schema.prisma`
- **Neon PostgreSQL** — serverless Postgres, connection string in `DATABASE_URL`
- **Anthropic SDK** (`claude-sonnet-4-5`) — instantiated per-request inside handlers, never at module level
- **Tailwind CSS** — no component libraries

### Key structural decisions

**Prisma 7 quirks:** The datasource `url` is not in `schema.prisma` (Prisma 7 moved it out). It lives in `prisma.config.ts` for migrations and in `lib/prisma.ts` via `PrismaPg({ connectionString: ... })` for runtime. The client singleton is in `lib/prisma.ts`.

**Anthropic client instantiation:** The SDK client is created inside each request handler via `getClient()`, not at module level. This is intentional — Next.js injects env vars after module initialisation, so a module-level `new Anthropic()` will miss them.

**Env var name:** The Anthropic API key is stored as `FOX_EXCEL_ANTHROPIC_KEY` (not `ANTHROPIC_API_KEY`). This is because Claude Code's own runtime sets `ANTHROPIC_API_KEY=""` as an empty system env var, which silently overrides `.env` values and causes auth failures. The renamed key is in both `.env` and `.env.local`.

**Claude JSON responses:** `claude-sonnet-4-5` wraps JSON in markdown fences despite instructions. The screen route strips ` ```json ... ``` ` fences before `JSON.parse()`.

**`strengths` and `concerns`** are stored as JSON strings in the DB (plain `String` columns), not arrays. Always `JSON.stringify()` before saving and `JSON.parse()` when rendering.

### Data model

```
Candidate (one per CV submission)
  ├── id, name, email?, cvText, createdAt
  └── screenings: ScreeningResult[]  ← one-to-many

ScreeningResult (one per candidate: CDP only)
  ├── role: Role  (CDP)
  ├── verdict: "STRONG FIT" | "WORTH INTERVIEWING" | "BORDERLINE" | "NOT SUITABLE"
  ├── overallScore, volumeScore, leadershipScore, venueFitScore, commitmentScore (all Int 1–10)
  ├── strengths, concerns  (JSON strings — arrays serialised)
  └── recommendation (String)

@@unique([candidateId, role])  — one result per role per candidate
```

### Routes

| Route | Purpose |
|---|---|
| `GET /recruit` | Screen form — upload PDF/.docx or paste CV; single CDP result |
| `GET /recruit/candidates` | History table — CDP verdict per candidate |
| `GET /recruit/candidates/[id]` | CDP result detail view with raw CV |
| `POST /api/recruit/screen` | Single Claude call for CDP, saves candidate + 1 result |
| `POST /api/recruit/extract` | Accepts `multipart/form-data` file upload; extracts text via `pdf-parse` (v1) or `mammoth` |

### CV file extraction

- **PDF**: `require("pdf-parse")` — must use `require()`, not ESM import; v1 only (v2 changed to a class-based API and breaks)
- **DOCX**: `import("mammoth").extractRawText()`
- Both normalise whitespace and collapse blank lines before returning

### UI conventions

- No dark mode — `globals.css` has a fixed light-mode `--foreground: #171717`. The `@media (prefers-color-scheme: dark)` block was intentionally removed.
- Verdict badge colours: green = STRONG FIT, blue = WORTH INTERVIEWING, amber = BORDERLINE, red = NOT SUITABLE
- All pages share the same header pattern with a nav link to the opposite page

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `.env` | Neon PostgreSQL connection string |
| `FOX_EXCEL_ANTHROPIC_KEY` | `.env` + `.env.local` | Anthropic API key — renamed to avoid system env conflict |

Both files must be present. `.env.local` takes precedence and is the definitive source for the API key.
