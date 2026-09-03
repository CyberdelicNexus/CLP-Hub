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

## Planned by phase

| Phase | Tables |
|---|---|
| 1 Recruitment | `participants`, `participant_contacts`, `applications`, `application_questions`, `application_answers` |
| 2 Participant ops | `screenings`, `consents`, `randomizations` (table + interface only, no algorithm) |
| 3 Cohorts | `study_arms`, `cohorts`, `cohort_staff`, `participant_cohort_assignments`, `session_templates`, `cohort_sessions`, `session_attendance` |
| 5 Content | `contents`, `content_versions`, `content_assignments` |
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
