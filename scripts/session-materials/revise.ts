/**
 * Pure part of scripts/revise-session-pages.ts: swaps whole strings and whole
 * blocks in one page body, and reports what it could not find. No database.
 */
import { TEXT_KEYS } from "./galician";

export interface RevisionOutcome {
  body: unknown[];
  /** Pairs swapped on this run. */
  applied: number;
  /** Pairs whose new text is already there and the old text is gone. */
  alreadyDone: number;
  /** Old strings found nowhere (and the new one isn't there either). */
  notFound: string[];
}

/** Every participant-visible string in a body, trimmed. */
export function bodyStrings(n: unknown, key?: string, out: string[] = []): string[] {
  if (Array.isArray(n)) {
    for (const v of n) {
      if (typeof v === "string" && key === "items") out.push(v.trim());
      else bodyStrings(v, key, out);
    }
  } else if (n && typeof n === "object") {
    const o = n as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && ((k === "text" && o.type === "text") || TEXT_KEYS.has(k))) out.push(v.trim());
      else bodyStrings(v, k, out);
    }
  }
  return out;
}

function replaceStrings(n: unknown, map: Map<string, string>, hits: Set<string>, key?: string): unknown {
  const swap = (s: string): string => {
    const core = s.trim();
    const next = map.get(core);
    if (next === undefined) return s;
    hits.add(core);
    return s.slice(0, s.indexOf(core)) + next + s.slice(s.indexOf(core) + core.length);
  };
  if (Array.isArray(n)) {
    return n.map((v) => (typeof v === "string" && key === "items" ? swap(v) : replaceStrings(v, map, hits, key)));
  }
  if (n && typeof n === "object") {
    const o = n as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        typeof v === "string" && ((k === "text" && o.type === "text") || TEXT_KEYS.has(k))
          ? swap(v)
          : replaceStrings(v, map, hits, k),
      ]),
    );
  }
  return n;
}

/**
 * Applies `pairs` (whole-string swaps) and `blocks` (replace the top-level
 * block matching `match` with `replacement`) to a page body. A block swap
 * whose replacement is already present counts as done.
 */
export function revisePage(
  body: unknown[],
  pairs: [before: string, after: string][],
  blocks: { match: (b: Record<string, unknown>) => boolean; replacement: unknown; label: string }[] = [],
): RevisionOutcome {
  let next = body;
  let applied = 0;
  let alreadyDone = 0;
  const notFound: string[] = [];

  for (const swap of blocks) {
    const i = next.findIndex((b) => b && typeof b === "object" && swap.match(b as Record<string, unknown>));
    if (i >= 0) {
      next = [...next.slice(0, i), swap.replacement, ...next.slice(i + 1)];
      applied++;
    } else if (next.some((b) => JSON.stringify(b) === JSON.stringify(swap.replacement))) {
      alreadyDone++;
    } else {
      notFound.push(`[block] ${swap.label}`);
    }
  }

  const present = new Set(bodyStrings(next));
  const map = new Map<string, string>();
  for (const [before, after] of pairs) {
    if (present.has(before)) map.set(before, after);
    else if (present.has(after)) alreadyDone++;
    else notFound.push(before);
  }
  const hits = new Set<string>();
  next = replaceStrings(next, map, hits) as unknown[];
  applied += hits.size;

  return { body: next, applied, alreadyDone, notFound };
}
