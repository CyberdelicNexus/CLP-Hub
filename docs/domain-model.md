# Domain model

Core model: **Study → Study Arm → Cohort → Participant → State → Event → Rule → Action.**

## Implemented (Phase 0)

| Table | Purpose | Notes |
|---|---|---|
| `studies` | Multi-study root | `code` unique, `status`, `default_locale`, `timezone`, recruitment window |
| `users` | Staff profiles | `id` = `auth.users.id`; `preferred_locale`; `active` (deactivate, never delete) |
| `user_roles` | Study-scoped role grants | Historical: `revoked_at` instead of delete; one active grant per (user, study, role) |
| `audit_events` | Append-only audit log | Trigger blocks UPDATE/DELETE; `action` must match `<entity>.<verb>` |
| `schema_migrations` | Applied migration names | Managed by `scripts/migrate.ts` |

Enums: `staff_role`, `study_status`, `ui_locale`, `audit_actor_type`. Every enum has a TypeScript mirror in `src/domain`.

## Implemented (Phase 1 · migration 0002)

| Table | Purpose | Notes |
|---|---|---|
| `participants` | People in the intake funnel | `code` from `participant_code_seq` (D-016); `recruitment_status` only — eligibility/enrollment are Phase 2 |
| `participant_contacts` | Category A identity, 1:1 with participant | Gated by `participants.contact.read`; unique `(study_id, email_normalized)` enforces duplicate linking (D-013) |
| `application_questions` | Per-study form configuration | Operational questions only (D-014); Spanish label required |
| `applications` | One submission | `status` is operational triage, **not** an eligibility decision |
| `application_answers` | Answers, one per question | `value` is jsonb (scalar, or array for MULTI_SELECT) |

Added enums: `recruitment_status`, `application_status`, `application_source`, `question_type` — mirrored in `src/domain/recruitment.ts`.

## Implemented (Phase 2 · migration 0003)

| Table | Purpose | Notes |
|---|---|---|
| `screenings` | Appointment plus recorded result | **No free-text column.** `result` is a staff-recorded determination; `external_record_id` is an opaque pointer to the approved system (D-019) |
| `consents` | Consent status and form version | Historical: superseded, never rewritten; one active row per participant (D-020) |

Also adds `participants.eligibility_status` (default PENDING) and
`participants.enrollment_status` (nullable — null means the participant is not in
the enrollment pipeline at all, which is a different statement from CONSENT_PENDING).

Added enums: `eligibility_status`, `enrollment_status`, `screening_status`,
`consent_status`. RANDOMIZED and COHORT_ASSIGNED exist in the vocabulary but no
Phase 2 code path can set them (D-017).

## Implemented (Phase 3a · migration 0004)

| Table | Purpose | Notes |
|---|---|---|
| `study_arms` | Arm configuration | Labels only. **No allocation ratio column** — this system does not allocate |
| `cohorts` | Group lifecycle | Forward-only status (D-023); capacity is informational |
| `cohort_staff` | Who runs which cohort | Historical; also the narrowing behind `cohorts.read.all` (D-022) |
| `participant_cohort_assignments` | Membership | Historical; one active cohort per participant |
| `randomizations` | Recorded allocation outcome | Manual entry only; one per participant; never generated (D-018/D-021) |

Added enums: `cohort_status`, `allocation_method`. RANDOMIZED and COHORT_ASSIGNED
become reachable in this phase.

## Implemented (Phase 3b · migration 0005)

| Table | Purpose | Notes |
|---|---|---|
| `session_templates` | Programme definition | Session names are configuration rows; `arm_id` nullable = applies to every arm (D-026) |
| `cohort_sessions` | Scheduled instance for a cohort | `template_id` nullable so ad-hoc sessions are possible; no notes column |
| `session_attendance` | One row per participant per session | Opens as EXPECTED when scheduled (D-025); TECHNICAL_FAILURE is never an absence (D-024) |

Added enums: `session_modality`, `session_status`, `attendance_status`.

## Implemented (Phase 5 · migration 0006)

| Table | Purpose | Notes |
|---|---|---|
| `contents` | Identity of a page | `key` is the public URL slug; `session_template_id` links session material by FK (D-029) |
| `content_versions` | Explicit version per locale | Publishing never mutates a published row; one PUBLISHED per (content, locale) |
| `content_assignments` | Which version a session was pinned to | Pinned at scheduling (D-028); superseding inserts a row rather than editing one |

Added enums: `content_type`, `content_status`. Bodies are typed blocks in jsonb,
validated on save and on read — never HTML (D-027).

## Planned by phase

| Phase | Tables |
|---|---|
| 6 VR logistics | `devices`, `device_assignments`, `shipments`, participant VR readiness |
| 7 Communications | `communication_templates`, `communications`, `broadcasts`, `broadcast_recipients` |
| 8 Automation | `study_events`, `automation_rules`, `scheduled_actions`, `tasks`, `alerts` |

Dropped from the original brief by decision D-003: `participant_progress` (no participant accounts, no per-participant page tracking).

## Participant state (Phase 1–2, fixed vocabularies)

Three independent status fields, never one blended string:

- **recruitment_status**: INTERESTED, APPLICATION_STARTED, APPLICATION_SUBMITTED, PRESCREEN, SCREENING_PENDING, SCREENING_SCHEDULED
- **eligibility_status**: PENDING, ELIGIBLE, INELIGIBLE, REVIEW_REQUIRED, WAITLIST
- **enrollment_status**: CONSENT_PENDING, ENROLLED, RANDOMIZED, COHORT_ASSIGNED, WITHDRAWN, COMPLETED

Transitions of eligibility, consent, randomization and withdrawal are explicit staff actions with audit rows. Nothing transitions automatically without an approved rule.

## Other fixed vocabularies (from the brief)

- Cohort status: PLANNING, RECRUITING, PREPARATION, ACTIVE, INTEGRATION, FOLLOW_UP, COMPLETED
- Session modality: ZOOM, VR, IN_PERSON, ASYNCHRONOUS, OTHER
- Attendance: EXPECTED, ATTENDED, LATE, ABSENT, EXCUSED, TECHNICAL_FAILURE, WITHDRAWN (TECHNICAL_FAILURE ≠ ABSENT)
- Consent: PENDING, CONSENTED, DECLINED, WITHDRAWN, SUPERSEDED
- Device: AVAILABLE, RESERVED, PREPARING, SHIPPED, DELIVERED, ACTIVE, RETURN_REQUESTED, RETURN_IN_TRANSIT, RETURNED, CLEANING, MAINTENANCE
- VR readiness: READY, NOT_READY, NEEDS_SUPPORT (explicit, reported by staff on the participant's behalf or via a public form — never inferred)
- Communication status: QUEUED, SENT, DELIVERED, FAILED, CANCELLED, SKIPPED
- Delivery mode: AUTOMATIC, APPROVAL_REQUIRED, MANUAL (WhatsApp is always MANUAL, D-004)

## Conventions

- UUID primary keys, `timestamptz` in UTC, localized display using the study timezone.
- Historical tables (`user_roles`, cohort assignments, consents, content versions, communications) are never updated destructively.
- Trial-specific values (arm names, session names such as "Vida", timings) are rows, not code.
