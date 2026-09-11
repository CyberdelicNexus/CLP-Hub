-- =============================================================================
-- CLP Hub · Migration 0013 · Fix the screening_url check constraint
-- Alters: studies (replaces studies_screening_url_https)
--
-- WHAT WENT WRONG
-- ---------------
-- Migration 0007 added:
--
--   check (screening_url is null or screening_url ~ '^https://[^\s]{1,500}$')
--
-- PostgreSQL's regex engine caps a `{m,n}` repetition count at 255. `{1,500}`
-- is therefore not a valid pattern, and the expression fails to compile with
-- "invalid repetition count(s)".
--
-- It slipped through because every existing row had `screening_url` null, so
-- the left-hand side of the OR was true and the regex was never compiled during
-- validation. The first INSERT of an actual URL is what surfaced it.
--
-- WHY A NEW MIGRATION RATHER THAN AN EDIT TO 0007
-- -----------------------------------------------
-- 0007 has already been applied and recorded in schema_migrations. Editing it
-- would leave the file describing something different from what actually ran, on
-- every database where it ran. A follow-up is the honest fix.
--
-- THE REPLACEMENT splits the two things the original conflated: the shape check
-- stays a regex (https, no whitespace), and the length becomes a `length()`
-- comparison, which has no such cap. Same rule, expressible.
--
-- Nothing is destructive: one constraint is replaced by an equivalent one. No
-- row is touched.
-- =============================================================================

alter table studies drop constraint if exists studies_screening_url_https;

do $$ begin
  alter table studies add constraint studies_screening_url_https
    check (
      screening_url is null
      or (screening_url ~ '^https://[^[:space:]]+$' and length(screening_url) <= 500)
    );
exception when duplicate_object then null; end $$;
