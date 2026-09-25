-- =============================================================================
-- CLP Hub · Migration 0022 · Participant codes built from initials (D-087)
-- Alters: participants (replaces participants_code_format)
--
-- The public /participar route now creates codes like "P-JM1026": the initials
-- of the first name and first surname, then the month and year of the
-- submission, with "-2", "-3", ... when two people share initials in a month.
-- The original constraint only allowed the sequence form "P-000042".
--
-- The new constraint ALLOWS BOTH shapes, so every existing row still passes and
-- the staff-entry, IMPORT and Qualtrics-reference routes keep producing
-- sequence codes. Uniqueness is unchanged (participants_code_unique on
-- study_id, code). No row is touched, and nothing is destructive: to go back,
-- restore the old check once no initials-shaped code exists.
-- =============================================================================

alter table participants drop constraint if exists participants_code_format;

alter table participants add constraint participants_code_format
  check (code ~ '^P-([0-9]{6,}|[A-Z]{2}[0-9]{4}(-[0-9]+)?)$');
