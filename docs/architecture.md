# Architecture

## Shape

One Next.js application, one Postgres database (Supabase), one scheduled-job mechanism (Vercel Cron). No microservices, no message brokers, no GraphQL.

```
Browser ──► Next.js (Vercel)
              ├─ (public)   numadelic.org home at /; under /clearlight the recruitment site (ES/EN/GL) + study content pages   [no auth]
              └─ (team)     /equipo dashboard                                 [Supabase Auth]
                    │
                    ▼
              src/services/*  ── business logic, transactions, audit
                    │
                    ▼
              Drizzle ──► Postgres (Supabase)  ◄── scripts/ (migrate, seed)
```

## Surfaces

- **Public site** (`src/app/(public)`): recruitment pages and, later, blog-style study content (session preparation, integration, VR preparation, troubleshooting). Spanish-first. Contains **no participant data**, because participants never log in.
- **Team dashboard** (`src/app/(team)/equipo`): staff only. Locale switchable ES/EN per user. Study-scoped.

There is no authenticated participant hub (decision D-003).

## Layers

| Layer | Path | Rule |
|---|---|---|
| Domain | `src/domain` | Pure constants, enums, permission matrix, navigation. No I/O. |
| Auth | `src/auth` | Session resolution, study context, authorization guards. |
| Services | `src/services` | All writes. Transaction + audit together. Accept a `StudyContext` where study-scoped. |
| DB | `src/db` | Drizzle schema mirrors SQL migrations. Single server-side handle. |
| App | `src/app` | Server Components and Server Actions. Thin: validate input (Zod), call a service, render. |
| Components | `src/components` | Presentational. `ui/` is shadcn; `team/` is the dashboard frame. |

Business logic must not live in components or route files.

## Request flow (team area)

1. `src/proxy.ts` refreshes the Supabase session cookie and does an optimistic redirect to `/equipo/login` when unauthenticated.
2. `(app)/layout.tsx` calls `requireStaffSession()` (real check) and `getStudyContext()`.
3. `getStudyContext()` resolves the active study from the `clp_study` cookie, **validated against the user's active memberships**, and computes the permission set.
4. Pages and actions call `assertPermission(ctx, "...")` or filter by `ctx.permissions`.
5. Services receive the context and run transactions that include `recordAuditEvent`.

## Security model

- Staff identity: Supabase Auth (email + password). MFA is a recommended production setting (open item).
- Data access: server only, via `DATABASE_URL`. The anon/authenticated API keys are denied on every table (RLS enabled with no policies + explicit `REVOKE`). Browser code never queries the database.
- Authorization: role → permission matrix in code (`docs/permissions.md`). Never trust client-provided roles or study ids.
- Service-role key: scripts only. Not in the app env schema.
- Cookies: `clp_locale`, `clp_study`, `clp_public_locale` are httpOnly preferences with no PII.
- Logging: pino JSON with redaction of identity fields. No external error monitoring (D-002).
- No PII in URLs, ever.

Hardening before real participant data (not done): dedicated least-privilege DB role instead of `postgres`, MFA, retention policy for audit snapshots, approved hosting region.

## Internationalization

- UI strings: `messages/es.json`, `messages/en.json` via next-intl, keyed (`t("nav.cohorts")`). Locale from the `clp_locale` cookie; default `es`; synced with `users.preferred_locale` at login and on change.
- Study content: database, versioned, per locale (Phase 5). Never in the message files.
- Public site (landing and legal pages): Spanish, English and Galician, chosen by the visitor through `/idioma/[locale]` and kept in the `clp_public_locale` cookie, separate from the staff `clp_locale`; default `es`. The copy is typed modules per language under `src/content/landing/`, not message files (D-042, D-063).

## Background work

Phase 8 adds `study_events`, `automation_rules`, `scheduled_actions`, `tasks`,
`alerts` and a cron-invoked processor at
`POST /api/internal/process-scheduled-actions` that re-checks participant state
at execution time. The processor **prepares and never delivers**: an action that
still makes sense reaches READY and waits for a person. It is authorised with a
bearer `CRON_SECRET`, and refuses every request when that is unset. See
`docs/automations.md`.
