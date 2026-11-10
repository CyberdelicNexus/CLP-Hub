-- =============================================================================
-- CLP Hub · Migration 0031 · Consent as a check; a checklist on individual visits
-- (2026-10-30 request, D-139)
-- Columns: session_templates.visit_checks,
--          participant_visits.questionnaire_captured_at / _by
-- Enum value: consent_status 'VOIDED'
--
-- Everyone accepts the digital consent in Qualtrics before applying, so the
-- team no longer records it by hand. The physical consent is one tick, on the
-- participant and on the visit where it is signed. Unticking a mistake must not
-- read as the person withdrawing, so a tick made in error is VOIDED: a distinct
-- status, kept in the history, never in force.
--
-- `visit_checks` says what a visit collects (configuration, Configuración), so
-- nothing in code knows which session is S0 or POST.
--
-- `questionnaire_captured_at` records THAT the questionnaire was filled in, not
-- a single answer (docs/research-data-boundaries.md).
-- =============================================================================

alter type consent_status add value if not exists 'VOIDED';

alter table session_templates
  add column if not exists visit_checks text[] not null default '{}';

do $$ begin
  alter table session_templates add constraint session_templates_visit_checks_known
    check (visit_checks <@ array['PHYSICAL_CONSENT', 'QUESTIONNAIRE']::text[]);
exception when duplicate_object then null; end $$;

alter table participant_visits
  add column if not exists questionnaire_captured_at timestamptz,
  add column if not exists questionnaire_captured_by uuid references users(id);
