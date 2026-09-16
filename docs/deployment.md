# Deployment (Vercel)

One Next.js application on Vercel, one Postgres database on Supabase (D-005,
`docs/architecture.md`). This page is what a deployment needs and what it will
serve; `docs/development.md` covers the local loop.

**Nothing here is approved for real participants.** Hosting regions and data
processing agreements are still open (`docs/research-data-boundaries.md`), so
any deployment is a prototype carrying synthetic data only. The whole site is
`robots: index: false, follow: false` (`src/app/layout.tsx`) and `/robots.txt`
disallows crawling outright (`src/app/robots.ts`), so no deployment should
reach a search engine. A deployment URL is still public to anyone who has it,
custom domain included: treat the link as internal.

## What each environment serves

`APP_ENV` decides what the public landing page does, and it is the single most
important variable to get right:

| `APP_ENV` | Landing page at `/` | Markers (`FALTA CONTENIDO APROBADO`) | Seeding |
|---|---|---|---|
| `development` | The full landing page | Drawn | Allowed with `ALLOW_DEMO_DATA=true` |
| `staging` | The full landing page | Drawn | Allowed with `ALLOW_DEMO_DATA=true` |
| `production` | **The holding page**, while any protocol value is unapproved | Never drawn | Refused |

That is the publication gate (D-042): in production the page refuses to publish
until `missingContentList()` is empty, and it is not empty today. **A review
deployment must therefore use `APP_ENV=staging`**, or the team will see the
holding page instead of the site.

On staging the landing draws no markers of its own any more (D-061), with one
exception: the final invitation shows `URL_QUALTRICS` while no open study has a
screening URL configured, because the CTA has nowhere to send anyone. The three
legal pages draw their own markers, which is the point of them.

## Environment variables

Set these in Vercel under **Project → Settings → Environment Variables**, for
every environment the project builds (Production, Preview, Development). Values
come from the Supabase project; never commit them (`.env*` is git-ignored, and
`.env.example` is the template).

| Variable | Required | Notes |
|---|---|---|
| `APP_ENV` | Yes | `staging` for a review deployment. See the table above. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Publishable key. Browser-safe; staff auth only. |
| `DATABASE_URL` | Yes | Use Supabase's **Transaction pooler** URI on Vercel: the app runs serverless and a direct connection exhausts Postgres connections. |
| `LOG_LEVEL` | No | Defaults to `info`. |
| `CRON_SECRET` | Only for Phase 8 automation | 16 characters or more. Unset means the processor endpoint refuses every request (503), which is the closed state. |
| `SUPABASE_SERVICE_ROLE_KEY` | Never in Vercel | Scripts only (seeding), from a local shell. Application code never reads it. |

The first four are not optional at runtime: `getEnv()` parses them on the
request, so a deployment missing any of them answers `/` with a 500 rather than
a page. Verified against a production build with them unset.

The *build* needs none of them, and no database: every route is dynamic
(`ƒ` in the build's route table), so nothing is prerendered and the build
container never opens a connection. A first deploy will therefore go green
before the variables are set, and then serve 500s — set them first.

## First deployment

1. Push the branch to GitHub (`origin`, `CyberdelicNexus/CLP-Hub`).
2. In Vercel, **Add New → Project**, import that repository. Framework preset
   Next.js; build command, output directory and install command are all the
   defaults.
3. Set the environment variables above **before** the first build.
4. Deploy. The production branch is `main`; any other branch, `implementation`
   included, gets a preview deployment with its own URL, which is the right
   thing to hand to reviewers.
5. Apply migrations against the database the deployment points at
   (`npm run db:migrate` from a local shell with that `DATABASE_URL`). Vercel
   runs no migrations; nothing in the build touches the schema.
6. Staff need accounts before `/equipo` is usable: this application grants and
   revokes roles but cannot create an account (D-044). On a throwaway review
   database, `npm run db:seed` creates the synthetic study and staff.

## Scheduled actions (Phase 8, optional)

The processor is a plain endpoint; Vercel Cron calls it (D-005). It is not
needed for a landing-page review. To enable it, add `vercel.json`:

```json
{ "crons": [{ "path": "/api/internal/process-scheduled-actions", "schedule": "*/15 * * * *" }] }
```

and set `CRON_SECRET`. Vercel sends it as `Authorization: Bearer`. Without the
secret the endpoint answers 503 to everything, so an unconfigured deployment is
closed rather than open (`docs/automations.md`).

## Before anything real

Still open, and none of it is satisfied by deploying (`docs/research-data-boundaries.md`):
hosting region and data processing agreements, staff MFA, a least-privilege
database role instead of the Supabase `postgres` role, captcha or WAF plus rate
limiting on the public form, audit retention, and the erasure approach. The
landing page also still needs native Spanish editorial, clinical and ethics
review, and its legal pages need a lawyer or DPO. Until then: synthetic data
only, in every environment.
