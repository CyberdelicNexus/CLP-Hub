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

## Implemented (Phase 4a · migration 0007)

| Table | Purpose | Notes |
|---|---|---|
| `eligibility_reasons` | Why a determination came out as it did | Wording is configuration; the CONSORT category is a fixed enum (D-030). A reason states *that* a criterion was not met, never which |
| `qualtrics_field_mappings` | Configuration for a future READ-ONLY integration | **No transfer is implemented.** A check constraint refuses IDENTIFIABLE and RESEARCH source classes outright (D-031) |

Also adds `studies.screening_url` and `studies.qualtrics_mode`,
`participants.external_ref` (unique per study, the Qualtrics response handle),
and `screenings.reason_id` / `screenings.reason_note`.

Added enums: `eligibility_reason_category`, `qualtrics_field_class`,
`intake_target`, `integration_mode`. `application_source` gains `QUALTRICS`;
`PUBLIC_FORM` is retired but kept so historical rows stay readable.

Check constraints doing real work here: an INELIGIBLE or REVIEW_REQUIRED result
requires a reason; ELIGIBLE accepts none; a note exists only beside a reason, is
one line and at most 280 characters; and a Qualtrics mapping cannot name an
identifiable or research field at all.

## Implemented (Phase 4b · migration 0008)

| Table | Purpose | Notes |
|---|---|---|
| `consent_scopes` | Authorizations a physical consent may grant | Configuration rows, PHYSICAL only. Codes, never boolean columns (D-032) |

Also adds `consents.consent_type` (DIGITAL / PHYSICAL) and
`consents.granted_scopes`, plus `study_arms.requires_physical_consent`.

**Replaces** the index `consents_one_active_per_participant` with
`consents_one_active_per_participant_type`: a participant may now hold one active
consent *per type*. Reversible; see the migration header for the impact.

Added enum: `consent_type`.

## Implemented (Phase 4c · migration 0009)

Alters `cohorts` only — no new table.

| Column | Purpose | Notes |
|---|---|---|
| `arm_id` | The arm this cohort runs | Nullable; null takes anyone, which is every pre-existing cohort. Once set, arm compatibility is enforced on assignment (D-034) |
| `min_size` / `max_size` | Configured group size | "Between 6 and 8" is data, never code. Checked only when a cohort is marked ACTIVE, and overridable with a recorded reason (D-033) |

`capacity` is **renamed** to `max_size` — reversible, no value lost. See the
migration header for the impact.

New service: `transferToCohort`, which moves a participant between cohorts in one
transaction and audits it as `cohort_assignment.moved`.

## Implemented (Phase 4d · migration 0010)

| Table | Purpose | Notes |
|---|---|---|
| `participant_responsibilities` | Who runs the initial visit, and who handles the headset | Historical; one active holder per role. Grants **no** extra visibility, unlike `cohort_staff` (D-035) |
| `initial_visits` | The in-person visit where the physical consent is signed and equipment handed over | Historical; one open at a time. Carries the app's only two open free-text fields, both capped and never audited by content (D-035) |

Added enums: `responsibility_role`, `visit_status`.

New pure module `src/domain/next-step.ts`: what record is MISSING for a
participant, never a judgement about them (D-036). New read service
`src/services/audit-trail.ts`: the audit log, redacted to field names (D-037).

Participants can now be filtered by eligibility, enrollment, cohort, arm and
responsible, and the list shows each participant's next step.

## Implemented (Phase 6 · migration 0011)

| Table | Purpose | Notes |
|---|---|---|
| `devices` | Headset inventory | Asset data only. Deactivated, never deleted |
| `device_assignments` | One device out with one participant | Historical; one open per device and per participant. **No responsible column** and **no next-session column** — both are read from existing tables (D-038) |
| `device_incidents` | Equipment problems | Equipment only; no category names anything that happened to a person |

Added enums: `device_status`, `vr_readiness`, `incident_kind`.

`readiness` defaults to UNKNOWN and is reported, never inferred (D-003).
The device lifecycle permits the reversals logistics actually has, unlike the
strictly-forward cohort lifecycle (D-038).

## Planned by phase

| Phase | Tables |
|---|---|
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
- Consent status: PENDING, CONSENTED, DECLINED, WITHDRAWN, SUPERSEDED
- Consent type: DIGITAL, PHYSICAL (D-032)
- Responsibility role: INITIAL_SESSION, VR_EQUIPMENT (D-035)
- Visit status: SCHEDULED, COMPLETED, NO_SHOW, CANCELLED (D-035)
- Device status: AVAILABLE, RESERVED, PREPARING, SHIPPED, DELIVERED, ACTIVE, RETURN_REQUESTED, RETURN_IN_TRANSIT, RETURNED, CLEANING, MAINTENANCE (D-038)
- VR readiness: UNKNOWN, READY, NOT_READY, NEEDS_SUPPORT — reported, never inferred (D-003, D-038). UNKNOWN is the default: "nobody has told us" is not "it does not work"
- Communication status: QUEUED, SENT, DELIVERED, FAILED, CANCELLED, SKIPPED
- Delivery mode: AUTOMATIC, APPROVAL_REQUIRED, MANUAL (WhatsApp is always MANUAL, D-004)

## Conventions

- UUID primary keys, `timestamptz` in UTC, localized display using the study timezone.
- Historical tables (`user_roles`, cohort assignments, consents, content versions, communications) are never updated destructively.
- Trial-specific values (arm names, session names such as "Vida", timings) are rows, not code.
