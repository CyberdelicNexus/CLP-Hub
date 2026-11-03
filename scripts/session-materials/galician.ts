/**
 * The Spanish -> Galician swap used for the session pages (D-135): every
 * participant-visible string in a page body is looked up, whole, in
 * ./galician.json. Shared by scripts/seed-galician-pages.ts and
 * scripts/revise-session-pages.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const TEXT_KEYS = new Set(["title", "md", "caption", "alt", "description", "label", "contactLabel"]);

export function loadGalicianTable(): Record<string, string> {
  return JSON.parse(readFileSync(join(process.cwd(), "scripts/session-materials/galician.json"), "utf8"));
}

/**
 * `tr` swaps one string (keeping its leading and trailing spaces), `walk` swaps
 * every text string in a page body or block. Strings with no entry are left in
 * Spanish and collected in `missing`, so callers can refuse to write.
 */
export function galicianTranslator(table: Record<string, string>) {
  const missing = new Set<string>();

  const tr = (s: string): string => {
    const core = s.trim();
    if (!core) return s;
    const gl = table[core];
    if (gl === undefined) {
      missing.add(core);
      return s;
    }
    return s.slice(0, s.indexOf(core)) + gl + s.slice(s.indexOf(core) + core.length);
  };

  const walk = (n: unknown, key?: string): unknown => {
    if (Array.isArray(n)) return n.map((v) => (typeof v === "string" && key === "items" ? tr(v) : walk(v, key)));
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(o).map(([k, v]) => [
          k,
          typeof v === "string" && ((k === "text" && o.type === "text") || TEXT_KEYS.has(k)) ? tr(v) : walk(v, k),
        ]),
      );
    }
    return n;
  };

  return { tr, walk, missing };
}
