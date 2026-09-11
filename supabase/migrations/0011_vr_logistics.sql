-- =============================================================================
-- CLP Hub · Migration 0011 · VR device logistics (Phase 6)
-- Tables: devices, device_assignments, device_incidents
--
-- EQUIPMENT, NOT PEOPLE. Everything here is asset tracking that happens to be
-- attached to a participant code. No column holds research or clinical data, and
-- there is deliberately no place to record something that happened to a person:
-- an adverse event is Category C and belongs in the institution's approved
-- system (docs/research-data-boundaries.md).
--
-- WHAT IS DELIBERATELY ABSENT, AND WHY (D-038)
-- --------------------------------------------
--   * No `responsible_user_id` on device_assignments. Who handles a
--     participant's equipment is already participant_responsibilities with role
--     VR_EQUIPMENT (D-035). A second column for the same fact would drift from
--     it, and the brief explicitly asks not to duplicate existing relations.
--     Views join to that table instead.
--
--   * No `next_session_at`. That is cohort_sessions for the participant's
--     cohort, read at display time. Copied here it would go stale the moment a
--     session moved.
--
--   * No readiness inference. `readiness` is reported by staff or by the
--     participant (D-003); nothing computes it. A readiness this application
--     guessed would be a statement about someone's setup that nobody checked.
--
-- Purely additive. No existing table, column, index or row is touched.
-- =============================================================================

do $$ begin
  create type device_status as enum (
    'AVAILABLE','RESERVED','PREPARING','SHIPPED','DELIVERED','ACTIVE',
    'RETURN_REQUESTED','RETURN_IN_TRANSIT','RETURNED','CLEANING','MAINTENANCE'
  );
exception when duplicate_object then null; end $$;

-- NEEDS_SUPPORT is its own value rather than a flavour of NOT_READY, for the
-- same reason TECHNICAL_FAILURE is not ABSENT (D-024): "it does not work and I
-- need help" is a different operational fact from "it is not set up yet".
do $$ begin
  create type vr_readiness as enum ('UNKNOWN','READY','NOT_READY','NEEDS_SUPPORT');
exception when duplicate_object then null; end $$;

-- Equipment problems only. No category names anything that happened to a person.
do $$ begin
  create type incident_kind as enum (
    'NOT_DELIVERED','DAMAGED','LOST','HARDWARE_FAULT','SOFTWARE_FAULT',
    'CONNECTIVITY','NOT_RETURNED','OTHER'
  );
exception when duplicate_object then null; end $$;

-- devices ----------------------------------------------------------------------
create table if not exists devices (
  id         uuid primary key default gen_random_uuid(),
  study_id   uuid not null references studies(id) on delete restrict,
  code       text not null,
  model      text,
  serial     text,
  status     device_status not null default 'AVAILABLE',
  active     boolean not null default true,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_code_unique unique (study_id, code),
  constraint devices_code_shape check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint devices_label_length
    check ((model is null or length(model) <= 120)
           and (serial is null or length(serial) <= 120)
           and (notes is null or length(notes) <= 500))
);

create index if not exists devices_status_idx on devices (study_id, status);

drop trigger if exists devices_set_updated_at on devices;
create trigger devices_set_updated_at before update on devices
  for each row execute function set_updated_at();

-- device_assignments -----------------------------------------------------------
-- Historical: closed, never deleted; a re-issue is a new row.
create table if not exists device_assignments (
  id                    uuid primary key default gen_random_uuid(),
  study_id              uuid not null references studies(id) on delete restrict,
  device_id             uuid not null references devices(id) on delete restrict,
  participant_id        uuid not null references participants(id) on delete restrict,
  handed_over_at        timestamptz,
  received_at           timestamptz,
  readiness             vr_readiness not null default 'UNKNOWN',
  readiness_reported_at timestamptz,
  expected_return_at    timestamptz,
  returned_at           timestamptz,
  closed_at             timestamptz,
  assigned_by           uuid references users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Arithmetic of the physical world: a device cannot be received before it was
  -- handed over, nor returned before it was received.
  constraint device_assignments_dates_ordered
    check (
      (received_at is null or handed_over_at is null or received_at >= handed_over_at)
      and (returned_at is null or handed_over_at is null or returned_at >= handed_over_at)
      and (closed_at is null or returned_at is not null)
    ),
  -- A reported readiness has a timestamp. UNKNOWN means nobody reported.
  constraint device_assignments_readiness_reported
    check (readiness = 'UNKNOWN' or readiness_reported_at is not null)
);

-- One open assignment per device: a headset cannot be with two people at once.
create unique index if not exists device_assignments_one_open_per_device
  on device_assignments (device_id) where closed_at is null;

-- And one per participant, for the same reason in reverse.
create unique index if not exists device_assignments_one_open_per_participant
  on device_assignments (participant_id) where closed_at is null;

create index if not exists device_assignments_device_idx
  on device_assignments (device_id, created_at desc);
create index if not exists device_assignments_participant_idx
  on device_assignments (participant_id, created_at desc);
create index if not exists device_assignments_open_idx
  on device_assignments (study_id) where closed_at is null;

drop trigger if exists device_assignments_set_updated_at on device_assignments;
create trigger device_assignments_set_updated_at before update on device_assignments
  for each row execute function set_updated_at();

-- device_incidents -------------------------------------------------------------
create table if not exists device_incidents (
  id            uuid primary key default gen_random_uuid(),
  study_id      uuid not null references studies(id) on delete restrict,
  device_id     uuid not null references devices(id) on delete restrict,
  assignment_id uuid references device_assignments(id),
  kind          incident_kind not null,
  description   text,
  reported_by   uuid references users(id),
  reported_at   timestamptz not null default now(),
  resolved_by   uuid references users(id),
  resolved_at   timestamptz,
  resolution    text,
  -- Capped so a fault report stays a fault report. The form also says, in
  -- Spanish, that this is about equipment and not about a person.
  constraint device_incidents_text_length
    check ((description is null or length(description) <= 500)
           and (resolution is null or length(resolution) <= 500)),
  constraint device_incidents_resolution_consistent
    check (resolved_at is not null or resolution is null)
);

create index if not exists device_incidents_device_idx on device_incidents (device_id, reported_at desc);
create index if not exists device_incidents_open_idx
  on device_incidents (study_id) where resolved_at is null;
create index if not exists device_incidents_assignment_idx on device_incidents (assignment_id);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table devices            enable row level security;
alter table device_assignments enable row level security;
alter table device_incidents   enable row level security;

revoke all on devices, device_assignments, device_incidents from anon, authenticated;
