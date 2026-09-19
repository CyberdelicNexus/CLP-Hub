/**
 * The read-only cover banner — always horizontally centred, its vertical
 * crop focus adjustable per version (`position`, 0-100), fading into the
 * page background at its bottom edge rather than ending on a hard line
 * (2026-09-19 follow-up to D-071's cover image). Shared by the staff
 * editor's own preview, the published-version card, and both public page
 * templates, so every context renders the same shape — a plain server
 * component, no editing affordance here at all (see `contenido/
 * cover-banner.tsx`'s `CoverBanner` for the editable version).
 */
export function CoverImage({
  url,
  position,
  bleed = true,
  variant = "card",
}: {
  url: string | null;
  position: number;
  /** True inside a padded card, to bleed past its own side padding; false
   * on the public page, which has no padding of its own to bleed past.
   * Ignored by the "hero" variant, which always bleeds to the viewport. */
  bleed?: boolean;
  /**
   * "card": the thin, contained banner used inside staff cards (default).
   * "hero" (2026-09-19 follow-up: "update the cover to fill the whole page
   * and always at the top of the page"): full viewport width via the
   * standard `left-1/2 -mx-[50vw]` full-bleed trick — works even nested
   * inside a constrained column, since the offset is computed against the
   * viewport, not the parent — and taller, for the public study pages only.
   */
  variant?: "card" | "hero";
}) {
  if (!url) return null;

  if (variant === "hero") {
    return (
      <div className="relative left-1/2 -mx-[50vw] h-56 w-screen overflow-hidden sm:h-72 md:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: `center ${position}%` }}
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-background" />
      </div>
    );
  }

  return (
    <div
      className={
        bleed
          ? "relative -mx-6 -mt-6 h-40 overflow-hidden sm:h-52"
          : "relative h-40 overflow-hidden rounded-2xl sm:h-52"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        style={{ objectPosition: `center ${position}%` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
