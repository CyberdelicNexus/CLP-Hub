import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COUNTRY_CODES,
  SPAIN,
  countryName,
  countryOptions,
  isCountryCode,
  isResidenceFilter,
  residenceGroup,
} from "@/domain/residence";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

describe("country of residence (D-153)", () => {
  it("is a list of two-letter codes, with Spain in it, and no duplicates", () => {
    expect(COUNTRY_CODES.length).toBeGreaterThan(240);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(isCountryCode(SPAIN)).toBe(true);
    expect(isCountryCode("es")).toBe(false);
    expect(isCountryCode("España")).toBe(false);
  });

  it("offers Spain first, then the rest by name in the visitor's language", () => {
    const es = countryOptions("es");
    expect(es[0]).toEqual({ code: "ES", name: "España" });
    expect(es).toHaveLength(COUNTRY_CODES.length);
    expect(countryName("DE", "es")).toBe("Alemania");
    expect(countryName("DE", "en")).toBe("Germany");
  });

  it("groups people as in Spain, elsewhere, or not given, for the staff filter", () => {
    expect(residenceGroup("ES")).toBe("espana");
    expect(residenceGroup("PT")).toBe("fuera");
    expect(residenceGroup(null)).toBe("sin-indicar");
    expect(isResidenceFilter("fuera")).toBe(true);
    expect(isResidenceFilter("ES")).toBe(false);
  });

  it("is checked by the database too, and filtered only for those who may see contact data", () => {
    const sql = read("supabase", "migrations", "0034_residence_country.sql");
    expect(sql).toMatch(/residence_country ~ '\^\[A-Z\]\{2\}\$'/);
    for (const page of ["participantes", "solicitudes"]) {
      const src = read("src", "app", "(team)", "hub", "(app)", page, "page.tsx");
      expect(src).toMatch(/const residence = includeContact && isResidenceFilter\(/);
    }
  });

  it("never decides anything: no eligibility or status code reads it", () => {
    for (const f of ["src/domain/next-step.ts", "src/domain/participant-state.ts", "src/domain/eligibility-reason.ts"]) {
      expect(read(f)).not.toMatch(/residence/i);
    }
  });
});
