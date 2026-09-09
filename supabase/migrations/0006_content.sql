-- =============================================================================
-- CLP Hub · Migration 0006 · Study content (Phase 5)
-- Tables: contents, content_versions, content_assignments
--
-- Study content is NOT UI strings. UI strings live in messages/*.json and are
-- versioned by git; study content lives here, is versioned explicitly per
-- locale, and a published version is NEVER overwritten (docs/content-model.md).
--
-- Bodies are typed blocks (jsonb), not HTML. Nothing an author writes becomes
-- markup: the renderer turns blocks and a small Markdown subset into React
-- elements, so there is no HTML string to sanitise on a public page.
--
-- Public pages contain no participant data whatsoever. They are identical for
-- every reader (docs/research-data-boundaries.md, open item 5).
-- =============================================================================

do $$ begin
  create type content_type as enum (
    'SESSION_PREPARATION','SESSION_INTEGRATION','VR_GUIDE',
    'TROUBLESHOOTING','FAQ','EMAIL_TEMPLATE','WHATSAPP_TEMPLATE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('DRAFT','REVIEW','PUBLISHED','ARCHIVED');
exception when duplicate_object then null; end $$;

-- contents ---------------------------------------------------------------------
-- The identity of a piece of content. `key` doubles as the public URL slug for
-- standalone pages. `session_template_id` links session material to the
-- programme by foreign key rather than by matching strings, so renaming a
-- session cannot silently orphan its preparation page.
create table if not exists contents (
  id                  uuid primary key default gen_random_uuid(),
  study_id            uuid not null references studies(id) on delete restrict,
  type                content_type not null,
  key                 text not null,
  session_template_id uuid references session_templates(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint contents_key_format check (key ~ '^[a-z][a-z0-9-]{1,60}$'),
  constraint contents_key_unique unique (study_id, key),
  -- Session material must name its session; standalone material must not.
  constraint contents_session_link_consistent check (
    (type in ('SESSION_PREPARATION','SESSION_INTEGRATION') and session_template_id is not null)
    or (type not in ('SESSION_PREPARATION','SESSION_INTEGRATION') and session_template_id is null)
  )
);

-- One preparation and one integration page per session.
create unique index if not exists contents_session_type_unique
  on contents (session_template_id, type) where session_template_id is not null;
create index if not exists contents_study_idx on contents (study_id, type);

drop trigger if exists contents_set_updated_at on contents;
create trigger contents_set_updated_at before update on contents
  for each row execute function set_updated_at();

-- content_versions --------------------------------------------------------------
-- Explicit versions per locale. Publishing inserts a new row and archives the
-- previous published one; it never mutates a published row.
create table if not exists content_versions (
  id             uuid primary key default gen_random_uuid(),
  content_id     uuid not null references contents(id) on delete cascade,
  locale         ui_locale not null default 'es',
  version_number integer not null,
  title          text not null,
  -- Array of typed blocks. Validated by Zod on save and again on render.
  body           jsonb not null default '[]'::jsonb,
  status         content_status not null default 'DRAFT',
  created_by     uuid references users(id),
  approved_by    uuid references users(id),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint content_versions_number_positive check (version_number > 0),
  constraint content_versions_number_unique unique (content_id, locale, version_number),
  constraint content_versions_title_length check (length(btrim(title)) between 1 and 200),
  constraint content_versions_body_is_array check (jsonb_typeof(body) = 'array'),
  -- A published version must say when, and an archived one must have been published.
  constraint content_versions_published_at_present
    check (status <> 'PUBLISHED' or published_at is not null)
);

-- At most one live version per content per locale. This is what makes
-- "the published Spanish page" a single unambiguous row.
create unique index if not exists content_versions_one_published
  on content_versions (content_id, locale) where status = 'PUBLISHED';
create index if not exists content_versions_content_idx
  on content_versions (content_id, locale, version_number desc);

drop trigger if exists content_versions_set_updated_at on content_versions;
create trigger content_versions_set_updated_at before update on content_versions
  for each row execute function set_updated_at();

-- content_assignments -----------------------------------------------------------
-- Which published version a cohort session was pinned to, so "which version did
-- Cohort 04 receive?" is answerable. Pinned when the session is SCHEDULED
-- (D-027), and re-pinned only by an explicit staff action, which inserts a new
-- row rather than editing the old one.
create table if not exists content_assignments (
  id                 uuid primary key default gen_random_uuid(),
  study_id           uuid not null references studies(id) on delete restrict,
  cohort_session_id  uuid not null references cohort_sessions(id) on delete cascade,
  content_version_id uuid not null references content_versions(id) on delete restrict,
  pinned_at          timestamptz not null default now(),
  pinned_by          uuid references users(id),
  superseded_at      timestamptz,
  created_at         timestamptz not null default now()
);

-- One live pin per session per content. The partial index keeps superseded
-- history alongside it.
create unique index if not exists content_assignments_live_unique
  on content_assignments (cohort_session_id, content_version_id)
  where superseded_at is null;
create index if not exists content_assignments_session_idx
  on content_assignments (cohort_session_id) where superseded_at is null;

-- Security: deny the Supabase API keys entirely --------------------------------
alter table contents            enable row level security;
alter table content_versions    enable row level security;
alter table content_assignments enable row level security;

revoke all on contents, content_versions, content_assignments from anon, authenticated;
