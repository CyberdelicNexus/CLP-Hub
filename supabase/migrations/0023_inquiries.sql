-- =============================================================================
-- CLP Hub · Migration 0023 · Inquiries (public questions before applying, D-088)
-- Tables: inquiries
--
-- A visitor's question from the public contact form, answered by staff in the
-- Hub. This reverses D-039/D-043's "no inbound path" at the founder's request,
-- and is built to keep as little as possible:
--
--   * `name`, `email` and `message` exist only while the inquiry is NEW. When
--     staff answer or close it they are set to NULL in the same transaction
--     that changes the status, so a health detail typed into the box does not
--     linger. What remains is the status, who acted and when.
--   * The reply text is never stored: it is sent by email and forgotten, like
--     the rendered message in D-039.
--   * Audit rows for an inquiry carry its id and status only, never its text.
--
-- The check constraints make "answered but still holding the text" impossible.
-- Purely additive. No existing table, column, index or row is touched.
-- =============================================================================

create table if not exists inquiries (
  id          uuid primary key default gen_random_uuid(),
  study_id    uuid not null references studies(id) on delete restrict,
  status      text not null default 'NEW',
  locale      text not null default 'es',
  name        text,
  email       text,
  message     text,
  created_at  timestamptz not null default now(),
  handled_by  uuid references users(id),
  handled_at  timestamptz,
  constraint inquiries_status check (status in ('NEW', 'ANSWERED', 'CLOSED')),
  constraint inquiries_locale check (locale in ('es', 'en', 'gl')),
  -- The text lives only while the inquiry is open.
  constraint inquiries_new_has_text check (
    status <> 'NEW' or (name is not null and email is not null and message is not null)
  ),
  constraint inquiries_handled_has_no_text check (
    status = 'NEW' or (name is null and email is null and message is null)
  ),
  constraint inquiries_handled_consistent check (
    (status = 'NEW' and handled_at is null and handled_by is null)
    or (status <> 'NEW' and handled_at is not null)
  ),
  constraint inquiries_message_length check (message is null or length(message) between 1 and 1000),
  constraint inquiries_name_length check (name is null or length(name) between 1 and 120),
  constraint inquiries_email_length check (email is null or length(email) between 3 and 200)
);

create index if not exists inquiries_study_status_idx
  on inquiries (study_id, status, created_at desc);

-- Security: deny the Supabase API keys entirely --------------------------------
alter table inquiries enable row level security;
revoke all on inquiries from anon, authenticated;
