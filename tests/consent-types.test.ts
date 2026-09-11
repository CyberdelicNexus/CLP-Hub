import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSENT_TYPES,
  canCarryScopes,
  missingConsentTypes,
  scopesFor,
  validateScopes,
  type ConsentScope,
} from "@/domain/consent";

const scope = (over: Partial<ConsentScope> = {}): ConsentScope => ({
  id: "s1",
  code: "ENTREVISTA",
  labelEs: "Autoriza una entrevista",
  labelEn: null,
  consentType: "PHYSICAL",
  position: 10,
  active: true,
  ...over,
});

describe("consent types", () => {
  it("has exactly the two moments the study has", () => {
    expect([...CONSENT_TYPES]).toEqual(["DIGITAL", "PHYSICAL"]);
  });

  /**
   * A remote tick-box accepted before the person has met anyone is not where
   * you agree to being filmed (D-032). Refused, not quietly ignored.
   */
  it("lets only the in-person consent carry authorizations", () => {
    expect(canCarryScopes("PHYSICAL")).toBe(true);
    expect(canCarryScopes("DIGITAL")).toBe(false);

    expect(
      validateScopes({ type: "DIGITAL", granted: ["ENTREVISTA"], configured: [scope()] }),
    ).toBe("scopesNotAllowed");
  });

  it("accepts a configured scope on a physical consent", () => {
    expect(
      validateScopes({ type: "PHYSICAL", granted: ["ENTREVISTA"], configured: [scope()] }),
    ).toBeNull();
  });

  it("refuses a scope the study never configured", () => {
    expect(
      validateScopes({ type: "PHYSICAL", granted: ["INVENTADO"], configured: [scope()] }),
    ).toBe("unknownScope");
  });

  it("refuses a scope that has been retired", () => {
    expect(
      validateScopes({
        type: "PHYSICAL",
        granted: ["ENTREVISTA"],
        configured: [scope({ active: false })],
      }),
    ).toBe("unknownScope");
  });

  it("treats granting nothing as valid for either type", () => {
    for (const type of CONSENT_TYPES) {
      expect(validateScopes({ type, granted: [], configured: [scope()] })).toBeNull();
    }
  });

  it("offers scopes in configured order, and none for a digital consent", () => {
    const scopes = [
      scope({ id: "b", code: "DOCUMENTAL", position: 20 }),
      scope({ id: "a", code: "ENTREVISTA", position: 10 }),
      scope({ id: "off", code: "RETIRADO", position: 5, active: false }),
    ];
    expect(scopesFor(scopes, "PHYSICAL").map((s) => s.id)).toEqual(["a", "b"]);
    expect(scopesFor(scopes, "DIGITAL")).toEqual([]);
  });
});

describe("which consents are missing", () => {
  /**
   * THE RULE THIS FUNCTION MUST NOT CONTAIN. It does not know that a control arm
   * needs less than an experimental one — it is handed `requiresPhysical` from
   * arm configuration and only subtracts what is recorded from what is required
   * (non-negotiable 3).
   */
  it("expects the digital consent from everyone", () => {
    expect(missingConsentTypes({ requiresPhysical: null, activeTypes: [] })).toEqual(["DIGITAL"]);
    expect(missingConsentTypes({ requiresPhysical: false, activeTypes: [] })).toEqual(["DIGITAL"]);
  });

  it("expects the physical consent only where the arm is configured to need it", () => {
    expect(
      missingConsentTypes({ requiresPhysical: true, activeTypes: ["DIGITAL"] }),
    ).toEqual(["PHYSICAL"]);
    expect(
      missingConsentTypes({ requiresPhysical: false, activeTypes: ["DIGITAL"] }),
    ).toEqual([]);
  });

  /**
   * Not yet allocated is not the same as "does not need one". Claiming a
   * physical consent is missing before anyone knows the arm would be the
   * application inventing a protocol requirement.
   */
  it("claims nothing about an unallocated participant's physical consent", () => {
    expect(missingConsentTypes({ requiresPhysical: null, activeTypes: ["DIGITAL"] })).toEqual([]);
  });

  it("reports nothing once both recorded consents are in force", () => {
    expect(
      missingConsentTypes({ requiresPhysical: true, activeTypes: ["DIGITAL", "PHYSICAL"] }),
    ).toEqual([]);
  });
});

describe("migration 0008", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0008_consent_types.sql"),
    "utf8",
  );

  it("allows one active consent per type rather than one per participant", () => {
    expect(sql).toMatch(/consents_one_active_per_participant_type/);
    expect(sql).toMatch(/on consents \(participant_id, consent_type\)/);
  });

  it("states the impact of replacing the old index in the file itself", () => {
    // The relaxed invariant has to be legible to whoever reviews or reverts
    // this, not buried in a commit message.
    expect(sql).toMatch(/IMPACT/);
    expect(sql).toMatch(/reversible/i);
  });

  it("keeps authorizations off the digital consent at the database level", () => {
    expect(sql).toMatch(/consents_scopes_physical_only/);
  });

  it("deletes nothing", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });
});

describe("authorizations are configuration, not columns", () => {
  const schema = readFileSync(join(process.cwd(), "src/db/schema/intake.ts"), "utf8");
  const domain = readFileSync(join(process.cwd(), "src/domain/consent.ts"), "utf8");

  /**
   * One trial's media plan must not become every study's schema
   * (non-negotiable 6). If someone adds `allowsDocumentary` as a column, this
   * fails.
   *
   * Comments are stripped first: naming an authorization as an EXAMPLE of what
   * a scope row holds is exactly how the boundary gets explained, and banning
   * the word everywhere would push that explanation out of the code. What must
   * not exist is an identifier.
   */
  it("names no specific authorization in any identifier", () => {
    const specific = /documentary|documental|interview|entrevista/i;
    expect(stripComments(schema)).not.toMatch(specific);
    expect(stripComments(domain)).not.toMatch(specific);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
