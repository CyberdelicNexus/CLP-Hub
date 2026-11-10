import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStudyLocal, toStudyLocal } from "@/lib/study-time";

const MADRID = "Europe/Madrid";

describe("parseStudyLocal", () => {
  it("reads a winter wall-clock time in the study's zone (UTC+1)", () => {
    expect(parseStudyLocal("2026-11-19T18:00", MADRID)?.toISOString()).toBe("2026-11-19T17:00:00.000Z");
  });

  it("reads a summer wall-clock time in the study's zone (UTC+2)", () => {
    expect(parseStudyLocal("2026-07-01T18:00", MADRID)?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });

  it("settles times on both DST changeover days", () => {
    // Spring forward 2026-03-29 02:00 → 03:00; an evening session that day is UTC+2.
    expect(parseStudyLocal("2026-03-29T18:00", MADRID)?.toISOString()).toBe("2026-03-29T16:00:00.000Z");
    // Fall back 2026-10-25 03:00 → 02:00; an evening session that day is UTC+1.
    expect(parseStudyLocal("2026-10-25T18:00", MADRID)?.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("returns null for anything that is not a datetime-local value", () => {
    expect(parseStudyLocal("", MADRID)).toBeNull();
    expect(parseStudyLocal("2026-11-19", MADRID)).toBeNull();
    expect(parseStudyLocal("not a date", MADRID)).toBeNull();
  });

  it("round-trips with toStudyLocal", () => {
    for (const v of ["2026-01-15T09:30", "2026-07-01T18:00", "2026-11-19T23:59"]) {
      expect(toStudyLocal(parseStudyLocal(v, MADRID) as Date, MADRID)).toBe(v);
    }
  });
});

/**
 * D-136: on Vercel the server runs in UTC, so `new Date("2026-11-19T18:00")`
 * stores 18:00 UTC and Madrid sees 19:00. Every staff form now reads its dates
 * through parseStudyLocal; this keeps a new action from slipping back.
 */
describe("staff actions read form dates in the study's timezone", () => {
  const root = join(__dirname, "..", "src", "app", "(team)");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/actions\.ts$/.test(name)) files.push(p);
    }
  };
  walk(root);

  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [f.slice(root.length + 1), f]))("%s has no new Date(parsed.data…)", (_name, file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/new Date\(\s*`?\$?\{?parsed\.data/);
  });
});
