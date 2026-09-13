# Decision log

Append-only. Newest at the bottom. Record assumptions here rather than silently deciding.

**Current phase: 4 (Operational refinement) — started 2026-09-11 on founder approval. Phases 0–3 and 5 shipped.**

Phase 4 was skipped when content was brought forward; it is now the number for the
refinement pass agreed at the 2026-09-11 meeting. Phases 6 (VR logistics) and 7
(communications) were also approved in the same meeting and keep their numbers.

---

## D-001 · 2026-09-03 · Monolith on Next.js 16 + Supabase Postgres

One app, one database, Drizzle with hand-written SQL migrations. Matches the founder's other project's conventions (Next 16, React 19, Tailwind 4, shadcn). Drizzle Kit is used for checks only; migrations stay reviewable SQL that can also be pasted into the Supabase dashboard.

## D-002 · 2026-09-03 · No external error monitoring

Founder decision: no Sentry. Structured pino logs with PII redaction. Operational failures will surface as in-app alerts (Phase 8).

## D-003 · 2026-09-03 · Participants never authenticate

Founder decision: the "study hub" is not a learning platform. Study material is published as public, blog-style Spanish pages. Consequences: no magic links, no per-participant progress table, no personalised hub. Public pages must contain no participant data. VR readiness is captured by staff or via a simple public form, not inferred.

## D-004 · 2026-09-03 · WhatsApp is manual

No WhatsApp API. Each cohort gets a "Mensajes" page with every message rendered in Spanish with real dates and links plus a copy button. Facilitators paste manually and mark as sent, which creates the immutable communication record. Email may remain automatable for logistics via Resend (Phase 7).

## D-005 · 2026-09-03 · Vercel Cron instead of Trigger.dev

With WhatsApp manual and email volume low, a cron-invoked processor over `scheduled_actions` is sufficient. The processor boundary keeps the option to swap in Trigger.dev later.

## D-006 · 2026-09-03 · Authorization in code, RLS as deny-all

Permissions live in `src/domain/permissions.ts` and are enforced server-side. All tables have RLS enabled with no policies and explicit revokes for `anon`/`authenticated`, so the Supabase API keys cannot read anything. This avoids duplicating the permission matrix in SQL. Hardening item: dedicated least-privilege DB role before real data.

## D-007 · 2026-09-03 · Locale via cookie, no URL prefix

Staff UI locale comes from an httpOnly `clp_locale` cookie synced with `users.preferred_locale` (audited). Public pages default to Spanish. No `/es/` `/en/` routing.

## D-008 · 2026-09-03 · Roles as enum, no `roles` table

The five roles are a fixed vocabulary with permissions in code; a `roles` table would add nothing. `user_roles` is historical (revoke, never delete).

## D-009 · 2026-09-03 · All communication touchpoints Spanish

Every template must have a Spanish version; English is optional and only for staff preview. Enforced in Phase 7 schema constraints.

## D-010 · 2026-09-03 · Naming

Repository "CLP Hub" (`clp-hub`). The trial's name is not referenced in code; the seed study is `DEMO`. Team dashboard lives under `/equipo`.

## D-011 · 2026-09-03 · Design system: "soft modern", light and dark

Founder direction, from reference dashboards. A bento-grid surface system: rounded
cards, pastel accent surfaces, soft diffuse elevation, Plus Jakarta Sans display
over Geist body. Full token layer in `src/app/globals.css` with complete `:root`
and `.dark` palettes; see `docs/design-system.md`.

Considered and rejected: an industrial-brutalist direction (zero radius, hazard
red, monospace, scanlines). It conflicts with the reference material and reads as
a strong personality for a tool clinical staff use daily. Its defensible parts were
kept — deterministic grid, tabular numerals for metrics, semantic markup.

Consequences: pastel tokens are backgrounds only and always paired with an `-ink`
foreground, so no accent ever carries meaning by itself; contrast stays ≥ 4.5:1 in
both modes. Also fixed a latent bug where `--font-sans` resolved to nothing and the
UI fell back to the browser default font.

## D-012 · 2026-09-03 · Theme preference is device-local and not audited

`next-themes` stores light/dark/system in `localStorage`. Deliberately unlike the
locale (D-007), which lives on the staff profile and is audited: the theme is a
rendering preference, not user state or a research-relevant setting, so it gets no
database column, no cookie and no audit row. Revisit only if staff ask for the
choice to follow them across devices.

## D-013 · 2026-09-04 · Repeat applications link to the existing participant

Founder decision. Within one study, a submission whose email matches an existing
participant (trimmed + lowercased) attaches a new application to that participant
instead of creating a second person. Enforced by a unique index on
`participant_contacts (study_id, email_normalized)`, so the rule holds under
concurrent submissions rather than only in application code.

Normalisation is trim + lowercase only. Provider-specific tricks (stripping dots,
removing `+` tags) are deliberately not applied: they would merge two people who
are genuinely distinct.

This is an identity-resolution claim — "same email means same person" — recorded
here because it is an assumption, not a fact. Repeat submissions inside a
two-minute window return the existing application rather than creating another, so
a double-click does not produce duplicates.

## D-014 · 2026-09-04 · Application questions are operational only, by convention

Founder decision (convention, not a database constraint). `application_questions`
may ask only operational things: contact details, availability, location, referral
source, and consent to be contacted. Health, symptom, diagnosis, medication and
psychometric questions are Category C research data and must not be configured
here (`docs/research-data-boundaries.md`).

The boundary is documented in `src/domain/recruitment.ts`, in migration 0002, in
the seed, and on the form itself, which tells applicants not to include health
information and caps free text at 1000 characters.

Accepted risk: nothing in the database prevents a future admin UI from adding a
health question. A check constraint or an allow-list of question keys was
considered and deferred. Revisit before question configuration is exposed to
staff in the UI.

## D-015 · 2026-09-04 · Public form anti-abuse is deliberately minimal

The public form has a honeypot field and a fill-time floor only. The honeypot
reports success so a bot learns nothing; the fill-time floor reports a real error
asking the person to retry, because it is timed from server render and could
otherwise silently discard a fast human's application.

This is **not** sufficient protection for public exposure. A captcha or WAF plus
IP-based rate limiting is a prerequisite before the form accepts real traffic,
alongside the hosting approval already tracked below. IP addresses are
deliberately not stored today, since that would add a data category with no
approved purpose.

## D-016 · 2026-09-04 · Participant codes come from a database sequence

`participants.code` (e.g. `P-000042`) is generated from `participant_code_seq`
rather than counted per study, so concurrent submissions cannot collide. The code
is the pseudonymous handle that operational history and audit rows are keyed by,
which is what makes the proposed erasure approach — clear contact data, keep
history — possible. Audit snapshots reference the code, not the person's name or
email.

## D-017 · 2026-09-05 · Randomization moves to Phase 3, with study arms

Founder decision, amending the phase plan in `docs/domain-model.md`. `randomizations`
cannot record a meaningful allocation without an arm to point at, and `study_arms`
was scheduled for Phase 3. Rather than store an unvalidated arm code and migrate
it later, both tables land together in Phase 3.

Consequences: `enrollment_status` keeps its full vocabulary, but RANDOMIZED and
COHORT_ASSIGNED are deliberately unreachable in Phase 2 — no code path can set
them, and `PHASE_3_ENROLLMENT_STATUSES` in `src/domain/participant-state.ts`
names them so the gap is explicit rather than accidental.

Also noted: `docs/permissions.md` defines `randomization.read` but no
`randomization.manage`, so as written nobody could record an allocation. The key
was **not** added now, since an unused permission is worse than a missing one.
Adding it is a prerequisite for Phase 3.

## D-018 · 2026-09-05 · Allocations are recorded manually, never generated

Founder decision, settled ahead of Phase 3. When randomization arrives, a
`RandomizationProvider` interface will exist so an approved mechanism can be
plugged in, but the only implementation will be manual entry: staff record an
arm and an external reference produced by the approved system.

A demo fixture provider was considered and rejected. No code capable of producing
an allocation belongs in this repository, not even guarded by `ALLOW_DEMO_DATA` —
the guarantee is easier to audit if it is absolute.

## D-019 · 2026-09-05 · Screening stores an appointment and a result, nothing else

The `screenings` table has no free-text column at all, deliberately. Screening
answers, instrument scores and clinical notes are Category C and live in the
institution's approved system; `external_record_id` is an opaque pointer to it,
capped at 120 characters and validated against `^[\w.:/-]*$` so it cannot quietly
become a notes field. A staff member who types prose there is told why it was
refused.

Database constraints back this up rather than trusting application code: a result
requires status COMPLETED, a completed screening requires a timestamp, and
'PENDING' is rejected as a result because "not determined" is expressed by the
absence of one.

New vocabulary: screening status SCHEDULED / COMPLETED / NO_SHOW / CANCELLED.
This is **not** from the founder's brief — it is an assumption, and researchers
should confirm it covers the real workflow (see open questions).

## D-020 · 2026-09-05 · Consent is a status record, and is historical

`consents` records which form version was used, when the decision was made, who
recorded it and an external reference. No document, no signature, no upload.

Rows are never rewritten into a different decision: re-consenting to a newer
version creates a new row and marks the previous one SUPERSEDED, and a partial
unique index permits only one PENDING/CONSENTED row per participant at a time.
SUPERSEDED is not reachable by any staff action — only the service sets it.

Consenting enrols the participant in the same transaction. Declining or
withdrawing consent does **not** automatically un-enrol anyone: that is a
separate, deliberate decision, recorded on its own.

## D-021 · 2026-09-08 · Recording an allocation is never refused

Founder decision. The application does **not** check consent or eligibility
before recording a randomization: staff record what the approved mechanism
actually produced, which is the most faithful reading of "results are determined
elsewhere".

Because nothing is refused, the audit row carries the participant's state at the
moment of recording — the latest consent status of any kind,
`hadActiveConsentAtRecording`, and the eligibility status. This makes an anomaly
visible afterwards instead of silently lost. It does not block anything.

This behaved exactly as intended on first use: an allocation was recorded for a
synthetic participant whose consent had been withdrawn, and the audit row shows
it. Whether such a case should raise an alert is a Phase 8 question.

A duplicate allocation for the same participant **is** refused, by a unique
constraint. That is data integrity, not a clinical rule. How a genuine correction
should be recorded is an open question.

## D-022 · 2026-09-08 · Cohort scoping is a permission, not a role check

Facilitators see only the cohorts they staff. Rather than checking for the
FACILITATOR role — which non-negotiable 8 forbids in feature code — this is
expressed as a new permission, `cohorts.read.all`. A caller holding it sees every
cohort in the study; a caller without it is narrowed to their `cohort_staff` rows.

The narrowing is applied in service queries via `ctx.cohortScope`, resolved once
per request. `authorize.ts` and the shape of the permission model are unchanged.
An out-of-scope cohort returns 404 rather than a permission error, because for
that caller it genuinely does not exist.

Consequence worth noting: assigning someone to `cohort_staff` also widens what
they can see. That write is therefore gated on `cohorts.manage` and its audit row
is flagged `grantsCohortVisibility`.

`randomization.manage` was also added, closing the gap recorded in D-017.

## D-023 · 2026-09-08 · Cohort lifecycle runs forward only

PLANNING → RECRUITING → PREPARATION → ACTIVE → INTEGRATION → FOLLOW_UP →
COMPLETED, with no way back. The brief supplies the vocabulary but not the
permitted moves, so this is an **assumption**: sessions and attendance will hang
off the stage, and silently reversing it would rewrite history they depend on.
Recorded as an open question.

Cohorts accept new participants only while PLANNING, RECRUITING or PREPARATION.
Capacity is informational and does not block assignment — over-filling a cohort
is an operational judgement, not something the app should refuse.

## D-024 · 2026-09-08 · TECHNICAL_FAILURE is never an absence

The brief states TECHNICAL_FAILURE ≠ ABSENT. This is implemented as a property of
the domain rather than a convention:

- `countsAsAbsent` returns true for ABSENT and nothing else. TECHNICAL_FAILURE is
  neither present nor absent — it is excluded from adherence figures entirely,
  alongside EXPECTED, EXCUSED and WITHDRAWN.
- `tallyAttendance` returns separate counts and deliberately does **not** return a
  single attendance percentage. A "70% attendance" figure that quietly swallowed
  three headset failures would be a false statement about those participants.
- The session page shows the counts side by side with a note explaining why.
  TECHNICAL_FAILURE is styled as a warning, not as an error and not as the same
  neutral as an excused absence: it is an equipment problem to fix, and it must
  never look like ABSENT.
- `tests/sessions.test.ts` asserts every status falls in exactly one bucket, that
  adding failures never changes the absence count, and that ABSENT is the only
  status attributable as a real absence.

Recording TECHNICAL_FAILURE is offered as directly as any other status, because
if it were harder to reach staff would reach for ABSENT when a headset failed.

## D-025 · 2026-09-08 · Registers open when a session is scheduled

Scheduling a session immediately creates an EXPECTED attendance row for every
current cohort member, so the register is complete before the session happens
rather than being reconstructed afterwards from whoever someone remembered to
write down. "Not recorded" is therefore visible and countable.

Refreshing a register adds members who joined the cohort later; it never removes
anyone, because a record of who was expected is history. Attendance stays
editable after a session is HELD — corrections are ordinary, and every change
writes an audit row carrying the previous value.

Session status vocabulary (SCHEDULED / HELD / CANCELLED) is an **assumption**:
the brief supplies modality and attendance vocabularies but not one for the
session itself. Recorded as an open question.

## D-026 · 2026-09-08 · Session templates are configuration, arm-agnostic by default

`session_templates` holds the programme: names, order, modality, duration and a
day offset. This is where a real trial's session names live — a session called
"Vida" is a row, never a value in code.

`arm_id` is nullable and null by default, meaning a template applies to every
arm. Making templates arm-specific would assert a trial design this application
has no business encoding; the column exists so an approved design can say so
explicitly, without the schema presuming it.

`cohort_sessions.template_id` is likewise nullable, so an ad-hoc session can be
scheduled without inventing a template for it.

## D-027 · 2026-09-09 · Content bodies are typed blocks, and no HTML is ever produced

Founder decision. A content body is a JSON array of nine typed blocks (TEXT,
VIDEO, IMAGE, CHECKLIST, CALLOUT, CONTEMPLATION, BUTTON, TECHNICAL_STEP,
SUPPORT_BOX). Text-bearing blocks accept a deliberately tiny Markdown subset —
bold, italic, inline code, links, paragraphs and lists — and nothing else.

The reason is that study content is authored by staff and rendered on **public**
pages. Rather than parse Markdown to HTML and then try to sanitise it, the parser
in `src/domain/markdown.ts` produces a typed token tree that the renderer turns
into React elements. No HTML string is ever constructed, `dangerouslySetInnerHTML`
is never used, and there is no sanitiser to get wrong.

Consequences:
- Raw HTML an author types is rendered as literal text, not markup.
- Link and media URLs are scheme-checked; `javascript:` and `data:` are refused
  both by the Zod schema on save and by the parser on render. An unsafe link is
  shown as plain text rather than silently deleted.
- Bodies are validated on save AND on read: a row hand-edited in the database
  drops its malformed blocks rather than taking a public page down.
- `tests/content.test.ts` covers each of these.

Message templates (EMAIL_TEMPLATE, WHATSAPP_TEMPLATE) are excluded from public
routing entirely — they are drafted here for Phase 7 and must never be reachable
as a web page.

## D-028 · 2026-09-09 · Content versions are pinned when a session is scheduled

Founder decision. When a session is scheduled, the currently published version of
its session content is pinned in `content_assignments`, so "which version did
Cohort 04 receive?" is answerable.

**Known consequence, accepted deliberately:** if content is republished between
scheduling and the session actually happening, the pinned version is not what
participants saw on the day. The alternative — pinning when the session is marked
HELD — would record what was actually delivered but would not let staff see in
advance what a cohort is going to get.

Mitigation in place: `countStaleAssignments` finds scheduled sessions pinned to a
version that is no longer published, so the drift is detectable rather than
silent. Re-pinning is deliberately not automatic; how it should work is an open
question.

## D-029 · 2026-09-09 · The block editor is a validated JSON editor, for now

Authors edit the block array as JSON, with live validation and a preview rendered
by the very same component the public page uses — so what an author sees is what
a participant gets, and an invalid body cannot be saved.

This is an honest interim, recorded as a limitation rather than presented as
finished: study staff writing preparation material should not be editing JSON. A
block-by-block editor is a follow-up. The data model does not change when it
arrives, because the blocks are already typed and validated.

Also deviating slightly from `docs/content-model.md`: `contents` gained a nullable
`session_template_id` foreign key. The design said content keys reference session
templates; a real foreign key does the same job while making it impossible to
orphan a preparation page by renaming a session.


## D-030 · 2026-09-11 · A determination carries a standardized reason, and one line of context

Founder decision, from the 2026-09-11 meeting. An exclusion with no recorded
reason cannot be reported in a flow diagram, and "requires review" with no
statement of what needs reviewing is a dead end rather than a handover. So
INELIGIBLE and REVIEW_REQUIRED now require a reason, enforced by a check
constraint on `screenings` rather than by application code.

The reason's **wording** is configuration (`eligibility_reasons`, per study); the
**category** it reports under is a fixed enum in
`src/domain/eligibility-reason.ts`. Those categories are the CONSORT groupings —
did not meet criteria, declined, unreachable, logistics, withdrew before
allocation, duplicate, study capacity, other. A reporting standard, not a
clinical rule, which is why it is code.

**The Category C line:** a reason says *that* a criterion was not met and never
*which*. "No cumple un criterio de inclusión" is the whole statement. The
criterion, the score and the reasoning stay in the approved system.
`tests/intake.test.ts` asserts no category name encodes a clinical concept.

ELIGIBLE accepts no reason at all — a reason beside an inclusion would be a
clinical justification. WAITLIST may carry one but is not forced.

**Accepted risk, stated plainly:** the optional note is free text next to a
determination, which D-019 deliberately refused for screenings. It was added
because staff asked for context a fixed category cannot carry ("reagendar en
septiembre"). Mitigations: 280 characters, newlines rejected in the domain, the
server action and SQL; the form warns in Spanish that clinical information does
not go there; and the note's **content is never copied into an audit snapshot** —
only whether one exists — so it lives in exactly one place and can be erased.
That makes it small, not safe. Revisit if notes start carrying narrative.

## D-031 · 2026-09-11 · Qualtrics is the intake, and identifiable screening data stays there

Founder decision, from the 2026-09-11 meeting, and a real change of direction:
**the public application form is retired.**

Initial screening happens in Qualtrics, and the digital consent is accepted there
*before* any datum about the person — their name included — is collected. A form
in CLP Hub would necessarily collect a name before that consent existed, which is
the exact order the study must not work in. `/participar` is now a hand-off: an
explanation and one outbound link to `studies.screening_url`. It renders no
`<form>`, no `<input>` and no server action, and `tests/intake.test.ts` asserts
that it stays that way.

Consequences:

- **Identity is the external reference, not the email.** `participants.external_ref`
  holds the opaque Qualtrics response ID, unique per study. `recordQualtricsIntake`
  creates a participant and an application row and writes **no**
  `participant_contacts` row at all. Contact details are added later, by someone
  who needs them to arrange the initial visit — an explicit, audited act rather
  than a side effect of intake.
- **D-013 is narrowed, not revoked.** The email-based duplicate rule still governs
  staff-entered contacts and the IMPORT route; it is simply no longer the entry
  point. A repeat external reference is refused outright rather than merged, since
  two rows for one response would double-count the person in a flow diagram.
- **PUBLIC_FORM survives in the enum.** Postgres cannot drop an enum value safely,
  and rewriting historical rows to hide where they came from would be falsifying
  the record. `ACTIVE_APPLICATION_SOURCES` is what code may create; the seed was
  changed to IMPORT so even it stops producing PUBLIC_FORM rows.

**On the future integration:** no transfer is implemented. There is no HTTP
client, credential, webhook or scheduled pull in this repository, and
`tests/intake.test.ts` asserts it. `qualtrics_field_mappings` configures which
fields *would* move, per field, off by default — and a check constraint refuses
any mapping whose source class is IDENTIFIABLE or RESEARCH. That refusal is a
database constraint, not a promise made by application code: a mapping for a
name, an email or a screening answer cannot be stored, not merely ignored.

`studies.qualtrics_mode` is DISABLED or TEST_ANONYMIZED. There is deliberately no
live mode to switch to; adding one is a migration plus a recorded decision.

**Open:** moving identifiable data would need explicit authorization and would
change `FIELD_CLASSES_NEVER_TRANSFERABLE`, the check constraint and this entry
together. None of that is done here.

## D-032 · 2026-09-11 · Consent is two decisions, and the physical one can carry authorizations

Founder decision, from the 2026-09-11 meeting.

The study has two consent moments, not two wordings of one:

- **DIGITAL** — accepted remotely in the screening platform, before any datum
  about the person is collected, their name included (D-031).
- **PHYSICAL** — signed in person at the initial visit, and the only one that can
  carry extra authorizations such as an interview or appearing in a documentary.

The enum values are deliberately generic. The platform's name is configuration,
so screening somewhere other than Qualtrics is not a migration.

**What had to be relaxed, stated plainly.** Migration 0003 enforced *one* active
consent per participant via a partial unique index, which makes holding both
impossible. Migration 0008 replaces it with one scoped per `(participant, type)`.
The old invariant no longer holds — that is the point of the change, not a side
effect. It is reversible: drop the new index, recreate the old one, no row is
deleted. Existing rows are backfilled to DIGITAL; under non-negotiable 9 all of
them are synthetic, so no real decision is relabelled. **If that ever stops being
true, the backfill must be revisited before this migration runs** — retyping a
real consent falsifies a record of what a person agreed to.

`startConsent` supersedes only within the same type. Starting the physical
consent must not quietly retire the digital one.

**Authorizations are rows, not columns.** `consent_scopes` is configuration per
study; a consent stores the granted codes in `granted_scopes`. Boolean columns
named `allows_interview` / `allows_documentary` were considered and rejected:
that is one trial's media plan, and as columns it would sit in every study's
schema (non-negotiable 6). A check constraint keeps the array empty for a DIGITAL
consent, and the checkboxes are never pre-ticked — a pre-ticked box is not
consent. `tests/consent-types.test.ts` asserts no identifier in the schema or the
domain names a specific authorization.

**Which arms sign in person is configuration, not a rule in code.**
`study_arms.requires_physical_consent`. The application never decides that a
control arm needs less than an experimental one; `missingConsentTypes` subtracts
what is recorded from what researchers configured, and an unallocated participant
is reported as missing nothing, because nobody yet knows which arm they are in.

**It is advisory only.** Nothing refuses an action because a consent is missing —
the same reasoning as D-021. A visible gap gets fixed; a blocked screen gets
worked around.

## D-033 · 2026-09-11 · Cohort size is configuration, checked once, and overridable

Founder decision, from the 2026-09-11 meeting: an experimental cohort forms with
between 6 and 8 participants.

**Those numbers are data, not code.** `cohorts.min_size` / `cohorts.max_size` are
configured per cohort (non-negotiable 6), and `tests/cohort-rules.test.ts`
asserts that neither 6 nor 8 appears as a constant in `src/domain/cohort.ts`. A
cohort with no bounds configured is unbounded, not implicitly 6–8.

**Where the rule bites.** Only when a cohort is marked ACTIVE. Assignment is
still never refused on size — that remains the operational judgement D-023
describes, and a cohort has to be allowed to pass through being too small on its
way to being the right size. The question "is this cohort ready to run" is asked
once, at the moment someone says it is running.

**And it is a speed bump, not a wall.** A refused activation hands the counts
back to the form, which turns into a confirmation with a required one-line
reason. The reason lands on the audit row, together with the member count and the
bounds — so a cohort of five that ran anyway is answerable, rather than either
impossible or invisible. `sizeIsCheckedAt` statuses always record those numbers,
override or not.

The detail page also warns *before* the button is pressed. Someone about to
activate a short cohort should find that out in time to go and fill it.

**`capacity` was renamed to `max_size`, not duplicated.** Two columns meaning
"how many fit" would drift apart. A rename preserves every value and is
reversible with one statement; `capacity` was already informational (D-023), so
nothing that read it was enforcing anything. Readers outside this repository
would break — inside it, all of them are updated in the same commit.

## D-034 · 2026-09-11 · A cohort can name its arm, and then the arm is enforced

`cohorts.arm_id` is nullable and null by default, so every cohort that existed
before this phase keeps taking anyone. Once a cohort names an arm:

- A participant allocated to a different arm is **refused**. This is data
  integrity, not a clinical rule — their recorded allocation and the group they
  actually attend would disagree, and every attendance figure built on the cohort
  would then be wrong. It is the same category of refusal as the duplicate
  allocation in D-021.
- A participant with **no allocation recorded** is also refused, and this is the
  deliberate half: they are not compatible by default. Assigning someone to an
  arm-specific cohort before anyone knows their arm is exactly the accident this
  exists to prevent.

**Moving between cohorts is one action.** `transferToCohort` removes and
re-inserts inside a single transaction and writes a `cohort_assignment.moved`
audit row carrying `movedFrom` / `movedTo`. Done as "remove, then assign" there
is a moment where the person belongs to no cohort, and if the second step fails
they simply stay there — the history then reads as an unexplained departure
followed by an unexplained arrival. Both assignment rows remain historical, as
before.

## D-035 · 2026-09-11 · Per-participant responsibles, the initial visit, and one more free-text field

Founder decision, from the 2026-09-11 meeting.

**Responsibles.** `participant_responsibilities` answers "for this person, who
runs the initial visit, and who takes or sets up the headset when that is someone
else". Cohort-level staffing (`cohort_staff`, D-022) is not duplicated — this is
the narrower question. Historical: revoked, never deleted.

One active holder per role, enforced by a partial unique index. Two people
simultaneously responsible for the headset is how a headset ends up with nobody
carrying it, so a new assignment supersedes rather than joins.

**Unlike `cohort_staff`, this grants no visibility.** D-022 flagged that a cohort
staffing row widens what someone can see precisely because that is unusual; this
one does not, the audit row says so explicitly (`grantsCohortVisibility: false`),
and the UI says so in Spanish. Widening access stays a permission change.

**The initial visit.** `initial_visits` is the in-person appointment where the
physical consent is signed and the equipment is handed over — distinct from
`screenings` (earlier, about eligibility) and from `cohort_sessions` (later, per
cohort). Historical in the same way screenings are: a visit that happened is not
edited into a different outcome, a repeat is a new row, at most one open at a
time.

**Accepted risk, stated plainly.** This adds the two most open free-text fields
in the application: a location (200 chars) and operational notes (500). That is a
real widening of the line D-019 drew for screenings, taken because "aparcar
detrás, el portero abre a las 9" is logistics, and refusing to store it does not
delete it — it moves it to WhatsApp where nobody but the sender can see it.

Mitigations, none of which make it *safe*, only small:
- Capped in the domain, in the server action and in a SQL check constraint.
- The form says, in Spanish, that clinical information does not go there.
- **Never copied into an audit snapshot.** The log records `hasNotes`, not the
  note. The audit table is append-only, so anything written there could not
  later be erased; this way the text lives in exactly one place.
- Never logged.
- Dropped from the audit history's changed-field list entirely.

Revisit if notes start carrying narrative.

## D-036 · 2026-09-11 · The next step names a missing record, never a judgement

`src/domain/next-step.ts` answers "what is outstanding for this person". Every
value is a statement about a MISSING RECORD: `RECORD_ALLOCATION` means the
allocation field is empty, not that the participant should be randomized, is
ready to be, or deserves to be.

The distinction is the whole point. A function that said "ready for
randomization" would be making a clinical judgement with a friendly label on it
(non-negotiable 3). Three consequences are visible in the code and locked by
`tests/next-step.test.ts`:

- **It never reads eligibility.** An INELIGIBLE participant's next step is still
  whatever record is missing; the eligibility badge beside it is what tells staff
  not to proceed. The app does not quietly withhold a step because it has formed
  an opinion. A test asserts the module's source mentions no eligibility value.
- **It never invents a requirement.** A physical consent is "missing" only where
  `requiresPhysicalConsent` says the arm signs one, and `null` (not yet
  allocated) is never read as `false`.
- **Only two steps get visual weight**, and neither ranks a participant: a booked
  visit with no outcome, and a booked visit with nobody running it. Those fail
  silently; everything else is simply work not yet done.

It is computed only for a viewer holding both `screening.read` and
`consent.read`. A step derived from a partial view would be a confident, wrong
instruction.

## D-037 · 2026-09-11 · The audit log becomes readable, in a redacted form

The audit log has been written since Phase 0, but nothing in the product could
read it back, which made "consultar el historial de cambios relevantes" a
database task. `src/services/audit-trail.ts` is that read and only that read — it
contains no insert, update or delete.

Audit rows are keyed by the entity they changed, so "this participant's history"
means the participant plus every screening, consent, randomization, cohort
assignment, responsibility and visit belonging to them. Those ids are gathered
and matched in one query.

**What is shown: the action, when, who, and the NAMES of changed fields. Not
their values.** `before_json` / `after_json` can carry contact fields on rows
written by earlier phases (research-data-boundaries, open item 4). Sensitive
names are dropped from the list entirely rather than shown redacted: "email ●●●"
still tells the reader an email was touched, which in a study this small is
itself informative.

Snapshot values are reachable through `includeSnapshots`, which the participant
panel deliberately does not pass. Exposing them carries its own retention
question, and a panel that quietly showed them would settle that question by
accident.

Access requires `audit.read` — held by ADMIN and STUDY_MANAGER today.

## D-038 · 2026-09-11 · VR logistics reuses what exists rather than restating it

Phase 6, approved at the 2026-09-11 meeting. `devices`, `device_assignments` and
`device_incidents` track equipment. Everything here is asset data attached to a
participant *code*; no column holds anything research-related.

**What is deliberately absent, and why.** The brief asked not to duplicate
existing entities, and two obvious columns were left out for that reason:

- **No `responsible_user_id` on an assignment.** Who handles a participant's
  equipment is `participant_responsibilities` with role VR_EQUIPMENT (D-035). A
  column here would be the same fact written twice, and the two would disagree
  the first time somebody changed one. The logistics views join to that table, so
  the dashboard and the participant page cannot contradict each other.
- **No `next_session_at`.** That is `cohort_sessions` for the participant's
  cohort, read at display time. Copied onto the assignment it would go stale the
  moment a session moved.

**Readiness is reported, never inferred (D-003).** The default is UNKNOWN rather
than NOT_READY, because "nobody has told us" is a different fact from "it does
not work". NEEDS_SUPPORT is its own value rather than a flavour of NOT_READY, the
same argument D-024 makes about TECHNICAL_FAILURE: folding them together loses
the one that requires someone to act. A test asserts the domain module contains
no telemetry or last-seen inference.

**The device lifecycle goes backwards, unlike the cohort one.** D-023 made the
cohort lifecycle strictly forward because sessions depend on the stage. Logistics
is different: shipments get recalled, returns get cancelled because someone kept
the headset for one more session, devices come back from maintenance to the
shelf. Refusing those would make staff record something untrue. What *is* refused
is a jump that skips the physical world — AVAILABLE straight to RETURNED, from
somewhere it was never sent.

**What logistics refuses, and why each refusal is integrity rather than
judgement:** a device already out cannot be re-assigned, a participant cannot
hold two, and an assignment cannot be closed while the device has not come back
or an incident is still open. The first two are physically impossible and a
record saying otherwise would make every later figure wrong; the third is the
mechanism by which a broken headset gets forgotten.

**Incidents are about equipment.** There is no category, and no column, for
something that happened to a *person* — an adverse event is Category C and
belongs in the institution's approved system. The form says so in Spanish, the
description is capped at 500 characters, and its content is never copied into an
audit snapshot (the D-035 rule). A test asserts no incident kind names a clinical
concept.

**The logistics screen shows participant codes, never names**, even though the
LOGISTICS role holds `participants.contact.read`. An address is needed on a
shipping label, not on a dashboard, and an operations screen listing everyone's
name is a re-identification surface for anyone walking past it.

## D-039 · 2026-09-11 · Message templates, and what a send record is allowed to hold

Phase 7, approved at the 2026-09-11 meeting. `communication_templates` holds
reusable messages organised by the stage they belong to; `communications` records
that one was sent.

**Nothing sends anything**, and nothing in the schema could (D-004). No API
token column, no queue, no scheduled-send table, no webhook.
`tests/communication.test.ts` asserts the absence across the domain module, the
service and the server actions, rather than trusting it — the same
absolute-guarantee argument D-018 makes about randomization. A system that
*could* send an unapproved message to a participant would eventually send one.

**The variable allow-list is the safety model.** A template may contain only
`codigo`, `nombre`, `fecha`, `hora`, `lugar`, `responsable`, `cohorte`, `enlace`
and `instrucciones`. Nothing clinical, no eligibility, no consent status, no
allocation, no email address, no phone number. A body using anything else is
refused on save, and the placeholder pattern is deliberately permissive about
what it *captures* (any `{{word}}`) so that an unrecognised placeholder is caught
rather than silently passed through and sent as literal text.

`nombre` needs `participants.contact.read` to render. Without it the placeholder
falls back to the participant code rather than being blanked: "Hola P-000042," is
honest about what the sender could see; "Hola ," just looks broken.

`renderTemplate` is not a template engine — one pass of literal replacement, no
conditionals, no loops, and a value containing `{{nombre}}` is inserted as those
characters because the scan runs over the original body, never over its own
output. Unsupplied values render as `⟨fecha⟩` rather than as nothing, because a
message reading "nos vemos el  a las " gets sent and one reading "nos vemos el
⟨fecha⟩" gets fixed.

**THE RENDERED MESSAGE IS NEVER STORED.** `communications.template_body` holds
the template *with its placeholders intact*. That answers "what did we send
P-000042 on the 4th" without copying their name, date and location into a second
table. The composer builds the rendered text in the browser, shows it, copies it
to the clipboard — and the form that marks it as sent submits the template id and
nothing else. A hidden field would be exactly how a rendered message ends up in
the database.

There is **no inbound path and no reply column**: this application never holds a
WhatsApp conversation, which is what "no almacenar conversaciones" asks for.

**Statuses are SENT and SKIPPED only.** No DELIVERED, no FAILED. Nothing here
observes delivery, and a status the application cannot verify would be a claim
rather than a record.

**Recording a send needs `communications.read`, not `.manage`.** The facilitator
who pasted the message is the person who should be able to say they did;
authoring a template is the privileged act.

**Message templates moved out of the content system.** `CONTENT_TYPES` keeps
EMAIL_TEMPLATE and WHATSAPP_TEMPLATE so existing rows stay readable, but
`AUTHORABLE_CONTENT_TYPES` no longer offers them and the server action refuses
them. A message is plain text with placeholders organised by stage, not a page of
typed blocks with a URL key — and two places to write the same message is exactly
the duplication the brief asked to avoid.

**Operational account.** Which WhatsApp account staff paste into is outside this
application's reach; it is recorded here as a standing instruction on the
communications screen and as an open item below, not as a setting this app can
enforce.

## D-040 · 2026-09-11 · The overview answers "what needs a person today"

The home screen kept counts and one link. It now carries an attention panel that
gathers, in one place: determinations parked for review, eligible people with no
allocation recorded, cohorts at the edge of their configured size, and device
assignments whose step is waiting on somebody.

Three rules it follows:

- **Every row links to where the work is done.** A dashboard that reports a
  problem without taking you to it gets read once.
- **Each section is gated by the permission that owns its data**, so a
  facilitator does not see a logistics queue they cannot act on and a researcher
  does not see one at all.
- **Nothing merely in progress appears.** A cohort still filling and a device
  that left yesterday are not problems. Showing them would make the panel
  wallpaper, which is the failure mode of every operations dashboard.

It shows counts and codes, never a participant name, even for a viewer entitled
to read one: this is the screen most likely to be left open on a shared monitor.

## D-041 · 2026-09-11 · Messages divide by stage AND session, and a channel message never names a person

Founder clarification after Phase 7 shipped: WhatsApp does not need to be
connected to CLP Hub at all — what the team needs is every communication
**divided by stage and by session**, ready to copy into the relevant channel.

Three consequences.

**Session is a foreign key, not a label.** `communication_templates.session_template_id`
points at the programme row, for the reason D-029 gives about content: renaming a
session must not orphan the messages about it, and a text field like "Sesión 1"
drifts the moment two people spell it differently. Null means the message is not
about a session — a waiting-list note, a closing message — and those sort last
within their stage rather than first.

**A message is addressed to a cohort channel or to one person.**
`audience` is PARTICIPANT or COHORT_CHANNEL. The distinction is not cosmetic; it
changes what the message may contain:

> A COHORT_CHANNEL template may not use `{{nombre}}` or `{{codigo}}`.

A group channel is read by every member of the cohort. "Hola María" pasted there
tells six other people that María is in this study, and "Hola P-000042" is no
better — inside a cohort of eight, a code addressed to one person is trivially
matched to whoever replies next. Both are refused at save time, the variable hint
list shrinks to match so the rule is visible before it bites, and
`tests/communication.test.ts` locks it down along with the seeded templates.

The audience is fixed once a template exists. Re-scoping one that staff already
use would silently change what is legal inside it.

**A channel message is recorded once, against the cohort.**
`communications.participant_id` becomes nullable and `cohort_id` joins it, with a
check constraint keeping exactly one of them set — the old guarantee "every send
has a subject" widened rather than weakened. Expanding a channel message into a
row per member was considered and rejected: the log would assert that each person
was written to individually, and their own page would then show a personal
message they never received.

**Still nothing sends anything.** This changes who the copied text is addressed
to, not who copies it. There is no client, credential or endpoint, and the tests
that assert their absence are unchanged.

## D-042 · 2026-09-11 · The public landing page is the Clear Light recruitment site, built from the V3 handoff

`/` stops being a generic design-foundation shell and becomes the Spanish
recruitment landing page for the trial, built to the V3 design handoff (eight
locked sections, one living light, a feathered human reveal, one dark theme).
Full description in `docs/landing-page.md`.

Four choices worth recording.

**The copy is a typed module, not messages and not the database.** Recruitment
copy is neither a staff UI string (messages/*.json, D-009) nor participant
session content (the versioned content model, D-029). It changes through review,
not through a dashboard, and it must be diffable against the approved protocol
wording. So it lives in `src/content/landing/clear-light.ts` with tests that pin
the rules that protect participants (no dashes, one CTA label, two identical
groups, no promised outcome). Moving it into managed content later is an open
question, not a rejected one.

**Unresolved protocol values are markers, and production refuses to publish
them.** A missing criterion or contact renders as `FALTA CONTENIDO APROBADO:
KEY` outside production. When `APP_ENV` is `production` and any marker remains,
the route renders a holding page. Nothing invented reaches the public, and the
gate is in code rather than in a checklist. The Qualtrics URL is configuration
(`studies.screening_url`, D-031) and drops out of the list once set.

**The only outbound link sits after the randomization explanation.** The nav and
hero "Comprobar si puedo participar" anchor to the final invitation; the
outbound Qualtrics link exists only there. The brief requires the two groups to
be explained before the CTA, and a visitor who skips ahead does so by their own
click.

**The scroll engine is vendored verbatim and loaded as a script.** The
scroll-craft engine (`public/landing/scrollcraft.js`) is the mechanism the
handoff asked for; its rule is that it is never edited per project, so it is not
bundled, linted or typed. Page code drives everything bespoke from the `--sc-p`
variable it publishes. Pinned acts exist only on wide, motion-allowed, scripted
viewports; every other reader gets the same content stacked in document flow.

Not done here, on purpose: no analytics, no form, no captions invented for the
film, no team section, and no documentary onboarding photos that the team has
not supplied. The old `LandingNav`, which listened to window scroll, is removed.

## D-043 · 2026-09-13 · Automation prepares work; it never delivers any of it (Phase 8)

Phase 8 lands the last planned tables — `study_events`, `automation_rules`,
`scheduled_actions`, `tasks`, `alerts` (migration 0015) — plus a cron-invoked
processor and the `/equipo/tareas` and `/equipo/alertas` surfaces. Full
description in `docs/automations.md`.

Six choices worth recording.

**READY is the end of what the system can do alone.** A processor that walks a
queue of due reminders is one HTTP client away from being a mailer, so Phase 8
does not weaken D-004 or D-039 — it restates them in a place where they are
easier to break. `scheduled_actions.status` has no SENT and no DELIVERED; DONE
is a person saying they acted. `tests/automation.test.ts` asserts that no HTTP
client, credential or endpoint exists across the domain module, the service and
the processor route, the same way D-018 makes randomization an absence rather
than a set of guards.

**AUTOMATIC stays in the vocabulary and is refused at save time.** The design
called for three delivery modes and the enum keeps all three, because deleting
the value would lose the record of what was intended. What must never exist is a
STORED rule claiming it — the team would believe their reminders were going out
on their own. It is refused in the domain (`isDeliveryModeAvailable`), in the
service (`createRule`) and by a check constraint. Refusing at save time rather
than at execution time means the misunderstanding surfaces while somebody is
still looking at the form.

**An event carries two timestamps, and that is what makes one engine enough.**
`occurred_at` is when the fact was recorded; `anchor_at` is what a rule's offset
is measured from. "Immediately after the application" is the same instant for
both. "24 h before session 2" anchors on the session's start, which is still in
the future when the event is written. No rule has to know which kind it is
reading, and `scheduled_for = anchor_at + offset_minutes` is the whole
calculation.

**Rule conditions are a closed allow-list of operational predicates.** Eight
named booleans — `participantActive`, `sessionScheduled`, `deviceOut` and so on
— with no operators, no values and no field access. This is the same safety model
as `TEMPLATE_VARIABLES` (D-039) and the same reasoning as non-negotiable 3: a
rule that could read an arbitrary column would eventually branch on a screening
result. `consentActive` asks whether a consent row exists and stands, never what
it granted. An unknown key in a stored row is dropped rather than honoured or
thrown on, and raises `RULE_MISCONFIGURED`.

**The go/no-go is taken when the action is due, and the snapshot is never
consulted.** `snapshot_json` exists so somebody can later see what the world
looked like when the action was planned; the decision reads the state as it is at
execution. A reminder scheduled on Monday for a participant who withdrew on
Tuesday is SKIPPED with the unmet condition named. There is no grace window
either: an action the processor missed on Friday is prepared on Monday with its
original time visible and marked late, because dropping it silently would hide an
outage. Rescheduling or cancelling cancels the open actions against that subject
rather than editing them, so the audit trail of what was planned survives.

**Alerts answer four open questions the same way: surface it, name it, let a
person decide.** "Should recording an allocation for a participant without active
consent raise an alert?" — yes, CRITICAL. "Should an under-sized cohort activated
with an override raise one?" — yes, WARNING. So do a headset past its return date
and an exclusion recorded with no reason. Every alert kind is about the DATA:
something missing, late or inconsistent in the records the team keeps. None is a
judgement about a participant, and none can be, because the sweeps that raise
them read only operational columns. An exclusion count is raised against the
STUDY rather than against one of the excluded people. Severity is fixed in code
rather than configurable, because a team that can turn "allocation without
consent" down to INFO will, on the week it fires. Nothing resolves its own
alerts: a sweep that did would erase the record that something was wrong for a
fortnight.

**No sweep contains a trial-specific number.** Each reads either a configured
bound (`cohorts.min_size`) or a fact with no threshold at all. A check like "warn
48 h before the session if the headset is not ready" has this trial's number in
it, so it is a rule row — event `SESSION_SCHEDULED`, negative offset, action
ALERT — and the seed ships one as a worked example. A test asserts the sweep
bodies contain no bare duration or group-size constant (non-negotiable 6).

Not done here, on purpose: no reschedule path for a session (so
`SESSION_RESCHEDULED` is in the vocabulary and not yet emitted), no approval
workflow behind `communications.approve`, no per-study on/off switch for sweeps,
and no delivery of any kind.

## Open questions for researchers

- Hosting region / data processing agreements before any real participant.
- Captcha / WAF and rate limiting for the public application form (D-015).
- Whether the permitted application question vocabulary should be enforced in the
  database rather than by convention (D-014).
- Confirm the screening status vocabulary (SCHEDULED / COMPLETED / NO_SHOW /
  CANCELLED) reflects the real workflow — it is an assumption, not from the brief (D-019).
- Whether an eligibility determination may be corrected after the fact, and by
  whom. The app currently permits it and audits every change.
- Consent form versions are free-text labels today. Should they become study
  configuration rows so the set of valid versions is controlled?
- Confirm the cohort lifecycle is strictly forward-only (D-023) — it is an
  assumption, not from the brief.
- How should a genuine randomization correction be recorded? Today a second
  allocation for the same participant is refused outright (D-021).
- Confirm the session status vocabulary (SCHEDULED / HELD / CANCELLED) — it is an
  assumption, not from the brief (D-025).
- Should attendance become locked once a session is HELD, or stay correctable as
  it is now? Every change is audited either way.
- Are session templates ever genuinely arm-specific? The column exists but is
  unused (D-026).
- How should a session be re-pinned when its content is republished before the
  session happens? Drift is detectable today but nothing acts on it (D-028).
- Do participants need an index of the study pages, or are the links only ever
  handed out in messages? There is no /estudio landing page today.
- Should the recruitment landing copy become managed study content instead of a
  typed module, and should `/participar` remain once the landing carries the
  same hand-off? (D-042)
- Should EN translations of study content be required, or is Spanish enough with
  EN only for staff preview (as D-009 implies)?
- Erasure vs. audit immutability: pseudonymization approach acceptable?
- Audit retention period.
- Should the flow-diagram figures suppress small counts before they can be
  exported or screenshotted? Nothing is suppressed today (D-030); disclosure
  control is a researcher decision, not one the app should make silently.
- Who may add or retire an eligibility reason? They are configuration rows today
  with no admin UI, so only a seed or a direct database change creates one.
- Should the reason note be visible to every role that can read screening, or
  gated separately? It is the one free-text field near a determination (D-030).
- Should a channel message be recordable against something other than a cohort —
  a study-wide announcement channel, say? Only cohorts today (D-041).
- Which WhatsApp account is the project's operational one, and who has access to
  it? CLP Hub cannot enforce this (D-039).
- Should message templates require an approval step before staff may use them,
  as `communications.approve` anticipates? Nothing uses that permission yet.
- Should a participant be able to report VR readiness themselves through a
  public form, as D-003 anticipated? Only staff can record it today (D-038).
- What happens to an assignment when a participant withdraws with the headset
  still out? Nothing closes it automatically.
- Should the visit note be visible to every role that can read a participant, or
  gated separately? It is the most open free-text field in the app (D-035).
- Should audit snapshot VALUES ever be shown in the product, and under what
  retention rule? Nothing shows them today (D-037).
- Is ACTIVE the right moment to check cohort size, or should PREPARATION also be
  checked? (D-033)
- Should a cohort whose arm is null be allowed at all once arms exist, or should
  naming an arm become mandatory for new cohorts? (D-034)
- Who may add or retire a consent scope, and what happens to a consent that
  already granted a scope later withdrawn from the study? (D-032)
- Should withdrawing the physical consent also withdraw the authorizations it
  granted, or are those separately revocable? Today they travel with the row.
- Confirm that contact details for a Qualtrics-route participant are only ever
  entered when the initial visit is being arranged (D-031). Nothing enforces the
  timing today.
- Whether email reminders may ever be AUTOMATIC. Refused everywhere today
  (D-043); answering yes means adding a provider, a credential and a delivery
  record, and re-opening D-004.
- Should a study be able to turn an individual sweep off, or is the fixed set
  the right one? Severity is deliberately not configurable (D-043).
- Which timings from the previous study apply to this one? The four rules in the
  seed are synthetic demonstrations, not this trial's schedule.
- How should a session be rescheduled? There is no path today, so
  `SESSION_RESCHEDULED` is in the vocabulary and never emitted (D-043).
- Should `communications.approve` gate the APPROVAL_REQUIRED delivery mode, or
  is the distinction between MANUAL and APPROVAL_REQUIRED only advisory today?
- MFA requirement for staff.
