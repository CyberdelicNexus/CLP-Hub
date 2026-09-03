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

`npm run db:seed` creates the `DEMO` study and five staff accounts (`demo.<role>@example.com`) with `SEED_STAFF_PASSWORD`. It uses the service-role key to create Supabase Auth users and is idempotent. Names and emails are deliberately fake.

## Running

```bash
npm run dev
```

Login: `http://localhost:3000/equipo/login`. Switch language in the header; the choice is stored on the staff profile and audited.

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
