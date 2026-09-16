# BRIEF: aNUma Clear Light RCT recruitment landing page

Self-authored under explicit creative delegation. The master prompt and the V3
handoff package (`claude-handoff-v3/`) fix the structure, copy and visual
direction; the eight interview topics below record those decisions with their
source, and mark the few places where the build had to decide.

## The eight topics

1. **Vibe.** "Restrained, intimate, documentary, numadelic, calm." Source:
   master prompt section 4 ("a restrained, intimate encounter between real human
   bodies and indistinct bodies of light"). References: the supplied Clear Light
   footage and the composite `physical-cloud-reveal-reference.png`.
2. **Scroll journey, in the brief's words.** Hero reveal of humans; El porqué;
   El qué with film; Etapas del Programa S0 to S6; Cómo incorporarse (three
   steps); Asignación al azar (two equal groups); Elegibilidad y preguntas;
   Invitación final. Locked, docs/07 item 1.
3. **Energy curve.** Quiet open, quiet middle, one lift at the stages, quiet
   again, quietest at the close. The brief forbids more than one engineered
   climax and any crescendo at the end (master prompt sections 4 and 5.8).
4. **Feeling curve and the one moment.** Below. The moment: "I moved my hand
   over the glowing figures and real people wearing headsets appeared under the
   light."
5. **The one thing no site does.** A page-long single light that ends by
   dissolving into a real person's heart, after having been seven people, one
   light, a waypoint, two equal lights.
6. **Distance from premium-minimal.** Premium-minimal is the brief's own family
   (near-black, one accent, generous space). Authored decision: no drift, no
   grain, no glass, so the footage's softness is the only texture.
7. **One world or distinct scenes.** Distinct sections with one continuous
   guide (the light). Not a worldflight: the brief locks eight sections with
   document-flow content and forbids scroll trapping.
8. **Assets.** All supplied: two registered hero layers, four Clear Light
   clips, two Clear Light stills, one documentary participant frame, a raster
   logo. Nothing generated. No image-generation key was used.

## Feeling curve

| # | Section | Feeling | What causes it |
|---|---|---|---|
| 1 | Hero | Curiosity | Seven indistinct lights; the hand reveals people with headsets; the first scroll gathers them into one |
| 2 | El porqué | Recognition | The one light sinks; illness named plainly, centred above it |
| 3 | El qué | Orientation | The light rises; a clear explanation and a user-started film below it |
| 4 | Etapas | Wonder (the peak) | The light walks S0 to S6 while the footage changes |
| 5 | Incorporarse | Reassurance | Three calm steps, "no te compromete" |
| 6 | Al azar | Fairness | One light divides into two identical lights |
| 7 | Elegibilidad | Intimacy, trust | The light comes home to a person's heart; the facts follow |
| 8 | Invitación | Calm resolve | The arc, one small fire, one CTA, and the page holds |

**Peak:** section 4, the act with the largest span (4.5 viewport heights).

**Revised 2026-09-14 (D-046), founder-directed:** sections 1 to 3 became one
opening sequence (span 3.2) that plays supplied footage of the seven bodies
gathering into one light. Footage now also plays before the peak, so the act
before section 4 is no longer quiet. Open question for the founder: the
gathering is a strong candidate for the one moment people remember, which
would move the peak to the opening; section 4 keeps the most scroll room. **Ending:** resolves and holds; the last cue is the CTA and the
footer sits inside the final viewport.

**Tell-someone sentence:** "It's the site where you move your hand over glowing
figures and the real people wearing headsets appear underneath the light."

## Grammar

Filmic one-shot, as constrained by the locked storyboard: a single linear
argument with one emotional arc, a continuous guide, pinned crossfade acts.
The other seven lost on the brief itself: chaptered editorial forbids the
pinned crossfade acts the storyboard requires; live surface has no product to
run; continuous world forbids document-flow sections; typographic poster
forbids the photographic hero; gallery has no collection; split stage has no
two-sided argument; rhythmic cutlist forbids pinning and the quiet pace the
ethics contract requires.

## Signature move

The feathered human reveal on the hero (pointer, press-and-hold, or button),
paired with the light that ends the page inside a documentary participant's
heart. Both are page code driven from pointer events and `--sc-p`; the engine
is untouched.

## Score

| Beat | Section | Device | Why |
|---|---|---|---|
| Curiosity, recognition, orientation | 1 to 3 | `pin` 3.2 + event-triggered footage (bespoke) + pointer mask | Scroll starts each event (gather, sink, rise) and the copy arrives with the light; nothing is scrubbed |
| Wonder | 4 | `pin` 4.5 + cues + `--sc-p` waypoint | Seven states need scroll room |
| Reassurance | 5 | `pin` 3.2 + cues (cross-fade) | Three states, held frame |
| Fairness | 6 | `flow` + `--sc-p` split | The division happens as the section arrives |
| Intimacy | 7 | `flow` + `--sc-p` dissolve | Same |
| Resolve | 8 | `flow`, holds | The page stops |

Three pinned acts in a row (the opening, 4 and 5) contradict the skill's "never
the same device twice in a row". The pins in 4 and 5 are locked decisions
(docs/07 items 11 and 13) and the opening was directed by the founder; all
outrank the skill. They differ in kind: time-based events over footage, a
travelling waypoint over seven media states, a three-state rail over
cross-fading stills. The scroll-craft harness samples fixed positions and
cannot see a state that arrives by time, so the opening is verified by its own
script (docs/landing-page.md, "Opening sequence verified").

Authored silence: none. The empty screens the first desktop run showed between
sections 5 and 6 were a bug (an author `position` rule un-pinning the stage)
and were fixed.

## Fingerprint gate

The registry was empty at the start of this build; nothing to clear.

## Verification record

Harness (`shoot.mjs`, six positions per act) at 1440x900, 1024x768, 768x1024,
390x844 and 1440 reduced-motion: no dead scroll, every cue clears 4.5:1 at its
worst frame (desktop and 1024; the phone, tablet and reduced runs carry no
pinned cues). First desktop run found two real defects, both fixed and re-run:
section 5 never pinned (an author `position` rule on the stage) and section 4's
text cues overlapped at full opacity (window overlap without matching ramps).
A third finding, 2.12:1 on the step rail, was my own duplicated-text overlay;
replaced by a colour driven from `--sc-p`.

Interaction script (`lab/interaction/results.json`): pointer window, gate,
toggle, phone press-and-hold (after moving the gate to the media frame and
delaying the phone coalescence), keyboard order and focus, 200% zoom, no-JS,
reduced motion, media failure, stage clip play/pause, equal branch lights, the
shared 2/3 light size, and every link.

Feel check, cold scroll at 1440: curiosity, weight, orientation, wonder,
reassurance, fairness, tenderness, calm. Matches the intended curve; the peak
reads as the peak (largest scroll room, only footage), the act before it is
quiet, the end holds. Nothing changed after the feel check.

Not verified: a real phone, real assistive technology, production hosting.
