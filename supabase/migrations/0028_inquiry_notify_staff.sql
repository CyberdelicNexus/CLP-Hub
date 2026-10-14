-- =============================================================================
-- CLP Hub · Migration 0028 · Choose who is told about a new inquiry (D-119)
--
-- `studies.notify_staff_of_inquiries`: when true (every study until now), a new
-- inquiry notifies everyone who answers inquiries AND the team mailbox
-- (`contact_email`). When false, only the team mailbox. The founder asked for
-- this while testing, so test emails reach one address instead of the team.
-- =============================================================================

alter table studies add column if not exists notify_staff_of_inquiries boolean not null default true;

-- Security: no RLS change needed — studies already denies anon/authenticated.
