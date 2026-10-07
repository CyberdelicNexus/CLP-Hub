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
| `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` | Only for the inquiry inbox (D-088) | Blank means unset. See "Email" below. Without them the inbox works but staff are not emailed and replies are refused. |
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

## Email (inquiry inbox, D-088)

The inquiry inbox emails staff when a question arrives and sends the staff reply
to the person, through Resend (`src/services/mailer.ts`).

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | A Resend API key. "Sending access" is enough for the app. |
| `MAIL_FROM` | The sender, `Clear Light <address@your-verified-domain>`. |
| `APP_URL` | The Hub's public address, only to link the inbox from the notification. |

**Testing before a domain exists.** Resend refuses any sender on a domain that is
not verified in the account (a `@usc.es` or `@gmail.com` `MAIL_FROM` gets a 403).
Use Resend's shared test sender, `MAIL_FROM=Clear Light <onboarding@resend.dev>`,
which can only deliver **to the address the Resend account was created with**.
So in that mode a reply to an inquiry works only if the person's email is that
address, and the notification to the team is rejected (logged as
`mail.rejected`, and the submission still succeeds) because their addresses are
not the account owner's.

**Going live** needs a domain the team controls, verified at Resend:

1. In Resend, Domains, add the domain. Prefer a **subdomain used only for
   sending** (for example `mail.example.org`): it leaves the root domain's own
   mail untouched and keeps this sender's reputation separate. Pick the **EU
   (Ireland) region**: this is a study with participants in Spain.
2. Resend then shows the DNS records to create (normally an SPF pair, a DKIM
   key, and optionally DMARC). The exact values are specific to the domain and
   come only from the Resend dashboard; they are not in this repository.
3. Whoever holds the domain adds them at the DNS host, then presses Verify in
   Resend (propagation is usually minutes, up to 48 hours).
4. Set `MAIL_FROM` to an address on that domain and redeploy.

The API key created for the app should be "sending access" and, if the domain is
verified, restricted to that domain. It cannot manage domains, which is why
domain setup is done in the Resend dashboard (or with a separate full-access key
kept out of the app's environment).

### The domain: numadelic.org

State on 2026-09-25 (public DNS lookups; the account is held by David):

- DNS is hosted at **GoDaddy** (`ns49/ns50.domaincontrol.com`).
- The root already has **live email hosting**: MX records at `mx0/mx1.123-reg.co.uk`.
  Never change or remove them. It has no SPF and no DMARC record, and its
  `A` records look like a parked page.
- The site is served from the **root**, `numadelic.org`, with Clear Light under
  `/clearlight` and a placeholder home page at `/` (D-104, replacing the
  `clearlight.numadelic.org` subdomain planned on 2026-09-25). A path cannot be
  set in DNS, so the root itself points at Vercel:
  - `A` `@` to `216.198.79.1` (the value the Vercel Domains page showed on
    2026-10-07; its legacy `76.76.21.21` also works, and whatever that page
    shows wins if different).
  - Delete the root's two parked `A` records, `76.223.67.189` and
    `13.248.213.45` (GoDaddy's parking page). While they exist Vercel reports
    "Invalid Configuration" and most visitors land on the parking page.
  - `CNAME` `www` to `cname.vercel-dns.com`, with `www.numadelic.org` added in
    Vercel as a redirect to the root.
  - Never touch the `MX` records.

  Then set `APP_URL=https://numadelic.org` in Vercel and add that address to
  Supabase Auth's Site URL and redirect URLs, or staff login will send people
  back to the old address. Staff sign in at `numadelic.org/equipo/login`.
- Email is sent from the **root** `numadelic.org` registered in Resend (EU
  Ireland), as `Clear Light <consultas@numadelic.org>`. The records Resend issued
  (2026-09-25) all live on their own names and do not touch the root's MX:
  CNAME `send` to `send.forge.rmta.net`, CNAME `rsend` to
  `rsend-euw1.forge.rmta.net`, TXT `resend._domainkey` (the DKIM public key,
  copied from the Resend dashboard), and a recommended TXT `_dmarc`
  (`v=DMARC1; p=none;`, monitoring only, since none existed). Resend generates
  the values per domain, so re-copy them from its dashboard if the domain is ever
  re-added.
- Until Resend shows the domain as verified, keep
  `MAIL_FROM=Clear Light <onboarding@resend.dev>`.

## Before anything real

Still open, and none of it is satisfied by deploying (`docs/research-data-boundaries.md`):
hosting region and data processing agreements, staff MFA, a least-privilege
database role instead of the Supabase `postgres` role, captcha or WAF plus rate
limiting on the public form, audit retention, and the erasure approach. The
landing page also still needs native Spanish editorial, clinical and ethics
review, and its legal pages need a lawyer or DPO. Until then: synthetic data
only, in every environment.
