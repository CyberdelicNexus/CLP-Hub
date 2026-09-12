# Asset manifest

All paths are relative to the handoff package root.

## Section references — layout only

| File | Purpose | Production use |
|---|---|---|
| `assets/section-references/01-hero-soft-reveal.png` | Hero layout and reveal state | Reference only |
| `assets/section-references/02-why-centered-no-trail.png` | Centered why section | Reference only |
| `assets/section-references/03-what-horizontal-video.png` | Horizontal copy/video layout | Reference only |
| `assets/section-references/04-program-stages-rebalanced.png` | Stage layout and timeline | Reference only |
| `assets/section-references/05-how-to-join-compact-steps.png` | Sticky onboarding state | Reference only |
| `assets/section-references/06-random-assignment-two-groups.png` | Two-group randomization | Reference only |
| `assets/section-references/07-eligibility-and-faq.png` | Eligibility/FAQ layout | Reference only |
| `assets/section-references/08-final-invitation-minimal-fire.png` | Final CTA layout | Reference only |

Never ship these files as full webpage backgrounds. Rebuild their typography, controls and layout in semantic HTML/CSS.

## Hero reveal candidates

| File | Role |
|---|---|
| `assets/hero-reveal/hero-luminous-soft-v3.png` | Default luminous foreground layer |
| `assets/hero-reveal/hero-physical-quest3-v3.png` | Physical layer revealed through the pointer mask |

Both are 16:9. Register them to the same rendered box. A final production alignment/segmentation pass may be required if edge drift becomes visible.

## Original phase videos

| File | Suggested role |
|---|---|
| `assets/source-media/videos/short phase 1.mp4` | Early stage / gathering / Cuerpos de Luz |
| `assets/source-media/videos/short phase 2.MOV` | Stage progression media |
| `assets/source-media/videos/short phase 3.MOV` | Embodied-light stage media |
| `assets/source-media/videos/short phase 4 group.mp4` | Group/integration or final-state media |

Create web derivatives and posters. Preserve originals. Do not fake detail or sharpness.

## Source images

| File | Role |
|---|---|
| `assets/source-media/images/CL circle 1.png` | Authentic purple light-body circle reference |
| `assets/source-media/images/CL circle 2.png` | Authentic group and orange fire-light reference |
| `assets/source-media/images/physical-cloud-reveal-reference.png` | Physical participant plus translucent-presence reveal reference |
| `assets/source-media/images/quest3-hardware-reference.png` | Quest 3 headset and controller hardware reference |

## Brand

- `assets/brand/anuma-logo.png` — available raster logo; request or create an approved SVG before final production if possible.

## Brand discovery reference

- `references/brand-discovery/analysis.html`
- `references/brand-discovery/analysis.css`
- `references/brand-discovery/analysis.js`
- `references/brand-discovery/analysis-data.js`

Use these for ethos and strategic context, not as page code.

## External references

- Previous pilot copy: `https://anuma.com/clearlight`
- RCT project's older page: `https://www.intangiblerealitieslab.org/projects/numadelic`
- Candidate film: `https://www.youtube.com/watch?v=yCyCmNLmMd4`
- VGPU Flare reference: `https://vgpu.sh/examples/nextjs-flare`
- Canvas UI Liquid reference: `https://canvasui.dev/docs/components/liquid`

External references must not override V3. Verify dependencies and licenses before implementation.
