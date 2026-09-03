-- =============================================================================
-- CLP Hub · Migration 0001 · Foundation
-- Tables: studies, users, user_roles, audit_events, schema_migrations
-- Applied by scripts/migrate.ts (npm run db:migrate) or pasted into the
-- Supabase SQL editor. Idempotent where practical.
-- =============================================================================

-- Enums ----------------------------------------------------------------------
do $$ begin
  create type staff_role as enum ('ADMIN','STUDY_MANAGER','FACILITATOR','RESEARCHER','LOGISTICS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type study_status as enum ('DRAFT','ACTIVE','PAUSED','CLOSED','ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ui_locale as enum ('es','en');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_actor_type as enum ('STAFF','SYSTEM','PARTICIPANT');
exception when duplicate_object then null; end $$;

-- Helpers --------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function forbid_row_change() returns trigger
language plpgsql as $$
begin
  raise exception 'Table % is append-only', tg_table_name using errcode = 'restrict_violation';
end $$;

-- studies --------------------------------------------------------------------
create table if not exists studies (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  title             text not null,
  status            study_status not null default 'DRAFT',
  default_locale    ui_locale not null default 'es',
  timezone          text not null default 'Europe/Madrid',
  recruitment_open  boolean not null default false,
  recruitment_start date,
  recruitment_end   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint studies_code_format check (code ~ '^[A-Z0-9_-]{2,32}$')
);

drop trigger if exists studies_set_updated_at on studies;
create trigger studies_set_updated_at before update on studies
  for each row execute function set_updated_at();

-- users (staff profiles, mirrors auth.users) ---------------------------------
create table if not exists users (
  id               uuid primary key references auth.users(id) on delete restrict,
  email            text not null unique,
  display_name     text not null,
  preferred_locale ui_locale not null default 'es',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

-- user_roles (study-scoped, historical) ---------------------------------------
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete restrict,
  study_id   uuid not null references studies(id) on delete restrict,
  role       staff_role not null,
  granted_by uuid references users(id),
  granted_at timestamptz not null default now(),
  revoked_by uuid references users(id),
  revoked_at timestamptz,
  constraint user_roles_revocation_consistent
    check ((revoked_at is null and revoked_by is null) or revoked_at is not null)
);

create unique index if not exists user_roles_active_unique
  on user_roles (user_id, study_id, role) where revoked_at is null;
create index if not exists user_roles_study_idx on user_roles (study_id) where revoked_at is null;
create index if not exists user_roles_user_idx on user_roles (user_id) where revoked_at is null;

-- audit_events (append-only) --------------------------------------------------
create table if not exists audit_events (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid references studies(id) on delete restrict,
  actor_type  audit_actor_type not null,
  actor_id    uuid,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  before_json jsonb,
  after_json  jsonb,
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  constraint audit_events_action_format check (action ~ '^[a-z_]+\.[a-z_]+$')
);

create index if not exists audit_events_entity_idx on audit_events (entity_type, entity_id, created_at desc);
create index if not exists audit_events_study_idx on audit_events (study_id, created_at desc);

drop trigger if exists audit_events_append_only on audit_events;
create trigger audit_events_append_only before update or delete on audit_events
  for each row execute function forbid_row_change();

-- schema_migrations ------------------------------------------------------------
create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

-- Security: deny the Supabase API keys entirely --------------------------------
-- All application data access goes through the server (DATABASE_URL).
-- RLS enabled with no policies + explicit revokes = anon/authenticated get nothing.
alter table studies           enable row level security;
alter table users             enable row level security;
alter table user_roles        enable row level security;
alter table audit_events      enable row level security;
alter table schema_migrations enable row level security;

revoke all on studies, users, user_roles, audit_events, schema_migrations from anon, authenticated;
