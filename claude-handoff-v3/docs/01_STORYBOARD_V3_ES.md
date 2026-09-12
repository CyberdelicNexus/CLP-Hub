# aNUma RCT Landing Page — Storyboard V3

Status: current authoritative visual storyboard for Claude Taste + Scroll Craft. This document supersedes V2 wherever they conflict.

## Global aesthetic corrections

- Light bodies in Sections 1 and 8 must look like the supplied blurred reference: vague low-resolution blue-violet silhouettes with small warm heart lights. They are not crisp plasma, detailed smoke, particle people or neon anatomy.
- The human reveal uses a feathered opacity blend, not a hard portal. The physical participant becomes visible while 20–35% of the luminous haze remains over and around the body, matching the supplied composite reference.
- Every revealed participant wears a current white Meta Quest 3 and visibly holds two ringless Quest 3 Touch Plus controllers.
- Use one fixed `travelLightDiameter` for Sections 2 and 3. The object changes vertical position, not size.
- Random assignment has exactly two equally weighted groups: the program group and the control group. Replace these labels only with approved protocol wording.

## 1 — Hero

- Use `design-review/section-concepts-v3/01-hero-soft-reveal.png`.
- The seven bodies form a soft, shallow arc at restrained scale.
- Pointer movement controls a feathered alpha mask over the physical Quest 3 layer.
- Inside the mask: physical layer opacity rises toward 0.9; luminous layer falls only to approximately 0.25 so the haze remains present.
- No hard circular edge, stroke, magnifier lens or crisp cutout.
- Source layers:
  - `hero-reveal-assets/hero-luminous-soft-v3.png`
  - `hero-reveal-assets/hero-physical-quest3-v3.png`

## 2 — El porqué

- Use `02-why-centered-no-trail.png`.
- Center all copy in one column.
- Remove the right-side second-read sentence entirely.
- Absolutely no line, trail, curve, connector or floating waypoint above the light.
- The light rests half outside the bottom center and uses the same fixed diameter as Section 3.

## 3 — El qué

- Use `03-what-horizontal-video.png`.
- The same fixed-size light rests half outside the top center.
- Put copy and video inside one centered horizontal two-column container.
- Copy is left; video is right; both are vertically centered on the same axis.
- The video must not drop beneath the copy on desktop.
- Keep Spanish subtitles/context and a Spanish text summary for any public video.

## 4 — Etapas del Programa

- Use `04-program-stages-rebalanced.png`.
- Keep title and intro upper-left.
- Place the active experiential image at the visual center.
- Place the active stage name and description bottom-right, directly above the timeline.
- Keep S0–S6 across the bottom and move the small light through the nodes as scrolling advances.

Stage names remain:

- S0 Preparación
- S1 Orientación
- S2 Cuerpos de Luz
- S3 Vida
- S4 Más Allá del Cuerpo
- S5 Ofrenda
- S6 Integración Grupal

## 5 — Cómo incorporarse al estudio

- Use `05-how-to-join-compact-steps.png`.
- Reduce 01/02/03 to compact editorial numerals.
- Each number and step label share the same baseline in a two-column step rail.
- Align the active description to the label column.
- Retain the documentary image cross-fade and top-right light.

## 6 — Asignación al azar

- Use `06-random-assignment-two-groups.png`.
- Exactly two branches and two equal lights.
- Working labels: `GRUPO DEL PROGRAMA` and `GRUPO CONTROL`.
- Both branches have equal size, brightness, connector length, vertical position, label scale and content area.
- Approved protocol language replaces `[CONDICIÓN APROBADA]` before launch.

## 7 — Elegibilidad y preguntas

- Carry forward `07-eligibility-and-faq.png` unchanged.
- The combined eligibility/FAQ information architecture remains approved for this design round.

## 8 — Invitación final

- Use `08-final-invitation-minimal-fire.png`.
- Return to the restrained centered layout of the earlier approved closing section.
- Keep the small blurred body arc at the top.
- Replace the former pale center point with one small irregular orange fireball based on `CL circle 2`.
- Keep headline, consent clarification, one Qualtrics CTA, contact link and quiet footer.
- The same feathered Quest 3 human reveal is available over the top body arc, but the default static state stays clean and unrevealed.

## Responsive and reduced-motion rules

- On mobile, Sections 2 and 3 keep the same light diameter token scaled with `clamp()`; only the container stacks.
- Reduced motion uses stable section states and direct fades. No essential text depends on animation.
- Pointer reveal becomes press-and-hold or an explicit reveal toggle on touch devices.
