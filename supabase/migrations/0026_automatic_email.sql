-- =============================================================================
-- CLP Hub · Migration 0026 · Automatic email, rule scopes, paired cohorts (D-116)
--
-- D-043 refused AUTOMATIC delivery everywhere. D-116 narrows that refusal
-- instead of removing it: an automation rule may now SEND, but only an email,
-- only from an individually-addressed template, and WhatsApp stays manual.
-- The channel and audience live on the template, which a check constraint
-- cannot reach, so the email-only half of the guard is enforced in
-- `createRule` and again when the action comes due. What the database still
-- guarantees on its own: only a MESSAGE action can be AUTOMATIC.
--
-- Adds:
--   automation_rules.arm_id               -- rule applies only to cohorts running this arm
--   automation_rules.session_template_id  -- rule applies only to sessions of this template
--   scheduled_actions.audience_cohort_id  -- whose members an action is for, when scoped
--   cohorts.paired_cohort_id              -- this cohort follows that cohort's calendar
--   studies.contact_email                 -- team mailbox: inquiry notices, Reply-To
--   alert_kind EMAIL_NOT_CONFIGURED, EMAIL_NOT_SENT
--
-- Additive except for the two dropped AUTOMATIC constraints, which are replaced.
-- =============================================================================

-- --- The send guard, narrowed ------------------------------------------------

alter table automation_rules drop constraint if exists automation_rules_no_automatic_delivery;
alter table automation_rules drop constraint if exists automation_rules_automatic_is_message;
alter table automation_rules add constraint automation_rules_automatic_is_message
  check (delivery_mode <> 'AUTOMATIC' or action_kind = 'MESSAGE');

alter table scheduled_actions drop constraint if exists scheduled_actions_no_automatic_delivery;
alter table scheduled_actions drop constraint if exists scheduled_actions_automatic_is_message;
alter table scheduled_actions add constraint scheduled_actions_automatic_is_message
  check (delivery_mode <> 'AUTOMATIC' or action_kind = 'MESSAGE');

-- --- Rule scopes ---------------------------------------------------------------
-- Configuration, not a condition. A rule scoped to an arm reads the ARM OF THE
-- COHORT it is about (configuration, set by staff), never a participant's
-- allocation row, and the processor still decides nothing about anybody.

alter table automation_rules add column if not exists arm_id uuid references study_arms(id);
alter table automation_rules add column if not exists session_template_id uuid
  references session_templates(id);

alter table scheduled_actions add column if not exists audience_cohort_id uuid
  references cohorts(id);
create index if not exists scheduled_actions_audience_cohort_idx
  on scheduled_actions (audience_cohort_id);

-- --- Paired cohorts ----------------------------------------------------------
-- A control-arm cohort has no sessions of its own; it follows the calendar of
-- the cohort it is paired with. One pair per cohort, never itself.

alter table cohorts add column if not exists paired_cohort_id uuid references cohorts(id);
alter table cohorts drop constraint if exists cohorts_not_paired_with_self;
alter table cohorts add constraint cohorts_not_paired_with_self
  check (paired_cohort_id is null or paired_cohort_id <> id);
create unique index if not exists cohorts_paired_cohort_unique
  on cohorts (paired_cohort_id) where paired_cohort_id is not null;

-- --- Team mailbox --------------------------------------------------------------

alter table studies add column if not exists contact_email text;
alter table studies drop constraint if exists studies_contact_email_shape;
alter table studies add constraint studies_contact_email_shape
  check (contact_email is null or (length(contact_email) <= 200 and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'));

-- --- Alerts --------------------------------------------------------------------
-- ADD VALUE may run inside the migration's transaction; the values are not
-- used in this same transaction.

alter type alert_kind add value if not exists 'EMAIL_NOT_CONFIGURED';
alter type alert_kind add value if not exists 'EMAIL_NOT_SENT';

-- Security: no RLS change needed — every table touched already denies
-- anon/authenticated.
