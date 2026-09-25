# Permissions

Source of truth: `src/domain/permissions.ts`. Tests: `tests/permissions.test.ts`. This page must be kept in sync.

Roles are **study-scoped** (`user_roles`). A user may hold several roles in one study. Permissions are the union of their roles' permissions. Feature code checks permissions, never role names.

| Permission | ADMIN | STUDY_MANAGER | FACILITATOR | RESEARCHER | LOGISTICS | SUPERVISOR |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| study.settings.manage | ✓ | | | | | |
| team.read | ✓ | ✓ | | | | |
| team.manage | ✓ | | | | | |
| audit.read | ✓ | ✓ | | | | |
| applications.read / manage | ✓ | ✓ | | | | |
| participants.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| participants.manage | ✓ | ✓ | | | | |
| participants.contact.read | ✓ | ✓ | | | ✓ | ✓ |
| screening.read | ✓ | ✓ | | ✓ | | ✓ |
| screening.manage | ✓ | ✓ | | | | |
| consent.read | ✓ | ✓ | | ✓ | | ✓ |
| consent.manage | ✓ | ✓ | | | | |
| randomization.read | ✓ | ✓ | | ✓ | | ✓ |
| randomization.manage | ✓ | ✓ | | | | |
| cohorts.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cohorts.read.all | ✓ | ✓ | | ✓ | ✓ | ✓ |
| cohorts.manage | ✓ | ✓ | | | | |
| sessions.read | ✓ | ✓ | ✓ | ✓ | | ✓ |
| sessions.manage | ✓ | ✓ | ✓ | | | ✓ |
| attendance.manage | ✓ | ✓ | ✓ | | | ✓ |
| content.read | ✓ | ✓ | ✓ | ✓ | | ✓ |
| content.manage / publish | ✓ | ✓ | | | | |
| logistics.read / manage | ✓ | ✓ | | | ✓ | |
| communications.read | ✓ | ✓ | ✓ | | | ✓ |
| communications.manage | ✓ | ✓ | | | | |
| communications.approve | ✓ | ✓ | | | | |
| tasks.read / manage | ✓ | ✓ | ✓ | | ✓ | ✓ |
| alerts.read | ✓ | ✓ | ✓ | | ✓ | ✓ |
| inquiries.manage | ✓ | ✓ | | ✓ | | |
| exports.research | ✓ | | | ✓ | | |

## Field-level rules (to enforce as tables arrive)

- `participants.read` without `participants.contact.read` returns participant code, statuses and cohort, **not** name/email/phone/address.
- FACILITATOR access is narrowed to assigned cohorts via `cohort_staff`. This is
  implemented as the `cohorts.read.all` permission rather than a role check
  (D-022): holders see every cohort, and a caller without it is limited to the
  cohorts they staff. The narrowing is applied in service queries through
  `ctx.cohortScope`, and an out-of-scope cohort returns 404.
- RESEARCHER sees status fields and `external_record_id`, never contact data or logistics.
- LOGISTICS sees contact + shipping data, never screening/consent/randomization detail.
- SUPERVISOR (added 2026-09-19, for two real team members overseeing
  facilitators and sessions study-wide) sees everything FACILITATOR does but
  without the `cohort_staff` narrowing, plus screening/consent/randomization
  *status* for oversight — it does not gain `.manage` on any of those, on
  cohorts, on applications, or on communications/logistics. A starting
  point, not a settled design.

## What each key gates today

Every permission in the matrix is now exercised by a real surface. Notable ones:

- `study.settings.manage` — `/equipo/configuracion`: the study's title, status,
  timezone, recruitment switch and screening URL, plus the automation rules. Only
  ADMIN. A facilitator who can use a template should not be able to change when
  it fires (D-044).
- `team.read` / `team.manage` — `/equipo/equipo`. Reading the team is not the
  same as changing it, so more roles hold `read`. Neither can create an account:
  logins live in Supabase Auth.
- `tasks.read` / `tasks.manage` — `/equipo/tareas`. `manage` covers creating,
  closing and assigning, and is held by every role that does operational work: a
  facilitator who finishes the thing the task describes should be able to close
  it.
- `alerts.read` — `/equipo/alertas`, including acknowledging and resolving.
  There is no separate manage key: a role that could see the queue but not clear
  it would leave the queue permanently full (D-043).
- `inquiries.manage` — `/equipo/consultas`: read and answer public questions (D-088). It also decides who is emailed when one arrives. RESEARCHER holds it as a deliberate exception to "never sees contact data": it covers only an open inquiry's name and email, erased once answered.
- `communications.approve` — still unused. Whether it should gate the
  APPROVAL_REQUIRED delivery mode is an open question.

RESEARCHER holds neither `tasks.read` nor `alerts.read`: operational queues are
not research output.

## Dashboard navigation visibility

`src/domain/navigation.ts` maps each section to the permissions that reveal it. The server filters the menu; the page re-checks on render. Every entry now has a page of its own — the `[section]` placeholder route is gone, so an unknown path under `/equipo` is a 404 rather than a "Próximamente" card (D-044).

## Open items

- Staff MFA (Supabase Auth) for production.
- Whether RESEARCHER exports require a second approval.
