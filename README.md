# CLP Hub

Operations platform for a Spanish-language randomized controlled trial: recruitment site, public study content pages, and an internal team dashboard (ES/EN).

**Status: Phase 0 — foundation shell.** No recruitment, screening, randomization, messaging or participant content exists yet. Nothing here is approved for real participant data; see `docs/research-data-boundaries.md`.

## Surfaces

| Surface | Path | Who | Phase |
|---|---|---|---|
| Public recruitment site | `/` | Anyone | 1 |
| Public study content (session prep, integration, VR) | `/estudio/...` | Participants, no login | 4–5 |
| Team dashboard | `/equipo` | Authenticated staff | 0+ |

Participants never authenticate. Staff authenticate with Supabase Auth and hold study-scoped roles.

## Stack

Next.js 16 (App Router, React 19) · TypeScript strict · Tailwind 4 + shadcn/ui · PostgreSQL on Supabase · Drizzle ORM with hand-written SQL migrations · next-intl · Zod · Vitest · pino.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in the Supabase dev project values
npm run db:migrate              # applies supabase/migrations/*.sql
npm run db:seed                 # DEMO study + synthetic staff (needs ALLOW_DEMO_DATA=true)
npm run dev                     # http://localhost:3000/equipo/login
```

Demo logins after seeding: `demo.admin@example.com`, `demo.study-manager@example.com`, `demo.facilitator@example.com`, `demo.researcher@example.com`, `demo.logistics@example.com`, password = `SEED_STAFF_PASSWORD`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (authorization, scoping, audit, env guards) |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Synthetic development data (refuses in production) |

## Documentation

- `docs/architecture.md` — surfaces, layers, request flow, security model
- `docs/domain-model.md` — entities, status enums, phase-by-phase schema plan
- `docs/permissions.md` — roles → permissions matrix
- `docs/automations.md` — events, rules, scheduled actions (design, Phase 8)
- `docs/content-model.md` — versioned study content (design, Phase 5)
- `docs/design-system.md` — tokens, type, motion, theming, accessibility rules
- `docs/research-data-boundaries.md` — what this app must never store
- `docs/development.md` — environments, migrations, seeding, testing
- `docs/decisions.md` — append-only decision log

## Non-negotiables

No randomization algorithm. No invented eligibility criteria. No clinical data. Append-only audit. Synthetic data only in this repository. Trial-specific names, arms, schedules and rules come from configuration, never code.
