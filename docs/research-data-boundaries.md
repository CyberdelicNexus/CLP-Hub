# Research data boundaries

This application is an **operations** tool. It is not the research outcomes database and not a REDCap substitute.

## Three categories

| Category | Examples | Stored here? |
|---|---|---|
| A. Operational identity | Name, email, phone, shipping address, timezone, cohort, schedule | Yes, minimum necessary, contact fields gated by `participants.contact.read` |
| B. Study operations | Screening *status*, eligibility *result*, consent *status*, randomization *status* and arm, attendance, VR readiness, logistics, communications | Yes |
| C. Research / clinical | Screening answers, psychometrics, clinical notes, outcome measures, adverse events, health history | **No.** Lives in the institution's approved system. This app stores only `external_record_id` and result/status fields. |

Keep the separation visible: no table or column for Category C data may be added without a recorded researcher decision in `docs/decisions.md`.

### How Phase 2 holds the line

`screenings` deliberately has **no free-text column**. It stores an appointment,
a staff-recorded eligibility result, and `external_record_id` — an opaque pointer
to the approved system, capped at 120 characters and validated against
`^[\\w.:/-]*# Research data boundaries

This application is an **operations** tool. It is not the research outcomes database and not a REDCap substitute.

## Three categories

| Category | Examples | Stored here? |
|---|---|---|
| A. Operational identity | Name, email, phone, shipping address, timezone, cohort, schedule | Yes, minimum necessary, contact fields gated by `participants.contact.read` |
| B. Study operations | Screening *status*, eligibility *result*, consent *status*, randomization *status* and arm, attendance, VR readiness, logistics, communications | Yes |
| C. Research / clinical | Screening answers, psychometrics, clinical notes, outcome measures, adverse events, health history | **No.** Lives in the institution's approved system. This app stores only `external_record_id` and result/status fields. |

Keep the separation visible: no table or column for Category C data may be added without a recorded researcher decision in `docs/decisions.md`.

 so prose is refused. `consents` likewise stores a status, a form
version label and an external reference, never the signed document.

Database check constraints enforce the rules rather than trusting application
code: a result requires status COMPLETED, a completed screening requires a
timestamp, and 'PENDING' is rejected as a result.

### Where Category C is most likely to leak in

`application_answers` (Phase 1) stores free-form answers to questions that are **configuration rows**, so the boundary depends on what is configured rather than on the schema. Per D-014, application questions may ask only operational things — contact, availability, location, referral source, consent to be contacted. A health, symptom, diagnosis, medication or psychometric question would put Category C data in this app.

Today that boundary is a documented convention, not a database constraint. The form warns applicants not to include health information and caps free text at 1000 characters, but nothing prevents a future admin UI from configuring a prohibited question. Enforcing it in the database is an open question.

## Explicit non-features

- No randomization algorithm. The `RandomizationProvider` interface exists in
  `src/domain/randomization.ts`; its only implementation is manual entry, which
  passes through exactly what staff read from the approved system. A demo or
  fixture provider was considered and **rejected** (D-018): no allocation-producing
  code belongs in this repository at all, because an absolute guarantee is easier
  to audit than a guarded one. `tests/cohorts.test.ts` asserts the module contains
  no source of randomness.
- No eligibility logic. Staff record results produced elsewhere.
- No AI decisions, no AI participant chat, no therapeutic advice.
- No inferred readiness or behavioural analytics.

## Privacy and governance items (open)

1. **Hosting approval.** Vercel + Supabase regions are not yet approved for real participants. Until they are, only synthetic data may exist in any environment.
2. **Public form abuse protection.** The application form has only a honeypot and a fill-time floor (D-015). A captcha or WAF plus IP rate limiting is required before it accepts real traffic. IP addresses are deliberately not stored, as that would add a data category with no approved purpose.
3. **Right to erasure vs. append-only audit.** Proposed approach: pseudonymize contact data on request while keeping operational history keyed by participant code. Needs researcher / DPO sign-off.
4. **Audit snapshots may contain PII.** `before_json`/`after_json` can include contact fields. Access requires `audit.read`; retention policy to be defined. Phase 1 deliberately keeps them out: recruitment audit rows identify the person by `participants.code` and record answer *counts*, never names, emails or answer text. Later phases should follow the same rule.
5. **Public content pages** must never embed participant data or unguessable-but-personal state; they are the same for everyone. Implemented in Phase 5: `/estudio/…` pages take no session, read only PUBLISHED content, and render identically for every reader. The URL names a study session, never a cohort or a person — which version a cohort was pinned to is internal (D-028).
6. **Staff MFA** before production.
7. **Dedicated database role** with least privilege instead of the Supabase `postgres` role before production.
8. **Logs** redact identity fields (see `src/lib/logger.ts`); never log message bodies or screening results.
9. **No PII in URLs**, analytics parameters, or tracking pixels. The app sets `robots: noindex`.

Security features existing in the code do **not** constitute GDPR, clinical, trial or institutional compliance. Those are external determinations.
