-- =============================================================================
-- CLP Hub · Migration 0015 · Automation (Phase 8)
-- Tables: study_events, automation_rules, scheduled_actions, tasks, alerts
--
-- The model is STATE + EVENT + RULE → ACTION (docs/automations.md). Nothing in
-- this schema encodes a trial-specific timing, template or threshold: rules are
-- configuration rows and the processor only knows how to read one.
--
-- NOTHING HERE SENDS ANYTHING, AND NOTHING HERE COULD.
-- ----------------------------------------------------
-- There is no recipient column, no address column, no credential column, no
-- provider column, no delivery-receipt column and no retry-after column. The
-- furthest `scheduled_actions.status` goes on its own is READY: prepared,
-- re-checked against the state as it is at that moment, and waiting for a
-- person. DONE is a human saying they acted (D-004, D-039, D-043).
--
-- `automation_rules.delivery_mode` keeps AUTOMATIC in the enum because
-- docs/automations.md designed for it, and a check constraint below refuses to
-- store it. The vocabulary stays honest about the design; the constraint stays
-- honest about what this application can do.
--
-- WHAT A RULE MAY TEST
-- --------------------
-- `conditions_json` is an object of named boolean predicates drawn from a closed
-- allow-list in src/domain/automation.ts — participantActive, sessionScheduled,
-- deviceOut and so on. No operators, no values, no field access. A rule that
-- could read an arbitrary column would eventually branch on a screening result,
-- which this application must never do.
--
-- Purely additive. No existing table, column, index or row is touched.
-- =============================================================================

-- Enums ------------------------------------------------------------------------

do $$ begin
  create type automation_event_type as enum (
    'APPLICATION_SUBMITTED','SCREENING_SCHEDULED','SCREENING_COMPLETED',
    'ELIGIBILITY_DETERMINED','CONSENT_RECORDED','ALLOCATION_RECORDED',
    'COHORT_ASSIGNED','COHORT_STATUS_CHANGED','VISIT_SCHEDULED',
    'SESSION_SCHEDULED','SESSION_RESCHEDULED','SESSION_CANCELLED','SESSION_HELD',
    'DEVICE_ASSIGNED','DEVICE_DELIVERED','DEVICE_RETURN_REQUESTED','DEVICE_RETURNED',
    'PARTICIPANT_WITHDRAWN','PARTICIPANT_COMPLETED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_subject_kind as enum
    ('PARTICIPANT','COHORT','SESSION','DEVICE','STUDY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_action_kind as enum ('MESSAGE','TASK','ALERT');
exception when duplicate_object then null; end $$;

-- AUTOMATIC is in the vocabulary and refused by constraint. See the header.
do $$ begin
  create type automation_delivery_mode as enum ('MANUAL','APPROVAL_REQUIRED','AUTOMATIC');
exception when duplicate_object then null; end $$;

-- No SENT and no DELIVERED, deliberately. READY is as far as the system goes.
do $$ begin
  create type scheduled_action_status as enum
    ('PENDING','READY','DONE','SKIPPED','CANCELLED','FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('OPEN','DONE','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('LOW','NORMAL','HIGH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_origin as enum ('MANUAL','RULE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_kind as enum (
    'ALLOCATION_WITHOUT_CONSENT','COHORT_UNDERSIZED','COHORT_OVER_CAPACITY',
    'DEVICE_RETURN_OVERDUE','EXCLUSION_WITHOUT_REASON','VR_NOT_READY_BEFORE_SESSION',
    'SCHEDULED_ACTION_FAILED','RULE_MISCONFIGURED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_severity as enum ('INFO','WARNING','CRITICAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_status as enum ('OPEN','ACKNOWLEDGED','RESOLVED');
exception when duplicate_object then null; end $$;

-- study_events -----------------------------------------------------------------
-- Plain rows recording that something operational happened. NOT event sourcing:
-- no table is rebuilt from these, and deleting one would lose history without
-- corrupting state.
--
-- The two timestamps are the point of the table:
--   * occurred_at — when the fact was recorded.
--   * anchor_at   — the time a rule offsets FROM.
-- For "immediately after the application" they are the same. For "24 h before
-- session" the anchor is the session's start, which is in the future when the
-- event is written. One rule engine, both shapes, and no rule has to know which
-- kind it is reading.
create table if not exists study_events (
  id           uuid primary key default gen_random_uuid(),
  study_id     uuid not null references studies(id) on delete restrict,
  event_type   automation_event_type not null,
  subject_kind automation_subject_kind not null,
  -- Exactly one of these matches subject_kind; STUDY sets none of them.
  participant_id uuid references participants(id) on delete restrict,
  cohort_id      uuid references cohorts(id) on delete restrict,
  session_id     uuid references cohort_sessions(id) on delete restrict,
  device_id      uuid references devices(id) on delete restrict,
  occurred_at  timestamptz not null default now(),
  anchor_at    timestamptz not null default now(),
  -- Operational context for traceability: codes, ids, a status name. Never a
  -- name, never a contact detail, never anything from Category C.
  metadata     jsonb,
  created_at   timestamptz not null default now(),
  constraint study_events_subject_matches check (
    (subject_kind = 'PARTICIPANT' and participant_id is not null)
    or (subject_kind = 'COHORT'  and cohort_id is not null)
    or (subject_kind = 'SESSION' and session_id is not null)
    or (subject_kind = 'DEVICE'  and device_id is not null)
    or (subject_kind = 'STUDY'
        and participant_id is null and cohort_id is null
        and session_id is null and device_id is null)
  )
);

create index if not exists study_events_study_idx
  on study_events (study_id, event_type, occurred_at desc);
create index if not exists study_events_participant_idx
  on study_events (participant_id, occurred_at desc);
create index if not exists study_events_session_idx
  on study_events (session_id, occurred_at desc);

-- automation_rules -------------------------------------------------------------
-- Configuration. Every timing this trial uses lives in a row here, never in
-- code (CLAUDE.md rule 6).
create table if not exists automation_rules (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  key            text not null,
  name_es        text not null,
  event_type     automation_event_type not null,
  action_kind    automation_action_kind not null,
  -- Minutes from the event's anchor. Negative is before it.
  offset_minutes integer not null default 0,
  delivery_mode  automation_delivery_mode not null default 'MANUAL',
  -- MESSAGE rules point at a template; TASK and ALERT rules do not.
  communication_template_id uuid references communication_templates(id),
  -- TASK rules carry the title the task is created with.
  task_title_es  text,
  task_priority  task_priority not null default 'NORMAL',
  -- ALERT rules carry the kind they raise.
  alert_kind     alert_kind,
  -- Named boolean predicates from a closed allow-list. See the header.
  conditions_json jsonb not null default '{}'::jsonb,
  active         boolean not null default true,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint automation_rules_key_unique unique (study_id, key),
  constraint automation_rules_key_shape check (key ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
  constraint automation_rules_name_length check (length(name_es) between 1 and 120),
  constraint automation_rules_offset_bounds
    check (offset_minutes between -527040 and 527040),
  -- THE SEND GUARD. AUTOMATIC delivery would need an outbound client, a
  -- credential and an endpoint. None exist (D-004, D-039, D-043). Removing this
  -- constraint is not enough to make one appear, which is the point: a rule
  -- cannot claim a capability the application does not have.
  constraint automation_rules_no_automatic_delivery
    check (delivery_mode <> 'AUTOMATIC'),
  -- Each action kind carries exactly what it needs and nothing it does not.
  constraint automation_rules_action_shape check (
    (action_kind = 'MESSAGE'
       and communication_template_id is not null
       and task_title_es is null and alert_kind is null)
    or (action_kind = 'TASK'
       and task_title_es is not null
       and communication_template_id is null and alert_kind is null)
    or (action_kind = 'ALERT'
       and alert_kind is not null
       and communication_template_id is null and task_title_es is null)
  ),
  constraint automation_rules_task_title_length
    check (task_title_es is null or length(task_title_es) between 1 and 160),
  constraint automation_rules_conditions_is_object
    check (jsonb_typeof(conditions_json) = 'object')
);

create index if not exists automation_rules_event_idx
  on automation_rules (study_id, event_type, active);

drop trigger if exists automation_rules_set_updated_at on automation_rules;
create trigger automation_rules_set_updated_at before update on automation_rules
  for each row execute function set_updated_at();

-- scheduled_actions ------------------------------------------------------------
-- One concrete instance of one rule firing for one subject.
--
-- `snapshot_json` is written when the action is materialised and is FOR
-- TRACEABILITY ONLY. The go/no-go is taken when the action comes due, against
-- the state as it is then. A reminder scheduled on Monday for someone who
-- withdrew on Tuesday is SKIPPED with the unmet condition recorded, never
-- prepared (docs/automations.md, "Execution rule").
create table if not exists scheduled_actions (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  rule_id        uuid not null references automation_rules(id) on delete restrict,
  event_id       uuid not null references study_events(id) on delete restrict,
  subject_kind   automation_subject_kind not null,
  participant_id uuid references participants(id) on delete restrict,
  cohort_id      uuid references cohorts(id) on delete restrict,
  session_id     uuid references cohort_sessions(id) on delete restrict,
  device_id      uuid references devices(id) on delete restrict,
  action_kind    automation_action_kind not null,
  delivery_mode  automation_delivery_mode not null default 'MANUAL',
  scheduled_for  timestamptz not null,
  status         scheduled_action_status not null default 'PENDING',
  -- Unmet conditions, or the processing failure. A vocabulary, not prose, so it
  -- can be counted.
  skip_reason    text,
  snapshot_json  jsonb,
  processed_at   timestamptz,
  completed_at   timestamptz,
  completed_by   uuid references users(id),
  -- Set when a MESSAGE action ends with a person recording that they sent it.
  communication_id uuid references communications(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint scheduled_actions_subject_matches check (
    (subject_kind = 'PARTICIPANT' and participant_id is not null)
    or (subject_kind = 'COHORT'  and cohort_id is not null)
    or (subject_kind = 'SESSION' and session_id is not null)
    or (subject_kind = 'DEVICE'  and device_id is not null)
    or (subject_kind = 'STUDY'
        and participant_id is null and cohort_id is null
        and session_id is null and device_id is null)
  ),
  constraint scheduled_actions_no_automatic_delivery
    check (delivery_mode <> 'AUTOMATIC'),
  constraint scheduled_actions_skip_reason_length
    check (skip_reason is null or length(skip_reason) <= 280),
  -- A communication can only hang off a message action that a person finished.
  constraint scheduled_actions_communication_consistent
    check (communication_id is null or (action_kind = 'MESSAGE' and status = 'DONE'))
);

-- One rule fires at most once per event. Re-running the materialiser over the
-- same events is therefore free, which is what makes the processor safe to run
-- on a cron that may overlap or retry.
create unique index if not exists scheduled_actions_rule_event_unique
  on scheduled_actions (rule_id, event_id);

-- The processor's hot path: what is due and still open.
create index if not exists scheduled_actions_due_idx
  on scheduled_actions (study_id, status, scheduled_for)
  where status in ('PENDING','READY');
create index if not exists scheduled_actions_participant_idx
  on scheduled_actions (participant_id, scheduled_for desc);
create index if not exists scheduled_actions_session_idx
  on scheduled_actions (session_id, scheduled_for desc);

drop trigger if exists scheduled_actions_set_updated_at on scheduled_actions;
create trigger scheduled_actions_set_updated_at before update on scheduled_actions
  for each row execute function set_updated_at();

-- tasks ------------------------------------------------------------------------
-- Human work. Created by a person or by a TASK rule.
--
-- `title_es` and `detail` are staff-authored free text on a shared screen. The
-- same warning the visit note carries applies (D-035): nothing stops someone
-- typing a clinical observation into a text box, and the boundary is documented
-- and audited rather than pretended away.
create table if not exists tasks (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  -- Set for a rule-created task so re-running the processor updates rather than
  -- duplicates. Null for a task a person typed.
  dedupe_key     text,
  title_es       text not null,
  detail         text,
  status         task_status not null default 'OPEN',
  priority       task_priority not null default 'NORMAL',
  origin         task_origin not null default 'MANUAL',
  due_at         timestamptz,
  assigned_to    uuid references users(id),
  participant_id uuid references participants(id) on delete restrict,
  cohort_id      uuid references cohorts(id) on delete restrict,
  session_id     uuid references cohort_sessions(id) on delete restrict,
  device_id      uuid references devices(id) on delete restrict,
  rule_id        uuid references automation_rules(id),
  scheduled_action_id uuid references scheduled_actions(id),
  created_by     uuid references users(id),
  completed_by   uuid references users(id),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint tasks_title_length check (length(title_es) between 1 and 160),
  constraint tasks_detail_length check (detail is null or length(detail) <= 1000),
  -- A rule-created task always carries the rule it came from, and a hand-typed
  -- one never does. Otherwise "who put this here" is unanswerable.
  constraint tasks_origin_consistent check (
    (origin = 'RULE' and rule_id is not null)
    or (origin = 'MANUAL' and rule_id is null)
  ),
  constraint tasks_completion_consistent check (
    (status = 'DONE') = (completed_at is not null)
  )
);

create unique index if not exists tasks_dedupe_unique
  on tasks (study_id, dedupe_key) where dedupe_key is not null;
create index if not exists tasks_open_idx
  on tasks (study_id, status, due_at) where status = 'OPEN';
create index if not exists tasks_assigned_idx
  on tasks (assigned_to, status);
create index if not exists tasks_participant_idx on tasks (participant_id);

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();

-- alerts -----------------------------------------------------------------------
-- Operational risk: something is missing, late, or inconsistent in the records
-- the team keeps.
--
-- EVERY ALERT IS ABOUT THE DATA, NEVER ABOUT A PERSON. `detail` carries codes —
-- P-000042, C-2026-A, VR-07 — exactly as the attention panel does, because this
-- is the screen most likely to be open on a shared monitor. An alert means
-- "someone should look", never "the system has concluded".
--
-- `dedupe_key` is `<kind>:<subjectKind>:<subjectId>`, deliberately without a
-- date: a headset still overdue tomorrow is the same problem, and a key that
-- moved daily would defeat the deduplication it exists for.
create table if not exists alerts (
  id             uuid primary key default gen_random_uuid(),
  study_id       uuid not null references studies(id) on delete restrict,
  kind           alert_kind not null,
  severity       alert_severity not null default 'WARNING',
  status         alert_status not null default 'OPEN',
  dedupe_key     text not null,
  subject_kind   automation_subject_kind not null,
  participant_id uuid references participants(id) on delete restrict,
  cohort_id      uuid references cohorts(id) on delete restrict,
  session_id     uuid references cohort_sessions(id) on delete restrict,
  device_id      uuid references devices(id) on delete restrict,
  -- Short, operational, code-only. Never a name.
  detail         text,
  rule_id        uuid references automation_rules(id),
  scheduled_action_id uuid references scheduled_actions(id),
  raised_at      timestamptz not null default now(),
  -- Bumped every time a sweep still finds the problem, so "since when" and
  -- "still true as of" are both answerable from one row.
  last_seen_at   timestamptz not null default now(),
  acknowledged_by uuid references users(id),
  acknowledged_at timestamptz,
  resolved_by    uuid references users(id),
  resolved_at    timestamptz,
  resolution_note text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint alerts_detail_length check (detail is null or length(detail) <= 280),
  constraint alerts_resolution_note_length
    check (resolution_note is null or length(resolution_note) <= 280),
  constraint alerts_subject_matches check (
    (subject_kind = 'PARTICIPANT' and participant_id is not null)
    or (subject_kind = 'COHORT'  and cohort_id is not null)
    or (subject_kind = 'SESSION' and session_id is not null)
    or (subject_kind = 'DEVICE'  and device_id is not null)
    or (subject_kind = 'STUDY'
        and participant_id is null and cohort_id is null
        and session_id is null and device_id is null)
  ),
  constraint alerts_acknowledged_consistent
    check ((acknowledged_at is null) = (acknowledged_by is null)),
  constraint alerts_resolution_consistent
    check ((status = 'RESOLVED') = (resolved_at is not null))
);

-- One OPEN or ACKNOWLEDGED row per problem. A resolved alert does not block a
-- new one: if the same headset goes overdue again next month, that is a new
-- problem and deserves its own row and its own raised_at.
create unique index if not exists alerts_unresolved_unique
  on alerts (study_id, dedupe_key) where status in ('OPEN','ACKNOWLEDGED');
create index if not exists alerts_open_idx
  on alerts (study_id, status, severity, raised_at desc);
create index if not exists alerts_participant_idx on alerts (participant_id);

drop trigger if exists alerts_set_updated_at on alerts;
create trigger alerts_set_updated_at before update on alerts
  for each row execute function set_updated_at();

-- Security: deny the Supabase API keys entirely --------------------------------
alter table study_events      enable row level security;
alter table automation_rules  enable row level security;
alter table scheduled_actions enable row level security;
alter table tasks             enable row level security;
alter table alerts            enable row level security;

revoke all on study_events, automation_rules, scheduled_actions, tasks, alerts
  from anon, authenticated;
