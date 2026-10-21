/**
 * Fades the edge of a sideways row where more cards wait beyond it (D-131,
 * D-132), so a visitor sees another card is coming. The fade belongs to the
 * row's window, not to any card: cards pass through one fixed gradient as the
 * row scrolls, so nothing changes state and nothing pops. `data-more` says
 * which edges have more beyond them ("start", "end"); landing.css eases each
 * edge's fade in and out. Returns the cleanup.
 */
export function observeEdgeFade(rail: HTMLElement): () => void {
  rail.classList.add("edge-fade");
  // A snap point can sit a few pixels in from either end (the row's padding).
  const read = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const more = [rail.scrollLeft > 8 && "start", rail.scrollLeft < max - 8 && "end"].filter(Boolean).join(" ");
    if (rail.dataset.more !== more) rail.dataset.more = more;
  };
  const sizes = new ResizeObserver(read);
  sizes.observe(rail);
  rail.addEventListener("scroll", read, { passive: true });
  return () => {
    sizes.disconnect();
    rail.removeEventListener("scroll", read);
  };
}
