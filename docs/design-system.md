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
| Brand gradient | `gradient-brand` (built from `chart-1/2/3`) | `.text-gradient-brand`, `.bg-gradient-brand`; team dashboard only |
| Glass chrome | `glass-bg`, `glass-bg-strong`, `glass-border`, `glass-highlight` | `.glass-panel`, `.glass-panel-strong`; nav surfaces only |

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

## Brand gradient (2026-09-18)

`--gradient-brand` is a 135° linear gradient across `chart-1 → chart-2 →
chart-3`, so it stays paired between light and dark without introducing new
hues outside the token set. Two utilities:

- `.text-gradient-brand` — gradient text (`background-clip: text`), used
  sparingly for a greeting or a headline accent, never for body copy or
  anything that must hit the 4.5:1 text-contrast rule above, since a gradient
  cannot guarantee a single contrast ratio against its own background.
- `.bg-gradient-brand` — a solid gradient fill, used as a 4px accent strip on
  the overview stat tiles and behind small count badges (dark ink text on top,
  since the gradient's lightness is too high for white text to clear 4.5:1).

**`.card-accent` (2026-09-18, D-069; updated 2026-09-19, D-070)** — the
card-level gradient treatment, replacing an earlier background-wash variant
the founder first rejected as too loud ("ghost gradients") and then asked
back in, fainter, alongside the border and bar rather than instead of them.
Three layers, all from the same `chart-1`/`chart-2`/`chart-3` hues so light
and dark stay paired:
- `--gradient-brand-fill` — a very faint (5–10%) diagonal wash mixed into
  `--card`, the reinstated background tint.
- `--gradient-brand-border` — the card's own border, gradient-tinted.
- `--gradient-brand-vertical`, drawn by a `::before` pseudo-element as a 3px
  bar down the left edge, `inset-block: 0` (full height, not inset) — the
  point of strongest colour.

`overflow: hidden` is part of the utility itself, not left to call sites, so
the left bar is clipped by the card's own `rounded-*` class instead of
overhanging past its corners ("the left border should also touch the
rounded corners"). Used on the dashboard/Evaluación/Logística VR stat tiles,
the selected row in the Cohortes stack, and the Cohortes/status-team
summary card.

**Page background (2026-09-19, D-070).** `--gradient-page` puts the same
two hues at 4–8% behind the whole app shell (`body`, `background-attachment:
fixed` so it doesn't tile per-page) — "a subtle dark gradient on the whole
page background that adapts to light and dark mode." Independent of
`.card-accent`'s own fill; both exist so a card reads as a slightly denser
version of the same ambient colour behind it, not a different one.

**Scrollbars (2026-09-19).** `scrollbar-color` (Firefox) and
`::-webkit-scrollbar*` (everything else) are set globally in `@layer base`
so every scrollbar uses `--border` (thumb) over a transparent track instead
of the OS default, adapting to the theme like everything else here.

## Glass chrome (2026-09-18)

The team dashboard's **navigation chrome** — the sidebar and the header bar —
uses a glassmorphism treatment (`.glass-panel` / `.glass-panel-strong`):
translucent fill, a hairline border, an inset top highlight, and
`backdrop-filter: blur()` guarded by `@supports` and
`prefers-reduced-transparency: no-preference` so it degrades to the plain
opaque fill rather than breaking. This is deliberately scoped to chrome, not
applied to content `Card`s — the bento-grid surface system above still holds
for everything the user reads and edits, per CLAUDE.md rule 2 (inspect before
modifying, don't rewrite working architecture for stylistic preference).

The sidebar also collapses to an icon rail (`SidebarShell`,
`src/components/team/sidebar-shell.tsx`) via a toggle in its own top-right
corner. Collapsed state lives in `localStorage`, per-browser like the theme
preference above — a viewport preference, not account data, so it is not
audited or synced.

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

`src/app/(public)/page.tsx` is the **Clear Light recruitment landing page**, and
it does not use the soft-modern system above. It is one locked dark theme with
Living Teal as the only interface accent, Manrope for the interface and IBM Plex
Mono for identifiers, themed over the vendored scroll-craft floor
(`src/components/landing/scrollcraft.css`). Its tokens, sections, motion and
accessibility behaviour are documented in `docs/landing-page.md` (D-042). The
soft-modern system continues to apply to `/participar`, `/estudio/...` and the
team dashboard.
