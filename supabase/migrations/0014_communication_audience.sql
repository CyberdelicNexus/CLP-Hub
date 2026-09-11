-- =============================================================================
-- CLP Hub · Migration 0014 · Session-linked templates and cohort channels (Phase 7b)
-- Alters: communication_templates (session_template_id, audience)
--         communications (participant_id now nullable, cohort_id, audience)
--
-- WHY
-- ---
-- Templates were organised by stage alone. The team also needs them divided by
-- SESSION, and the messages are pasted into a cohort's group channel as often as
-- they are sent to one person.
--
-- Two consequences, both in this migration:
--
--   1. `session_template_id` is a real foreign key, not a text label. Renaming a
--      session must not orphan the messages about it — the reason D-029 gives
--      for doing the same thing to content. Null means "not about a session".
--
--   2. A message pasted into a cohort channel is recorded as ONE row against the
--      cohort, not one row per member (D-041). Expanding it would make the log
--      assert that each person was written to individually, and their own page
--      would then show a personal message they never received.
--
-- ⚠ IMPACT: `communications.participant_id` becomes NULLABLE.
--
--    Before: every row named a participant.
--    After:  a row names a participant OR a cohort, never both and never
--            neither — enforced by a new check constraint, so the guarantee
--            "every send has a subject" is preserved in a wider form rather
--            than weakened.
--
--    Existing rows are untouched: they already have a participant, and the
--    backfill sets their audience to PARTICIPANT, which is what they were.
--
--    Reversing it means deleting any cohort-channel rows first, then restoring
--    NOT NULL. Nothing is lost by this migration itself.
--
-- Everything else is additive. No row is deleted.
-- =============================================================================

do $$ begin
  create type communication_audience as enum ('PARTICIPANT','COHORT_CHANNEL');
exception when duplicate_object then null; end $$;

-- communication_templates ------------------------------------------------------
alter table communication_templates
  add column if not exists session_template_id uuid references session_templates(id);

alter table communication_templates
  add column if not exists audience communication_audience not null default 'PARTICIPANT';

create index if not exists communication_templates_session_idx
  on communication_templates (session_template_id);

-- communications ---------------------------------------------------------------
alter table communications add column if not exists cohort_id uuid references cohorts(id);
alter table communications
  add column if not exists audience communication_audience not null default 'PARTICIPANT';

alter table communications alter column participant_id drop not null;

-- The guarantee, widened rather than dropped: every send still has exactly one
-- subject, it just may now be a group instead of a person.
do $$ begin
  alter table communications add constraint communications_one_subject
    check (
      (participant_id is not null and cohort_id is null)
      or (participant_id is null and cohort_id is not null)
    );
exception when duplicate_object then null; end $$;

-- And the subject must match what the row says it is addressed to, so a
-- cohort-channel row cannot quietly point at one person.
do $$ begin
  alter table communications add constraint communications_audience_matches_subject
    check (
      (audience = 'PARTICIPANT' and participant_id is not null)
      or (audience = 'COHORT_CHANNEL' and cohort_id is not null)
    );
exception when duplicate_object then null; end $$;

create index if not exists communications_cohort_idx on communications (cohort_id, sent_at desc);
