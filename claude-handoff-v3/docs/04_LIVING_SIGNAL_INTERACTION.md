# La señal viva — V3 interaction specification

## Core idea

One luminous presence changes state as the page progresses. It is a narrative guide, not a decorative cursor follower.

## State sequence

| State | Section | Light behavior |
|---|---|---|
| `HUMAN_REVEAL` | 1 | Seven blurred bodies; pointer reveals aligned Quest 3 humans through a feathered opacity mask |
| `COALESCE` | 1 → 2 | The bodies gather into one light; pointer reveal disables before gathering begins |
| `REST_BOTTOM` | 2 | One fixed-size light, half outside bottom center; no trail |
| `REST_TOP` | 3 | Same light and size, half outside top center |
| `STAGE_GUIDE` | 4 | Light shrinks to a waypoint and travels through S0–S6 |
| `ONBOARDING_SOURCE` | 5 | Light grows and rests partially outside top-right while three onboarding states change |
| `TWO_GROUP_SPLIT` | 6 | Light moves to center and separates into exactly two equal lights |
| `HEART_DISSOLVE` | 7 | The lights reunite and dissolve into the VR participant's heart center |
| `FIRE_RESOLVE` | 8 | A small irregular orange fire light appears beneath the blurred group arc; optional reveal returns |

## Hero reveal behavior

- Two full-size registered layers occupy the same box.
- Default visible layer: `hero-luminous-soft-v3.png`.
- Underlayer: `hero-physical-quest3-v3.png`.
- A large feathered radial mask follows pointer position with subtle interpolation.
- Inside the mask, physical opacity approaches 0.9.
- Luminous layer remains approximately 0.2–0.35 visible to preserve the cloud overlay.
- Mask diameter should be generous enough to reveal a torso, headset and both controllers.
- No hard edge, outline, glass lens, magnification or displacement.
- Disable the reveal as soon as coalescence begins.

## Progress model

Use the verified Scroll Craft progress mechanism if available. Otherwise derive normalized local progress with Intersection Observer plus the project's established animation system. Do not build a high-frequency raw scroll loop.

## Section 2–3 invariant

Both sections share one responsive diameter token. Position changes; size does not.

```css
--travel-light-size: clamp(15rem, 25vw, 26.25rem);
```

This value is guidance, not a mandatory literal if Taste requires a small optical adjustment. The rendered diameter must still match visually.

## Two-group invariant

Program and control lights use the same component and tokens. Only text labels differ. Do not create separate visual variants.

## Touch and reduced motion

- Touch uses press-and-hold or an explicit reveal control.
- Reduced motion starts in stable section states and cross-fades directly.
- Stage and onboarding content remains accessible through ordinary controls or document flow.
- No essential content depends on scroll position, hover or animation completion.
