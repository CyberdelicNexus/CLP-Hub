# Automations (design — implemented in Phase 8)

Model: **STATE + EVENT + RULE → ACTION**. Communication logic lives in rules, never scattered through UI components.

## Tables

- `study_events` — internal domain events (`APPLICATION_SUBMITTED`, `SESSION_START`, `DEVICE_DELIVERED`, …). Plain rows, not event sourcing.
- `automation_rules` — per study: `event_type`, `event_filter`, `offset_minutes`, `communication_template_id`, `delivery_mode`, `conditions_json`, `active`.
- `scheduled_actions` — concrete instances with `scheduled_for`, `status`, `approval_status`, `payload`.
- `tasks` and `alerts` — human work and operational risk, created by rules as well.

## Delivery modes

| Mode | Behaviour | Default for |
|---|---|---|
| AUTOMATIC | Sent by the processor without review | Pure logistics reminders (email) |
| APPROVAL_REQUIRED | Prepared, waits for Preview / Edit / Approve & Send / Skip | Reflective, emotional, facilitator-oriented content |
| MANUAL | Rendered on the cohort "Mensajes" page for a human to copy-paste and mark sent | **All WhatsApp** (decision D-004) |

Sensitive templates (`sensitive = true`) can never be AUTOMATIC.

## Execution rule (critical)

At execution time the processor **re-evaluates** participant state and rule conditions. A reminder scheduled Monday for a participant who withdrew Tuesday morning is SKIPPED with a reason, never sent. Scheduled actions store a snapshot for traceability but never rely on it for the go/no-go decision.

Rescheduling a cohort session recalculates its dependent scheduled actions (cancel + recreate with audit) rather than editing them in place.

## Mechanism

Vercel Cron → `/api/internal/process-scheduled-actions` (secret-protected) → claims due actions → per-action: re-check → deliver / prepare / skip → immutable `communications` row → audit. Trigger.dev was dropped for simplicity (D-005); it can be reintroduced behind the same processor boundary if needed.

## Configurable timings (examples from the previous study; not hardcoded)

Immediately after signup · ~2 weeks before first session · ~1 week before session · after headset shipment · 4 days before orientation · 24 h before session · morning of session · 1 h before · immediately after · 1–2 h after · 24 h after completion · 3 business days after completion · weekly until headset returned.

## WhatsApp manual flow

Cohort page → "Mensajes" tab lists every message on the cohort timeline, rendered in Spanish with real dates/links → facilitator copies → pastes into the group → clicks "Marcar como enviado" → `communications` row (`channel = WHATSAPP`, `status = SENT`, `sent_by`) + audit. Nothing is sent by the system.
