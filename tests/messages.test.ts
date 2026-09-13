import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/domain/locale";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(read(`messages/${l}.json`)) as Record<string, unknown>]),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

/** Every leaf key path in a message tree, and every key segment along the way. */
function walk(node: unknown, path: string, out: { leaves: string[]; segments: string[] }) {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    out.leaves.push(path);
    return out;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    out.segments.push(key);
    walk(value, path ? `${path}.${key}` : key, out);
  }
  return out;
}

function tree(locale: (typeof LOCALES)[number]) {
  return walk(messages[locale], "", { leaves: [], segments: [] });
}

describe("message files", () => {
  /**
   * THE BUG THIS EXISTS FOR. next-intl reads a dot in a key as nesting, so
   * `"participant.created"` made the whole `audit.action` namespace malformed
   * and every page that loaded messages logged INVALID_KEY. The stored audit
   * action keeps its dot — that is the database vocabulary — and the message
   * key uses `__` instead, translated at lookup.
   */
  it("has no key containing a dot", () => {
    for (const locale of LOCALES) {
      const offenders = tree(locale).segments.filter((s) => s.includes("."));
      expect(offenders, `${locale}: ${offenders.join(", ")}`).toEqual([]);
    }
  });

  /**
   * Every string is an ICU message, whether or not it has arguments.
   *
   * THE BUG THIS EXISTS FOR. Two messages showed the template syntax literally
   * — "no puede usar {{nombre}}" — and ICU reads `{` as an argument opener, so
   * they threw MALFORMED_ARGUMENT at render time. A literal brace has to be
   * quoted: `'{{'nombre'}}'`. Nothing in typecheck or lint can see this, which
   * is exactly why it survived until somebody opened the page.
   */
  it("parses every string as ICU", () => {
    const broken: string[] = [];
    for (const locale of LOCALES) {
      const visit = (node: unknown, path: string) => {
        if (typeof node === "string") {
          try {
            new IntlMessageFormat(node, locale);
          } catch {
            broken.push(`${locale}:${path}`);
          }
          return;
        }
        if (node && typeof node === "object") {
          for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            visit(value, path ? `${path}.${key}` : key);
          }
        }
      };
      visit(messages[locale], "");
    }
    expect(broken).toEqual([]);
  });

  /** A key present in Spanish and missing in English is an untranslated screen. */
  it("defines the same keys in every locale", () => {
    const [first, ...rest] = LOCALES;
    const base = new Set(tree(first).leaves);
    for (const locale of rest) {
      const other = new Set(tree(locale).leaves);
      const missing = [...base].filter((k) => !other.has(k));
      const extra = [...other].filter((k) => !base.has(k));
      expect(missing, `missing from ${locale}`).toEqual([]);
      expect(extra, `only in ${locale}`).toEqual([]);
    }
  });
});

describe("audit action labels", () => {
  /**
   * Every action the services actually write, collected from source rather than
   * from a list somebody has to remember to update.
   *
   * `recordAuditEvent` validates the `<entity>.<verb>` shape at runtime, so this
   * regex matches what will actually reach the database. Actions chosen by a
   * ternary are caught too, because each branch is still a quoted literal.
   */
  const emitted = new Set<string>();
  const dir = join(root, "src");
  const files: string[] = [];
  const collect = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  collect(dir);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/action:\s*\n?\s*(?:[^,;]*?\?\s*)?"([a-z_]+\.[a-z_]+)"/g)) {
      emitted.add(match[1]);
    }
    for (const match of source.matchAll(/:\s*"([a-z_]+\.[a-z_]+)",?\s*$/gm)) {
      // The `false` branch of a ternary on its own line.
      if (/audit|action/i.test(source.slice(Math.max(0, match.index - 200), match.index))) {
        emitted.add(match[1]);
      }
    }
  }

  it("found the actions in the source", () => {
    // A sanity floor. If the regex stops matching, this fails loudly rather
    // than silently asserting nothing.
    expect(emitted.size).toBeGreaterThan(50);
    expect(emitted.has("participant.created")).toBe(true);
    expect(emitted.has("alert.raised")).toBe(true);
    expect(emitted.has("user_role.granted")).toBe(true);
  });

  /**
   * The audit panel falls back to the raw key rather than hiding an entry, so a
   * missing label is cosmetic — but it is the history screen a researcher reads,
   * and half of it in snake_case is not a finished product.
   */
  it("labels every action in every locale", () => {
    for (const locale of LOCALES) {
      const actions = (messages[locale].audit as { action: Record<string, string> }).action;
      const missing = [...emitted].filter((a) => !actions[a.replace(".", "__")]).sort();
      expect(missing, `${locale} is missing labels`).toEqual([]);
    }
  });

  it("labels nothing that is never written", () => {
    const actions = Object.keys(
      (messages.es.audit as { action: Record<string, string> }).action,
    ).map((k) => k.replace("__", "."));
    const orphans = actions.filter((a) => !emitted.has(a)).sort();
    expect(orphans, "labels for actions no service writes").toEqual([]);
  });
});
