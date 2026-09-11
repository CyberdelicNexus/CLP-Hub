-- =============================================================================
-- CLP Hub · Migration 0012 · Message templates and send records (Phase 7)
-- Tables: communication_templates, communications
--
-- NOTHING IN THIS APPLICATION SENDS A MESSAGE, and nothing in this schema
-- enables one (D-004, D-039). There is no API token column, no queue, no
-- scheduled-send table and no delivery status. A template is rendered on screen,
-- copied by a person, pasted into WhatsApp by that person, and then marked as
-- sent.
--
-- WHAT IS DELIBERATELY NOT STORED
-- -------------------------------
--   * The rendered message. `communications.template_body` holds the template
--     text with its placeholders INTACT. That answers "what did we send
--     P-000042 on the 4th" without copying their name, date and location into a
--     second table.
--   * Replies. There is no inbound path and no column for one. This application
--     never holds a WhatsApp conversation.
--   * Delivery status. No DELIVERED, no FAILED. Nothing here observes delivery,
--     and a status the application cannot verify would be a claim, not a record.
--
-- Purely additive. No existing table, column, index or row is touched.
-- =============================================================================

do $$ begin
  create type communication_stage as enum (
    'APPLICATION_RECEIVED','SCREENING_SCHEDULING','INFO_REQUEST',
    'ELIGIBILITY_CONFIRMED','WAITLIST','INITIAL_SESSION_SCHEDULING',
    'SESSION_REMINDER','VR_INSTRUCTIONS','FOLLOW_UP','CLOSING'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type communication_channel as enum ('WHATSAPP','EMAIL');
exception when duplicate_object then null; end $$;

-- Only what a person can attest to.
do $$ begin
  create type communication_status as enum ('SENT','SKIPPED');
exception when duplicate_object then null; end $$;

-- communication_templates ------------------------------------------------------
-- Spanish is mandatory; English is optional and for staff preview only (D-009).
create table if not exists communication_templates (
  id         uuid primary key default gen_random_uuid(),
  study_id   uuid not null references studies(id) on delete restrict,
  key        text not null,
  stage      communication_stage not null,
  channel    communication_channel not null default 'WHATSAPP',
  name_es    text not null,
  name_en    text,
  body_es    text not null,
  body_en    text,
  version    integer not null default 1,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_templates_key_unique unique (study_id, key),
  constraint communication_templates_key_shape
    check (key ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
  constraint communication_templates_name_length
    check (length(name_es) between 1 and 120
           and (name_en is null or length(name_en) <= 120)),
  constraint communication_templates_body_length
    check (length(body_es) between 1 and 2000
           and (body_en is null or length(body_en) <= 2000)),
  constraint communication_templates_version_positive check (version >= 1)
);

create index if not exists communication_templates_stage_idx
  on communication_templates (study_id, stage, position);

drop trigger if exists communication_templates_set_updated_at on communication_templates;
create trigger communication_templates_set_updated_at before update on communication_templates
  for each row execute function set_updated_at();

-- communications ---------------------------------------------------------------
-- Append-only by convention: a send is a historical fact.
create table if not exists communications (
  id               uuid primary key default gen_random_uuid(),
  study_id         uuid not null references studies(id) on delete restrict,
  participant_id   uuid not null references participants(id) on delete restrict,
  template_id      uuid references communication_templates(id),
  template_version integer,
  -- The TEMPLATE, placeholders intact. Never the rendered message.
  template_body    text,
  stage            communication_stage not null,
  channel          communication_channel not null,
  status           communication_status not null default 'SENT',
  skip_reason      text,
  sent_at          timestamptz not null default now(),
  sent_by          uuid references users(id),
  constraint communications_body_length
    check (template_body is null or length(template_body) <= 2000),
  constraint communications_skip_reason_length
    check (skip_reason is null or length(skip_reason) <= 280),
  -- A reason only makes sense on a skip.
  constraint communications_skip_reason_consistent
    check (status = 'SKIPPED' or skip_reason is null)
);

create index if not exists communications_participant_idx
  on communications (participant_id, sent_at desc);
create index if not exists communications_study_idx
  on communications (study_id, stage, sent_at desc);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table communication_templates enable row level security;
alter table communications          enable row level security;

revoke all on communication_templates, communications from anon, authenticated;
