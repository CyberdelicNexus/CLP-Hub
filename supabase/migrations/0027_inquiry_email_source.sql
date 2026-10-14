-- =============================================================================
-- CLP Hub · Migration 0027 · Emails to info@ land in the inquiry inbox (D-118)
--
-- An email sent to the study's address (info@numadelic.org) is received by
-- Resend, posted to the Hub's webhook, and filed as an inquiry, exactly like a
-- question from the contact form: its text lives only while it is NEW, and
-- answering or closing it erases name, email and message (the 0023 checks are
-- unchanged and still apply).
--
-- Adds:
--   inquiries.source        FORM (contact form, every row so far) or EMAIL
--   inquiries.external_ref  the provider's id for a received email, unique, so a
--                           webhook delivered twice files the email once.
--                           An opaque id, not personal data; kept after handling.
-- Changes:
--   inquiries_message_length  up to 5000 characters for an EMAIL (an email is
--                             longer than a form box), 1000 for the form as before.
-- =============================================================================

alter table inquiries add column if not exists source text not null default 'FORM';
alter table inquiries add column if not exists external_ref text;

alter table inquiries drop constraint if exists inquiries_source;
alter table inquiries add constraint inquiries_source check (source in ('FORM', 'EMAIL'));

alter table inquiries drop constraint if exists inquiries_external_ref_length;
alter table inquiries add constraint inquiries_external_ref_length
  check (external_ref is null or length(external_ref) between 1 and 100);

create unique index if not exists inquiries_external_ref_unique
  on inquiries (external_ref) where external_ref is not null;

alter table inquiries drop constraint if exists inquiries_message_length;
alter table inquiries add constraint inquiries_message_length check (
  message is null
  or length(message) between 1 and (case when source = 'EMAIL' then 5000 else 1000 end)
);

-- Security: no RLS change needed — inquiries already denies anon/authenticated.
