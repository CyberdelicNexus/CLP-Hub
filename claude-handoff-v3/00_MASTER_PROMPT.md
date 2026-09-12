# MASTER PROMPT — aNUma Clear Light RCT Landing Page

You are the lead design engineer responsible for building the Spanish aNUma Clear Light randomized controlled trial recruitment landing page.

Work in the current target repository. The design handoff package is located at:

C:\Users\JEMA\Pictures\Image Vault\Anuma\CLP_Hub\claude-handoff-v3

Do not implement the website inside the handoff package. Copy production assets into the target repository using appropriate project-local paths.

## 1. Use the two installed skills

Use both installed Claude skills together:

- **Taste** owns visual direction, typography, hierarchy, spacing, responsive composition, accessibility, anti-generic decisions and final visual restraint.
- **Scroll Craft** owns scrollytelling structure, the continuous light narrative, sticky states, scroll triggers, touch/reduced-motion equivalents and browser verification.

Before planning or coding, locate and read the complete installed instructions for both skills. Report their actual registered names and capabilities. Do not assume a specific API, engine folder, page-grammar name, custom property or verification harness unless the installed skill explicitly provides it.

If the skills conflict, use this authority order:

1. Approved study protocol and public recruitment content
2. Participant comprehension, voluntary choice and accessibility
3. `docs/07_LOCKED_DECISIONS.md`
4. `docs/01_STORYBOARD_V3_ES.md`
5. `docs/02_DESIGN_SYSTEM_RCT_ES.md`
6. Taste
7. Scroll Craft

No creative or technical convenience may override a higher layer.

## 2. Read the package in this order

Read every file completely before implementation:

1. `docs/07_LOCKED_DECISIONS.md`
2. `docs/01_STORYBOARD_V3_ES.md`
3. `docs/08_CONTENT_MODEL_ES.md`
4. `docs/02_DESIGN_SYSTEM_RCT_ES.md`
5. `docs/03_MEDIA_MOTION_DIRECTION.md`
6. `docs/04_LIVING_SIGNAL_INTERACTION.md`
7. `docs/10_ASSET_MANIFEST.md`
8. `docs/09_MISSING_STUDY_CONTENT.md`
9. `docs/11_ACCEPTANCE_CHECKLIST.md`
10. `docs/12_IMPLEMENTATION_ORDER.md`
11. `docs/06_BRAND_DESIGN_SYSTEM.md`

Use `references/brand-discovery/analysis.html` and its companion files for deeper brand ethos only. Ignore V1/V2 storyboards or visual concepts outside this package.

## 3. Project definition

- Brand: aNUma
- Experience: Clear Light
- Page: recruitment landing page for a randomized controlled trial
- Public language: Spanish only
- Audience: potential participants and relevant referrers in Spain, subject to approved protocol wording
- Primary outcome of the page: informed visitors open the approved Qualtrics interest/eligibility questionnaire
- Primary CTA: `Comprobar si puedo participar`
- Qualtrics URL: `[FALTA CONTENIDO APROBADO: URL_QUALTRICS]`
- Theme: one locked dark theme
- Interface accent: Living Teal
- Mobile priority: high
- Stack: inspect and preserve the current repository. If the repository is empty, use its intended platform defaults; do not introduce a new framework without need.

This page must explain, recruit and feel numadelic. It must not simulate the intervention, promise an outcome, use urgency or pressure participation.

## 4. Visual north star

The aesthetic is not generic psychedelic technology. It is a restrained, intimate encounter between real human bodies and indistinct bodies of light.

Required visual qualities:

- Near-black charcoal space
- Soft, low-resolution blue-violet presences
- Small warm cream lights at the heart
- One irregular orange fire light only in the final invitation and approved source media
- Living Teal reserved for interface actions and fine structural cues
- Calm wide grotesk typography
- Generous negative space
- Documentary humanity beneath the numadelic layer

Reject:

- Crisp plasma people
- Detailed energy anatomy
- Generic galaxies, stars, sacred geometry or spiritual symbols
- Purple mesh gradients
- Decorative gradient text
- Glassmorphism and repetitive card grids
- Fake study interfaces, metrics, testimonials, credentials or badges
- Stock meditation imagery
- More than one engineered visual climax

## 5. The eight-section flow is locked

Build these eight sections in this order. Use the corresponding image in `assets/section-references/` as the visual target. The images are design references, not flat webpage backgrounds and must never be shipped as screenshots of the UI.

### Section 1 — Hero

Reference: `assets/section-references/01-hero-soft-reveal.png`

- Identify the page as a research study immediately.
- Show seven soft light bodies in a shallow arc.
- Implement the pointer reveal using:
  - `assets/hero-reveal/hero-luminous-soft-v3.png`
  - `assets/hero-reveal/hero-physical-quest3-v3.png`
- Register both layers to the exact same container, crop and `object-position`.
- Use a large feathered alpha/opacity mask following the pointer.
- Physical layer rises toward approximately 90% opacity inside the mask.
- Luminous haze remains approximately 20–35% visible inside the reveal.
- Do not create a hard circular portal, outline, magnifying lens or clipped photograph.
- Revealed people must visibly wear Quest 3 headsets and hold Quest 3 controllers.
- Touch: press-and-hold or explicit reveal control.
- Reduced motion: stable layered still with an accessible reveal toggle.

### Section 2 — El porqué

Reference: `assets/section-references/02-why-centered-no-trail.png`

- Center all copy.
- One light settles half outside the bottom center.
- Absolutely no trail, path, curve, connector or secondary right-side text.
- Define one shared responsive light-size token used unchanged in Section 3.

### Section 3 — El qué

Reference: `assets/section-references/03-what-horizontal-video.png`

- The same light moves to half outside the top center without changing size.
- Place copy left and video right inside one centered horizontal container.
- Both columns are vertically centered on the same axis.
- The desktop video must not drop below the copy.
- Use approved supplied source media or the referenced YouTube film only with Spanish subtitles/context.
- No essential understanding may depend on English audio.

### Section 4 — Etapas del Programa

Reference: `assets/section-references/04-program-stages-rebalanced.png`

- Keep title upper-left.
- Center the active experiential image/video.
- Place active-stage title and description bottom-right above the timeline.
- Timeline stages: S0 Preparación, S1 Orientación, S2 Cuerpos de Luz, S3 Vida, S4 Más Allá del Cuerpo, S5 Ofrenda, S6 Integración Grupal.
- The small living light travels through S0–S6 as the visitor scrolls.
- Each stage reveals one short description and one approved still/clip.
- No dead scroll and no essential information hidden in a scrub state.

### Section 5 — Cómo incorporarse al estudio

Reference: `assets/section-references/05-how-to-join-compact-steps.png`

- Three sticky-scroll states: questionnaire, conversation, informed decision.
- Use compact 01/02/03 numerals.
- Align each number and label on one baseline.
- Align the active description to the label column.
- Cross-fade one documentary visual per state.
- Keep the light resting at the top-right during the sequence.
- This is the application/onboarding process, not the S0–S6 program journey.

### Section 6 — Asignación al azar

Reference: `assets/section-references/06-random-assignment-two-groups.png`

- Exactly two groups: program and control.
- One light divides into two identical lights.
- Both branches must have equal size, brightness, distance, motion, copy space and hierarchy.
- Never make the program group look preferable.
- Replace working labels only when approved protocol wording exists.

### Section 7 — Elegibilidad y preguntas

Reference: `assets/section-references/07-eligibility-and-faq.png`

- Combine eligibility criteria and FAQ.
- Documentary VR participant remains on the left.
- The traveling light dissolves into the participant's heart center.
- Keep criteria, possible risks/benefits, equipment, voluntary participation, withdrawal, contact and registry information easy to find.
- Do not invent eligibility criteria.

### Section 8 — Invitación final

Reference: `assets/section-references/08-final-invitation-minimal-fire.png`

- Preserve the restrained centered layout exactly in spirit.
- Small blurred body arc at the top.
- One small irregular orange fire light at its center.
- Centered headline, consent clarification, one Qualtrics CTA, contact link and quiet footer.
- The hero's feathered human reveal may return over the top arc, but the default state remains clean.
- No emotional crescendo, giant orb or oversized people.

## 6. Content rules

- Use the working Spanish copy from `docs/08_CONTENT_MODEL_ES.md` for the prototype.
- Never invent protocol facts.
- Any unknown factual value must render only in non-production development as `FALTA CONTENIDO APROBADO` and be listed in `docs/09_MISSING_STUDY_CONTENT.md`.
- Do not copy the team, pricing, US shipping text or English-first videos from the old pilot page.
- Showing interest is not consent, enrollment or a guaranteed place.
- Possible personal benefit is never guaranteed.
- The two randomized groups must be explained before the Qualtrics CTA.

## 7. Asset rules

- Read `docs/10_ASSET_MANIFEST.md` before copying anything.
- Concept images define composition only; rebuild layouts with semantic HTML and real components.
- Copy selected production assets into the project's own `public`/asset pipeline with clear names.
- Preserve original source media. Generate optimized derivatives for the web.
- Do not upscale low-resolution Clear Light footage into fake sharpness. Its softness is part of the aesthetic.
- Provide posters for every video and graceful media-failure fallbacks.
- Do not hotlink local absolute Windows paths in production code.

## 8. Implementation behavior

Proceed autonomously through these passes without waiting for routine approval:

1. Repository, asset and installed-skill audit
2. Static semantic foundation
3. Responsive composition
4. Hero reveal
5. Section 2–3 traveling-light handoff
6. S0–S6 stage scrollytelling
7. Three-step onboarding scrollytelling
8. Two-group randomization transition
9. Heart dissolution and final invitation
10. Taste polish
11. Accessibility, reduced-motion and touch pass
12. Browser verification and production build

Stop only if the target repository is inaccessible, the project cannot run, or a missing protocol decision makes it unsafe to publish factual content. Continue with clearly marked development placeholders when they do not change the approved design.

Technical preferences:

- Essential content stays in semantic document flow.
- Prefer DOM, CSS transforms, opacity, masks and supplied media.
- Use the verified Scroll Craft patterns and existing project dependencies.
- Do not add Three.js/WebGL unless the approved effect cannot be achieved with the existing stack and supplied media.
- Avoid raw window scroll listeners when an existing motion/observer system is available.
- Clean up observers, timelines and media listeners.
- Motion must never obscure text, intercept CTA clicks or cause scroll trapping.

## 9. Verification gates

Before completion, verify every item in `docs/11_ACCEPTANCE_CHECKLIST.md`.

At minimum, test:

- Desktop: 1440px and 1024px
- Tablet: 768px
- Mobile: 390px
- Keyboard-only navigation
- 200% zoom
- Reduced motion from first load
- Touch alternatives
- Loading and media-failure states
- Section entrance, midpoint and exit
- No dead scroll or stuck pinned state
- Equal treatment of program and control groups
- Quest 3 reveal without a hard portal edge
- Shared light diameter across Sections 2 and 3
- All CTA and contact links
- Production build, lint and typecheck using the repository's real scripts

Do not claim a check passed unless it was run and observed.

## 10. Completion report

When finished, report:

- What was built
- Exact files changed
- Exact commands and checks run
- Screenshots/contact sheet produced
- How Taste influenced the final visual decisions
- How Scroll Craft was used and which verified APIs/patterns it supplied
- Performance decisions and media derivatives
- Reduced-motion and touch behavior
- Remaining items from `docs/09_MISSING_STUDY_CONTENT.md`
- Any deployment blocker

Begin by reading the two installed skills and the handoff package. Then audit the target repository and proceed through the full build.
