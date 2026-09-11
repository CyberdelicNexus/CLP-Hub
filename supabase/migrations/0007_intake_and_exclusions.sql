-- =============================================================================
-- CLP Hub · Migration 0007 · Intake boundary and eligibility reasons (Phase 4a)
-- Tables: eligibility_reasons, qualtrics_field_mappings
-- Alters:  studies (screening_url, qualtrics_mode)
--          participants (external_ref)
--          screenings (reason_id, reason_note)
--          application_source (+ 'QUALTRICS')
--
-- WHAT THIS MIGRATION IS FOR
-- --------------------------
-- Initial screening happens in Qualtrics, and the person accepts the digital
-- consent there BEFORE any datum about them — their name included — is
-- collected. The identifiable half of that screening stays in Qualtrics.
--
-- So this migration does two things at once:
--   1. Gives CLP Hub an opaque handle back to the Qualtrics response
--      (participants.external_ref) so a participant can be operated on here
--      without their identity being copied here.
--   2. Makes the refusal to copy identifiable or research data a CHECK
--      CONSTRAINT rather than a convention — see qualtrics_field_mappings.
--
-- NO DATA TRANSFER IS IMPLEMENTED. There is no HTTP client, credential,
-- webhook or scheduled pull in this repository. qualtrics_field_mappings is
-- configuration for a future read-only integration, and the study runs in
-- DISABLED or TEST_ANONYMIZED mode only — there is no live mode to switch to.
--
-- NOTHING HERE IS DESTRUCTIVE. Every change is additive: new nullable columns,
-- new tables, one new enum value. No row is rewritten, nothing is dropped, and
-- the retired PUBLIC_FORM source value is deliberately kept so historical
-- applications stay readable (D-031).
--
-- The "a determination must carry a reason" constraint is added NOT VALID, so
-- determinations recorded before the column existed are left alone rather than
-- backfilled with an invented reason. See the constraint itself for the full
-- argument.
-- =============================================================================

-- New enums --------------------------------------------------------------------

-- CONSORT-aligned groupings for reporting exclusions. A reporting standard, not
-- a clinical rule, which is why it is a fixed vocabulary. The trial's own reason
-- wording is a row in eligibility_reasons.
do $$ begin
  create type eligibility_reason_category as enum (
    'DID_NOT_MEET_CRITERIA',
    'DECLINED',
    'UNREACHABLE',
    'LOGISTICS',
    'WITHDREW_BEFORE_ALLOCATION',
    'DUPLICATE',
    'STUDY_CAPACITY',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

-- What a Qualtrics field contains, mapped onto the three categories in
-- docs/research-data-boundaries.md.
do $$ begin
  create type qualtrics_field_class as enum (
    'ANONYMOUS_ID','OPERATIONAL','IDENTIFIABLE','RESEARCH'
  );
exception when duplicate_object then null; end $$;

-- The closed list of places a mapped field could land. An integration able to
-- write an arbitrary column would be an integration able to write a name.
do $$ begin
  create type intake_target as enum (
    'participant.externalRef',
    'participant.recruitmentStatus',
    'consent.digitalStatus',
    'consent.digitalDecidedAt',
    'screening.externalRecordId',
    'screening.completedAt'
  );
exception when duplicate_object then null; end $$;

-- No 'LIVE'. Off, or exercised against anonymized/synthetic data. Adding a live
-- mode is a schema change plus a recorded decision, never a configuration flip.
do $$ begin
  create type integration_mode as enum ('DISABLED','TEST_ANONYMIZED');
exception when duplicate_object then null; end $$;

-- 'QUALTRICS' joins application_source. PUBLIC_FORM is retired but NOT removed:
-- Postgres cannot drop an enum value safely, and rewriting historical rows to
-- hide where they came from would be falsifying the record.
alter type application_source add value if not exists 'QUALTRICS';

-- studies ----------------------------------------------------------------------
-- Where the public page sends people, and whether any integration is armed.
alter table studies add column if not exists screening_url text;
alter table studies add column if not exists qualtrics_mode integration_mode
  not null default 'DISABLED';

do $$ begin
  alter table studies add constraint studies_screening_url_https
    check (screening_url is null or screening_url ~ '^https://[^\s]{1,500}$');
exception when duplicate_object then null; end $$;

-- participants -----------------------------------------------------------------
-- The opaque tie to the Qualtrics response. Pattern-checked so it cannot quietly
-- become a place to write "María, la del jueves" — which would put an
-- identifiable datum in the very column meant to keep identity out.
alter table participants add column if not exists external_ref text;

do $$ begin
  alter table participants add constraint participants_external_ref_shape
    check (external_ref is null or external_ref ~ '^[\w.:-]{1,120}$');
exception when duplicate_object then null; end $$;

-- One participant per external reference, per study. This replaces the email as
-- the identity key for the Qualtrics route (D-031); the email-based unique index
-- from D-013 is untouched and still governs any staff-entered contact.
create unique index if not exists participants_external_ref_unique
  on participants (study_id, external_ref)
  where external_ref is not null;

-- eligibility_reasons ----------------------------------------------------------
-- Configuration. The wording is a row; the CONSORT category it reports under is
-- the enum above. A reason states THAT a criterion was not met and never which:
-- no Category C fact belongs in this table.
create table if not exists eligibility_reasons (
  id         uuid primary key default gen_random_uuid(),
  study_id   uuid not null references studies(id) on delete restrict,
  code       text not null,
  category   eligibility_reason_category not null,
  label_es   text not null,
  label_en   text,
  applies_to eligibility_status[] not null,
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eligibility_reasons_code_unique unique (study_id, code),
  constraint eligibility_reasons_code_shape
    check (code ~ '^[A-Z0-9][A-Z0-9_]{1,47}$'),
  constraint eligibility_reasons_label_length
    check (length(label_es) between 1 and 120
           and (label_en is null or length(label_en) <= 120)),
  -- A reason attached to an inclusion would be a clinical justification, and a
  -- reason for "not looked at yet" is a contradiction. Both are refused here
  -- rather than trusted to application code.
  constraint eligibility_reasons_applies_to_sane
    check (array_length(applies_to, 1) >= 1
           and not ('ELIGIBLE' = any (applies_to))
           and not ('PENDING'  = any (applies_to)))
);

create index if not exists eligibility_reasons_study_idx
  on eligibility_reasons (study_id, position);

drop trigger if exists eligibility_reasons_set_updated_at on eligibility_reasons;
create trigger eligibility_reasons_set_updated_at before update on eligibility_reasons
  for each row execute function set_updated_at();

-- screenings -------------------------------------------------------------------
-- A determination now carries why.
alter table screenings add column if not exists reason_id uuid references eligibility_reasons(id);
alter table screenings add column if not exists reason_note text;

create index if not exists screenings_reason_idx on screenings (reason_id);

-- The obligation, in the database. An exclusion with no recorded reason cannot
-- be reported in a flow diagram, and "requires review" with no statement of what
-- needs reviewing is a dead end rather than a handover.
--
-- ⚠ DECLARED **NOT VALID**, deliberately.
--
-- Determinations recorded before this column existed have no reason, and they
-- are not wrong — nobody was asked for one. The two ways to make them satisfy a
-- validated constraint would both be worse than leaving them:
--
--   * Backfilling an "OTHER / not recorded" reason invents a justification for a
--     decision a researcher made. That is falsifying a record.
--   * Deleting or blanking the result destroys the determination itself.
--
-- NOT VALID means: enforced on every INSERT and on every UPDATE from now on,
-- never checked against the rows that predate it. So the rule bites immediately
-- for new work, historical rows stay honest, and touching one of them forces the
-- record to be completed.
--
-- They are not hidden either: `countExclusionsWithoutReason` in
-- src/services/study-flow.ts counts them and the evaluation page shows the
-- figure, so the gap is visible and fixable rather than silent.
--
-- Once staff have completed them, `alter table screenings validate constraint
-- screenings_reason_required;` promotes it to fully validated. That is a
-- one-line follow-up migration, not something to force now.
do $$ begin
  alter table screenings add constraint screenings_reason_required
    check (result is null
           or result not in ('INELIGIBLE','REVIEW_REQUIRED')
           or reason_id is not null)
    not valid;
exception when duplicate_object then null; end $$;

-- ELIGIBLE accepts no reason at all, for the same argument as above.
do $$ begin
  alter table screenings add constraint screenings_reason_not_for_eligible
    check (reason_id is null or result is distinct from 'ELIGIBLE');
exception when duplicate_object then null; end $$;

-- A note only exists beside a reason, is one line, and is short (D-030).
do $$ begin
  alter table screenings add constraint screenings_reason_note_bounded
    check (reason_note is null
           or (reason_id is not null
               and length(reason_note) <= 280
               and reason_note !~ '[\r\n]'));
exception when duplicate_object then null; end $$;

-- qualtrics_field_mappings -----------------------------------------------------
-- Configuration for an integration that DOES NOT EXIST YET, written now so the
-- refusal is a constraint rather than a promise. Every mapping is off by default
-- and must be turned on field by field by a person.
create table if not exists qualtrics_field_mappings (
  id           uuid primary key default gen_random_uuid(),
  study_id     uuid not null references studies(id) on delete restrict,
  source_field text not null,
  source_class qualtrics_field_class not null,
  target       intake_target not null,
  enabled      boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint qualtrics_field_mappings_target_unique unique (study_id, target),
  constraint qualtrics_field_mappings_source_shape
    check (source_field ~ '^[\w.:-]{1,80}$'),
  -- THE CONSTRAINT THIS TABLE EXISTS FOR. A mapping for a name, an email, a
  -- phone number or a screening answer cannot be stored. Not "is ignored" —
  -- cannot be stored. Lifting this requires a migration and a recorded decision.
  constraint qualtrics_field_mappings_no_identifiable
    check (source_class in ('ANONYMOUS_ID','OPERATIONAL')),
  -- The destination must expect exactly the class the source carries, so the
  -- guarantee holds from both ends.
  constraint qualtrics_field_mappings_class_matches_target
    check (
      (target = 'participant.externalRef'       and source_class = 'ANONYMOUS_ID')
      or (target <> 'participant.externalRef'   and source_class = 'OPERATIONAL')
    ),
  constraint qualtrics_field_mappings_notes_length
    check (notes is null or length(notes) <= 280)
);

create index if not exists qualtrics_field_mappings_study_idx
  on qualtrics_field_mappings (study_id);

drop trigger if exists qualtrics_field_mappings_set_updated_at on qualtrics_field_mappings;
create trigger qualtrics_field_mappings_set_updated_at before update on qualtrics_field_mappings
  for each row execute function set_updated_at();

-- Security: deny the Supabase API keys entirely --------------------------------
alter table eligibility_reasons      enable row level security;
alter table qualtrics_field_mappings enable row level security;

revoke all on eligibility_reasons, qualtrics_field_mappings from anon, authenticated;
