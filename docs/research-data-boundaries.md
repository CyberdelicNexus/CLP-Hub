# Research data boundaries

This application is an **operations** tool. It is not the research outcomes database and not a REDCap substitute.

## Three categories

| Category | Examples | Stored here? |
|---|---|---|
| A. Operational identity | Name, email, phone, shipping address, timezone, cohort, schedule | Yes, minimum necessary, contact fields gated by `participants.contact.read` |
| B. Study operations | Screening *status*, eligibility *result*, consent *status*, randomization *status* and arm, attendance, VR readiness, logistics, communications | Yes |
| C. Research / clinical | Screening answers, psychometrics, clinical notes, outcome measures, adverse events, health history | **No.** Lives in the institution's approved system. This app stores only `external_record_id` and result/status fields. |

Keep the separation visible: no table or column for Category C data may be added without a recorded researcher decision in `docs/decisions.md`.

## Explicit non-features

- No randomization algorithm. A `RandomizationProvider` interface will exist (Phase 2) so an approved mechanism can be plugged in; the app records the outcome and reference only. Demo fixtures are labelled DEMO and never usable in production.
- No eligibility logic. Staff record results produced elsewhere.
- No AI decisions, no AI participant chat, no therapeutic advice.
- No inferred readiness or behavioural analytics.

## Privacy and governance items (open)

1. **Hosting approval.** Vercel + Supabase regions are not yet approved for real participants. Until they are, only synthetic data may exist in any environment.
2. **Right to erasure vs. append-only audit.** Proposed approach: pseudonymize contact data on request while keeping operational history keyed by participant code. Needs researcher / DPO sign-off.
3. **Audit snapshots contain PII.** `before_json`/`after_json` may include contact fields. Access requires `audit.read`; retention policy to be defined.
4. **Public content pages** must never embed participant data or unguessable-but-personal state; they are the same for everyone.
5. **Staff MFA** before production.
6. **Dedicated database role** with least privilege instead of the Supabase `postgres` role before production.
7. **Logs** redact identity fields (see `src/lib/logger.ts`); never log message bodies or screening results.
8. **No PII in URLs**, analytics parameters, or tracking pixels. The app sets `robots: noindex`.

Security features existing in the code do **not** constitute GDPR, clinical, trial or institutional compliance. Those are external determinations.
