-- =============================================================================
-- CLP Hub · Migration 0034 · Country of residence (2026-11-22 request, D-153)
-- Column: participant_contacts.residence_country
--
-- Asked on the public application form so the team can tell applicants living
-- in Spain from those who are not. Category A contact data
-- (docs/research-data-boundaries.md): it sits with the name, email and phone,
-- behind participants.contact.read, and goes with them on erasure.
-- An ISO 3166-1 alpha-2 code ('ES'), never free text. Null = not given yet
-- (applications from before this question; staff fill it in by hand).
-- =============================================================================

alter table participant_contacts
  add column if not exists residence_country text;

alter table participant_contacts drop constraint if exists participant_contacts_residence_country_code;
alter table participant_contacts add constraint participant_contacts_residence_country_code
  check (residence_country is null or residence_country ~ '^[A-Z]{2}$');
