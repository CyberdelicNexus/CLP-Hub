# Load testing

How to stress-test the Hub before recruitment is announced (D-147). The script
is `scripts/load/hub-load.js`, written for [k6](https://k6.io).

**Synthetic data only.** Run against a Vercel preview backed by a disposable
Supabase branch, never against the production database. The script refuses
writes against `numadelic.org`, but it cannot tell which database a preview
uses. That part is on you.

## Before you start

1. Install k6 (`winget install k6` on Windows, `brew install k6` on macOS).
2. Create a Supabase branch, run `npm run db:migrate` and `npm run db:seed`
   against it, and point a Vercel preview at it.
3. Create one staff account on that branch for the test, with an obviously fake
   address. `scripts/deactivate-demo-accounts.ts` switches off the seeded demo
   logins, so either re-activate one or provision a test account.
4. Set up the Vercel WAF rate-limit rules below on the preview project too, so
   the test exercises them.

## Running it

```bash
# Public pages only: safe anywhere, writes nothing.
k6 run -e BASE_URL=https://<preview>.vercel.app scripts/load/hub-load.js

# Add staff browsing (STAFF_VUS concurrent staff, default 10).
k6 run -e BASE_URL=... -e STAFF_EMAIL=... -e STAFF_PASSWORD=... scripts/load/hub-load.js

# Add application-form submissions (APPLY_PER_MIN, default 30). Writes rows.
k6 run -e BASE_URL=... -e ALLOW_WRITES=yes scripts/load/hub-load.js

# Also the contact form (writes Consultas rows) and the cron processor.
k6 run -e BASE_URL=... -e ALLOW_WRITES=yes -e CONTACT=yes -e CRON_SECRET=... scripts/load/hub-load.js
```

| Variable | Default | Meaning |
|---|---|---|
| `PEAK_RPS` | 20 | Public page requests per second. The spike stage runs at 3× this. |
| `STAFF_VUS` | 10 | Staff browsing at the same time. |
| `APPLY_PER_MIN` | 30 | Application-form submissions per minute. |
| `PUBLIC_PATHS`, `STAFF_PATHS` | see script | Comma-separated paths to visit. |

A run lasts about six minutes. Fake applicants are `loadtest+…@example.com`
(a reserved domain, so no email can ever be delivered) named "Prueba Carga …".

**The cron scenario can send real email.** The processor sends any automatic
email that is due (D-116). Only pass `CRON_SECRET` against a database whose
participants all have fake addresses.

## Pass criteria

The script fails the run if any of these break:

- under 1 % of requests fail, and over 99 % of checks pass
- p95 under 1.5 s for public pages, 2.5 s for staff pages, 3 s for form writes, 10 s for the cron call

While it runs, also watch:

- **Supabase:** database connections and CPU (Reports). Connection exhaustion
  is the most likely failure; check the pooler is used in `DATABASE_URL`.
- **Vercel:** function duration and errors (Observability), and how many
  requests the WAF blocked.
- **The Hub:** `/hub/alertas` for anything the processor raised.

## Cleaning up

Delete the Supabase branch. Don't try to remove load-test rows from a shared
database: audit rows are append-only by design.

## Rate limiting with the Vercel WAF

The app has no rate limiting of its own. It's done in the Vercel firewall so no
counter or IP address is stored here (D-147). In the Vercel project go to
**Firewall → Configure → New Rule** and add:

| Rule | If | Then |
|---|---|---|
| Public form writes | Method is `POST` and path starts with `/clearlight` | Rate limit: 10 requests per 60 s per IP, then deny (429) |
| Staff login | Method is `POST` and path is `/hub/login` | Rate limit: 10 requests per 60 s per IP, then deny |
| Cron endpoint | Path starts with `/api/internal/` and the `authorization` header is missing | Deny |
| General | Any request | Rate limit: 300 requests per 60 s per IP, then challenge |

Start each rule in **Log** mode for a day, look at what it would have blocked,
then switch it to **Deny**. A load test from a single machine trips these
limits by design. Either run it with the rules in Log mode, or add a bypass
rule for the test machine's IP and remove it afterwards.
