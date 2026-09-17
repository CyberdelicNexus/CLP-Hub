# Recruitment landing page (aNUma Clear Light)

The public route `/` is the recruitment landing page for the Clear Light
randomized controlled trial, in Spanish, with English and Galician translations
the visitor can choose (D-063). It is built from the V3 design handoff
(`claude-handoff-v3/`, tracked in this repository) and recorded in D-042.

**Status: prototype.** The copy is working Spanish copy from the handoff content
model and has not had native editorial, clinical or ethics review. Every
protocol value the team has not supplied is a `FALTA CONTENIDO APROBADO` marker.
Markers render only outside production; in production the page refuses to
publish while any remains (see "Publication gate").

## What it is

- Eight sections in a locked order: hero, El porqué, El qué, Etapas del Programa
  (S0 to S6), Cómo incorporarse al estudio, Asignación al azar, Elegibilidad y
  preguntas, Invitación final.
- One locked dark theme on a true black ground (`--sc-canvas: #000`, D-047),
  lavender as the interface accent, as a gradient on buttons and link
  highlights (D-052, replacing Living Teal), Manrope for the interface, Poppins
  for eyebrows and section 6's group names and closing line (D-050), IBM Plex
  Mono only for identifiers and markers.
- One living light ("la señal viva") that appears in every section from the
  second onward: it sinks below "El porqué" and rises above "El qué", travels the
  S0 to S6 timeline, rests top-right during onboarding, divides into two equal
  lights for the randomization explanation and dissolves into the documentary
  participant's heart before the final invitation.
- The hero's feathered reveal: seven soft light bodies over a photograph of the
  same seven people wearing Quest 3 headsets; the pointer, or a press on touch,
  opens a large feathered window without an edge. There is no explicit toggle
  (D-054): keyboard-only and reduced-motion visitors see only the light bodies,
  never the people.
- The opening sequence (D-046): on desktop the hero and sections 2 and 3 are one
  pinned stage. The first scroll plays the clip of the seven bodies gathering
  into one light, registered exactly over the hero still; the light sinks and
  "El porqué" wipes in top-down; the next scroll lifts it and "El qué" with its
  film wipes in bottom-up. Scroll starts each event; it never scrubs frames.
- The page collects nothing it stores. Its only outbound *link* is the
  Qualtrics screening link, read from `studies.screening_url` of the study
  open for recruitment (D-031); without one, the CTA renders inert. Section 3's
  film is a YouTube embed (see "Deviations"), loaded only after the visitor
  clicks play.

## Where things live

| Concern | Path |
|---|---|
| Route | `src/app/(public)/page.tsx` (fonts, DB read, publication gate) |
| Sections | `src/components/landing/sections/*.tsx` |
| Client islands | `hero-reveal.tsx`, `light-sequence.tsx`, `reading-light.tsx`, `split-stage.tsx`, `film-player.tsx`, `site-bar.tsx`, `still-toggle.tsx`, `contact-dialog.tsx`, `consent.tsx`, `scrollcraft-mount.tsx` |
| Footer (landing and legal pages) | `src/components/landing/site-footer.tsx` |
| Legal pages | `src/app/(public)/{aviso-legal,privacidad,cookies}/page.tsx` → `legal-page.tsx`; copy in `src/content/landing/legal.ts` |
| Fonts | `src/components/landing/fonts.ts` (shared by the landing and legal pages) |
| Copy | `src/content/landing/clear-light.ts` (typed, Spanish source, with `Missing` markers); translations `clear-light.en.ts`, `clear-light.gl.ts`, `legal.en.ts`, `legal.gl.ts`; `copy.ts` picks one per language |
| Language switch | `language-switch.tsx` (in the bar and the legal pages' bar) → `src/app/(public)/idioma/[locale]/route.ts` |
| Styles | `src/components/landing/landing.css` (page) over `scrollcraft.css` (vendored floor) |
| Scroll engine | `public/landing/scrollcraft.js` (vendored from the scroll-craft skill, unmodified) |
| Media | `public/landing/media/` (derivatives only; originals stay in the handoff) |
| Derivative pipeline | `scripts/landing-media.mjs` |
| Tests | `tests/landing-content.test.ts` |
| Verification artifacts | `scrollcraft/builds/clear-light/` (BRIEF, contact sheets, results) |

## How the scroll works

The vendored engine reads `data-sc-act` / `data-sc-span` / `data-sc-cue`
attributes off the server-rendered markup and publishes each act's progress as
the CSS custom property `--sc-p` on the act element. Everything bespoke is CSS
`calc()` against that variable (the timeline waypoint and its active node, the
heart dissolve, the step-rail colours) or a small client island that reads
scroll position in an animation frame while its section is near the viewport
(the opening sequence, section 6's split). The only window scroll listener in
page code is the opening's threshold hold, attached only while it stands (D-062).

Three acts pin (the opening, 4 and 5). They are rendered only under
`(min-width: 861px) and (prefers-reduced-motion: no-preference) and (scripting: enabled)`;
everywhere else a stacked document-flow variant with the same content is shown.
Nothing essential lives only in a pinned state.

### The opening sequence

`opening.tsx` renders one pinned act (span 3.2) holding the hero, "El porqué"
and "El qué" as panels over the hero media, plus the same three sections as
ordinary flow for the stacked variant. `light-sequence.tsx` controls it:

- **Events, not frames.** Act progress picks a destination (hero below p 0.02,
  "El porqué" below p 0.4, "El qué" beyond). The clip plays at its own rate to
  that destination's rest frame: 0 (seven bodies), 5.25s (the light sunk to
  the bottom), 7.92s (risen to the top). The stage's `data-state` follows the
  playhead, so the hero copy leaves at 1.5s as the bodies begin to merge, "El
  porqué" arrives at 4.85s as the light settles, and "El qué" at 7.05s once it
  is up. The reveals are timed CSS transitions of a feathered mask.
- **No skipped chapter.** Moving forward always stops at the next rest and
  dwells 1.1s before continuing, so a reader who keeps scrolling still reads
  "El porqué". Scrolling does not get trapped: if the reader leaves the pin
  first, the stage cuts to "El qué" as it slides away.
- **No rewinding.** Scrolling back, a nav link, the hero's "Conocer el estudio",
  or keyboard focus landing in a hidden panel dips the clip to dark (320ms) and
  cuts to the destination's rest. The three anchors (`#inicio`, `#porque`,
  `#que`) sit in the act's scroll track; the ids move onto them only while the
  pinned stage is the variant showing.
- **Seamless handoff.** The clip's first frame is measured against the hero
  still by its seven heart lights (1.57% wider, 1.55% shorter, 14px shifted at
  1280). `.op__video` undoes that with a transform in container units while at
  rest and eases to none once the bodies move; the still steps aside only after
  the clip is fully showing.
- **Nothing on mobile.** The clip is requested only while the pinned stage is
  showing, never on the stacked variant; if it fails to load, the opening falls
  back to the stacked sections.

Section 1 does not shrink or fade on scroll in either variant; the gathering
is the footage, not a CSS transform.

**The threshold hold (D-062, replacing D-061's scroll lock).** D-061 froze
scroll from the moment a transition began: up to 6.9s, then 4.3s, of dead input
right after the scroll that started the clip, which visitors read as the site
failing to render. Now the scroll that starts a transition is never held. The
hold is a wall at the scroll position where the *next* sequence would begin
(`ENTER[1]` for "El qué", the end of the pin for the rest of the page), and it
stands only while the current transition is in flight or its copy is wiping
in. A reader who never reaches the wall never feels it.

- **Pushing is answered.** While the reader pushes against the wall the clip
  plays faster, up to `PUSH_RATE` (2x), easing back when they stop.
- **It lifts when the next scroll can act.** `DWELL_MS` (1100ms) is both the
  hold after a rest is reached and the gate on the next transition, so the
  push that follows the release starts the next event at once.
- **Every exit stays open.** Scrolling up is never held; Escape, focus leaving
  the stage, any in-page link, a jump larger than half a viewport (navigation,
  find in page, the scrollbar), "Pausar animación", leaving the stage and a
  `HOLD_SAFETY_MS` cap (6s) all release it. A reader already past the wall is
  never pulled back. Pinned variant only, so never under reduced motion, on a
  phone, or without scripting.
- **Listeners only while it stands.** The non-passive wheel, touch and key
  listeners are added when the wall is armed and removed when it lifts, so the
  rest of the page scrolls without waiting on script.

### The reading light (stacked sections 2 and 3)

`reading-light.tsx` is the stacked variant's answer to the wipes above: a small
lavender light travels the two sections with the reader and lights each
`[data-reading-block]` as it reaches it, passing behind the copy rather than
over it. Copy only takes its pre-reveal state under `[data-reading="live"]`,
which the component sets on mount, so no-JS and pre-hydration readers see
finished copy; a lit block stays lit; reduced motion and "Pausar animación" opt
out. Section 4's stages and section 5's steps use the vendored engine's own
`data-sc-in` instead, which fires once per item on entry.

### The two-light split and the reunion (sections 6 and 7)

`split-stage.tsx` drives one scroll-linked journey from section 6 into
section 7, reversed by scrolling back (D-049, D-050, D-051): the split below;
then, after a pause for reading (22% of a viewport of scroll), both lights
leave their lines (the lines fade over the first third), travel down and meet
at the section 7 light's resting point, arriving when section 7's grid top is
at 28% of the viewport. There they hand over to the section 7 light (same
component, same size, same point), whose descent into the heart now starts
only after the reunion: the script sets `--t` through `data-journey` / `--jt`
instead of the section's flow progress. The reunion curve is followed by its
parameter with a smoothstep, so both lights descend level and start moving
down on screen promptly. One smoothed scroll position drives all three
stretches. Under reduced motion or "Pausar animación" the script hands section
7 back to its CSS.

The split itself (D-049, D-050):

- **Seen, not scrolled past.** The lights wait at the fork until the diagram's
  bottom edge is above 84% of the viewport, then travel as it scrolls up,
  arriving when its top edge reaches 14% (at least 220px of scroll). They
  follow with a little inertia, and scrolling back reverses them.
- **One geometry.** The script measures the diagram in pixels and builds both
  curves from it; each light sits at a distance along its curve and the line is
  drawn to 0.15 of a diameter behind it, so the line enters the light's haze and
  its end never shows through the core. The lights paint above the lines.
- **Lines in the light's colours.** A gradient along each line, transparent at
  the fork, then violet, lavender and a pale warm tint at the light.
- **Text after the lights.** The two groups' text fades in over the last 30% of
  the split (`--k`). The columns share the diagram's width, so each column's
  centre is its light's centre; subgrid rows keep both columns' lines level
  when a name wraps.
- **Two group colours, equal weight.** Each name has its own gradient
  (violet to pink, teal to blue) at matched lightness, in Poppins.
- **Hover.** On a pointer device, hovering a light or its text brightens that
  side's light, line, name and text. Pure CSS (`:has()`).
- **Closing line.** "Los dos grupos tienen la misma importancia para el
  estudio." is set large in Poppins with a slow shimmer, which stops under
  reduced motion and "Pausar animación".
- Reduced motion and "Pausar animación" show the end state at once. Without
  JavaScript, CSS places the lights at their ends and the lines are absent.

Eyebrows (`.cl-eyebrow`) and the section 3 facts use Poppins at 0.85 to
0.95rem instead of 0.72rem IBM Plex Mono, which rendered pixelated (D-050).

## Behaviour by input

| Input | Hero reveal | Pinned acts | Lights |
|---|---|---|---|
| Fine pointer | Window follows the pointer while the hero is showing; the people never show over the moving clip | Pinned | Breathing, travelling |
| Touch | Press-and-hold opens the window at the finger; lifting or scrolling closes it | Stacked list below 861px | Same |
| Keyboard / any other input | No control: only the light bodies show, never the people (D-054) | Stacked or pinned per viewport | Same |
| Reduced motion | No control, no pointer tracking: only the light bodies show (D-054) | Stacked list | Static end states, no breathing or flicker |
| No JavaScript | Layered still shows, people never revealed | Stacked list | Static |
| Pause icon button (footer, "Pausar animación") | unaffected | the opening cuts between rests instead of playing | breathing, fire glow and shimmer stop |

## Languages (D-063)

- **ES · EN · GL** in the top bar of the landing page and the legal pages. Each
  option is a plain link to `/idioma/[locale]?desde=<page>`, named in its own
  language (`lang`, `aria-label` "Español", "English", "Galego"); the current one
  is `aria-current`. The route sets `clp_public_locale` (12 months, technical)
  and redirects 303 to the page, which reloads whole. `desde` must be one of the
  four public pages; anything else goes to `/`.
- **Spanish is the default** and the source text. The translations have the same
  shape, and a test holds them to it: same keys and lengths, identical `href`,
  `src`, sizes, codes, ids and slugs, and the same `Missing` marker objects, so
  the publication gate is one list for every language.
- **The translations are working drafts published without review** at the
  founder's direction: no native editorial, clinical, legal or ethics review.
  Markers (`FALTA CONTENIDO APROBADO`) stay in Spanish; they are for the team.
- **Not translated:** the Qualtrics questionnaire (external, Spanish), `/participar`,
  `/estudio` (study content, D-029) and the staff dashboard, which has no Galician.
  Anchors (`#porque`, `#invitacion`) and routes keep their Spanish names.

## Footer, contact, consent and legal pages (D-052)

- **Footer** (`site-footer.tsx`, shared with the legal pages): brand and
  tagline; "El estudio" (study information, FAQ, contact); "Legal" (legal notice
  and terms of use, privacy policy, cookie policy, "Configurar cookies"); the
  draft note and the pause icon button. No team access link: staff reach
  `/equipo/login` directly.
- **Contact dialog** (`contact-dialog.tsx`): every `#contacto` link opens a
  native modal `<dialog>` centred on screen, with a blurred backdrop; a click
  outside the panel or Escape closes it. Name, email, message, a note not to
  include health information, and a privacy link. **Design only**: the form has
  no action and makes no request; submitting says sending is not available and
  nothing was sent or stored (`CONTACTO_FORMULARIO`). Without JavaScript,
  `#contacto` reaches section 7's "Contacto y registro" answer, which owns that
  id; the dialog is `#contacto-formulario`.
- **Consent** (`consent.tsx`): the public pages set no cookie for an anonymous
  visitor (verified) until they pick a language (D-063), which sets
  `clp_public_locale`; the cookie policy lists it. A banner offers "Rechazar" and "Aceptar" with identical
  styling; the choice is stored in localStorage (`cl-consent-v1`) for 12 months
  and reopened from "Configurar cookies". The only optional content is the
  section 3 YouTube film: without consent, pressing play asks in place and no
  YouTube request is made.
- **Legal pages** `/aviso-legal`, `/privacidad`, `/cookies`: drafts in the
  landing theme, marked "Borrador pendiente de revisión legal" at the top, with
  the same footer, dialog and banner. They describe only what the code does,
  show unsupplied facts as markers outside production, and in production show
  the holding page while anything on the site is unapproved.

## Media

Derivatives are generated by `node scripts/landing-media.mjs` from the handoff
package. Nothing is sharpened or upscaled; images are full-resolution masters
that `next/image` resizes. The one clip (the opening sequence) is silent and
sits on the hero still, which serves as its poster.

A derivative whose content changes gets a new file name. `next/image` and
browsers cache optimized images by URL, so replacing bytes under an existing
name keeps serving the old image for hours.

| File | Source | Role |
|---|---|---|
| `hero-luminous-hd.webp` | hero-reveal PNG (Numadelic Circle Upscaled), 3344x1882, full-resolution master at WebP 95, served through `next/image` at quality 90 | Hero luminous (ground) layer |
| `hero-physical-v3.webp` | the founder's `hero-circle-humans-enhanced.png`, re-rendered twice (D-059 at 5460x3072, then D-060 at 3360x1888 "without the weird carpet issue"), WebP 92, served at quality 90 | Hero physical (revealed) layer; supersedes `hero-physical-v2.webp` |
| `film-poster-v2.webp` | the founder's `physical-cloud-reveal-reference.png` (D-060, 2400x1372, one participant, not the hero's circle of seven), WebP 92, `object-fit: cover` at 16:9 in the page (no manual pre-crop needed) | Section 3 film preview; supersedes `film-poster-circle.webp`, which cropped from the hero's physical photo |
| `light-sequence.mp4` | hero-reveal clip (Numadelics Gemini Omni Flash Reference to Video), native 1280x720, CRF 17, keyframes forced on the rest frames | Opening sequence |
| `film-poster-circle.webp` | the physical hero PNG, cropped 16:9 to the circle of participants | Section 3 click-to-play preview; the film itself is a YouTube embed |
| `etapa-s0.webp` to `etapa-s6.webp` | stock-images/Etapas `S0.png` to `S6.png` (mixed sizes, 3:2 to 2.33:1, on black), except S2: `etapa-s2-v4.webp` from the founder's own edit of `S2.png` (D-058, 3632x2048, landscape; superseded D-055 to D-057's earlier versions) | Section 4, one image per stage, shown whole with a feathered edge; a portrait stage image gets a narrower box on the stacked list (`.etapas-list__figure--portrait`, D-057), keyed off its own aspect ratio, so it applies automatically if one comes back |
| `join-responde-v2.webp`, `join-habla.webp`, `join-recibe.webp` | stock-images `02-responde-enhanced.jpeg` (D-055, 3632x2048, in fact a PNG), `01-habla`, `03-recibe` (1672x941, mapped to the steps by what each shows, not by file number) | Section 5, one per step |
| `participant-heart-v3.webp` | stock-images `FAQ-enhanced-image-3.jpeg` (in fact a PNG, 2048x2720, D-056), WebP 92, served at quality 90 | Section 7 (replaces D-053's `participant-heart-v2.webp`) |
| `footer-arc.webp` | stock-images `footer/footer.png` (3342x1882), top 1040px: six bodies in an arc around the fire | Section 8 (replaces `arc-top.webp` and `fire.webp` from CL circle 2) |

## Publication gate

`missingContentList()` in the content module lists every unresolved value. In
development and staging each renders as a visible marker. When `APP_ENV` is
`production` and the list is non-empty, `/` renders a holding page
(`public.holding` in `messages/*.json`) instead of the landing. The Qualtrics
URL leaves the list as soon as the open study has a screening URL.

## Missing approved content

Keys as they appear on the page. The study team must supply these before
publication (docs/09 of the handoff lists the full protocol set).

| Key | Needed |
|---|---|
| `URL_QUALTRICS` | Production Qualtrics URL, set on the study (`studies.screening_url`) |
| `SUBTITULOS_VIDEO` | Approved Spanish captions or transcript for the section 3 film (not rendered as a marker: the film has no text beneath it by design, but the key still blocks publication) |
| `DESCRIPCION_ETAPAS` | Approval of the S0 to S6 names and descriptions |
| `CONDICION_GRUPO_PROGRAMA`, `CONDICION_GRUPO_CONTROL` | Approval of the draft group text in section 6, or the approved description of what each group receives (not rendered as a marker, D-049) |
| `ETIQUETAS_GRUPOS` | Approved names of the two groups (working labels: Grupo del programa, Grupo control; not rendered as a marker, D-049) |
| `CRITERIOS` | The complete approved inclusion and exclusion criteria (section 7 lists the two the founder supplied: life-threatening illness, speaks Spanish) |
| `REGISTRO` | Public registry and study identifier |
| `EQUIPO` | Principal investigator, sponsor, participating centre |
| `DEDICACION` | Duration, number and format of sessions, location, time commitment |
| `RIESGOS` | Possible benefits, risks, discomforts and burdens |
| `CONDICION_GRUPOS` | What each group receives (FAQ) |
| `EQUIPAMIENTO` | Equipment provision, setup, return, accessibility accommodations |
| `RETIRADA` | Approved withdrawal and contact procedure |
| `CONTACTO` | Study email and telephone, alternative contact route, registry link |

Since D-051 none of the section 7 keys above (`CRITERIOS` to `CONTACTO`) is
drawn as a marker: the section carries general working answers instead. All of
them still block publication. On the landing page the only marker still drawn
is `DESCRIPCION_ETAPAS` (plus `URL_QUALTRICS` while no screening URL is set);
the legal pages draw their own keys.
| `PROTECCION_DATOS` | Approval, by the DPO or ethics committee, of the section 7 confidentiality and data protection answer |
| `PRIVACIDAD` | Legal approval of the privacy policy page (`/privacidad`) |
| `VERSION_MATERIAL` | Version and date of the recruitment material (not rendered as a marker since D-052) |
| `CONTACTO_FORMULARIO` | Where contact form messages go, with its anti-abuse and privacy work (the dialog sends nothing until then) |
| `TITULAR_WEB` | Site owner for the legal notice (LSSI-CE art. 10): name, NIF, address, email, registry details |
| `RESPONSABLE_TRATAMIENTO` | Data controller: entity, NIF, address, contact |
| `DPO` | Data Protection Officer contact |
| `BASE_JURIDICA` | Approved legal basis for each processing activity |
| `PLAZO_CONSERVACION` | Retention periods |
| `ENCARGADOS_TRATAMIENTO` | Processors, hosting region and international transfers |
| `REVISION_LEGAL` | Legal review of the three legal pages, with a version date |

Also pending, not rendered as markers: native editorial review of the English
and Galician translations (D-063), native Spanish editorial review, clinical
review of the mortality language, ethics approval of the copy, public-use
rights for the generated hero participants and the Quest 3 depiction, approval
and public-use rights for the generated images in sections 4 and 5 (the S0
image shows a video-call interface with English labels that resembles a
commercial product), protocol review of the step 3 wording (D-047), an SVG
logo.

## Deviations from the handoff, and why

- The hero's explicit reveal toggle is removed (D-054, founder request). The
  brief requires "touch: press-and-hold **or an explicit button**" and
  "reduced motion: a stable layered still with an accessible reveal toggle".
  Pointer and touch still work; keyboard-only and reduced-motion visitors now
  have no way to see the physical layer, only the light bodies. Accepted
  knowingly, not silently: the founder asked for the button removed, not
  relocated, after a first pass moved it instead.
- The hero's filled action is "Conocer el estudio" and "Comprobar si puedo
  participar" is a text link there and in the nav; both anchor to the final
  invitation rather than to Qualtrics. The master brief requires the two groups
  to be explained before the Qualtrics CTA, so the one outbound link lives after
  section 6. The label is identical everywhere.
- Eyebrows appear only on the hero and section 6 (one per three sections, per
  the design system). Section-number eyebrows and em dashes from the concept
  images are not reproduced.
- Section 3's film is an embedded YouTube video (`youtube-nocookie.com`,
  loaded only after the visitor clicks play) rather than a local silent
  derivative, with a 16:9 preview and no text beneath it. The team does not
  control the source clip's audio, so the page makes no claim about it.
  `SUBTITULOS_VIDEO` still blocks publication, since YouTube's own captions are
  not the approved Spanish transcript the brief requires ("only with Spanish
  subtitles/context"); section 3's copy carries the explanation meanwhile, so
  no understanding depends on the film.
- The hero headline is a locked twelve-word question; it sets in three lines at
  1440 and four to five on a phone.
- The optional return of the human reveal over the section 8 arc is omitted:
  the arc is the authentic "CL circle 2" frame and has no physical counterpart.
- Section 5's third step is "Asignación a tu cohorte" (cohort assignment and a
  home visit to hand over the headset), replacing the handoff's "informed
  decision" step, at the founder's direction (D-047). Section 5's photographs
  are generated images supplied by the founder, not documentary photographs.
- Section 4 shows one founder-supplied image per stage, whole and unframed on
  the black page, instead of cropped clips in a square frame (D-048). Stage
  names use the founder's `#887cde` (5.98:1 on black) at a heading line height,
  in a right column widened so every name sets on one line.
- Sections 1 to 3 share one pinned stage on desktop (the opening sequence),
  added once the coalescence footage was supplied. The eight-section order, the
  headings and the stacked (mobile, reduced motion, no-JS) reading are
  unchanged. On desktop the handoff's "light at the bottom of section 2, top of
  section 3" is the footage's own orb, not the CSS light.

## Verification

Run on 2026-09-11 against the Next dev server with installed Chrome, through
the scroll-craft harness (`shoot.mjs`, six positions per act, contact sheets in
`scrollcraft/builds/clear-light/lab/<run>/sheet.png`) and a page-specific
Playwright script (`lab/interaction/results.json` and screenshots).

| Check | Result |
|---|---|
| 1440x900, 1024x768, 768x1024, 390x844 harness | No dead scroll; every cue clears 4.5:1 at its worst frame |
| Reduced motion from first load | Pinned acts replaced by stacked lists, split and heart at end state, no breathing or flicker, hint hidden |
| No JavaScript | Stacked variants shown, cues visible, all eight headings readable |
| Pointer reveal | Window opens over the copy band (780 px at 1440), closes after the hero scrolls; toggle shows the whole still |
| Touch press-and-hold (390, CDP touch) | Opens at the finger (192 px), physical layer at 0.9, closes on release |
| Keyboard | Order: nav, hero actions, reveal button, film, FAQ summaries, CTA, footer; focus ring visible; Enter opens a FAQ item |
| *(the reveal toggle and hint referenced above were removed 2026-09-15, D-054; keyboard and reduced-motion no longer have any way to see the physical layer)* | |
| 200% zoom equivalent (720x450) and all widths | No horizontal overflow |
| Media failure (film and a stage clip blocked) | Poster stays, Spanish note appears, page continues |
| Stage clips | Only the active stage's clip plays; the rest are paused |
| Two lights, section 6 | Identical 144 px boxes, symmetric about the centre |
| Sections 2 and 3 light | One element, 360 px at 1440 (the shared token) |
| Links | Every anchor resolves; the only outbound *link* is the study's screening URL (superseded in part by D-046: section 3 now embeds a YouTube video on click, which is an outbound resource load, not a navigational link) |
| `npm run typecheck`, `lint`, `test` (277), `build` | Pass |

Not verified: a real phone (iOS decoder, Low Power Mode, real touch scrolling)
and real assistive technology.

The next-intl error about dotted `audit.action` message keys, which the dev
server logged on every route at the time of this run, was fixed later in D-045
and is gone.

**Opening sequence verified 2026-09-14 (D-046)** against the dev server with
installed Chrome and a page-specific Playwright script that reads the stage
state and the clip's playhead in real time while scrolling with the wheel. The
scroll-craft harness samples fixed scroll positions and cannot see a state
that arrives by time, so it does not cover this act.

| Check | Result |
|---|---|
| Hero at rest | Sharp at 1440 (full-resolution master, quality 90); luminous layer `transform: none` in both variants, so nothing shrinks on scroll |
| Handoff registration | Clip frame 0 against the still at 1440x900: heart lights within 1 to 4 px, mean difference 4/255 |
| One wheel notch | Clip plays at 1x: hero copy leaves at t 1.5, "El porqué" at t 4.9, rests paused on 5.25s (about 5.4s wall time); two runs agree within 0.1s |
| Next scroll | Plays to 7.92s and rests on "El qué" (2.8s) |
| Scroll back | Dip seen, "El porqué" at rest in 314 to 365 ms; to the top, hero back in 399 to 430 ms, still restored |
| Nav "El estudio", hero "Conocer el estudio" | Lands at p 0.2 and cuts to "El porqué" in 215 to 419 ms |
| Fast continuous scroll through the pin | Stage leaves showing "El qué" at rest, no errors |
| Keyboard | Nav, hero actions, "Revelar a las personas", then the film button, which cuts to "El qué" with the button in view and its panel fully opaque; Shift+Tab to the reveal toggle brings the hero back *(the reveal toggle was removed 2026-09-15, D-054; hero actions still resolve to the "inicio" state on their own, since they sit inside `.op__hero`'s own `[data-panel]`, which is what the toggle's special case existed for)* |
| Layout at rest, 1440x900 and 1024x768 | "El porqué" copy above the sunk light, "El qué" copy and film below the risen light; film 16:9 |
| Contrast at rest | Dimmest copy colour against the brightest 1% of background under the copy: 10.9:1 or better at both widths |
| Sections 4 and 5 after the heading/paragraph spacing fix | No content outside the 100svh stage at 1440 or 1024 |
| Mobile 390x844, reduced motion | Stacked variant; clip never requested (`readyState` 0); film 16:9 with no text below; no horizontal overflow |
| Section 3 film | Clicking play mounts `youtube-nocookie.com/embed/yCyCmNLmMd4`; nothing from YouTube loads before that |
| Console | No page errors |
| `npm run typecheck`, `lint`, `test` (346), `build` | Pass |

Not verified: a real phone or trackpad (momentum scrolling can reach "El qué"
faster than a wheel), Safari and Firefox (the feathered reveal uses `@property`;
without it the copy appears without the wipe), real assistive technology, and
whether YouTube honours `cc_lang_pref=es`.

**Section 5 photographs and true black verified 2026-09-14 (D-047)** with a
Playwright script at 1440x900, 1024x768 and 390x844:

| Check | Result |
|---|---|
| Three states at act progress 0.18, 0.52, 0.9 | Exactly one photograph and one description at full opacity in each, matching the step |
| Step 3's longer description | Ends 40 px above the supporting line at both desktop widths |
| Copy over the black fade | Dimmest copy colour (`--cl-muted`) against the brightest 1% of background under the column: 6.65:1 or better in every state |
| Ground | `--sc-canvas` computes `#000`, body `rgb(0, 0, 0)`; rgb(0,0,0) is 70 to 96% of the pixels in the section 6, 7 and 8 frames |
| Stacked (390x844) | 4:3 photographs cropped on the person with the left fade; no FOTOS marker; no horizontal overflow |

**Section 4 images and timeline verified 2026-09-15 (D-048)** with a Playwright
script at 1440x900, 1024x768 and 390x844, at the middle of each stage's window:

| Check | Result |
|---|---|
| Media | Exactly one image at full opacity per stage, matching it; every image shown at its own aspect ratio (1.5, 1.78, 1.79, 2.34) and inside the media area |
| Active node | Only that stage's dot grows (8 to 14 px) and brightens; every dot's centre within 0.5 px of the line |
| Travelling light | Above the nodes (z-index 2 over 1); at the progress where it reaches node S3 its centre is 0 px from the dot and it paints over it |
| Removed | No `.timeline__lit` element and no `<video>` left in the section |
| Stage names | `rgb(136, 124, 222)` in both variants, line height 1.08, every name on one line in a 312 px box at 1440 and 1024, no overlap with the image |
| Stacked (390x844) | Images whole at full width; no horizontal overflow |
| Console, `typecheck`, `lint`, `test` (346), `build` | No errors; pass |

**Section 6 split verified 2026-09-15 (D-049)** with a Playwright script at
1440x900, 1024x768, 390x844 and 1440x900 with reduced motion:

| Check | Result |
|---|---|
| Diagram half on screen at the bottom, 1.5s | Still `waiting`: both lights at the fork, no lines, group text at opacity 0 |
| Diagram wholly in view | Still waiting 250 ms in; moving 1.9s in; `done` by 4.5s |
| Mid-flight | Each light's centre on its curve; the line ends on the same curve behind it |
| At rest | Light centres equal the text column centres at every width (208/624 px of 832, 87.5/262.5 of 350); the line ends 0.15 of a diameter short of the centre, inside the haze |
| Reduced motion | `done` from load, same end geometry |
| Group text | Both names on one line at 390; lines level across columns; no marker drawn in the section |
| Console, `typecheck`, `lint`, `test` (347), `build` | No errors; pass |

Not verified: Safari and Firefox, a real phone, and a resize while the lights
are moving (the script re-lays out at the current progress, but it was not
exercised).

**Scroll-driven split, Poppins and hover re-verified 2026-09-15 (D-050)** at
1440x900, 390x844 and 1440x900 with reduced motion, stepping the diagram's top
through the viewport and back. The event checks above no longer apply.

| Check | Result |
|---|---|
| Diagram bottom below 84% of the viewport | `--k` 0, lights at the fork, no lines, text at opacity 0 |
| Halfway | `--k` 0.5, lights on their curves, each line ending 0.15 of a diameter behind its light |
| Top at 14% and above | `--k` 1, end geometry as above, text at opacity 1 |
| Scrolling back to halfway | `--k` back to 0.5, same positions as on the way down |
| Reduced motion | `--k` 1 at every position; shimmer animation `none` |
| Fonts | Eyebrow and group names compute to Poppins; eyebrow 14.4px at 1440, 13.6px at 390; closing line 32px and 21.6px |
| Hover on "Grupo control" | Only the right light brightens (`brightness(1.5)`, scale 1.14) |
| Hover growth stays centred (after the founder saw the lights drift off their lines) | Hovering either light or text: the light's centre stays at 208,292 / 624,292 at 120, 250 and 600 ms while it grows from 144 to 164 px; line ends unchanged. Position is the `translate` property, so `scale` no longer multiplies the offset |
| Console, `typecheck`, `lint`, `test`, `build` | No errors; pass |

**Reunion and section 7 copy verified 2026-09-15 (D-051)** at 1440x900, 390x844
and 1440x900 with reduced motion, scrolling from the end of the split down
1500px and back:

| Check | Result |
|---|---|
| Reading pause | Lights stay on their line ends for the first 150px after the split |
| Reunion | Lines fade out; the two lights descend level (same height at every step) and converge on the section 7 light's point |
| Handoff | At arrival the travelling lights go to opacity 0 and the section 7 light appears at the same point and size (144px at 1440, 104px at 390) |
| Heart | `--jt` rises 0 to 1 only after the handoff; the light shrinks to 40px (29px at 390) and fades |
| Reverse | Scrolling back to 700px and 260px reproduces the same states as on the way down |
| Reduced motion | No `data-journey`; lights stay at their line ends; section 7 at its CSS end state |
| Section 7 copy | No markers in the section; every question has 2 or 3 answers; criteria heading in Poppins |
| Console, `typecheck`, `lint`, `test` (350), `build` | No errors; pass |

Not verified: momentum scrolling on a real trackpad or phone, where the
travelling lights briefly overlap the group text on the way down.

**Footer, contact, consent and legal pages verified 2026-09-15 (D-052)** at
1440x900 and 390x844 with a fresh browser profile:

| Check | Result |
|---|---|
| First load | Banner shown; no cookies set; no YouTube request |
| Reject | Banner closes; `cl-consent-v1` stored with `thirdParty: false`; "Configurar cookies" reopens it |
| Film without consent (390) | Play shows "Para ver el vídeo, acepta el contenido de YouTube."; no iframe, no YouTube request |
| Buttons | `.cl-btn` background is the lavender gradient |
| Contact dialog | Opens from section 8 and from the footer without changing the URL hash; backdrop `blur(12px)`; panel centred (720,450 at 1440; 195,422 at 390); submit shows the unavailable notice and makes no non-GET request; closes on an outside click and on Escape |
| Footer | Seven links as listed above; pause button labelled "Pausar animación"; no team access |
| Section 7 photo | Served from `participant-heart-hd.webp` at quality 90 |
| Legal pages | All three return 200 with no page errors; markers: aviso legal 2, privacidad 6, cookies 1 |
| Layout | No horizontal overflow at either width |
| `typecheck`, `lint`, `test` (356), `build` | Pass |

Not verified: Safari and Firefox (`<dialog>` and `::backdrop` blur), a real
screen reader in the dialog, and any legal adequacy of the pages.

**Mobile pass and the scroll lock verified 2026-09-16 (D-061)**, *the lock
itself since replaced by the threshold hold, D-062*, in Chrome at
390x844 and 430x844 (touch), 1440x900, 1440x900 with reduced motion, and with
JavaScript off:

| Check | Result |
|---|---|
| Hero frame on a phone | 8:7 box, crop anchored right, both layers on one `object-position`. Rendered pixels measured at 360, 390, 430, 700 and 860 wide: the bodies sit 2.2 to 2.7% from the left edge and 2.3 to 2.6% from the right, filling ~95% of the box |
| Reading light | `data-reading="live"` on mount; blocks light in reading order (0, then 2, then 4 of 6) as the light reaches them and stay lit; light fades in and out with the track and passes behind the copy |
| Etapas and steps | Each item fades up once on entry (`sc-in`), none re-hides |
| Onboarding cards | Photograph covers the card, copy sits over it, numeral first |
| Section 6 copy | Body measure 300px inside a 390px viewport, down from full width |
| Markers | None drawn anywhere on the landing page; `DESCRIPCION_ETAPAS` still in the gate |
| Scroll lock, first transition | Holds at one position through six further wheel notches, releases at `data-state="porque"` with the copy fully wiped in |
| Scroll lock, second transition | Holds again, releases at `data-state="que"`; the page then scrolls freely (900px) |
| Scroll up during a lock | Releases at once and returns to the top |
| Reduced motion | No lock (700px scrolled freely), no reading light, all copy visible |
| No JavaScript | Every reading block, stage item and step card at opacity 1 |
| Layout | No horizontal overflow at any width; no console errors |
| `typecheck`, `lint`, `test` (361), `build` | Pass |

Not verified: a real phone (the touch branch of the lock is exercised only
through Chrome's touch emulation, and the pinned variant it guards does not run
at phone widths anyway), Safari and Firefox.

## Open questions

- Should this copy become versioned study content managed from the team
  dashboard rather than a typed module? Today it is code, reviewed through pull
  requests, because it is recruitment material rather than session content.
- Should `/participar` remain as a separate hand-off page now that the landing
  carries the same explanation and link?
