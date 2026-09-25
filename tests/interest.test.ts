import { describe, expect, it } from "vitest";
import {
  INTEREST_NAME_MAX_LENGTH,
  fullNameOf,
  normalizeInterest,
  validateInterest,
} from "@/domain/interest";
import {
  PARTICIPANT_CODE_PATTERN,
  formatInterestCode,
  formatParticipantCode,
  initialOf,
  monthYearIn,
  withCollisionSuffix,
} from "@/domain/recruitment";

const ok = { firstName: "Persona", lastName: "Sintética", email: "sintetica@example.org", phone: "+34 600 000 000" };

describe("the public expression of interest (D-086)", () => {
  it("accepts a first name, a surname, an email and a phone", () => {
    expect(validateInterest(ok)).toEqual({});
  });

  it("requires all of them", () => {
    expect(validateInterest({ firstName: "", lastName: "", email: "", phone: "" })).toEqual({
      firstName: "required",
      lastName: "required",
      email: "required",
      phone: "required",
    });
  });

  it("rejects obvious typos, not exotic formats", () => {
    expect(validateInterest({ ...ok, email: "sintetica@example" }).email).toBe("invalidEmail");
    expect(validateInterest({ ...ok, phone: "llámame" }).phone).toBe("invalidPhone");
    expect(validateInterest({ ...ok, phone: "123" }).phone).toBe("invalidPhone");
    expect(validateInterest({ ...ok, phone: "(981) 55-44-33" })).toEqual({});
  });

  it("caps a name so a narrative cannot be pasted in, and needs a letter for the code", () => {
    expect(validateInterest({ ...ok, lastName: "a".repeat(INTEREST_NAME_MAX_LENGTH + 1) }).lastName).toBe("tooLong");
    expect(validateInterest({ ...ok, firstName: "1234" }).firstName).toBe("invalidName");
  });

  it("trims and collapses whitespace, and joins the name the way Qualtrics asks for it", () => {
    const n = normalizeInterest({ firstName: "  Persona  ", lastName: " Sintética   Prueba ", email: " a@b.co ", phone: " 600  000 000 " });
    expect(n).toEqual({ firstName: "Persona", lastName: "Sintética Prueba", email: "a@b.co", phone: "600 000 000" });
    expect(fullNameOf(n)).toBe("Persona Sintética Prueba");
  });
});

describe("the participant code built from initials (D-087)", () => {
  const oct2026 = new Date("2026-10-15T12:00:00Z");

  it("is P, the two initials, then month and year", () => {
    expect(formatInterestCode({ firstName: "Juan", lastName: "Martínez", submittedAt: oct2026, timeZone: "Europe/Madrid" })).toBe("P-JM1026");
  });

  it("folds accents, ignores leading punctuation and falls back to X without a Latin letter", () => {
    expect(initialOf("Álvaro")).toBe("A");
    expect(initialOf("Ñusta")).toBe("N");
    expect(initialOf("  ('elena")).toBe("E");
    expect(initialOf("Иван")).toBe("X");
  });

  it("reads the month in the study's timezone, not the server's", () => {
    // 23:30 UTC on 30 September is already 1 October in Madrid (UTC+2 in summer).
    const edge = new Date("2026-09-30T23:30:00Z");
    expect(monthYearIn(edge, "Europe/Madrid")).toEqual({ month: "10", year: "26" });
    expect(monthYearIn(edge, "UTC")).toEqual({ month: "09", year: "26" });
  });

  it("numbers a second person with the same initials in the month", () => {
    expect(withCollisionSuffix("P-JM1026", 1)).toBe("P-JM1026");
    expect(withCollisionSuffix("P-JM1026", 2)).toBe("P-JM1026-2");
  });

  it("matches the database constraint, alongside the older sequence codes", () => {
    for (const code of ["P-JM1026", "P-JM1026-2", "P-AB0127-13", formatParticipantCode(42), "P-000014"]) {
      expect(code).toMatch(PARTICIPANT_CODE_PATTERN);
    }
    for (const code of ["P-jm1026", "P-J1026", "P-JM102", "JM1026", "P-JM1026-", "P-JM1026-x"]) {
      expect(code).not.toMatch(PARTICIPANT_CODE_PATTERN);
    }
  });

  it("keeps the migration and the domain pattern in step", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0022_participant_code_initials.sql"), "utf8");
    expect(sql).toContain(`'^P-([0-9]{6,}|[A-Z]{2}[0-9]{4}(-[0-9]+)?)$'`);
    expect(PARTICIPANT_CODE_PATTERN.source).toBe("^P-([0-9]{6,}|[A-Z]{2}[0-9]{4}(-[0-9]+)?)$");
  });
});
