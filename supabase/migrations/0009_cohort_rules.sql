-- =============================================================================
-- CLP Hub · Migration 0009 · Cohort arm and size bounds (Phase 4c)
-- Alters: cohorts (arm_id, min_size, max_size; capacity RENAMED to max_size)
--
-- WHAT CHANGES
-- ------------
-- 1. A cohort can name the arm it runs. Null means "takes anyone", which is what
--    every existing cohort does and stays the default — nothing is reclassified.
-- 2. A cohort can carry a configured group size. "Between 6 and 8" is this
--    trial's number, so it is data, never a constant in code (non-negotiable 6).
--
-- ⚠ IMPACT: `capacity` is RENAMED to `max_size`, not dropped.
--
--    A rename preserves every value and is reversible with one statement. It was
--    chosen over adding `max_size` alongside `capacity` because two columns
--    meaning "how many fit" would drift apart, and the brief explicitly asks not
--    to duplicate existing concepts. `capacity` was already informational
--    (D-023), so nothing that read it was enforcing anything.
--
--    Anything outside this repository that selects `capacity` will break. Inside
--    it, every reader is updated in the same commit.
--
-- WHAT DOES NOT CHANGE: assignment is still never refused on size grounds
-- (D-023). The bounds are checked once, when a cohort is marked ACTIVE, and even
-- then a person may override with a recorded reason (D-033). Over-filling
-- remains an operational judgement.
--
-- Nothing here deletes a row or rewrites data.
-- =============================================================================

-- Arm --------------------------------------------------------------------------
alter table cohorts add column if not exists arm_id uuid references study_arms(id);

create index if not exists cohorts_arm_idx on cohorts (study_id, arm_id);

-- Size bounds ------------------------------------------------------------------
-- The rename. `if exists` on the old name plus `if not exists` on the new makes
-- the whole migration idempotent even if it is partially applied.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'cohorts' and column_name = 'capacity'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'cohorts' and column_name = 'max_size'
  ) then
    alter table cohorts rename column capacity to max_size;
  end if;
end $$;

alter table cohorts add column if not exists max_size integer;
alter table cohorts add column if not exists min_size integer;

-- Bounds must be sane relative to each other and positive. This is arithmetic,
-- not a rule about people: a maximum below the minimum is a configuration error
-- that would make every cohort permanently invalid.
do $$ begin
  alter table cohorts add constraint cohorts_size_bounds_sane
    check (
      (min_size is null or min_size >= 1)
      and (max_size is null or max_size >= 1)
      and (min_size is null or max_size is null or min_size <= max_size)
    );
exception when duplicate_object then null; end $$;
