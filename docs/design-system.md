# Design system

Direction: **soft modern** — a bento-grid surface system with rounded cards, pastel
accent surfaces and soft elevation, in light and dark. It is applied to the staff
dashboard, the sign-in page and the public landing shell.

Everything below is a token. No component may hardcode a colour, a radius or a
shadow. Tokens live in `src/app/globals.css`; the `@theme inline` block maps them
onto Tailwind utilities.

## Colour

Two complete palettes are defined: `:root` (light) and `.dark`. The `.dark` class
is written onto `<html>` by `next-themes`, which the `@custom-variant dark` rule
keys off.

| Group | Tokens | Use |
|---|---|---|
| Base | `background`, `foreground`, `card`, `popover` | Page and surface fills |
| Brand | `primary`, `primary-foreground` | Ink-black buttons in light, near-white in dark |
| Support | `secondary`, `muted`, `muted-foreground`, `accent`, `border`, `input`, `ring` | Chrome and quiet text |
| Accent surfaces | `surface-{lilac,peach,mint,sky}` + `-ink` pair | Bento tile fills and icon chips |
| Status | `status-{success,warning,critical,info}-{bg,fg}` | `StatusBadge` only |
| Charts | `chart-1` … `chart-5` | Series colours (Phase 1+) |

**The accent-surface rule.** Pastels are *backgrounds only*. Text placed on one
must use its paired `-ink` token, which is darkened in light mode and lightened in
dark mode to hold ≥ 4.5:1. Never set body text in a pastel, and never let an
accent surface carry meaning on its own — the "Sin datos" chips on the overview
are decorative, and the status of a record is always also stated in words.

## Type

| Role | Family | Variable |
|---|---|---|
| Display (h1–h3) | Plus Jakarta Sans | `--font-display` → `font-heading` |
| Body / UI | Geist | `--font-body` → `font-sans` |
| Mono | Geist Mono | `--font-geist-mono` → `font-mono` |

Headings get `-0.02em` tracking. Any element carrying a number or an identifier
takes the `data-numeric` attribute, which applies `tabular-nums` so values do not
jitter as they change.

> Note: before this change `--font-sans` was mapped to itself and resolved to
> nothing, so the whole UI silently fell back to the browser default font. The
> variables above are the fix.

## Shape and elevation

`--radius` is `0.875rem`; the `radius-*` scale derives from it. Elevation is three
diffuse, low-opacity tokens — `shadow-soft`, `shadow-lift`, `shadow-float` — each
re-declared in `.dark` with higher opacity, because a shadow tuned for white is
invisible on a dark ground. Card edges use `ring-1 ring-foreground/10` rather than
a border so they read softly in both modes.

## Motion

- Micro-interactions 150–300ms, `ease-out` on entry.
- `--ease-out-soft` (`cubic-bezier(0.22, 1, 0.36, 1)`) for reveals.
- `<Reveal>` (`src/components/reveal.tsx`) fades content in on scroll via
  `IntersectionObserver`, staggered by at most ~240ms.
- The `.reveal` hidden state is scoped to `@media (scripting: enabled)`, so with
  JavaScript disabled the content is simply visible rather than stuck at
  `opacity: 0`. This matters: the landing page is participant-facing.
- A global `prefers-reduced-motion` block collapses all animation and disables
  smooth scrolling.

## Theming

`next-themes` with `attribute="class"`, `defaultTheme="system"`. `<html>` carries
`suppressHydrationWarning` because the provider writes the class before hydration.

The theme is a **device-local rendering preference** held in `localStorage`. Unlike
the locale — which is stored on the staff profile and audited (D-007) — it is not
user state, is not persisted server-side, and is not audited. `ThemeToggle` reads
the hydration boundary with `useSyncExternalStore` rather than a mount effect, so
it neither mismatches on hydration nor trips the React `set-state-in-effect` rule.

## Accessibility rules applied

- Contrast ≥ 4.5:1 for text in both modes; accent surfaces always paired with ink.
- Every interactive element keeps a visible focus ring (`focus-visible:ring-3`).
- Icon-only controls carry an `aria-label`; decorative icons and shapes are
  `aria-hidden`.
- Colour is never the only signal.
- Skip-to-content link on the dashboard shell.

## Landing page

`src/app/(public)/page.tsx` is a **design foundation, not the recruitment site**.
Structure: floating pill nav → hero → highlights bento → process → data note →
footer.

All of its copy is deliberately generic placeholder text in `messages/*.json`. It
names no trial, no arm, no schedule and no eligibility criterion, states no
compliance claim, and collects no participant data. Real study content is
configuration and arrives from the database in Phase 5 — it must not be moved into
the message catalogue.
