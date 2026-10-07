# CLP Hub

Operations platform for a Spanish-language randomized controlled trial: recruitment site, public study content pages, and an internal team dashboard (ES/EN).

**Status: Phases 0–8 — operations, logistics, messaging and automation.** Staff triage, screening with recorded exclusion reasons, digital and in-person consent, cohorts with configured size bounds, recorded allocations, sessions, attendance, versioned public study pages, per-participant responsibles and initial visits, VR device logistics, WhatsApp message templates, and configurable automation rules that prepare work and raise alerts all exist.

**Nothing in this repository sends anything.** Automation schedules, re-checks and *prepares*; a person copies the message and sends it (D-004, D-039, D-043).

Initial screening happens in Qualtrics: `/clearlight/participar` collects nothing and hands people off, and identifiable screening data stays there (D-031). Nothing here is approved for real participant data; see `docs/research-data-boundaries.md`.

## Surfaces

| Surface | Path | Who | Phase |
|---|---|---|---|
| Public recruitment landing page (Clear Light, hands off to Qualtrics, collects nothing) | `/clearlight` | Anyone | D-042 |
| Placeholder home page for the domain root | `/` | Anyone | D-104 |
| Qualtrics hand-off explanation | `/clearlight/participar` | Anyone | 1, 4a |
| Public study content (session prep, integration, VR) | `/clearlight/estudio/...` | Participants, no login | 5 ✓ |
| Team dashboard | `/equipo` | Authenticated staff | 0+ |
| VR logistics | `/equipo/logistica-vr` | `logistics.read` | 6 ✓ |
| Message templates and the prepared queue | `/equipo/comunicaciones` | `communications.read` | 7, 8 ✓ |
| Tasks | `/equipo/tareas` | `tasks.read` | 8 ✓ |
| Alerts | `/equipo/alertas` | `alerts.read` | 8 ✓ |
| Team and roles | `/equipo/equipo` | `team.read` | 8 ✓ |
| Study settings and automation rules | `/equipo/configuracion` | `study.settings.manage` | 8 ✓ |
| Scheduled-action processor (cron, secret-protected) | `POST /api/internal/process-scheduled-actions` | `CRON_SECRET` | 8 ✓ |

Participants never authenticate. Staff authenticate with Supabase Auth and hold study-scoped roles; this application grants and revokes roles but cannot create an account (D-044).

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

The seed also opens recruitment on the DEMO study, configures eight operational application questions and creates three synthetic applications, so `/clearlight/participar` and `/equipo/solicitudes` are usable immediately. It ships four synthetic automation rules — demonstrations of the rule shape, not this trial's schedule.

Demo logins after seeding, password = `SEED_STAFF_PASSWORD`:

| Person (display name) | Role | Email |
|---|---|---|
| Cathy | ADMIN | `demo.admin@example.com` |
| Jose | STUDY_MANAGER | `demo.study-manager@example.com` |
| Joana | FACILITATOR | `demo.facilitator@example.com` |
| David | LOGISTICS | `demo.logistics@example.com` |
| Demo RESEARCHER | RESEARCHER | `demo.researcher@example.com` |

Emails stay role-based (unchanged); only the display name is a person's name, so the facilitator-scoping walkthrough below still resolves to the same account.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (authorization, scoping, audit, env guards) |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Synthetic development data (refuses in production) |
| `node scripts/landing-media.mjs` | Regenerate landing-page media derivatives from the handoff package |

## Documentation

- `docs/architecture.md` — surfaces, layers, request flow, security model
- `docs/domain-model.md` — entities, status enums, phase-by-phase schema plan
- `docs/permissions.md` — roles → permissions matrix
- `docs/automations.md` — events, rules, scheduled actions, sweeps, the processor
- `docs/content-model.md` — versioned study content (design, Phase 5)
- `docs/design-system.md` — tokens, type, motion, theming, accessibility rules
- `docs/landing-page.md` — the public recruitment landing page: structure, media, gate, missing content
- `docs/research-data-boundaries.md` — what this app must never store
- `docs/development.md` — environments, migrations, seeding, testing
- `docs/deployment.md` — Vercel: environment variables, what each `APP_ENV` serves, first deploy
- `docs/decisions.md` — append-only decision log

## Non-negotiables

**Nothing sends.** There is no HTTP client, credential or endpoint in the communications or automation features; `tests/communication.test.ts` and `tests/automation.test.ts` assert the absence. No randomization algorithm — `src/domain/randomization.ts` records allocations made elsewhere and is guarded by a test asserting it contains no source of randomness. No invented eligibility criteria. No clinical data. Append-only audit. Synthetic data only in this repository. Trial-specific names, arms, schedules and rules come from configuration, never code.
