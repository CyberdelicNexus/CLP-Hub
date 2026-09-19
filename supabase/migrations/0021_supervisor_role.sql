-- =============================================================================
-- CLP Hub · Migration 0021 · SUPERVISOR staff role (2026-09-19 request)
-- Adds: 'SUPERVISOR' to the staff_role enum
--
-- Two real team members oversee facilitators and sessions study-wide, a
-- responsibility none of the five existing roles (ADMIN, STUDY_MANAGER,
-- FACILITATOR, RESEARCHER, LOGISTICS) fit — see src/domain/permissions.ts's
-- SUPERVISOR entry for the permission set and its reasoning.
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as anything
-- that USES the new value, which is exactly why this migration only adds
-- the label — the follow-up staff-provisioning script that grants the role
-- runs afterward, in its own connection.
-- =============================================================================

alter type staff_role add value if not exists 'SUPERVISOR';
