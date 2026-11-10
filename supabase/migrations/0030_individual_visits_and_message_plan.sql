-- =============================================================================
-- CLP Hub · Migration 0030 · Individual visits and a cohort's message plan
-- (2026-10-28 request, D-136)
-- Tables: participant_visits, cohort_planned_messages
-- Columns: session_templates.attendance, session_templates.device_handoff
--
-- S0 and the POST visit are held one participant at a time, at home, and are
-- when the team delivers and picks up the headset. A session template now
-- says whether it is GROUP (one date per cohort, as before) or INDIVIDUAL (a
-- date per participant), and whether its visit DELIVERS or PICKS UP the
-- headset. Which sessions those are is configuration, set in Configuración.
--
-- The control group has no sessions; its messages are dated directly on the
-- cohort. An eligible EMAIL (D-116) is sent at that time by the processor;
-- everything else is a dated reminder with text to copy.
-- =============================================================================

-- Not `session_attendance`: that name is already the row type of the
-- `session_attendance` table (the attendance register).
create type session_scheduling as enum ('GROUP', 'INDIVIDUAL');
create type device_handoff as enum ('NONE', 'DELIVERY', 'PICKUP');
create type planned_message_status as enum ('PLANNED', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED');

alter table session_templates
  add column if not exists attendance session_scheduling not null default 'GROUP',
  add column if not exists device_handoff device_handoff not null default 'NONE';

create table if not exists participant_visits (
  id              uuid primary key default gen_random_uuid(),
  study_id        uuid not null references studies(id) on delete restrict,
  cohort_id       uuid not null references cohorts(id) on delete restrict,
  participant_id  uuid not null references participants(id) on delete restrict,
  template_id     uuid not null references session_templates(id) on delete restrict,
  scheduled_at    timestamptz not null,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint participant_visits_unique unique (participant_id, template_id)
);

create index if not exists participant_visits_cohort_idx on participant_visits (cohort_id, scheduled_at);
create index if not exists participant_visits_study_idx on participant_visits (study_id, scheduled_at);

create table if not exists cohort_planned_messages (
  id            uuid primary key default gen_random_uuid(),
  study_id      uuid not null references studies(id) on delete restrict,
  cohort_id     uuid not null references cohorts(id) on delete restrict,
  template_id   uuid not null references communication_templates(id) on delete restrict,
  send_at       timestamptz not null,
  status        planned_message_status not null default 'PLANNED',
  processed_at  timestamptz,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cohort_planned_messages_unique unique (cohort_id, template_id)
);

create index if not exists cohort_planned_messages_due_idx on cohort_planned_messages (study_id, status, send_at);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table participant_visits enable row level security;
revoke all on participant_visits from anon, authenticated;
alter table cohort_planned_messages enable row level security;
revoke all on cohort_planned_messages from anon, authenticated;
