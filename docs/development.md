# Development

## Environments

| | development | staging | production |
|---|---|---|---|
| `APP_ENV` | development | staging | production |
| Data | Synthetic only | Synthetic only | Real (only after governance approval) |
| Seeding | `ALLOW_DEMO_DATA=true` | optional | **refused by the script** |
| Supabase | University dev project (manual setup by the founder) | separate project | separate project |

Environment variables are validated with Zod in `src/config/env.ts`; the app fails fast on a bad config. `.env.example` documents every key.

## Database

- Migrations: hand-written SQL in `supabase/migrations/NNNN_name.sql`. Never edit an applied migration; add a new one.
- Apply: `npm run db:migrate` (records names in `schema_migrations`). The same files can be pasted into the Supabase SQL editor.
- Drizzle schema in `src/db/schema` must mirror the SQL. `npm run db:check` runs Drizzle Kit's consistency check.
- Connection: `DATABASE_URL` (transaction pooler, `prepare: false`).

## Seeding

`npm run db:seed` creates the `DEMO` study and five staff accounts (`demo.<role>@example.com`) with `SEED_STAFF_PASSWORD`. It uses the service-role key to create Supabase Auth users and is idempotent. Names and emails are deliberately fake — four of the five display names are the founding team's own first names (see the table in README.md), so the dashboard greeting reads naturally in a demo; emails stay role-based.

Since Phase 5 the seed also publishes three Spanish study pages — `/estudio/preparacion-vr`, `/estudio/ayuda` and `/estudio/sesiones/demo_intro/preparacion` — so the public content surface is browsable immediately.

Since Phase 3b the seed also creates three synthetic session templates — the programme definition, which is where a real trial's session names would live.

Since Phase 3a the seed also creates two synthetic study arms, one cohort, and assigns the demo FACILITATOR to it — which is what makes cohort scoping observable: sign in as `demo.facilitator@example.com` and only that cohort is visible.

Since Phase 2 the seed also creates synthetic screening and consent rows for one applicant (a scheduled screening for another), so the participant and evaluation screens have data. The external references are obviously fake and carry no clinical content.

Since Phase 1 it also opens recruitment on the DEMO study, configures eight application questions and creates three synthetic applications (`P-000001`…). The questions are operational only — contact, availability, referral source, consent (D-014) — and the applicants are obviously fake. Re-running skips applicants whose email already exists, so it will not accumulate duplicates.

## Running

```bash
npm run dev
```

Login: `http://localhost:3000/equipo/login`. Switch language in the header; the choice is stored on the staff profile and audited.

## The scheduled-action processor

`POST /api/internal/process-scheduled-actions` is invoked by Vercel Cron. It
processes due actions and runs the alert sweeps for every ACTIVE study.

```bash
curl -X POST http://localhost:3000/api/internal/process-scheduled-actions   -H "Authorization: Bearer $CRON_SECRET"
```

`CRON_SECRET` is optional in `.env.local` and the endpoint **refuses every
request when it is unset** (503) — an unconfigured deployment is closed, not
open. `GET` is refused with 405 because the endpoint changes state.

It prepares work and never delivers any of it. See `docs/automations.md`.

## Testing


`npm test` runs Vitest. Tests focus on research-sensitive behaviour: authorization matrix, study-scoping resolver, audit row builder, seed guards, locale defaults. Later phases add state-transition, rule-evaluation and execution-time re-check tests. Coverage percentages are not a goal.

`server-only` is aliased to a no-op stub in `vitest.config.mts` so pure modules can be imported; modules that touch the DB should be tested through their pure parts.

## Checks before committing

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Conventions

- Server Components by default; `"use client"` only for state/effects.
- Server Actions validate with Zod and call a service.
- Services own transactions and audit.
- Status values are enums mirrored in `src/domain`.
- UTC in the database; format with the study timezone for display.
- No `any`, no magic strings, no business logic in components.
