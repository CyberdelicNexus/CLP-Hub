-- =============================================================================
-- CLP Hub · Migration 0029 · Galician for study content (D-135)
--
-- `content_versions.locale` moves from ui_locale (the staff app's es/en) to a
-- new `content_locale` enum (es, en, gl): the same languages as the public site
-- (D-063). The staff app itself stays es/en; every other table keeps ui_locale.
-- Existing rows keep their language. Versions, the one-published-per-locale
-- index and the version numbering are all per (content, locale) already.
-- =============================================================================

do $$ begin
  create type content_locale as enum ('es','en','gl');
exception when duplicate_object then null; end $$;

alter table content_versions alter column locale drop default;
alter table content_versions
  alter column locale type content_locale using locale::text::content_locale;
alter table content_versions alter column locale set default 'es';

-- Security: no RLS change needed — content_versions already denies anon/authenticated.
