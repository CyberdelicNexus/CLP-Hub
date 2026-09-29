-- =============================================================================
-- CLP Hub · Migration 0024 · Cohort archiving (2026-09-28 request)
-- Adds: cohorts.archived_at
--
-- A cohort created by mistake, or a demo/draft one, needs somewhere to go that
-- is not the active workspace stack but also is not gone. `archived_at` is a
-- second, independent axis from `status` (PLANNING..COMPLETED, D-023's
-- strictly-forward lifecycle) rather than a new terminal status: archiving is
-- reversible and says nothing about where the cohort was in its programme, the
-- same reasoning `active` already gives `session_templates` and
-- `program_stages`. Null means visible in the ordinary workspace list, exactly
-- like every cohort that existed before this migration.
--
-- Deletion (`deleteCohort`, services/cohorts.ts) is a separate, harder
-- capability layered on top for the same "created by mistake" case, added in
-- the same change; see D-089.
-- =============================================================================

alter table cohorts add column if not exists archived_at timestamptz;

-- Security: no RLS change needed — cohorts already denies anon/authenticated.
