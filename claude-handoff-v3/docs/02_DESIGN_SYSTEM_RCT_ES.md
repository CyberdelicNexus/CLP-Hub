# aNUma RCT Recruitment Landing Page Design System

Version 1.2

Purpose: a Spanish-language recruitment landing page for a randomized controlled trial that explains the study clearly, recruits suitable participants ethically, and gives visitors a restrained numadelic experience before they enter the study process.

This document supersedes the broader landing-page recommendations in `ANUMA_LANDING_PAGE_DESIGN_SYSTEM.md` for this specific page.

**V3 narrative override:** read `ANUMA_RCT_STORYBOARD_V3_ES.md` and `design-review/section-concepts-v3/README.md` before implementation. They supersede all earlier storyboard and image-set decisions. The current page has eight sections, two equal randomized groups, `Etapas del Programa` with S0–S6, eligibility merged with FAQ near the end, soft reference-matched light bodies, and Quest 3 hardware in the human reveal. All other ethics, accessibility, token and implementation rules in this document remain active.

For implementation with Claude's Taste and Scroll Craft skills, use `CLAUDE_TASTE_SCROLLCRAFT_RCT_WORKFLOW.md`. Its phased prompts supersede the generic one-shot implementation prompt in Section 22 of this document.

For the supplied VR clips, participant composite, and the approved roles of Canvas UI Liquid and VGPU Flare, also read `ANUMA_RCT_MEDIA_MOTION_ART_DIRECTION.md`. Its real-media sequence supersedes the generic particle-only description of the optional micro-experience below.

## 1. Design read

Reading this as: a high-trust clinical-research recruitment page for Spanish-speaking potential participants and referrers, with a lucid, humane, numadelic visual language, leaning toward a custom dark-first design system that makes research uncertainty unusually clear.

Design dials:

- `DESIGN_VARIANCE: 5/10` - distinctive and asymmetric, but highly predictable around study information
- `MOTION_INTENSITY: 5/10` - perceptually alive, never disorienting or coercive
- `VISUAL_DENSITY: 4/10` - concise first layer with progressive disclosure for detail

Primary conversion goal:

> A suitable visitor starts the approved eligibility or expression-of-interest process.

Primary CTA in Spanish:

> Comprobar si puedo participar

Use this exact CTA label in the hero, sticky navigation, eligibility section, and final invitation. Do not introduce synonyms for the same action.

Secondary action:

> Entender el estudio

## 2. Strategic premise

The page must perform three jobs in this order:

1. Orient: explain that this is research, what question is being studied, and who is being recruited.
2. Reassure: explain what participation, randomization, privacy, possible discomfort, and voluntary consent mean.
3. Invite: offer a low-pressure path to check eligibility or request information.

The numadelic experience is the emotional layer around these jobs. It must not replace them.

Core idea:

> Una experiencia inmersiva para explorar una pregunta abierta.

The page should leave visitors feeling curious, respected, calm, and fully informed. It should not leave them feeling sold to, diagnosed, dazzled, or promised a result.

## 3. What to preserve and retire from the older page

Reference audited: `https://www.intangiblerealitieslab.org/projects/numadelic`

### Preserve

- Spanish as the public language
- The laboratory's scientific credibility
- Real project footage and recognizable numadelic visual material
- The human importance of the research question
- Participant voices from earlier work, but only with approval and precise labeling
- Visible research partners and funders when current and accurate

### Retire

- A long research essay before the visitor learns how to participate
- A headline framed as a broad health-improvement claim
- Dense paragraphs with no scannable study summary
- Recruitment status and CTA buried below several screens
- A contact form that does not explain what happens after submission
- Testimonials presented without clear study context
- Describing an earlier study as if it were evidence for the current trial
- Unexplained randomization, control condition, time commitment, risks, privacy, or withdrawal rights
- Generic laboratory navigation competing with the recruitment goal
- Imagery that reads as an abstract purple blur rather than a human experience
- Translation errors, inconsistent terminology, and unexplained acronyms

No sentence, quote, statistic, funder, partner, or eligibility condition from the older page should be carried into the new page unless the current protocol team approves it.

## 4. Ethical design contract

The landing page is recruitment material. It is not informed consent, clinical advice, treatment, or evidence that the intervention works.

### Required principles

- State that the project is a research study before describing the experience.
- Frame the study objective as a question or evaluation, not a promised outcome.
- Make the randomized nature of the trial visible before a visitor submits interest.
- Explain the control or comparison condition in plain Spanish once protocol wording is approved.
- Say that showing interest does not enroll the visitor and does not constitute consent.
- Say that participation is voluntary and that a person may decline or withdraw according to the approved protocol without penalty.
- Distinguish screening, informed consent, enrollment, randomization, intervention, and follow-up.
- Present possible benefits as uncertain. Present foreseeable burdens and risks with equal visual dignity.
- Link the public registry record and show the approved study identifier.
- Show the responsible investigator, sponsor, participating site, ethics body, contact route, and recruitment status when approved.
- Submit the final web copy, media, interactions, screener, and response-handling process to the relevant ethics review before publication.

### Prohibited practices

- Manufactured urgency or scarcity
- Countdown timers
- Outcome guarantees
- Therapeutic language unless the approved protocol supports it
- A CTA that says `Empieza tu transformación`, `Cúrate`, `Mejora tu salud mental`, or similar
- Hiding the possibility of assignment to a comparison or control group
- Making compensation visually dominant
- Asking for medical information in a general marketing form
- Sending screening or health data to advertising pixels, generic analytics, session replay, or local storage
- Treating an expression of interest as consent
- Using motion, sound, or emotional testimony to pressure participation

## 5. Protocol content gate

Claude Code must not invent any value represented by the following tokens. Each must come from the current approved protocol or study team.

```text
[NOMBRE_PUBLICO_DEL_ESTUDIO]
[TITULO_CIENTIFICO]
[PREGUNTA_PRINCIPAL_EN_LENGUAJE_CLARO]
[POBLACION_OBJETIVO]
[EDAD_O_RANGO]
[CRITERIOS_DE_INCLUSION_APROBADOS]
[CRITERIOS_DE_EXCLUSION_APROBADOS]
[PAIS_Y_CIUDADES]
[CENTROS_PARTICIPANTES]
[NUMERO_DE_VISITAS]
[DURACION_TOTAL]
[DURACION_POR_SESION]
[INTERVENCION]
[COMPARADOR_O_CONTROL]
[METODO_DE_ALEATORIZACION_EN_LENGUAJE_CLARO]
[SEGUIMIENTO]
[RIESGOS_Y_MOLESTIAS]
[BENEFICIOS_POTENCIALES]
[COSTES]
[COMPENSACION_O_REEMBOLSO]
[PRIVACIDAD_Y_RESPONSABLE_DE_DATOS]
[INVESTIGADOR_RESPONSABLE]
[PROMOTOR]
[CEI_O_CEIM]
[NUMERO_DE_APROBACION]
[REGISTRO_PUBLICO]
[IDENTIFICADOR_DEL_ESTUDIO]
[EMAIL_Y_TELEFONO]
[ESTADO_DE_RECLUTAMIENTO]
[FECHA_DE_VERSION_DEL_MATERIAL]
```

If a required value is missing, render an internal development placeholder such as `FALTA CONTENIDO APROBADO` and prevent production deployment. Never expose invented public copy.

## 6. Brand role for this page

### The archetype

The Intimate Explorer is expressed through:

- Lover: respectful human connection
- Explorer: curiosity toward an open question
- Sage: clear scientific method
- Mystic: sensory wonder, held in strict restraint

For this page, Sage has more operational weight than on a general aNUma brand page because the visitor is making a research-participation decision.

### Experience principles

1. Clarity before atmosphere.
2. Choice before persuasion.
3. Uncertainty before promise.
4. Human presence before technology.
5. Context before immersion.
6. Beauty without concealment.

### Decision hierarchy

When a design choice conflicts with a participant-information need, decide in this order:

1. Safety and comprehension
2. Voluntary choice
3. Accessibility
4. Research trust
5. Recruitment conversion
6. Numadelic expression

## 7. The experiential concept: The Luminous Threshold

The page should behave like a quiet threshold into the numadelic world.

The visitor begins in a dark field containing a dispersed living-light presence. As the visitor moves through the page, the light slowly gathers, separates into two clearly labeled paths when randomization is explained, reconnects around evidence and human testimony, and resolves into a calm point of invitation near the final CTA.

This creates a page-level narrative:

```text
Curiosity -> Orientation -> Choice -> Assignment -> Experience -> Reflection
```

### Non-negotiable distinction

The landing-page visual experience is not the trial intervention and must never be described as a preview of its effect.

If the page includes an interactive visual module, label it:

> Aproximación visual al universo de aNUma. No forma parte de la intervención del estudio.

### How to make the page numadelic

- Use authored light-particle footage or an optimized canvas field as an ambient layer.
- Keep recognizable human silhouettes, hands, breath, or relational distance in the imagery.
- Let particles coalesce slowly around content rather than explode from it.
- Use large dark negative spaces as intervals between information clusters.
- Allow one optional 12-18 second visual moment that visitors can start, pause, skip, and replay.
- Keep all essential copy visible and readable without playing the experience.
- Never autoplay audio.
- Never require interaction to reach study facts or the recruitment CTA.

### The optional micro-experience

One section may offer a bounded sensory interaction:

- Initial state: a dispersed field of points with a quiet `Iniciar experiencia visual` control.
- Active state: points gather into two presences, briefly connect, and return to rest.
- Duration: 12-18 seconds.
- Audio: off by default. If approved audio exists, the visitor explicitly enables it.
- Exit: `Saltar` and `Pausar` remain visible throughout.
- Reduced motion: replace the sequence with one still image and the label `Versión estática`.
- Copy: no therapeutic suggestion, guided breathing claim, or promised emotional state.

The primary recruitment CTA must remain visually dominant over this optional experience control.

## 8. Color system

Use one locked dark theme. Do not alternate light and dark sections.

Living Teal is the only interactive accent. Experience media may contain a restrained spectrum because the light-energy representation is content, not interface chrome.

```css
:root {
  color-scheme: dark;

  --color-void: #080c0d;
  --color-void-raised: #0d1416;
  --color-surface: #121b1d;
  --color-surface-soft: #172225;

  --color-text: #f2f5ef;
  --color-text-secondary: #b4bfba;
  --color-text-muted: #879590;

  --color-accent: #79ded4;
  --color-accent-strong: #9ce9df;
  --color-accent-ink: #071514;
  --color-accent-wash: rgb(121 222 212 / 0.09);

  --color-line: rgb(212 232 225 / 0.14);
  --color-line-strong: rgb(212 232 225 / 0.26);
  --color-focus: #9ce9df;

  --color-info: #9fc8e7;
  --color-caution: #edbd7c;
  --color-error: #ee9790;

  --shadow-low: 0 18px 56px rgb(0 18 20 / 0.24);
  --shadow-high: 0 34px 100px rgb(0 18 20 / 0.38);
}
```

Rules:

- Never use pure black or pure white.
- Never use red for ineligibility. Ineligibility is not user error.
- Reserve amber for genuine caution or important burden information.
- Reserve rose for form errors or urgent safety information.
- Do not use colored status dots.
- Do not use gradients on text, buttons, borders, or study facts.
- Do not use visual warmth to imply likely benefit.

## 9. Typography and Spanish language rules

### Fonts

Use Manrope Variable for the full interface. Use IBM Plex Mono only for real study identifiers, version dates, registry references, and evidence labels.

Optional: Newsreader may appear in one participant quotation or reflective transition. Do not use it inside the main headline and do not mix type families within a sentence.

```css
--font-sans: "Manrope Variable", "Manrope", "Segoe UI", sans-serif;
--font-mono: "IBM Plex Mono", Consolas, monospace;

--text-display: clamp(3.25rem, 6.5vw, 6rem);
--text-h1: clamp(2.75rem, 5.3vw, 5.15rem);
--text-h2: clamp(2.1rem, 3.8vw, 3.75rem);
--text-h3: clamp(1.45rem, 2.2vw, 2.25rem);
--text-lead: clamp(1.08rem, 1.4vw, 1.3rem);
--text-body: 1rem;
--text-small: 0.875rem;
--text-label: 0.6875rem;
```

### Spanish copy rules

- Set `<html lang="es">`.
- Use plain Spanish suitable for a broad public audience.
- Define `ensayo controlado aleatorizado` the first time, then use `estudio` where precision is not lost.
- Prefer `asignación al azar` over unexplained `aleatorización` in participant-facing copy.
- Avoid English UX labels, research jargon, and unexplained abbreviations.
- Use `tú` consistently unless the ethics-approved materials require `usted`.
- Use inclusive constructions that read naturally. Do not use `@`, `x`, or forced duplications that reduce readability.
- Keep paragraphs to 45-75 words and use progressive disclosure for protocol detail.
- Preserve Spanish punctuation and accents in buttons, labels, alt text, and metadata.
- Do not use em dash or en dash characters in visible copy. Restructure the sentence or use a standard hyphen.
- Do not translate approved study names, instrument names, or legal entities unless an official translated form exists.

## 10. Shape, spacing, and grid

Shape roles:

- Experience media and identity motif: circular or organically rounded
- Information surfaces and form containers: 16px radius
- Buttons and compact controls: full pill

```css
--radius-surface: 16px;
--radius-control: 999px;

--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;
--space-16: 4rem;
--space-24: 6rem;
--space-32: 8rem;

--container: 82.5rem;
--content-measure: 64ch;
--gutter: clamp(1.25rem, 4vw, 4rem);
--section-space: clamp(5.5rem, 9vw, 8.5rem);
```

Layout rules:

- Use a 12-column desktop grid and a maximum page width of 1320px.
- Use a 5/7 hero split, with copy left and living-light media right.
- Collapse to one strict column below 768px.
- Keep decision-critical content in a 64ch reading measure.
- Use negative space and sparse hairlines before reaching for cards.
- Do not use a centered manifesto hero.
- Do not use three equal feature cards.
- Do not repeat the same image-text split for more than two consecutive sections.

## 11. Motion system

Motion communicates gathering, attention, assignment, and reflection.

```css
--ease-presence: cubic-bezier(0.16, 1, 0.3, 1);
--ease-breath: cubic-bezier(0.45, 0, 0.55, 1);
--duration-fast: 180ms;
--duration-base: 420ms;
--duration-reveal: 720ms;
--duration-breath: 7600ms;
```

Approved motion:

- One calm hero reveal using opacity and 16-20px translation
- 1-2% scale breathing in the main light form
- Particles gathering into a human or relational field
- One clear separation into two branches while explaining group assignment
- Once-only section reveals
- 1px hover lift and 0.98 active scale on buttons

Prohibited motion:

- Fast particle storms
- Psychedelic tunnels
- Glitch, scan lines, text scramble, or hyperspace
- Scroll-jacking
- Mouse-following light blobs
- Custom cursors
- Pulsing recruitment CTA
- Animated countdowns
- Autoplay audio
- Motion that continues under reduced-motion preferences

Every animation must stop or become static under `prefers-reduced-motion: reduce`.

## 12. Page architecture

### 1. Minimal recruitment navigation

Use a single-line navigation no taller than 68px.

Recommended links:

- El estudio
- Participación
- Seguridad
- Equipo
- Preguntas

Right side:

- `Comprobar si puedo participar`

Do not reproduce the full laboratory website navigation. Link back to the laboratory in the footer.

### 2. Hero: the study question

Maximum four content elements:

1. One factual eyebrow
2. Headline
3. Support copy
4. Primary and secondary actions

Working Spanish structure:

Eyebrow:

> Estudio de investigación en [PAIS_Y_CIUDADES]

Headline:

> ¿Puede una experiencia inmersiva influir en [PREGUNTA_PRINCIPAL_EN_LENGUAJE_CLARO]?

Support:

> Buscamos [POBLACION_OBJETIVO] para un estudio con asignación al azar de [DURACION_TOTAL].

Primary CTA:

> Comprobar si puedo participar

Secondary CTA:

> Entender el estudio

The headline must remain a question unless the current evidence and approved recruitment copy justify a factual statement.

Hero media:

- A real person or two people visibly transitioning into a restrained light-energy field
- Deep charcoal environment, not a generic galaxy
- Subject positioned right of center
- No headset glamour shot
- Motion slow enough that copy remains dominant

### 3. Immediate study facts

Place this directly under the hero. It should be visible before any long explanation.

Show only approved values:

```text
Para quién        [POBLACION_OBJETIVO]
Dónde             [PAIS_Y_CIUDADES]
Dedicación        [NUMERO_DE_VISITAS] y [DURACION_TOTAL]
Asignación        Al azar entre [INTERVENCION] y [COMPARADOR_O_CONTROL]
Estado            [ESTADO_DE_RECLUTAMIENTO]
Identificador     [IDENTIFICADOR_DEL_ESTUDIO]
```

This is one structured facts band, not six floating cards.

Directly below it, include:

> Mostrar interés no te compromete a participar. El equipo te explicará el estudio antes de pedir tu consentimiento.

### 4. The research question

Explain:

- What the researchers want to learn
- Why the question matters
- What is already known
- What remains unknown
- Why a randomized comparison is useful

Recommended heading:

> Lo que queremos comprender

Do not lead this section with a claim about what the intervention improves.

### 5. Eligibility overview

Recommended heading:

> Este estudio puede ser para ti si...

Show three to five approved inclusion criteria. Place the approved exclusion criteria or reasons to contact the team in an accessible disclosure.

Use a large eligibility summary beside one calm portrait or relational image. Avoid a checklist that looks like a diagnosis tool.

CTA:

> Comprobar si puedo participar

If professional referrals are accepted, use a lower-weight text link:

> Información para profesionales

### 6. What participation involves

Use a continuous vertical or curved timeline. Label actions by their meaning, not as generic numbered steps.

Suggested labels:

- Comprueba
- Habla con el equipo
- Decide con información
- Participa
- Completa el seguimiento

Each point must show approved time commitment, location, people involved, and whether a headset is used.

### 7. What assignment at random means

Recommended heading:

> Por qué hay más de un grupo

Working copy pattern:

> Si participas, la asignación a [INTERVENCION] o [COMPARADOR_O_CONTROL] se realizará al azar. Esto permite comparar los grupos de forma rigurosa. [METODO_DE_ALEATORIZACION_EN_LENGUAJE_CLARO]

Use two equal, neutrally styled branches after one shared entry point. Do not make the intervention branch brighter, larger, or more desirable than the comparison branch.

Explicitly state whether participants know their group, whether crossover is possible, and what each group receives, but only from approved protocol content.

### 8. The numadelic experience

Recommended heading:

> Qué significa una experiencia numadélica

Explain the design language, the role of immersion, and what a participant physically does. Show real or approved simulated footage.

Required clarity:

- Whether a VR headset is used
- Approximate session duration
- Whether other people are present
- Who facilitates or supervises
- What a participant can do if uncomfortable
- That the visual page experience is not the intervention

This section may contain the optional 12-18 second micro-experience.

### 9. Possible benefits, burdens, and risks

Recommended heading:

> Lo que debes considerar

Use a balanced two-part layout:

```text
Beneficios posibles y no garantizados | Riesgos, molestias y dedicación
```

Both sides receive equal visual weight. Do not use positive imagery on one side and warning styling on the other.

Include the approved process for stopping, reporting discomfort, and receiving support.

### 10. Evidence and research team

Recommended heading:

> Quién realiza el estudio y cómo se supervisa

Show:

- Investigator and research team
- Sponsor
- Participating centers
- Ethics review
- Public registry link
- Funder, if current
- Relevant prior publication links

Use real logos and real portraits. Do not create fake credentials, study badges, seals, or statistics.

Prior results and participant quotations must be labeled clearly:

> Testimonio de un estudio anterior. No representa un resultado garantizado del estudio actual.

Quotes should be short, attributed according to the approved consent, and never placed immediately beside the primary CTA.

### 11. Questions and objections

Use an accessible accordion for six to ten approved questions:

- ¿Qué significa que la asignación sea al azar?
- ¿Puedo elegir el grupo?
- ¿Qué ocurre si cambio de opinión?
- ¿Tiene algún coste participar?
- ¿Hay compensación o reembolso?
- ¿Qué molestias puede causar la realidad virtual?
- ¿Cómo se protegen mis datos?
- ¿Qué ocurre después de enviar mis datos?
- ¿Con quién puedo hablar antes de decidir?
- ¿Dónde puedo consultar el registro del estudio?

Do not hide eligibility, risks, or withdrawal rights only inside the accordion.

### 12. Recruitment invitation

Recommended heading:

> Infórmate antes de decidir

Support:

> Responde unas preguntas iniciales o habla con el equipo. Mostrar interés no implica consentimiento ni garantiza la inclusión.

CTA:

> Comprobar si puedo participar

Also show the approved phone and email contact for visitors who prefer not to use the form.

### 13. Footer

Include:

- Full legal study and institution names
- Responsible investigator
- Study identifier and registry link
- Ethics body and approval identifier when approved for public display
- Privacy notice
- Accessibility statement
- Contact details
- Version and date of the recruitment material
- Link back to Intangible Realities Laboratory

## 13. Recruitment form or screener

### Preferred conversion flow

Use a two-stage process:

1. Public eligibility overview with no sensitive data collection.
2. Secure, approved screener or contact route after the visitor chooses to continue.

### First-contact form

Collect only the minimum approved information. A typical non-medical first contact might include:

- Nombre
- Forma de contacto preferida
- Email or phone
- Best contact time, only if operationally needed
- Confirmation that the person wants information about the study

Do not add diagnosis, medication, mental-health history, medical record uploads, or free-text health narratives to a generic website form.

### Required form context

Before the submit button, explain:

- Who receives the information
- Why it is collected
- How the team will respond
- Whether it is stored and for how long
- That submission is not consent or enrollment
- Link to the approved privacy notice

Submit label:

> Enviar mi solicitud de información

Success state:

> Hemos recibido tu solicitud. Esto no significa que ya formes parte del estudio. El equipo se pondrá en contacto contigo mediante [CANAL_Y_PLAZO_APROBADO].

Ineligible state:

> Con las respuestas actuales, este estudio puede no ser adecuado para ti. Si tienes dudas, puedes contactar con el equipo en [EMAIL_Y_TELEFONO].

Never use `Error`, red styling, or blame language for an ineligible result.

## 14. Voice system

Voice formula:

> Precisión cálida con una curiosidad serena.

Voice pairs:

- Clara, no reductora
- Cercana, no persuasiva
- Rigurosa, no clínica
- Sugerente, no vaga
- Humilde, no insegura
- Valiente, no provocadora por espectáculo

### Use

- `Estamos estudiando si...`
- `El objetivo es comprender...`
- `Todavía no sabemos...`
- `La participación es voluntaria.`
- `Puedes hacer preguntas antes de decidir.`
- `La asignación se realiza al azar.`
- `No se garantiza un beneficio personal.`
- `Puedes detener la experiencia según el procedimiento aprobado.`

### Avoid

- `Transforma tu relación con...`
- `Descubre una nueva realidad.`
- `Vive una experiencia que cambiará tu vida.`
- `Alivia la ansiedad.`
- `Sana a través de la realidad virtual.`
- `La ciencia ha demostrado que...` without a precise source
- `Una alternativa a...`
- `Sin riesgos.`
- `Plazas limitadas.` unless ethically approved, factual, and necessary

## 15. Image direction

### Hero

Use a recognizable person in a calm, neutral environment. A restrained particle field should reveal the person's embodied presence rather than erase it.

- Landscape 16:10 or 3:2
- Subject on the right
- Dark charcoal environment
- Warm, natural skin tone
- Fine teal-white particles with limited spectral warmth
- No obvious euphoria, distress, or clinical staging

### Randomization section

Use one shared field separating into two equally luminous paths. The graphic must support the explanation and remain neutral between groups.

### Participation section

Use documentary images of the actual center, headset, facilitator, room, and process when approved. These images reduce uncertainty more effectively than atmospheric art.

### Research section

Use real team portraits, institutional environments, publications, or equipment. Do not use stock scientists or fake interface mockups.

### Avoid

- Generic galaxies
- Psychedelic tunnels
- Chakras, lotus flowers, and sacred geometry as decoration
- Mushrooms or drug symbolism
- Floating headset product renders
- Stock meditation poses
- Smiling patient advertising
- Before-and-after emotional imagery
- Imagery that implies a positive outcome

## 16. Components

### Study facts band

- One horizontal structured band on desktop
- One stacked definition list on mobile
- No icons unless they materially improve comprehension
- Values always come from protocol tokens

### Primary button

- Living Teal fill
- Dark text
- Full-pill radius
- 50-54px high
- Minimum desktop width sufficient for `Comprobar si puedo participar` on one line
- 0.98 active scale

### Secondary button

- Transparent dark surface
- 1px strong line
- Light text
- No glow

### Research status label

- IBM Plex Mono
- Only for factual states such as `Reclutamiento abierto`, `Reclutamiento cerrado`, or `Seguimiento`
- No pulsing dot

### Disclosure

- Used for protocol detail, FAQ, and extended criteria
- Clear summary line
- Keyboard operable
- Open state uses spacing and one hairline, not a new glowing card

### Evidence reference

- Study title or publication title
- Authors or institution
- Year
- Direct link
- Plain-language one-line relevance

### Sticky recruitment control

- Appears only after the hero CTA has scrolled away
- Contains the same primary CTA label
- Never pulses or blocks content
- Does not appear during the form itself

## 17. Accessibility and sensory safety

- Meet WCAG AA at minimum, with AAA as the target for body text.
- Maintain a visible focus ring using `--color-focus`.
- Provide `Pausar animación` for any continuous movement.
- Honor reduced motion before the first animation frame.
- Avoid rapid luminance changes, flashes, flicker, and high-frequency particle movement.
- Avoid vestibular parallax and full-screen zooms.
- Never rely on color, glow, sound, or motion alone to communicate group assignment or state.
- Caption all spoken media and provide a transcript.
- Do not autoplay audio.
- Reserve media dimensions and provide meaningful alt text.
- Keep all recruitment information available in a linear document order.
- Use labels above inputs and contextual errors below inputs.
- Use at least 44px touch targets.
- Provide a static, low-bandwidth experience that retains all essential information.

## 18. Responsive behavior

### Desktop, 1024px and above

- 12-column grid
- Hero copy 5 columns, media 7 columns
- Study facts in one horizontal band
- Section padding 96-136px

### Tablet, 768-1023px

- 8-column grid
- Hero may remain split only if copy and subject keep comfortable width
- Study facts become a 2-column definition grid

### Mobile, below 768px

- Strict single column
- 20px page gutter
- Hero copy first, media second
- Study facts immediately follow the hero
- No pinned narrative or horizontal-scroll interaction
- Use a static hero poster if video would delay the CTA
- Accordion controls span the full width
- Recruitment CTA remains one line
- Contact routes remain visible outside the form

## 19. Technical architecture

- Render core content as static server content where the framework permits.
- Use semantic HTML with `header`, `main`, `nav`, `section`, `aside`, `form`, and `footer` landmarks.
- Use one H1 and a logical heading order.
- Store approved study content in one typed data object or CMS model, not scattered through components.
- Separate `approvedCopy`, `studyFacts`, `eligibility`, `riskInformation`, `contacts`, and `legalMetadata`.
- Block production builds when required protocol tokens remain unresolved.
- Use Motion from `motion/react` only if it already exists or after explicit installation.
- Isolate motion into small client leaf components.
- Never use `window.addEventListener('scroll')`.
- Do not introduce Three.js when optimized authored video or Canvas 2D can provide the experience.
- Keep form submission separate from marketing analytics.
- Do not send field values, eligibility answers, or medical data to analytics.
- Do not use session replay on the screener or form.
- Provide loading, validation, error, success, and ineligible states.
- Preserve an accessible no-JavaScript route to study information and contact details.

## 20. Measurement and testing

### Measure

- CTA exposure and click-through without storing health information
- Eligibility process start and completion using anonymous events
- Abandonment by step, only if ethically and legally approved
- FAQ usage
- Micro-experience start, skip, and pause
- Page performance and accessibility

### Do not measure

- Form values
- Eligibility answers
- Free-text medical information
- Keystrokes
- Session recordings on recruitment or screener screens

### Appropriate tests

- Plain question-led hero versus more direct study-led hero
- CTA placement, not manipulative CTA wording
- Study facts band order
- Static hero still versus restrained loop
- Eligibility overview before versus after study explanation

### Do not casually A/B test

- Ethics-approved claims
- Risk information
- Consent language
- Privacy language
- Eligibility criteria
- Control-group description
- Compensation terms

Any material recruitment variant may require ethics review before testing.

## 21. Content and asset request checklist

The study team must supply:

- Current approved protocol summary
- Approved public title and scientific title
- Public registry link and identifier
- Recruitment status and locations
- Inclusion and exclusion criteria
- Visit and session schedule
- Randomization and comparator explanation
- Risks, discomforts, possible benefits, and withdrawal process
- Cost, compensation, and reimbursement information
- Investigator, sponsor, sites, ethics body, and funder
- Approved privacy notice and data flow
- Contact and response procedure
- Approved Spanish terminology and tone
- Approved real photography and video
- Consent status for all participant quotations
- Destination and security requirements for the screener or form
- Version date that must appear in the footer

## 22. Claude Code implementation prompt

Copy everything between `BEGIN PROMPT` and `END PROMPT` into Claude Code with this file, the repository, approved protocol content, and approved media.

### BEGIN PROMPT

Build a production-quality Spanish recruitment landing page for aNUma's randomized controlled trial. Use `ANUMA_RCT_LANDING_PAGE_DESIGN_SYSTEM_ES.md` as the governing design, content, accessibility, ethics, and technical specification.

First inspect the repository, framework, routes, dependencies, existing brand assets, and approved study content. Preserve the current stack unless a change is necessary. Verify every dependency in `package.json` before importing it.

All visible public copy must be in Spanish. Set `<html lang="es">`. Keep code identifiers in English if that matches the repository. Use natural, plain Spanish and preserve all approved clinical and legal terms exactly.

The page has one conversion goal: a suitable visitor starts the approved eligibility or expression-of-interest process. Use `Comprobar si puedo participar` as the identical primary CTA label in the navigation, hero, eligibility section, sticky control, and final invitation. Use `Entender el estudio` as the secondary hero action.

The page must explain that this is research, what question is being studied, who may participate, what participation involves, what assignment at random means, what each group receives, possible benefits and risks, privacy, voluntary choice, and what happens after a person submits interest. The landing page is not informed consent.

Never invent or infer protocol facts. Search for all bracketed protocol tokens listed in the design-system file. If any required value is missing, use an internal `FALTA CONTENIDO APROBADO` marker, list it in `MISSING_STUDY_CONTENT.md`, and prevent production deployment. Never render invented health claims, eligibility rules, timelines, compensation, registry identifiers, investigator names, quotations, or safety instructions.

Build the page in this order:

1. Minimal one-line recruitment navigation.
2. Asymmetric 5/7 hero with a question-led headline, clear recruitment audience, primary CTA, secondary action, and human-to-light media.
3. Immediate structured study facts band and the statement that showing interest is not consent.
4. Plain-language research question and what remains unknown.
5. Eligibility overview with the repeated primary CTA.
6. Continuous participation timeline.
7. Neutral explanation of assignment at random and the comparison groups.
8. Explanation of the numadelic experience and optional bounded visual micro-experience.
9. Equal-weight benefits, burdens, and risks section.
10. Research team, oversight, registry, partners, and evidence.
11. Accessible FAQ.
12. Final recruitment invitation and approved contact routes.
13. Legal and study-metadata footer.

Use the locked dark palette and exact tokens. Living Teal is the only interface accent. Spectral light is allowed inside authored experience media only. Use Manrope Variable for the interface and IBM Plex Mono only for real study metadata.

Make the page numadelic through a coherent Luminous Threshold narrative: dispersed light becomes oriented, divides neutrally to explain randomization, reconnects around evidence and testimony, and resolves near the final invitation. Essential content must remain visible without animation. Do not use generic galaxies, purple mesh gradients, sacred geometry, psychedelic tunnels, stock meditation images, headset glamour shots, or fake interfaces.

If implementing the optional visual micro-experience, keep it 12-18 seconds, user initiated, silent by default, pausable, skippable, replayable, and clearly labeled as a visual approximation that is not the study intervention. The recruitment CTA must remain dominant. Provide a static reduced-motion alternative.

Never make the intervention group brighter or more desirable than the comparison group. Never use red or error language for an ineligible visitor. Never place emotionally strong testimony next to the recruitment CTA. Never use urgency, scarcity, countdowns, pulsing buttons, guaranteed outcomes, or claims that participation improves health.

Use semantic HTML, logical headings, keyboard operation, visible focus, captions and transcripts, 44px touch targets, reserved media dimensions, and WCAG AA contrast. Honor reduced motion before the first animation frame. Avoid flashes, rapid luminance changes, vestibular zooms, autoplay audio, and scroll-jacking.

Keep study information available without JavaScript. Isolate any Motion code in client leaf components. Animate only transform and opacity. Do not use window scroll listeners. Do not add Three.js unless the supplied media and Canvas 2D cannot express the approved concept.

Keep the eligibility or contact flow separate from marketing analytics. Do not put medical or screening answers in URLs, local storage, analytics events, error monitoring payloads, or session replay. Build loading, validation, error, success, and ineligible states using the approved Spanish copy.

Before finishing:

1. Run lint, typecheck, tests, and a production build.
2. Inspect the page at 390px, 768px, 1024px, and 1440px.
3. Test keyboard navigation, reduced motion, no-JavaScript access, and the static visual fallback.
4. Verify every factual claim against approved source content.
5. Verify that all unresolved protocol tokens block production.
6. Verify that the two randomized branches have equal visual weight.
7. Verify that the primary CTA label is identical everywhere.
8. Verify that no sensitive form value reaches analytics, logs, replay, URLs, or local storage.
9. Verify there are no em dash or en dash characters in visible copy.
10. Summarize changed files, checks run, unresolved content, and media still required.

### END PROMPT

## 23. Final pre-flight checklist

- The first viewport says this is research.
- The study question is framed as uncertain.
- The recruiting population and location are immediately clear.
- The primary CTA is visible and non-coercive.
- Showing interest is explicitly distinguished from consent and enrollment.
- Random assignment is explained before data submission.
- Intervention and comparison paths have equal visual weight.
- Possible benefit is not guaranteed.
- Risks, burdens, and time commitment are easy to find.
- Withdrawal and contact routes are visible.
- The current registry, investigator, sponsor, centers, and ethics information are present.
- Prior-study content is labeled as prior-study content.
- The form collects only approved minimum information.
- Sensitive data does not reach marketing analytics or session replay.
- The page remains fully usable without animation.
- The numadelic layer feels like presence and connection, not spectacle.
- Human figures remain legible inside the light-energy imagery.
- There is no autoplay audio, flashing, or scroll-jacking.
- The Spanish copy is plain, consistent, and professionally reviewed.
- All protocol placeholders are resolved before production.
- The final recruitment material and response process have received required ethics review.

## 24. Regulatory and ethics references

Use these as implementation constraints, then confirm the applicable jurisdiction and ethics process with the study team:

- [European Commission, advertising for trial subjects](https://health.ec.europa.eu/document/download/d71a3d59-544f-435f-acb2-153921f69eb5_en?filename=12_ec_guideline_20060216_en.pdf&prefLang=es): recruitment advertisements and response-handling procedures should be submitted for Ethics Committee review. A response should indicate interest in receiving more information, not enrollment.
- [AEMPS, documentation and recruitment materials](https://www.aemps.gob.es/va/investigacionClinica/medicamentos/docs/anexo1-Ins-AEMPS-EC.pdf): web copy and other recruitment advertising are part of the materials submitted for ethics review, along with the process for handling responses.
- [WHO, guidance for best practices for clinical trials](https://iris.who.int/bitstream/handle/10665/378782/9789240097711-eng.pdf?sequence=1): participant information should be clear, concise, accessible, in suitable languages and formats, and should prioritize the needs of potential participants.
- [WHO, clinical-trial registration overview](https://www.who.int/news-room/questions-and-answers/item/clinical-trials): interventional trials should be registered publicly. The registry should expose a plain-language public title and current recruitment status.

This section is a design and implementation guardrail, not legal advice.
