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

## D-044 · 2026-09-13 · Study settings and team membership are the last two stub sections

`/equipo/configuracion` and `/equipo/equipo` stop being "Próximamente" cards.
Neither needed a migration: `studies` already carries what settings edits, and
`user_roles` has carried grant/revoke history with `granted_by` since migration
0001.

**This application cannot create a login, and should not be able to.** Staff
accounts live in Supabase Auth. An app that could mint one would be an
account-creation surface sitting behind a single compromised session. Someone is
invited through Supabase, appears in `/equipo/equipo` once they exist, and is
then GRANTED a role — which is the part that is this application's business and
the part that is audited.

**A grant is never deleted.** Revoking stamps `revoked_at` and `revoked_by`, so
"who could see this in March" stays answerable. Roles are not exclusive: someone
can facilitate and handle logistics, and forcing a single role would push the
team into granting the broader of the two.

**Settings edits are audited with before and after, because they change what the
application does.** The screening URL is where every applicant is sent (D-031);
the timezone is what every date on every screen is rendered in; the status is
what the processor uses to decide which studies to work through. A silent change
to any of them would be indistinguishable from a bug.

**Automation rules are configuration, so they are edited here** rather than on
the communications screen. `study.settings.manage` gates the whole section — a
facilitator who can use a template should not be able to change when it fires.

**And the stub route is gone.** `[section]/page.tsx` answered any unknown path
under `/equipo` with a "Próximamente" card. That was right while sections were
still arriving; now that every nav entry has a route, it would turn a typo into
a false promise. A wrong path is a 404, and `tests/settings.test.ts` asserts
every nav entry has a page.

## D-045 · 2026-09-13 · Message files are checked by tests, not by opening the page

Running the new screens in a browser surfaced two message-file bugs that had
been shipping for a while and that no gate could see. Both are fixed, and both
now have a test, because the failure mode is the same: `typecheck`, `lint` and
`vitest` all passed while every team page logged an error on load.

**An audit action keeps its dot; its message key does not.** `audit.action` was
keyed by the stored action — `"participant.created"` — and next-intl reads a dot
in a key as nesting, so it rejected the whole namespace as malformed on every
render. The stored action is not negotiable: `<entity>.<verb>` is the database
vocabulary and `src/audit/record.ts` validates that shape. So the MESSAGE key
uses `__` instead and the separator is translated at lookup. `tests/messages.test.ts`
now refuses any key containing a dot.

**A literal brace in a message has to be quoted.** Two strings showed the
template syntax to the author — "no puede usar {{nombre}}" — and ICU reads `{` as
an argument opener, so they threw MALFORMED_ARGUMENT at render. The fix is
`'{{'nombre'}}'`; the test now parses every string in every locale as ICU.

**And every audit action a service writes must have a label in every locale.**
The audit panel deliberately falls back to the raw key rather than hiding an
entry, so a missing label is cosmetic — but forty of the sixty-five actions were
falling back, which is half the history screen in snake_case. The test collects
the actions from the source rather than from a list somebody has to remember to
update, and fails both ways: a missing label, and a label for an action nothing
writes.

The locale files are also now checked for key parity, so a string added in
Spanish and forgotten in English fails before it reaches a screen.

## D-046 · 2026-09-14 · The hero and sections 2 and 3 are one opening sequence driven by events, not scrubbing

The founder supplied higher-resolution renders of both hero layers (3344x1882)
and an 8-second clip of the seven light bodies gathering into one light, which
then sinks to the bottom of the frame and rises to the top. That is the
handoff's own "light below section 2, above section 3", filmed.

**One pinned stage on desktop, starting in the hero.** `opening.tsx` puts the
hero, "El porqué" and "El qué" in one pinned act over the hero media; the stacked
variant (mobile, reduced motion, no JS) is the same three flow sections as
before. A first attempt put a scrubbed act under sections 2 and 3 only; the
founder rejected it because the gathering must happen in the hero, and because
scrubbing frames felt clunky.

**Scroll triggers events; the clip plays at its own rate.** Act progress picks a
destination; `light-sequence.tsx` plays the clip to that destination's rest
frame (0, 5.25s sunk, 7.92s risen) and the copy follows the playhead, so each
text arrives when the light does. Forward motion always stops at the next rest
and dwells 2.4s, so continuous scrolling cannot skip "El porqué"; the reader is
never held (leaving the pin cuts to "El qué"). Going back, anchor links and
keyboard focus dip to dark and cut rather than rewind, because reverse playback
means seeking backwards frame by frame, which is exactly the stutter that was
rejected. The alternative, text in normal flow over a sticky clip, was rejected
because moving copy would pass over the orb and the reveals could not be
synchronised with it.

**The handoff from still to clip is registered, not approximated.** The clip's
first frame differs from the still by a measurable scale and offset (fitted on
the seven heart lights). A transform in container units undoes it at rest and
eases away once the bodies move, so the switch is invisible while the still
keeps its full resolution.

**Anchors and focus.** The pinned panels share one sticky box, so `#porque`
cannot point at the panel. Anchor spans sit in the act's scroll track and take
the ids only while the pinned stage is showing; the server markup gives them to
the stacked sections, so no-JS and mobile anchors keep working.

**Hero pixelation was the pipeline, not the source.** The derivative was a
1600px WebP at quality 82, which `next/image` re-encoded at its Next 16 default
quality of 75 and a retina screen stretched. Masters are now full resolution at
WebP 95/92, served at quality 90 (`images.qualities` in next.config.ts). The
CSS `--exit` shrink and fade on the hero is removed in both variants.

**Section 3's film is a YouTube embed**, per the founder, loaded only on click
(`youtube-nocookie.com`), with a 16:9 preview cropped from the physical hero
photograph and no text beneath it. `SUBTITULOS_VIDEO` is no longer rendered as
a marker but still blocks publication.

**Two page-wide fixes found on the way.** `.cl p` and `.cl h1, h2, h3` reset
margins at a higher specificity than every component class, so intended gaps
such as `.hero__support` and `.que__body` were zeroed; the resets now use
`:where()`. And changed derivatives get new file names (`-hd`, `-circle`),
because the image optimizer and browsers cache by URL.

## D-047 · 2026-09-14 · Section 5 uses supplied photographs, step 3 is cohort assignment, and the ground is true black

**Step 3 changed at the founder's direction.** "Decide con toda la información"
(consent information before joining) became "Asignación a tu cohorte": if
selected, the person is assigned to a study cohort and a visit is arranged to
hand over and explain the headset. This departs from the handoff's locked
"questionnaire, conversation, informed decision" sequence; the founder outranks
it, but two things need protocol review before publication: the three steps no
longer mention informed consent (the page still says interest is not consent,
in the invitation and FAQ), and "cohorte" appears before section 6 explains
random assignment to two groups, so a reader could take the cohort for the
group. The em dash in the supplied wording is not rendered; the numeral and the
label are separate elements and the page bans em dashes.

**The FOTOS_INCORPORACION marker is retired.** It existed because section 5
had no photographs; the founder supplied three. They are generated images, so
their approval and public-use rights join the hero participants in the pending
list rather than blocking the page as a marker. The source file numbers do not
follow the step order (`01-habla` is the conversation); the mapping is by what
each image shows.

**The fade is black, and the ground is true black.** `--sc-canvas` moves from
`#080c0d` to `#000`, which every scrim and fade already mixes from, so the
footage and photographs sit on the same black as the page. The section 5 fade
uses the stops the founder proposed (0, 37, 58, 78%) in that token rather than
the proposed `#050708`, plus a top and bottom fade so the photograph has no hard
edge while the stage slides in and out. The three descriptions now share one
grid cell, so the slot grows to the longest; the previous fixed-height slot
would have let step 3 overlap the supporting line.

## D-048 · 2026-09-15 · Section 4 shows one supplied image per stage, and the timeline's active node is its own dot

**Seven images replace the interim footage.** The founder supplied one image per
stage (`stock-images/Etapas/S0.png` to `S6.png`). They sit on black at mixed
aspect ratios, from 3:2 to a 2.33:1 film strip, so they are shown whole rather
than cropped into the previous square frame: each image is its own box, sized
to fit the middle column and the height above the timeline, with a feathered
mask on its real edges (several run content right up to an edge, which would
read as a hard line on the black page). With no clips left, `stage-media.tsx`
and the phase-footage encoding in `scripts/landing-media.mjs` are removed.

**The blue dot is gone; the node's own dot marks the active stage.** The
`.timeline__lit` accent dot was misaligned because it carried an engine cue,
and a cue writes an inline `transform` that replaced the dot's centring
translate. It also painted above the travelling light. The active stage is now
shown by the same white dot growing and brightening, driven by CSS against
`--sc-p` over the stage's window (the section 5 step-rail pattern), and the
travelling light sits in its own layer above the nodes so it passes over each
dot.

**Stage names use the founder's `#887cde`** (5.98:1 on the black ground). A
first pass used the founder's `#624d7b`, which measured 2.87:1, below the 3:1
large-text minimum; the founder then chose the brighter shade. Names take a
heading line height (1.08) instead of inheriting the body copy's, and the right
column's minimum grows from 16rem to 19.5rem (the left shrinks to 15rem) so
every name sets on one line; the image column gives up about 7% at 1440.

## D-049 · 2026-09-15 · Section 6 explains the trial, and its split is an event with one geometry

**The lights left their lines.** The lights moved in a straight diagonal driven
by `--sc-p` while the lines were SVG curves drawn by a dash offset. Chrome
computes dashes in screen space under `vector-effect: non-scaling-stroke`, so
`pathLength` did not hold and the lines looked complete while the lights were
still 15% short; the two only met at the very end, and the split happened
while the diagram was still entering from the bottom of the viewport.
`split-stage.tsx` now builds both curves from the diagram's measured pixels
and places each light at a distance along its own curve, drawing the line to
just behind it. Following the founder's direction for the opening sequence
(D-046), it is an event, not a scrub: it waits until the diagram is wholly on
screen, pauses 600ms and plays once.

**The lines take the light's colours.** A gradient from transparent at the fork
through violet to a pale warm tint at the light, at the founder's request. This
is a narrow exception to "Living Teal is the only interface accent": the lines
belong to the light imagery, not the interface.

**The copy explains a randomized controlled trial.** The founder chose, from
three drafts, the plain comparison framing ("Dos grupos para saber si la
experiencia ayuda."), and for the group text a role-based draft that says what
each group contributes to the comparison and nothing about what the control
group receives, so it cannot contradict whatever the protocol says (waiting
list, usual care or an active comparator). It still has not had clinical or
ethics review.

**The markers are not drawn in section 6, but still block publication.** At the
founder's direction the yellow `CONDICION_GRUPO_*` and `ETIQUETAS_GRUPOS`
markers no longer render here. The keys stay in `missingContentList()`, so
production still shows the holding page until the group wording and labels are
approved.

## D-050 · 2026-09-15 · Section 6 follows scroll again, the control group "receives a similar experience", and labels move to Poppins

**Scroll, not an event.** Having seen D-049's timed split, the founder preferred
the split to follow scrolling. Unlike the opening footage (D-046), where
scrubbing frames felt clunky, this is geometry, so it scrubs smoothly: the
lights wait at the fork until the whole diagram is up from the bottom of the
viewport, travel as it rises and reverse on the way back, with a small inertia.
D-049's single geometry stays, so the lights remain on their lines.

**The heading returns to "La asignación se realiza al azar."** The trial
explanation in the body stays.

**The control group "recibe una experiencia similar para comparar."** The
founder's wording, so that patients are not discouraged by the prospect of
being in the control group. This supersedes D-049's protocol-neutral draft and
is a factual claim about the control condition: **it must match the
protocol**. If control is a waiting list or usual care, this line would
mislead people deciding whether to take part, and has to change before
publication. The body now says the same ("el otro en una experiencia
similar"). `CONDICION_GRUPO_CONTROL` still blocks publication.

**Group names get distinct gradients.** Violet to pink and teal to blue, at
matched lightness, so the groups are told apart without either looking
brighter. The lights themselves stay identical.

**Poppins for eyebrows, group names and the closing line.** The 0.72rem IBM
Plex Mono eyebrow rendered pixelated on black; eyebrows and the section 3 facts
move to Poppins at 0.85 to 0.95rem. The closing line ("misma importancia") is
larger with a slow shimmer that stops under reduced motion and "Pausar
animación". Hovering a light or its text brightens that side.

## D-051 · 2026-09-15 · Section 6's lights reunite into section 7's light, and section 7 gets general answers instead of markers

**One journey, driven by scroll.** At the founder's direction, after the group
text is read the two lights leave their lines, travel down and reunite at the
top of the participant photograph, where they become section 7's light, which
then sinks into the heart. This is the handoff's `HEART_DISSOLVE` beat ("the
lights reunite and dissolve into the VR participant's heart center"), which the
page previously skipped: section 7's light used to descend on its own flow
progress. Scrolling back reverses the whole journey. `split-stage.tsx` now
drives section 7's `--t` too, so the descent cannot start before the lights
arrive; the section's CSS fallback is unchanged for reduced motion and no
JavaScript. The lines fade as the lights leave rather than staying as
disconnected tails, since the founder asked that a light never look detached
from its line.

**Section 7's copy, chosen by the founder from drafts.** Every answer is
general and states no protocol fact the team has not supplied:

- Criteria: the two the founder supplied mid-change, "Tener una enfermedad que
  amenaza la vida" and "Hablar castellano" (the first worded like section 2's
  "una enfermedad que amenaza la vida"), followed by a line that remits the rest
  to the call "según todos los criterios aprobados". They are not the complete
  protocol set (no exclusion criteria, age or residence), so `CRITERIOS` still
  blocks publication.
- What participating involves and headset use: only what the page already says
  (seven stages, video calls, VR sessions, home delivery and explanation of the
  headset from step 3). Duration and schedule are promised "antes de empezar".
- Benefits and risks: the minimum ("no se garantiza", "todavía no sabemos"),
  plus that the team will explain them before the reader decides. No risk is
  named, so none needs clinical sign-off yet.
- What each group receives: the section 6 wording, including the control
  group's "experiencia similar" (still subject to D-050's protocol check).
- Withdrawal: "en cualquier momento, sin tener que dar explicaciones", standard
  wording that the ethics committee must still confirm.
- Contact and registry: the team will get in touch after the questionnaire;
  registry and contact details will be published here.

**The markers are gone from section 7, but not from the gate.** The registry
and team markers above the heading are removed along with the in-answer
markers. Every key stays in `missingContentList()`, so production still shows
the holding page. The criteria label moves to Poppins like the other labels.

## D-052 · 2026-09-15 · Footer rebuilt with a design-only contact dialog, cookie consent, draft legal pages, and a lavender accent

**The contact form sends nothing.** The founder asked for a contact form in a
centred modal. Where messages go was put to the founder as a decision, because
any destination changes what the site collects: a message from a prospective
participant can easily contain health information (Category C,
docs/research-data-boundaries.md), and storing it here would need a table,
anti-abuse protection (the same gap as D-015), a legal basis and a privacy
notice. The founder chose design only for now. The dialog is complete, but its
form has no action and makes no request, and submitting says so. A test pins
that. `CONTACTO_FORMULARIO` blocks publication until a destination is chosen.
The dialog asks visitors not to include health information.

**Consent covers the one optional item.** The public pages set no cookie for
an anonymous visitor (the Supabase session cookie exists only for staff), so
the only content that needs consent is the section 3 YouTube film. The banner
styles accept and reject identically, as the AEPD guidance asks. The choice is
stored in localStorage for 12 months and can be reopened from the footer, and
the film asks for consent in place instead of loading YouTube.

**Legal pages are drafts with marked gaps.** `/aviso-legal` (legal notice and
terms of use, since Spanish sites combine the two under LSSI-CE), `/privacidad`
and `/cookies` follow the structure LSSI-CE and GDPR arts. 13 and 14 ask for.
They describe only what the code does, and every fact the team has not supplied
(site owner, controller, DPO, legal basis, retention, processors and hosting
region) is a marker that blocks publication, as is `REVISION_LEGAL`. Nothing
here claims compliance; that is for a lawyer or the DPO to determine. The
founder did not know the data controller yet.

**The pause control stays, as an icon.** The founder asked to remove the
"Pausar animación" link. Removing the control would leave the breathing lights,
fire glow and shimmer with no way to stop them (WCAG 2.2.2), so the founder
chose a small labelled icon button in the footer instead. The team access link
is gone; staff use `/equipo/login` directly.

**Lavender replaces Living Teal as the accent.** At the founder's request,
buttons use a lavender-to-violet-to-pink gradient with dark ink (the darkest
stop is still over 6:1 against the ink), links get a gradient underline, and
the accent token (focus rings, eyebrows, FAQ marks) moves to lavender. This
departs from the handoff design system's "Living Teal is the only interface
accent". Section 6's teal-to-blue control group name is a group colour, not the
accent, and stays.

**Section 7 additions.** The "Posibles beneficios y riesgos" answer carries the
founder's text, moved from "usted" ("obtenga") to the page's "tú" ("obtengas")
with two typos corrected (remunerada, amenazante). A new "Confidencialidad y
protección de datos" answer describes only what the system does (participant
codes, research answers kept in the institution's systems apart from contact
data) and the reader's GDPR rights; `PROTECCION_DATOS` blocks publication until
the DPO or ethics committee approves it.

**Media.** Section 8 uses the founder's footer frame (six bodies around the
fire) in place of the two "CL circle 2" crops, with a soft CSS glow breathing
over the fire. Section 7 uses the founder's 2400px upscale under a new file
name, so caches do not keep serving the old image.

## D-053 · 2026-09-15 · Section 7 photo replaced again, under a new file name

The founder supplied another participant photo (`FAQ-enhanced-image.jpeg`, in
fact a PNG despite the extension; sharp reads it by content), replacing
D-052's upscale. Same pose and composition (near 3:4, matching the section's
portrait frame closely), so no layout change was needed. Written to
`participant-heart-v2.webp`, a new name rather than overwriting
`participant-heart-hd.webp`: this project's media pipeline warns that
`next/image` and browsers cache derivatives by URL, and reusing the old name
during this same change did in fact keep serving the old photo in the dev
server until the file was renamed and the Next.js image cache cleared.

## D-054 · 2026-09-15 · The hero's explicit reveal toggle is removed, not relocated

The founder asked to remove "the buttons on the right corner" of the hero
(the "Revelar a las personas" toggle and its hint text). The first pass moved
the control to bottom-left instead of deleting it, reasoning that it was the
only way keyboard-only and reduced-motion visitors could ever see the
physical layer, per the master brief ("touch: press-and-hold or an explicit
button"; "reduced motion: a stable layered still with an accessible reveal
toggle"). The founder repeated the request with a screenshot of the exact
control and "we dont need it": deleted outright.

Pointer hover and touch press-and-hold are untouched, since neither depends
on the button. Keyboard-only and reduced-motion visitors now see only the
seven light bodies for the whole session; the physical photograph (the Quest
3 headsets, which the master brief calls out as required content: "revealed
people must visibly wear Quest 3 headsets and hold Quest 3 controllers") is
unreachable for them. This is a real, knowing gap against the locked
accessibility requirement, kept because the founder's direction outranks it
per the page's own authority order, and recorded rather than hidden.

Removed with it: the `revealed` state and `.is-revealed` CSS path (dead once
nothing could set it), the `HERO.reveal` copy fields for the button's labels
(`show`/`hide`/`pointerHint`/`touchHint`; the alt text fields stay), and a
`light-sequence.tsx` focus-order special case that existed only to treat the
button as belonging to the hero state.

## D-055 · 2026-09-15 · Two more founder upscales replace the S2 and "responde" photos

`S2-enhanced.jpeg` and `02-responde-enhanced.jpeg` (both in fact PNGs despite
the extension; sharp reads by content, as D-053 already established) replace
the section 4 S2 image and the section 5 "Responde el cuestionario" photo.
Same scenes, higher resolution (3632x2048 for both); no copy or layout change.

`etapa-s2.webp` keeps its name: `tests/landing-content.test.ts` pins the
`etapa-s${k}.webp` pattern for every stage image, so instead of a fresh file
name this one derivative was overwritten in place and `.next/cache/images` was
cleared by hand, as D-053 first had to. `join-responde.webp` has no such test
pin, so it follows the normal rule and becomes `join-responde-v2.webp`; the
superseded file is removed.

## D-056 · 2026-09-15 · The two cache-pinned image names give way; the section 7 photo changes again

D-055 overwrote `etapa-s2.webp` in place, because a test pinned that exact
name, and cleared the dev server's Next.js image cache. The founder still saw
the old photo: some cache this project does not control (very likely the
browser's own disk cache, since the URL for that image never changed) kept
serving the old bytes. The fix is the one the project already documents for
this exact situation: give the file a real new name, `etapa-s2-v2.webp`, and
loosen `tests/landing-content.test.ts`'s exact-match assertion to a pattern
that still pins the stage-index prefix but allows a `-v<n>` suffix. Every
other stage still resolves to its plain `etapa-s${k}.webp`, so this is a
narrow exception, not a relaxation of the naming discipline.

The founder also supplied a third section 7 photo (`FAQ-enhanced-image-3.jpeg`,
2048x2720, in fact a PNG despite the name), replacing D-053's. Same treatment:
`participant-heart-v3.webp`, a new name, superseded file removed.

## D-057 · 2026-09-15 · S2 reverts to the founder's own edit, and a portrait stage image gets a narrower mobile box

The founder edited `claude-handoff-v3/assets/stock-images/Etapas/S2.png`
directly (Affinity, 1838x2048, a different crop from the file D-048 first
used, 1672x941) and asked for it back in place of D-055/D-056's enhanced
swap. New derivative name again (`etapa-s2-v3.webp`), for the same reason as
D-056.

**A portrait stage image needs its own box on the stacked list.** Every other
stage photo is landscape, so `.etapas-list__figure img { width: 100% }` (full
mobile column width) has always kept them a modest height. S2's new crop is
nearly square, so filling that same width made it roughly 390px tall on a
narrow phone, visibly dominating the row the founder was looking at.
`stages.tsx` now flags any stage whose image is taller than it is wide, and
`.etapas-list__figure--portrait` caps that image at 70% width (about 30%
smaller), bringing it back in line with the rest; the rule reads by aspect
ratio, so it will apply automatically to a future portrait stage image too,
not just this one. The desktop pinned panel is unaffected, since it already
sizes by a fixed container height rather than the page's own width.

## D-058 · 2026-09-15 · S2 goes landscape, so the portrait-only narrower box stops applying on its own

The founder re-edited the same `S2.png` landscape (3632x2048, same scene as
D-057's portrait crop). New derivative name again, `etapa-s2-v4.webp`. No
markup or CSS change was needed: D-057's narrower mobile box keys off the
image's own width and height (`media.width < media.height`), so a landscape
S2 falls through to the plain full-width treatment every other stage image
already gets. Verified rendered at 350x197 on a 390px phone, matching the
other stages' proportions, with no `--portrait` class applied.

## D-059 · 2026-09-15 · The hero's revealed-people photo is upscaled

`hero-circle-humans-enhanced.png` (5460x3072) is the founder's upscale of the
same photograph already used for the hero's physical (revealed) layer, not a
different composition: same room, poses, lighting and near-identical aspect
ratio (1.7773 against the original 1.7770), confirmed by eye against the
original before swapping. New derivative name, `hero-physical-v2.webp`, per
this session's now-standard practice; the superseded `hero-physical-hd.webp`
is removed.

The section 3 film poster (`film-poster-circle.webp`) still crops from the
*original* `Numadelics_Magnific Precision Upscale V2` source, not this
upscale: its extract rectangle is pixel coordinates sized for that file's
3344x1882, and recomputing them for the new file's size was out of scope for
"update the hero" alone.

Verified in Chrome at 1440 and 390: the revealed photo still registers with
the luminous light bodies (each headset under its orb, same arc), at rest and
mid-reveal, with no console errors.

## D-060 · 2026-09-15 · Hero physical layer re-rendered again, and the section 3 poster becomes an unrelated photo

The founder re-rendered `hero-circle-humans-enhanced.png` a second time ("without
the weird carpet issue", the earlier render's floor texture), 3360x1888.
`hero-physical-v3.webp`, a fresh name again; `hero-physical-v2.webp` removed.

While investigating a reported misalignment between this layer and the fixed
luminous light-body layer, comparing the old and new physical photographs
point-by-point (a bright reference candle, and matched crops at three regions
of the frame) showed they agree to well under a pixel at every point checked:
the "enhanced" renders are faithful re-renders of the same photograph, not
regenerated content. Swapping back to the pre-D-059 photograph reproduced the
same local mismatch at the same spot, so it predates this session's photo
changes entirely: the light-body illustration and the photograph are two
separately authored images with only a shared "where the group roughly sits"
framing (both start their content around the same distance from the left
edge), not per-body-part registration, and a few figures — especially the
rightmost one — sit further from their corresponding glow than the rest.
`object-position` has only a few pixels of range to work with at typical
widths (the two images' aspect ratios are within 0.2% of each other, so
`cover` has almost no crop slack to redistribute), and a `transform: translate`
large enough to fix one figure measurably worsens others, since the
per-figure offsets are not uniform. Closing this properly needs one of the two
source images redone to register against the other; it is not a CSS fix. Left
as a known limitation for now.

**The section 3 video thumbnail changes to an unrelated photo.** It no longer
derives from the hero's physical layer at all: the founder supplied
`physical-cloud-reveal-reference.png` (2400x1372, one participant meditating
against a blue backdrop, not the circle of seven) specifically for this slot.
Its aspect ratio is already close to the frame's 16:9, so no manual crop was
needed; `.film__frame img { object-fit: cover }` frames it well on its own.
The poster alt text is rewritten for the new, different scene.

## D-061 · 2026-09-16 · The stacked variant gets a reading light, and the opening sequence holds the scroll

Six changes for the founder's review build, five of them the phone's:

**The hero frame fills the phone.** The frame's composition keeps the circle in
its right two thirds and leaves the left third black for the desktop copy. On a
phone there is no copy beside it, so that third was empty space and the bodies
sat small and off to the right. Under 861px the box becomes 8:7 with a
right-anchored crop, which drops the empty third; the layers keep one
`object-position`, so the reveal stays registered.

The first attempt at this (6:5, 1:1 under 420px) still looked off-centre,
because both numbers were guesses. Measuring the frame settles it: the bodies
span 37.3% to 98.3% of its width, centroid 67%. A cover crop shows a slice of
the width whose size is fixed by the box ratio alone, so exactly one ratio puts
that slice's centre on 67% at `object-position: 100%`, and it is 8:7. Squarer
clips the outer two bodies; wider shrinks them. Measured on the rendered page
at 360, 390, 430, 700 and 860px: the bodies sit 2.2 to 2.7% from the left edge
and 2.3 to 2.6% from the right at every width, filling ~95% of the box.

**A reading light carries sections 2 and 3 on the phone.** The desktop opening
sequence reveals that copy through the clip's wipes; stacked, it all arrived at
once. `reading-light.tsx` runs a small lavender light down the two sections with
the reader, lighting each block as it reaches it. It passes *behind* the copy
(z-index 0, under both sections): in front it read as a smudge over the words.
Three rules it keeps: nothing hides until the script sets `data-reading="live"`
(no-JS and pre-hydration readers see finished copy, verified with JavaScript
off), a block that has been lit stays lit, and reduced motion or "Pausar
animación" opts out entirely.

**Etapas and the onboarding steps fade up** through the vendored engine's own
`data-sc-in`, which fires once per item on entry. That attribute's base style
lives in scrollcraft.css and starts at `opacity: 0`, so the resilience rule in
landing.css, which until now only covered `[data-sc-cue]`, had to be widened:
without it a no-JS reader would have found those items invisible.

**The onboarding steps become cards.** The photographs are lit from the right
and fade to black on the left, so a picture hanging under its paragraph showed
that fade as a hard odd edge. Each step is now a card with the photograph as its
ground and the copy over it, numeral first.

**Section 6's copy narrows on a phone.** Centred copy at a phone's full width
set too many long lines; the head, body and closing line get their own measures
under 640px.

**`DESCRIPCION_ETAPAS` is no longer drawn** (founder's request), like the other
markers before it. It still blocks publication. No marker is now drawn anywhere
on the landing page.

**The opening sequence holds the scroll.** At the founder's request, scrolling
down during a transition is held until the clip reaches its rest and the copy
has wiped in, so the sequence cannot be skipped: about 6.9s for the first
transition (the clip's own 5.25s plus the hold) and 4.3s for the second. This is
scroll-jacking, which is hostile if it goes wrong, so every exit is open:
scrolling up, Escape, any other key, moving focus to a control, leaving the
stage, "Pausar animación", and a hard `LOCK_MAX_MS` cap that releases the page
whatever the clip does. It never runs on the stacked variant, under reduced
motion, or without scripting, and scrolling up behaves exactly as before.
`DWELL_MS` drops from 2400 to 1600, since the lock now does the anti-skip work
the dwell was doing alone, and the lock releases exactly when the next
transition may start, so the scroll after it begins the next event rather than
falling into a dead dwell.

Verified in Chrome: the lock holds at one scroll position through six further
wheel notches, releases with "El porqué" fully revealed, holds again for the
second transition, then leaves the page free; an upward notch releases it at
once.

## Open questions for researchers

- Where should contact form messages go: the study mailbox, a CLP Hub inbox, or
  elsewhere? Each changes what the public site collects (D-052).
- Who is the data controller and the DPO for the public site and the study, and
  who reviews the legal pages? (D-052)

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
- Who may hold ADMIN, and should granting ADMIN require a second
  administrator's approval? Any ADMIN can grant it today (D-044).
- Should revoking your own last grant be refused? It is permitted today: the
  grant is never deleted, so it can be restored, and a guard would have to
  decide what "locked out" means across five roles and several studies.
