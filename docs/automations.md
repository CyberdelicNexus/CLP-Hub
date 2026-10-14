# Automations (Phase 8 — implemented, migration 0015)

Model: **STATE + EVENT + RULE → ACTION**. Communication logic lives in rules, never scattered through UI components.

## What sends, and what never does

A MANUAL or APPROVAL_REQUIRED action that comes due and still makes sense reaches `READY` and waits for a person, who copies the message and says they sent it (D-004, D-039, D-043). **WhatsApp is always this way.**

Since D-116 an AUTOMATIC action **sends**, under three limits: the template is an EMAIL, it is addressed to one participant (`audience = PARTICIPANT`), and its body uses only `{{nombre}}`, `{{codigo}}` and `{{cohorte}}`. `createRule` refuses anything else, and the processor re-checks the template when the action comes due. Sending goes through `src/services/email-delivery.ts`, one email per person, each recorded as a `communications` row (`sent_by` null) with a SYSTEM audit row. The automation domain, service and processor route still hold no HTTP client or credential; `tests/automation.test.ts` asserts that, and that `sendMail` has no caller other than the delivery module and the inquiry inbox.

`scheduled_actions.status` has no `SENT` and no `DELIVERED`: what went out is the `communications` rows. An automatic action is claimed (PENDING → READY) before sending and ends DONE, or FAILED if nobody could be emailed. Recipients that failed raise a CRITICAL `EMAIL_NOT_SENT` alert by code; nothing is retried. With no sender configured nothing is claimed, the action stays PENDING behind an `EMAIL_NOT_CONFIGURED` alert, and goes out late once mail works.

## Tables

- `study_events` — operational facts, plain rows (not event sourcing).
- `automation_rules` — per study: `event_type`, `offset_minutes`, `action_kind`, `delivery_mode`, `communication_template_id` / `task_title_es` / `alert_kind`, `conditions_json`, `active`.
- `scheduled_actions` — concrete instances with `scheduled_for`, `status`, `skip_reason`, `snapshot_json`.
- `tasks` — human work, created by a person or by a TASK rule.
- `alerts` — operational risk, deduplicated per subject.

## The two timestamps on an event

This is the design that lets one engine serve every rule:

| Column | Meaning |
|---|---|
| `occurred_at` | When the fact was recorded |
| `anchor_at` | What a rule's offset is measured **from** |

"Immediately after the application" is `anchor_at = occurred_at`, offset `0`. "24 h before session 2" is `anchor_at = the session's start` — still in the future when the event is written — offset `-1440`. No rule has to know which kind it is reading.

`scheduled_for = anchor_at + offset_minutes`, bounded at roughly a year either way.

## Delivery modes

| Mode | Behaviour | Available |
|---|---|---|
| MANUAL | Prepared, appears in the queue, copied and sent by a person | ✓ |
| APPROVAL_REQUIRED | Same, with the expectation that it is reviewed before sending | ✓ |
| AUTOMATIC | Sent by the Hub when due, one email per person | **Email only** (D-116) |

AUTOMATIC is refused **at save time** for anything but an individual email template with always-known values (`isDeliveryModeAvailable(mode, channel)` and `automaticTemplateProblem` in the domain, `createRule` in the service), because a rule stored as AUTOMATIC and quietly downgraded when it fires would tell the team their messages were going out. Migration 0026 keeps a database guard: only a MESSAGE action can be AUTOMATIC.

## Scopes: which group a rule is for (D-116)

A rule may name an **arm** and, for session events, a **session template**. Both are configuration, not conditions; `CONDITION_KEYS` is unchanged.

- The arm scope reads the arm a **cohort** was configured with, never a participant's allocation. For an event about a participant, their own current cohort must run the arm. For a session or cohort event, the event's cohort must run it, or a cohort **paired** with it must (`cohorts.paired_cohort_id`, "follows the calendar of").
- A control cohort has no sessions. Pair it with the programme cohort, and a rule "control arm, SESSION_SCHEDULED, S0, +7 days" emails the control cohort's members a week after the programme cohort's S0. The action records whose members it is for in `scheduled_actions.audience_cohort_id`.
- The scope is re-checked when the action comes due; a person no longer in a cohort of that arm is skipped as `outOfScope`.

## What a rule may test

`conditions_json` is an object of named boolean predicates drawn from a **closed allow-list** (`CONDITION_KEYS`): `participantActive`, `participantEnrolled`, `consentActive`, `cohortActive`, `sessionScheduled`, `attendanceNotRecorded`, `deviceOut`, `vrNotReady`.

No operators, no values, no field access. `{"participantActive": true}` is the entire vocabulary. This is the same safety model as `TEMPLATE_VARIABLES`: a rule that could read an arbitrary column would eventually branch on a screening result, which this application must never do (CLAUDE.md rule 3). `consentActive` asks whether a consent row exists and stands — never what it granted.

Unknown keys in a stored row are **dropped, not honoured and not fatal**, and raise a `RULE_MISCONFIGURED` alert.

## Execution rule (critical)

At execution time the processor **re-evaluates** participant state and rule conditions. A reminder scheduled Monday for a participant who withdrew Tuesday morning is SKIPPED with the unmet condition named, never prepared. `snapshot_json` is written at materialisation for traceability and is **never** consulted for the decision.

Every unmet condition is recorded, not just the first, and as a vocabulary rather than prose — so "how often do we skip because someone withdrew" is countable.

There is **no grace window**. An action that should have been prepared on Friday and was not, because the processor was down, is still prepared on Monday with its original `scheduled_for` visible. Dropping it silently would hide an outage; the queue marks it late instead.

Rescheduling or cancelling a session, and withdrawing a participant, **cancel** the open actions against that subject rather than editing them (`INVALIDATING_EVENTS`). Editing in place would rewrite a row whose audit trail says it was scheduled for a different time.

## Mechanism

Vercel Cron → `POST /api/internal/process-scheduled-actions` → for every ACTIVE study: process due actions, then run the sweeps.

- Authorised with `Authorization: Bearer <CRON_SECRET>`. **Unset means closed**: the endpoint refuses every request with 503 rather than skipping the check, so an unconfigured deployment is not an open processor.
- `GET` and `POST` share the same secret check. Vercel Cron calls with GET (it used to be refused with 405, so the cron never ran; D-116); a GET without the secret is refused like any other request, so a prefetch or a link checker cannot run it.
- Safe to run twice. Materialisation is unique per `(rule_id, event_id)`, alerts deduplicate per subject, and an action is only picked up while `PENDING`.
- Capped at 200 actions per run. A backlog is worked through over several ticks rather than in one request that times out halfway.
- Failures are per action and per study: one rule pointing at a deleted template marks that action `FAILED` and raises a CRITICAL alert; the other ninety-nine still run.

Trigger.dev was dropped for simplicity (D-005); it can be reintroduced behind the same processor boundary if needed.

## Sweeps

State checks, deliberately separate from rules. A rule answers "this happened, so do that in N minutes"; a sweep answers "look at the study as it stands — is anything missing, late or inconsistent".

| Alert kind | What it means | Severity |
|---|---|---|
| `ALLOCATION_WITHOUT_CONSENT` | An allocation exists with no consent that stands | CRITICAL |
| `COHORT_UNDERSIZED` | An ACTIVE cohort is below its configured minimum | WARNING |
| `COHORT_OVER_CAPACITY` | A cohort is above its configured maximum | WARNING |
| `DEVICE_RETURN_OVERDUE` | A headset is past its expected return date and still out | WARNING |
| `EXCLUSION_WITHOUT_REASON` | An INELIGIBLE determination with no reason attached | WARNING |

**No sweep contains a trial-specific number.** Each reads either a configured bound (`cohorts.min_size`) or a fact with no threshold at all (a date that has passed). A check like "warn 48 h before the session if the headset is not ready" has this trial's number in it, so it is a **rule** — event `SESSION_SCHEDULED`, a negative offset, action `ALERT`, kind `VR_NOT_READY_BEFORE_SESSION` — and the seed ships one as a worked example.

Two further kinds are raised by the processor rather than by a sweep: `SCHEDULED_ACTION_FAILED` and `RULE_MISCONFIGURED`.

Severity is fixed in code, not configurable. A team that can turn "allocation without consent" down to INFO will, on the week it fires.

### Deduplication

`dedupe_key` is `<kind>:<subjectKind>:<subjectId>` and deliberately carries **no date**. A headset still overdue tomorrow is the same problem; a key that moved daily would defeat the deduplication it exists for, and the alerts screen would become the one people scroll past. `last_seen_at` is bumped instead, so one row answers both "since when" and "still true as of".

A RESOLVED alert does not block a new one: the same device overdue again next month is a new problem with its own `raised_at`.

An exclusion count is raised against the **study**, never against a person — naming one of three excluded participants would be worse than naming none.

## Alerts are never resolved by the system

Acknowledging and resolving are staff actions, audited as STAFF. A sweep that closed its own alerts would erase the record that something was wrong for two weeks.

## Where events are recorded

Inside the transaction that made the change, via `recordStudyEvent(tx, …)` — so a session marked HELD and the work scheduled around it commit together.

| Service | Events |
|---|---|
| `recruitment.ts` | `APPLICATION_SUBMITTED` (public form and Qualtrics intake) |
| `participant-ops.ts` | `SCREENING_SCHEDULED` (anchored on the appointment), `SCREENING_COMPLETED`, `ELIGIBILITY_DETERMINED`, `CONSENT_RECORDED`, `PARTICIPANT_WITHDRAWN`, `PARTICIPANT_COMPLETED` |
| `cohorts.ts` | `ALLOCATION_RECORDED`, `COHORT_ASSIGNED`, `COHORT_STATUS_CHANGED` |
| `sessions.ts` | `SESSION_SCHEDULED` (anchored on the start), `SESSION_HELD`, `SESSION_CANCELLED` |
| `logistics.ts` | `DEVICE_ASSIGNED`, `DEVICE_DELIVERED`, `DEVICE_RETURNED` |
| `participant-care.ts` | `VISIT_SCHEDULED` (anchored on the appointment) |

`SESSION_RESCHEDULED` and `DEVICE_RETURN_REQUESTED` are in the vocabulary but not yet emitted: there is no reschedule path in `sessions.ts` today.

**No event carries a determination, an arm or a contact detail.** `ELIGIBILITY_DETERMINED` records that a determination was made, never what it was, so a rule can act on the fact without this log ever holding the result.

## WhatsApp manual flow

Unchanged by Phase 8 and D-116: the only way a WhatsApp message reaches anyone. The prepared queue appears on `/equipo/comunicaciones` and on the overview's attention panel; each item opens the composer with its template already chosen. The person copies, pastes into WhatsApp, clicks "Marcar como enviado" → a `communications` row (`channel = WHATSAPP`, `status = SENT`, `sent_by`) plus audit, and the scheduled action is closed against that communication.

Marking a prepared message **skipped** does not close the queue item: a skip says the person decided not to send it, and the action should stay visible rather than disappear as if it had gone out.

## Configurable timings (examples from the previous study; not hardcoded)

Immediately after signup · ~2 weeks before first session · ~1 week before session · after headset shipment · 4 days before orientation · 24 h before session · morning of session · 1 h before · immediately after · 1–2 h after · 24 h after completion · 3 business days after completion · weekly until headset returned.

Each of these is one `automation_rules` row. None of them appears in code, and the four rules in the seed are synthetic demonstrations, not this trial's schedule.
