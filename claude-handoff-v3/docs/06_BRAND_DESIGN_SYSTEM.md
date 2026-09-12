# aNUma Landing Page Design System

Version 1.0

Source: synthesis of six core-team responses in `Anuma Brand Discovery/analysis.html`, its supporting data, and the preferred visual mockups.

Status: directional system for landing-page design and implementation. It is not a final brand strategy. Audience, entity, offer, naming, and commercial decisions still need validation.

## 1. Design read

Reading this as: a trust-sensitive immersive-practice landing page for contemplatively curious people, with an organic-minimal, lucid-wonder language, leaning toward a custom dark-first system built with semantic CSS tokens, restrained motion, and real human-to-light imagery.

Design dials:

- `DESIGN_VARIANCE: 7/10` - asymmetry and spatial depth, but never confusion
- `MOTION_INTENSITY: 6/10` - alive and embodied, but calm enough for the nervous system
- `VISUAL_DENSITY: 3/10` - spacious, focused, and easy to enter

The governing idea is:

> Make the invisible experientially clear.

The governing tension is:

> Organic presence inside a disciplined system.

## 2. What the research actually supports

### Strong signals

1. Connection is the central outcome. All six respondents describe value through connection, community, collective experience, or relationship.
2. Credibility needs two forms of proof. Research creates confidence; first-person testimony makes the value understandable.
3. VR is both a signature medium and a barrier. It creates focus, embodiment, and co-presence, but also raises access, comfort, and cultural concerns.
4. Context is part of the product. Preparation, consent, facilitation, and integration are core experience design, not secondary support.
5. The numadelic light-energy aesthetic is a distinctive asset worth preserving.
6. The public story needs a simpler doorway. It should lead with a felt human gap, explain aNUma plainly, establish credibility, and offer one clear next step.

### Character signals

Most repeated traits to embody:

- Restorative: 3/6
- Embodied: 3/6
- Open: 3/6
- Grounded, warm, playful, inquisitive, and unconventional: 2/6 each

Most repeated traits to reject:

- Elitist: 4/6
- Dogmatic: 4/6
- Corporate: 3/6
- Preachy: 3/6
- Trendy: 3/6
- Vague, cold, and overpromising: 2/6 each

### Expression signals

- Voice is balanced between academic and everyday: mean 53/100 toward everyday, with disagreement across the team.
- Voice leans poetic rather than literal: mean 40/100 on a poetic-to-literal scale.
- Voice leans provocative rather than reassuring: mean 73/100 toward provocative.
- Visual energy strongly leans organic: mean 18/100 on an organic-to-engineered scale. Five of six responses sit at 20 or lower.
- No named visual route won. Ceremonial Technology and Earth Signal received two votes each.
- Mockup 1 received the plurality at 3/6. Its useful qualities are spaciousness, warm light, clear hierarchy, restrained iconography, and a field of distinct luminous presences.

### Unresolved questions

Do not let visual design pretend these have already been answered:

- Which audience is the first launch audience?
- What is the exact public relationship between aNUma and Numadelic Labs?
- What is the first offer and business model?
- What eligibility and safety standards govern solo access?
- Does the term `numadelic` create useful curiosity or costly confusion?

The landing page may use the current working hypothesis: contemplatively curious people are the primary audience, with practitioners as the trust and distribution bridge.

## 3. Brand essence

### Strategic role

aNUma creates evidence-informed immersive practices that help people feel connection and perspective, solo and together.

### Brand archetype

The Intimate Explorer:

- Lover supplies the outcome: felt connection.
- Explorer supplies the method: an invitation beyond familiar boundaries.
- Mystic supplies wonder, but must never control the voice or claims.

### Brand promise

An invitation to experience what words alone cannot reach.

### Experience principles

1. Depth over spectacle.
2. Invitation over prescription.
3. Evidence without sterility.
4. Context is part of the product.
5. Technology serves attention.

### Design decision order

When principles conflict, decide in this order:

1. Comprehension
2. Safety and trust
3. Felt presence
4. Distinctive wonder
5. Technical novelty

## 4. Visual concept: Living Light

The visual world is not outer space, wellness beige, cyberpunk, or clinical software. It is a quiet dark field in which human presence becomes visible as light.

The central visual motif is a living luminous body:

- Soft points of light gathering into a person, pair, or shared field
- Fine organic filaments rather than rigid technical grids
- Slow expansion and coalescence rather than explosions
- Warmth at the center, cooler light at the edge
- Darkness used as focus and perceptual depth
- Human scale and recognizable bodies retained wherever possible

Use the existing orb motif as a mnemonic, not as the entire interface. Orbs can represent experiences, people, or points of entry. They should not become generic glowing buttons or a solar-system menu on every section.

## 5. Color system

The landing page uses one locked dark theme. Do not invert individual sections into light mode.

The UI uses one accent: Living Teal. Spectral colors may appear inside authored imagery, video, or experience artwork, but not as competing interface accents.

```css
:root {
  color-scheme: dark;

  /* Foundational surfaces */
  --color-void: #080c0d;
  --color-void-raised: #0d1416;
  --color-surface: #121b1d;
  --color-surface-soft: #172225;

  /* Text */
  --color-text: #f2f5ef;
  --color-text-secondary: #b4bfba;
  --color-text-muted: #879590;

  /* Brand accent */
  --color-accent: #79ded4;
  --color-accent-strong: #9ce9df;
  --color-accent-ink: #071514;
  --color-accent-wash: rgb(121 222 212 / 0.09);

  /* Structure */
  --color-line: rgb(212 232 225 / 0.14);
  --color-line-strong: rgb(212 232 225 / 0.26);
  --color-focus: #9ce9df;

  /* Semantic colors, never decorative accents */
  --color-success: #a7dfb3;
  --color-warning: #edbd7c;
  --color-danger: #ee9790;

  /* Tinted shadow only */
  --shadow-low: 0 18px 56px rgb(0 18 20 / 0.24);
  --shadow-high: 0 34px 100px rgb(0 18 20 / 0.38);
}
```

Rules:

- Never use pure black or pure white.
- Keep most of the page in the first four surface tokens.
- Use accent for primary actions, focus states, selected states, and one or two small moments of emphasis.
- Do not use teal outer glows on ordinary UI.
- Use amber, rose, and green only when they carry real status meaning.
- Do not use multicolor gradients in buttons, headings, cards, or borders.
- Let experience imagery contain violet, amber, green, or blue light. That spectrum belongs to the content, not the interface chrome.

## 6. Typography

### Primary typeface

Use Manrope Variable for navigation, headlines, body, buttons, and labels. It gives the system modern precision without becoming sterile.

Fallback:

```css
font-family: "Manrope Variable", "Manrope", "Segoe UI", sans-serif;
```

### Supporting typeface

Use IBM Plex Mono only for evidence labels, research metadata, timestamps, and technical identifiers. Never use it for poetic decoration.

```css
font-family: "IBM Plex Mono", Consolas, monospace;
```

### Optional editorial voice

Newsreader may be used for one dedicated testimonial or manifesto passage per page. Do not mix it into individual words inside a sans-serif headline. Do not use it for UI controls.

### Type scale

```css
--text-display: clamp(3.5rem, 7vw, 6.75rem);
--text-h1: clamp(3rem, 5.8vw, 5.5rem);
--text-h2: clamp(2.25rem, 4vw, 4rem);
--text-h3: clamp(1.5rem, 2.4vw, 2.5rem);
--text-lead: clamp(1.125rem, 1.5vw, 1.375rem);
--text-body: 1rem;
--text-small: 0.875rem;
--text-label: 0.6875rem;
```

Typography rules:

- Headlines use weight 400-500, tight tracking from `-0.02em` to `-0.045em`, and line-height 0.98-1.08.
- Body text uses weight 400, line-height 1.65, and a maximum width of 62ch.
- Hero headlines occupy no more than two lines on desktop.
- Hero support copy is 20 words or fewer.
- Labels may use mono, uppercase, and tracking around `0.1em`, but use no more than one eyebrow for every three sections.
- Use sentence case. Avoid shouty all-caps marketing headlines.
- Do not use gradient text.

## 7. Shape and material

The system has three documented shape roles:

- Experience imagery and identity motifs: circular or organically rounded
- Content surfaces and media frames: 16px radius
- Buttons and compact controls: full pill

Do not invent additional radii.

```css
--radius-surface: 16px;
--radius-control: 999px;
```

Material rules:

- Default grouping comes from negative space and sparse hairlines.
- Use panels only when a boundary carries meaning, such as a safety note or research artifact.
- Avoid rows of floating cards.
- Avoid glassmorphism on content. A very light transparent treatment is allowed for the sticky navigation over moving media.
- Shadows are rare and tinted toward deep teal.
- Grain may appear as a fixed, pointer-events-none overlay at 2-4% opacity. Do not attach noise filters to scrolling containers.

## 8. Grid and spacing

```css
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
--space-40: 10rem;

--container: 82.5rem;
--gutter: clamp(1.25rem, 4vw, 4rem);
--section-space: clamp(6rem, 11vw, 10rem);
```

Layout rules:

- Use a 12-column desktop grid with generous negative space.
- Keep the page container at 1320px maximum.
- Use asymmetric layouts at desktop and collapse to one strict column below 768px.
- Avoid a centered hero. Prefer a 5/7 split with text on the left and a human-to-light visual on the right.
- Navigation stays on one line and is 64-72px high.
- Never use `h-screen`; use `min-height: 100dvh` where a full-viewport section is required.
- Do not repeat the same layout family in consecutive sections.
- Do not use three equal feature cards.

## 9. Motion language

Motion should feel like breathing, gathering, attunement, and response. It should never feel like a game lobby, a psychedelic trip, or a technology demo.

### Motion tokens

```css
--ease-presence: cubic-bezier(0.16, 1, 0.3, 1);
--ease-breath: cubic-bezier(0.45, 0, 0.55, 1);
--duration-fast: 180ms;
--duration-base: 420ms;
--duration-reveal: 760ms;
--duration-breath: 7000ms;
```

### Approved behaviors

- Hero content enters once in a calm sequence: opacity plus 16-24px vertical translation.
- The main light form breathes slowly with 1-2% scale variation and very subtle luminance change.
- Luminous particles gather toward a form to express connection or integration.
- Section content reveals once when it enters the viewport.
- Buttons move by 1px on hover and scale to 0.98 on active.
- A shared-experience visual may show two light fields gently coalescing.

### Prohibited behaviors

- Fast particles, hyperspace, explosions, glitch, scan lines, or text scrambling
- Scroll-jacking unless it is essential to one clear narrative moment
- Endless marquees
- Parallax on every image
- Mouse-following light blobs
- Custom cursors
- Motion that continues under `prefers-reduced-motion: reduce`

Only animate transform and opacity. Use Motion values or CSS animation. Never update React state on every scroll or pointer frame.

## 10. Image direction

The landing page needs real, section-specific imagery. Do not replace it with fake UI panels, gradients, or decorative SVG diagrams.

### Hero image or video

Show a recognizably human presence transitioning into or coexisting with the numadelic light-energy form. The body must remain legible enough to answer the question, "What is happening to a person?"

Composition:

- Landscape, ideally 16:10 or 3:2
- Subject offset to the right to protect copy space
- Deep charcoal environment, not a generic star field
- One central living-light form with restrained spectral detail
- Bodily warmth in skin, breath, hands, or posture
- Quiet negative space and high local contrast around the subject

### Supporting imagery

Use at least three distinct visual categories:

1. Experience: person becoming or meeting light
2. Relationship: two or more people connected through a shared luminous field
3. Evidence: real researchers, facilitators, sessions, or documented research artifacts

### Avoid

- Generic galaxies or nebulas with no human anchor
- Chakras, lotus symbols, sacred geometry as decorative shorthand
- Mushrooms, chemical structures, or drug imagery
- Floating VR headsets as product glamour shots
- Neon blue or purple cyberpunk environments
- Stock meditation poses on beaches or mountaintops
- Overprocessed faces, closed-eye bliss, or guaranteed-transformation imagery
- Light effects so dense that content becomes spectacle

## 11. Iconography

Use Phosphor icons at weight `regular` with a consistent 1.5px visual stroke. Use icons only when they improve recognition.

Rules:

- No hand-drawn SVG icon set.
- No mixing icon families.
- Prefer literal icons for access, safety, preparation, people, research, and time.
- Do not use mystical symbols as category icons.
- Do not put every icon inside a glowing orb.

## 12. Core components

### Navigation

- Height: 68px desktop, 60px mobile
- Transparent over the hero with a subtle solid dark fallback after scroll
- Logo left, 3-4 links center or right, one primary CTA
- Suggested links: Experiences, How it works, Research, About
- CTA label should match the hero CTA exactly

### Primary button

- Living Teal fill, dark ink text
- Full-pill shape
- 48-52px high
- 18-24px horizontal padding
- One concise label, no wrap
- Optional Phosphor arrow at the end

### Secondary button

- Transparent dark surface
- 1px strong line
- Light text
- No glow

### Evidence marker

- Small IBM Plex Mono label
- Used only for real citations, study status, sample information, or methodology
- Never used as atmosphere

### Media frame

- 16px radius
- No heavy border
- Dark poster frame before load
- Correct width and height reserved to prevent layout shift
- Caption only when it adds factual context

### Testimonial

- One short quote, maximum three lines
- Person's full name, role, and relationship to the experience
- Real portrait or documentary still if permission exists
- No carousel by default

### Safety or claim guardrail

- Full-width restrained panel, not an alert-red box
- Plain language
- Link to protocol or methodology
- Separate known evidence from open questions

### Experience entry cards

Use exactly two pathways on the landing page if both are currently available:

- Explore solo
- Join a guided experience

Use a 7/5 asymmetric pair rather than equal cards. If either pathway is not actually available, do not show it as a live CTA.

## 13. Landing-page composition

The first 30 seconds should follow this sequence.

### 1. Navigation

One line, one CTA, no status clutter.

### 2. Hero: name the felt gap

Recommended working headline:

> You can understand connection. Here, you can feel it.

Recommended support copy:

> Evidence-informed immersive practices for exploring connection and perspective, solo or with others.

Primary CTA:

> Find an experience

Secondary CTA:

> See how it works

Use an asymmetric split hero with a real human-to-light image or restrained looping film. The CTA must be visible in the initial viewport.

### 3. Plain explanation

Answer "What is aNUma?" without asking the visitor to understand the whole ecosystem.

Working copy:

> aNUma combines immersive experience, careful preparation, and scientific inquiry to create conditions for insight and felt connection.

### 4. The experience arc

Show Prepare, Experience, and Integrate as one continuous pathway around a single piece of media. Do not use three equal cards or generic numbered steps.

### 5. Solo and shared pathways

Present the available entry points. Shared practice should feel relational and facilitated. Solo practice should feel bounded and prepared, not like an endless content library.

### 6. Evidence plus testimony

Pair one verifiable research artifact with one short participant account. Science and lived experience must appear together.

### 7. Why immersion

Explain what the medium uniquely enables: attentional containment, embodiment, and remote co-presence. Acknowledge access and comfort concerns directly.

### 8. Care and boundaries

Make preparation, consent, facilitation, and integration visible. State what the experience does not claim.

### 9. About the ecosystem

Give a concise relationship between aNUma and Numadelic Labs only after the visitor understands the experience. Keep governance detail on a dedicated page.

### 10. Final invitation

Repeat the same primary CTA label used in the hero. Do not introduce a new conversion intent.

## 14. Voice and copy system

Voice formula:

> Warm precision with a poetic edge.

### Voice pairs

- Lucid, not reductive
- Wonder-filled, not vague
- Provocative, not preachy
- Evidence-led, not clinical
- Humble, not timid

### Sentence behavior

- Start with the human experience, then explain the medium.
- Use concrete verbs: prepare, enter, notice, connect, reflect, study.
- Keep sentences short enough to breathe.
- Use one unfamiliar term at a time and define it immediately.
- Let poetry appear in high-value moments, not in every label.
- Use `numadelic` after the plain explanation, not before it.

### Claims language

Use:

- "Designed to support"
- "Creates conditions for"
- "Participants have described"
- "Research is exploring"
- "May help people notice"

Do not use:

- "Heals"
- "Treats"
- "Cures"
- "Guaranteed transformation"
- "Scientifically proven" without precise evidence
- "The same as psychedelics"
- "A complete spiritual path"
- "Safer or better than meditation, therapy, or psychedelics"

### Anti-copy list

Avoid these generic phrases:

- Elevate your consciousness
- Unlock your potential
- Step into the future
- Journey within
- Transform your reality
- Revolutionary VR wellness
- Where science meets spirituality
- Next-generation healing

## 15. Accessibility and trust

- Meet WCAG AA at minimum, with AAA as the target for body copy.
- Maintain visible keyboard focus using `--color-focus`.
- Do not rely on glow, hue, or motion alone to communicate state.
- All video has captions, a pause control, and a static poster.
- All meaningful images have factual alt text. Decorative particle textures use empty alt text.
- Reduced motion collapses breathing, particle, parallax, and stagger effects to a static composition.
- Avoid text over complex imagery unless a tested scrim protects contrast.
- Use labels above form inputs. Never use placeholders as labels.
- State headset requirements and accessibility constraints before the visitor commits.
- Distinguish published evidence, active research, and hypotheses.

## 16. Responsive behavior

### Desktop, 1024px and above

- 12-column asymmetric grid
- Hero copy spans 5 columns; media spans 7
- Section padding 112-160px
- Navigation remains one line and at most 72px high

### Tablet, 768-1023px

- 8-column grid
- Hero may remain split if both copy and subject retain comfortable width
- Reduce media detail before reducing text readability

### Mobile, below 768px

- Strict single column
- Page gutter 20px
- Hero copy first, media second
- Hero remains within a stable `min-height: 100dvh` composition when possible
- Buttons stack only when both cannot fit without wrapping
- No pinned or horizontal-scroll storytelling
- Static hero poster preferred to heavy video on constrained connections
- Touch targets at least 44px

## 17. Performance rules

- Hero media is optimized and preloaded only when it is the LCP candidate.
- Always reserve media dimensions to keep CLS below 0.1.
- Lazy-load below-the-fold video and large images.
- Keep interaction islands small. The landing page should render primarily as static server content when the framework supports it.
- If using Motion, import from `motion/react` and isolate motion into client leaf components.
- Do not add Three.js unless the hero concept cannot be expressed with optimized video or images.
- Target LCP below 2.5s and INP below 200ms.

## 18. Non-negotiable anti-patterns

- No generic purple-blue mesh gradient hero
- No centered headline over a glowing blob
- No fake product UI made from decorative divs
- No three equal feature cards
- No spiritual-symbol collage
- No generic galaxy without human presence
- No section numbers as decoration
- No eyebrow above every heading
- No multiple marquees
- No text scramble or glitch effects
- No custom cursor
- No glow on every interactive element
- No random glass cards
- No corporate stock photography
- No visual or verbal implication of guaranteed outcomes
- No presentation of unresolved strategy as settled fact

## 19. Claude Code implementation brief

Copy everything between `BEGIN PROMPT` and `END PROMPT` into Claude Code after attaching this file and the available brand assets.

### BEGIN PROMPT

Build a production-quality landing page for aNUma using the attached `ANUMA_LANDING_PAGE_DESIGN_SYSTEM.md` as the governing design and content specification.

First inspect the existing repository, framework, dependencies, routes, and brand assets. Preserve the current stack unless a change is necessary. Before importing any package, verify that it exists in `package.json`. If this is a new project, use Next.js, Tailwind CSS v4, semantic CSS variables, Phosphor icons, and Motion only for the small behaviors specified below.

Design intent: organic presence inside a disciplined system. The page must feel restorative, embodied, open, grounded, warm, inquisitive, and unconventional. It must not feel elitist, dogmatic, corporate, preachy, trendy, vague, cold, or overpromising.

Use the locked dark theme and exact semantic color tokens in the design-system file. Living Teal is the only UI accent. Spectral color is allowed only inside authored experience imagery. Use Manrope Variable for the main interface and IBM Plex Mono only for real evidence metadata. Follow the documented radius roles and spacing scale.

Use this page sequence:

1. Single-line navigation with logo, Experiences, How it works, Research, About, and the primary CTA.
2. Asymmetric 5/7 hero that names the felt gap, explains aNUma plainly, and shows a real human-to-light visual.
3. Plain-language explanation of aNUma.
4. Prepare, Experience, Integrate as one continuous pathway around one visual, not three cards.
5. Available solo and guided pathways in an asymmetric two-part composition.
6. Evidence plus a real participant testimony shown together.
7. Explanation of what immersion uniquely enables and what barriers it introduces.
8. Preparation, consent, facilitation, integration, and claim boundaries.
9. Concise aNUma and Numadelic Labs relationship.
10. Final invitation using the same primary CTA label as the hero.

Use this working hero copy unless the repository contains approved copy:

Headline: "You can understand connection. Here, you can feel it."

Support: "Evidence-informed immersive practices for exploring connection and perspective, solo or with others."

Primary CTA: "Find an experience"

Secondary CTA: "See how it works"

Do not invent studies, partners, participant quotes, statistics, testimonials, safety protocols, availability, prices, or clinical claims. If real content is missing, render an intentional labeled placeholder in the code and list the missing asset or copy in the README. Do not display placeholder claims as public content.

Use real supplied images or videos. If no suitable media exists, create clearly named media slots with exact aspect ratios and content descriptions. Never build a fake screenshot from styled divs. Never substitute a generic galaxy, gradient blob, or spiritual icon for the human-to-light visual.

Motion intensity is 6/10. Implement a calm hero reveal, one subtle breathing light treatment, section reveals, and tactile button states. Every animation must communicate hierarchy, gathering, feedback, or transition. Animate only transform and opacity. Honor `prefers-reduced-motion` with a static fallback. Do not use window scroll listeners, text scramble, glitch, custom cursors, or scroll-jacking.

Keep the hero headline to two lines on desktop, support copy to 20 words or fewer, and both CTAs visible in the initial viewport. Use `min-height: 100dvh`, never `h-screen`. Collapse all asymmetric layouts to one column below 768px. Keep navigation on one line at desktop and below 72px high.

Build accessible loading, empty, and error states for any interactive or data-driven surface. Ensure keyboard navigation, visible focus, semantic landmarks, factual alt text, video controls, and WCAG AA contrast. Reserve image dimensions to avoid layout shift.

Do not use three equal feature cards, repeated split layouts, section-number eyebrows, multiple marquees, generic glass cards, decorative status dots, gradient text, or duplicate CTA intents. Use no em dash or en dash characters in visible copy. Use standard hyphens when punctuation requires a dash.

Before finishing:

1. Run the repository's lint, typecheck, test, and production build commands.
2. Inspect the page at 390px, 768px, 1024px, and 1440px widths.
3. Test reduced motion and keyboard navigation.
4. Check that every claim can be traced to supplied content.
5. Verify that the primary CTA label is identical in navigation, hero, and closing section.
6. Verify that no page section violates the design-system anti-pattern list.
7. Summarize files changed, checks run, and any missing approved content or media.

### END PROMPT

## 20. Pre-flight checklist

- The first viewport names the felt gap, explains aNUma, and offers a clear next step.
- The page leads with a human outcome, not VR, psychedelics, or ecosystem complexity.
- The visual system reads organic before engineered.
- Darkness focuses attention and does not perform "future tech."
- Human presence remains visible inside the light-energy aesthetic.
- Living Teal is the only UI accent.
- Evidence and testimony appear together.
- Preparation and integration are visible as part of the experience.
- The copy distinguishes invitation from prescription.
- No unsupported health, safety, or transformation claim appears.
- The hero fits in the initial viewport.
- The page contains real media or explicit, non-public placeholders.
- Motion is slow, purposeful, and removable.
- The mobile layout is explicit and usable.
- CTA labels do not wrap and the primary CTA is consistent.
- Keyboard focus, media controls, contrast, and reduced motion are verified.
- The final page does not look like a meditation app, a VR game lobby, a research portal, or a psychedelic-event poster.

