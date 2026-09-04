# Decision log

Append-only. Newest at the bottom. Record assumptions here rather than silently deciding.

**Current phase: 2 (Participant operations) — started 2026-09-05 on founder approval. Phases 0–1 shipped.**

---

## D-001 · 2026-09-03 · Monolith on Next.js 16 + Supabase Postgres

One app, one database, Drizzle with hand-written SQL migrations. Matches the founder's other project's conventions (Next 16, React 19, Tailwind 4, shadcn). Drizzle Kit is used for checks only; migrations stay reviewable SQL that can also be pasted into the Supabase dashboard.

## D-002 · 2026-09-03 · No external error monitoring

Founder decision: no Sentry. Structured pino logs with PII redaction. Operational failures will surface as in-app alerts (Phase 8).

## D-003 · 2026-09-03 · Participants never authenticate

Founder decision: the "study hub" is not a learning platform. Study material is published as public, blog-style Spanish pages. Consequences: no magic links, no per-participant progress table, no personalised hub. Public pages must contain no participant data. VR readiness is captured by staff or via a simple public form, not inferred.

## D-004 · 2026-09-03 · WhatsApp is manual

No WhatsApp API. Each cohort gets a "Mensajes" page with every message rendered in Spanish with real dates and links plus a copy button. Facilitators paste manually and mark as sent, which creates the immutable communication record. Email may remain automatable for logistics via Resend (Phase 7).

## D-005 · 2026-09-03 · Vercel Cron instead of Trigger.dev

With WhatsApp manual and email volume low, a cron-invoked processor over `scheduled_actions` is sufficient. The processor boundary keeps the option to swap in Trigger.dev later.

## D-006 · 2026-09-03 · Authorization in code, RLS as deny-all

Permissions live in `src/domain/permissions.ts` and are enforced server-side. All tables have RLS enabled with no policies and explicit revokes for `anon`/`authenticated`, so the Supabase API keys cannot read anything. This avoids duplicating the permission matrix in SQL. Hardening item: dedicated least-privilege DB role before real data.

## D-007 · 2026-09-03 · Locale via cookie, no URL prefix

Staff UI locale comes from an httpOnly `clp_locale` cookie synced with `users.preferred_locale` (audited). Public pages default to Spanish. No `/es/` `/en/` routing.

## D-008 · 2026-09-03 · Roles as enum, no `roles` table

The five roles are a fixed vocabulary with permissions in code; a `roles` table would add nothing. `user_roles` is historical (revoke, never delete).

## D-009 · 2026-09-03 · All communication touchpoints Spanish

Every template must have a Spanish version; English is optional and only for staff preview. Enforced in Phase 7 schema constraints.

## D-010 · 2026-09-03 · Naming

Repository "CLP Hub" (`clp-hub`). The trial's name is not referenced in code; the seed study is `DEMO`. Team dashboard lives under `/equipo`.

## D-011 · 2026-09-03 · Design system: "soft modern", light and dark

Founder direction, from reference dashboards. A bento-grid surface system: rounded
cards, pastel accent surfaces, soft diffuse elevation, Plus Jakarta Sans display
over Geist body. Full token layer in `src/app/globals.css` with complete `:root`
and `.dark` palettes; see `docs/design-system.md`.

Considered and rejected: an industrial-brutalist direction (zero radius, hazard
red, monospace, scanlines). It conflicts with the reference material and reads as
a strong personality for a tool clinical staff use daily. Its defensible parts were
kept — deterministic grid, tabular numerals for metrics, semantic markup.

Consequences: pastel tokens are backgrounds only and always paired with an `-ink`
foreground, so no accent ever carries meaning by itself; contrast stays ≥ 4.5:1 in
both modes. Also fixed a latent bug where `--font-sans` resolved to nothing and the
UI fell back to the browser default font.

## D-012 · 2026-09-03 · Theme preference is device-local and not audited

`next-themes` stores light/dark/system in `localStorage`. Deliberately unlike the
locale (D-007), which lives on the staff profile and is audited: the theme is a
rendering preference, not user state or a research-relevant setting, so it gets no
database column, no cookie and no audit row. Revisit only if staff ask for the
choice to follow them across devices.

## D-013 · 2026-09-04 · Repeat applications link to the existing participant

Founder decision. Within one study, a submission whose email matches an existing
participant (trimmed + lowercased) attaches a new application to that participant
instead of creating a second person. Enforced by a unique index on
`participant_contacts (study_id, email_normalized)`, so the rule holds under
concurrent submissions rather than only in application code.

Normalisation is trim + lowercase only. Provider-specific tricks (stripping dots,
removing `+` tags) are deliberately not applied: they would merge two people who
are genuinely distinct.

This is an identity-resolution claim — "same email means same person" — recorded
here because it is an assumption, not a fact. Repeat submissions inside a
two-minute window return the existing application rather than creating another, so
a double-click does not produce duplicates.

## D-014 · 2026-09-04 · Application questions are operational only, by convention

Founder decision (convention, not a database constraint). `application_questions`
may ask only operational things: contact details, availability, location, referral
source, and consent to be contacted. Health, symptom, diagnosis, medication and
psychometric questions are Category C research data and must not be configured
here (`docs/research-data-boundaries.md`).

The boundary is documented in `src/domain/recruitment.ts`, in migration 0002, in
the seed, and on the form itself, which tells applicants not to include health
information and caps free text at 1000 characters.

Accepted risk: nothing in the database prevents a future admin UI from adding a
health question. A check constraint or an allow-list of question keys was
considered and deferred. Revisit before question configuration is exposed to
staff in the UI.

## D-015 · 2026-09-04 · Public form anti-abuse is deliberately minimal

The public form has a honeypot field and a fill-time floor only. The honeypot
reports success so a bot learns nothing; the fill-time floor reports a real error
asking the person to retry, because it is timed from server render and could
otherwise silently discard a fast human's application.

This is **not** sufficient protection for public exposure. A captcha or WAF plus
IP-based rate limiting is a prerequisite before the form accepts real traffic,
alongside the hosting approval already tracked below. IP addresses are
deliberately not stored today, since that would add a data category with no
approved purpose.

## D-016 · 2026-09-04 · Participant codes come from a database sequence

`participants.code` (e.g. `P-000042`) is generated from `participant_code_seq`
rather than counted per study, so concurrent submissions cannot collide. The code
is the pseudonymous handle that operational history and audit rows are keyed by,
which is what makes the proposed erasure approach — clear contact data, keep
history — possible. Audit snapshots reference the code, not the person's name or
email.

## D-017 · 2026-09-05 · Randomization moves to Phase 3, with study arms

Founder decision, amending the phase plan in `docs/domain-model.md`. `randomizations`
cannot record a meaningful allocation without an arm to point at, and `study_arms`
was scheduled for Phase 3. Rather than store an unvalidated arm code and migrate
it later, both tables land together in Phase 3.

Consequences: `enrollment_status` keeps its full vocabulary, but RANDOMIZED and
COHORT_ASSIGNED are deliberately unreachable in Phase 2 — no code path can set
them, and `PHASE_3_ENROLLMENT_STATUSES` in `src/domain/participant-state.ts`
names them so the gap is explicit rather than accidental.

Also noted: `docs/permissions.md` defines `randomization.read` but no
`randomization.manage`, so as written nobody could record an allocation. The key
was **not** added now, since an unused permission is worse than a missing one.
Adding it is a prerequisite for Phase 3.

## D-018 · 2026-09-05 · Allocations are recorded manually, never generated

Founder decision, settled ahead of Phase 3. When randomization arrives, a
`RandomizationProvider` interface will exist so an approved mechanism can be
plugged in, but the only implementation will be manual entry: staff record an
arm and an external reference produced by the approved system.

A demo fixture provider was considered and rejected. No code capable of producing
an allocation belongs in this repository, not even guarded by `ALLOW_DEMO_DATA` —
the guarantee is easier to audit if it is absolute.

## D-019 · 2026-09-05 · Screening stores an appointment and a result, nothing else

The `screenings` table has no free-text column at all, deliberately. Screening
answers, instrument scores and clinical notes are Category C and live in the
institution's approved system; `external_record_id` is an opaque pointer to it,
capped at 120 characters and validated against `^[\w.:/-]*$` so it cannot quietly
become a notes field. A staff member who types prose there is told why it was
refused.

Database constraints back this up rather than trusting application code: a result
requires status COMPLETED, a completed screening requires a timestamp, and
'PENDING' is rejected as a result because "not determined" is expressed by the
absence of one.

New vocabulary: screening status SCHEDULED / COMPLETED / NO_SHOW / CANCELLED.
This is **not** from the founder's brief — it is an assumption, and researchers
should confirm it covers the real workflow (see open questions).

## D-020 · 2026-09-05 · Consent is a status record, and is historical

`consents` records which form version was used, when the decision was made, who
recorded it and an external reference. No document, no signature, no upload.

Rows are never rewritten into a different decision: re-consenting to a newer
version creates a new row and marks the previous one SUPERSEDED, and a partial
unique index permits only one PENDING/CONSENTED row per participant at a time.
SUPERSEDED is not reachable by any staff action — only the service sets it.

Consenting enrols the participant in the same transaction. Declining or
withdrawing consent does **not** automatically un-enrol anyone: that is a
separate, deliberate decision, recorded on its own.

## Open questions for researchers

- Hosting region / data processing agreements before any real participant.
- Captcha / WAF and rate limiting for the public application form (D-015).
- Whether the permitted application question vocabulary should be enforced in the
  database rather than by convention (D-014).
- Confirm the screening status vocabulary (SCHEDULED / COMPLETED / NO_SHOW /
  CANCELLED) reflects the real workflow — it is an assumption, not from the brief (D-019).
- Whether an eligibility determination may be corrected after the fact, and by
  whom. The app currently permits it and audits every change.
- Consent form versions are free-text labels today. Should they become study
  configuration rows so the set of valid versions is controlled?
- Erasure vs. audit immutability: pseudonymization approach acceptable?
- Audit retention period.
- Whether email reminders may be AUTOMATIC or should also be manual.
- MFA requirement for staff.
