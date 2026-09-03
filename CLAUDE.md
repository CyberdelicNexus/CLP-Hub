@AGENTS.md

# CLP Hub — Agent Notes

Research study operations platform (RCT). Read `README.md` and the docs it lists before changing anything. The full product brief lives with the founder; `docs/` is the in-repo canon.

## Operating rules (binding)

1. **One phase at a time.** Current phase is recorded in `docs/decisions.md`. Do not start the next phase without explicit approval.
2. **Inspect before modifying.** Do not rewrite working architecture for stylistic preference.
3. **Never** implement randomization, eligibility criteria, clinical rules, or AI decisions about participants. Surface them as open questions.
4. **Never** store Category C research/clinical data (see `docs/research-data-boundaries.md`).
5. **Audit every research- or permission-relevant change** via `recordAuditEvent` inside the same transaction. Audit rows are append-only.
6. **No hardcoded trial specifics.** Study arms, session names, schedules, quotas, message timings are configuration.
7. **Spanish first** for anything participant-facing. Staff UI strings go in `messages/*.json` via translation keys; study content goes in the database (Phase 5), never in the message files.
8. **Authorization lives in code**: `src/domain/permissions.ts` + `src/auth/authorize.ts`. Never branch on role names in feature code. RLS is a deny-all safety net, not the permission system.
9. **Synthetic data only.** Seeds must be obviously fake.
10. Do not claim compliance or production readiness.

## Next.js 16 specifics

`cookies()`, `headers()`, `params`, `searchParams` are Promises. `src/proxy.ts` is the (renamed) middleware. Verify APIs against `node_modules/next/dist/docs/`.

## Where things live

| Concern | Path |
|---|---|
| Env validation | `src/config/env.ts` (server), `env-schema.ts` (pure) |
| Domain enums, permissions, nav | `src/domain/` |
| DB schema (Drizzle) + client | `src/db/` — migrations in `supabase/migrations/` |
| Auth session, study context, authorize | `src/auth/` |
| Audit primitive | `src/audit/record.ts` |
| Business logic | `src/services/` (transactions + audit) |
| Server actions | colocated `actions.ts` under `src/app/` |
| i18n | `src/i18n/`, `messages/es.json`, `messages/en.json` |
| Tests | `tests/` (Vitest) |

## Before declaring anything done

`npm run typecheck && npm run lint && npm test && npm run build`. Update `docs/` in the same change. Add a `docs/decisions.md` entry for any non-obvious choice.
