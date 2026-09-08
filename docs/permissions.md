# Permissions

Source of truth: `src/domain/permissions.ts`. Tests: `tests/permissions.test.ts`. This page must be kept in sync.

Roles are **study-scoped** (`user_roles`). A user may hold several roles in one study. Permissions are the union of their roles' permissions. Feature code checks permissions, never role names.

| Permission | ADMIN | STUDY_MANAGER | FACILITATOR | RESEARCHER | LOGISTICS |
|---|:-:|:-:|:-:|:-:|:-:|
| study.settings.manage | ✓ | | | | |
| team.read | ✓ | ✓ | | | |
| team.manage | ✓ | | | | |
| audit.read | ✓ | ✓ | | | |
| applications.read / manage | ✓ | ✓ | | | |
| participants.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| participants.manage | ✓ | ✓ | | | |
| participants.contact.read | ✓ | ✓ | | | ✓ |
| screening.read | ✓ | ✓ | | ✓ | |
| screening.manage | ✓ | ✓ | | | |
| consent.read | ✓ | ✓ | | ✓ | |
| consent.manage | ✓ | ✓ | | | |
| randomization.read | ✓ | ✓ | | ✓ | |
| randomization.manage | ✓ | ✓ | | | |
| cohorts.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| cohorts.read.all | ✓ | ✓ | | ✓ | ✓ |
| cohorts.manage | ✓ | ✓ | | | |
| sessions.read | ✓ | ✓ | ✓ | ✓ | |
| sessions.manage | ✓ | ✓ | ✓ | | |
| attendance.manage | ✓ | ✓ | ✓ | | |
| content.read | ✓ | ✓ | ✓ | ✓ | |
| content.manage / publish | ✓ | ✓ | | | |
| logistics.read / manage | ✓ | ✓ | | | ✓ |
| communications.read | ✓ | ✓ | ✓ | | |
| communications.manage | ✓ | ✓ | | | |
| communications.approve | ✓ | ✓ | | | |
| tasks.read / manage | ✓ | ✓ | ✓ | | ✓ |
| alerts.read | ✓ | ✓ | ✓ | | ✓ |
| exports.research | ✓ | | | ✓ | |

## Field-level rules (to enforce as tables arrive)

- `participants.read` without `participants.contact.read` returns participant code, statuses and cohort, **not** name/email/phone/address.
- FACILITATOR access is narrowed to assigned cohorts via `cohort_staff`. This is
  implemented as the `cohorts.read.all` permission rather than a role check
  (D-022): holders see every cohort, and a caller without it is limited to the
  cohorts they staff. The narrowing is applied in service queries through
  `ctx.cohortScope`, and an out-of-scope cohort returns 404.
- RESEARCHER sees status fields and `external_record_id`, never contact data or logistics.
- LOGISTICS sees contact + shipping data, never screening/consent/randomization detail.

## Dashboard navigation visibility

`src/domain/navigation.ts` maps each section to the permissions that reveal it. The server filters the menu; the page re-checks on render.

## Open items

- Staff MFA (Supabase Auth) for production.
- Whether RESEARCHER exports require a second approval.
