-- =============================================================================
-- CLP Hub · Migration 0032 · A session can be the initial visit
-- (2026-10-30 request, D-140)
-- Constraint: session_templates_visit_checks_known gains 'INITIAL_VISIT'
--
-- `initial_visits` and an individual session's `participant_visits` describe the
-- same appointment. A session marked INITIAL_VISIT keeps the first in step with
-- the second, so which session that is stays configuration.
-- =============================================================================

alter table session_templates drop constraint if exists session_templates_visit_checks_known;

alter table session_templates add constraint session_templates_visit_checks_known
  check (visit_checks <@ array['PHYSICAL_CONSENT', 'QUESTIONNAIRE', 'INITIAL_VISIT']::text[]);
