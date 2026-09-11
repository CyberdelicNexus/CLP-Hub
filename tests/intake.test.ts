import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ELIGIBILITY_REASON_CATEGORIES,
  REASON_NOTE_MAX_LENGTH,
  acceptsReason,
  isValidReasonNote,
  reasonsFor,
  requiresReason,
  validateReason,
  type EligibilityReason,
} from "@/domain/eligibility-reason";
import {
  FIELD_CLASSES_NEVER_TRANSFERABLE,
  INTAKE_TARGETS,
  QUALTRICS_FIELD_CLASSES,
  TARGET_FIELD_CLASS,
  isTransferableFieldClass,
  isValidExternalRef,
  selectTransferableFields,
  validateMapping,
  type QualtricsFieldMapping,
} from "@/domain/intake";
import { ELIGIBILITY_STATUSES } from "@/domain/participant-state";
import { ACTIVE_APPLICATION_SOURCES, APPLICATION_SOURCES } from "@/domain/recruitment";

// ---------------------------------------------------------------------------
// The Qualtrics boundary
// ---------------------------------------------------------------------------

describe("external reference", () => {
  it("accepts a Qualtrics response id", () => {
    expect(isValidExternalRef("R_1a2B3c4D5e6F7g8")).toBe(true);
  });

  it("accepts other opaque identifiers a study might key on", () => {
    expect(isValidExternalRef("panel-4471")).toBe(true);
    expect(isValidExternalRef("sv:2026.09:0042")).toBe(true);
  });

  /**
   * THE POINT OF THE PATTERN. This column is what lets a participant be operated
   * on without their identity being copied out of Qualtrics. A name typed into
   * it would defeat that silently, so anything that reads like prose is refused.
   */
  it("refuses anything that reads like a person", () => {
    expect(isValidExternalRef("María García")).toBe(false);
    expect(isValidExternalRef("maria@example.org")).toBe(false);
    expect(isValidExternalRef("la del jueves")).toBe(false);
    expect(isValidExternalRef("")).toBe(false);
  });
});

describe("qualtrics field mappings", () => {
  it("refuses every identifiable or research class outright", () => {
    for (const cls of FIELD_CLASSES_NEVER_TRANSFERABLE) {
      expect(isTransferableFieldClass(cls)).toBe(false);
      expect(
        validateMapping({ sourceField: "QID1", sourceClass: cls, target: "participant.externalRef" }),
      ).toBe("classNeverTransferable");
    }
  });

  it("names IDENTIFIABLE and RESEARCH among the never-transferable classes", () => {
    // Locks the list down: widening it is a deliberate edit that breaks a test,
    // not something that can happen by adding an enum member.
    expect([...FIELD_CLASSES_NEVER_TRANSFERABLE].sort()).toEqual(["IDENTIFIABLE", "RESEARCH"]);
  });

  it("covers every field class exactly once across the two lists", () => {
    for (const cls of QUALTRICS_FIELD_CLASSES) {
      const never = FIELD_CLASSES_NEVER_TRANSFERABLE.includes(cls);
      expect(never).toBe(!isTransferableFieldClass(cls));
    }
  });

  it("requires the destination to expect the class the source carries", () => {
    expect(
      validateMapping({
        sourceField: "consentAccepted",
        sourceClass: "OPERATIONAL",
        target: "participant.externalRef",
      }),
    ).toBe("classTargetMismatch");

    expect(
      validateMapping({
        sourceField: "ResponseId",
        sourceClass: "ANONYMOUS_ID",
        target: "participant.externalRef",
      }),
    ).toBeNull();
  });

  it("has a declared class for every target, and none of them identifiable", () => {
    for (const target of INTAKE_TARGETS) {
      const cls = TARGET_FIELD_CLASS[target];
      expect(cls).toBeDefined();
      expect(isTransferableFieldClass(cls)).toBe(true);
    }
  });

  it("transfers nothing at all while the integration is disabled", () => {
    const mappings: QualtricsFieldMapping[] = [
      {
        id: "1",
        sourceField: "ResponseId",
        sourceClass: "ANONYMOUS_ID",
        target: "participant.externalRef",
        enabled: true,
      },
    ];
    expect(selectTransferableFields(mappings, "DISABLED")).toEqual([]);
    expect(selectTransferableFields(mappings, "TEST_ANONYMIZED")).toHaveLength(1);
  });

  it("ignores a mapping nobody switched on", () => {
    const mappings: QualtricsFieldMapping[] = [
      {
        id: "1",
        sourceField: "ResponseId",
        sourceClass: "ANONYMOUS_ID",
        target: "participant.externalRef",
        enabled: false,
      },
    ];
    expect(selectTransferableFields(mappings, "TEST_ANONYMIZED")).toEqual([]);
  });
});

describe("no transfer code exists", () => {
  const source = readFileSync(join(process.cwd(), "src/domain/intake.ts"), "utf8");

  /**
   * The guarantee is "no integration is implemented", and it is much easier to
   * audit as an absolute than as a set of guards — the same argument D-018 makes
   * about randomization. If someone adds a client here, this fails loudly.
   */
  it("contains no HTTP client, credential or endpoint", () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest|axios|https?:\/\/[a-z]/i);
    expect(source).not.toMatch(/api[_-]?token|apiKey|bearer|datacenter/i);
  });
});

describe("application sources", () => {
  it("keeps the retired public form value so old rows stay readable", () => {
    expect(APPLICATION_SOURCES).toContain("PUBLIC_FORM");
  });

  it("does not offer the public form as a route anything can create today", () => {
    expect(ACTIVE_APPLICATION_SOURCES).not.toContain("PUBLIC_FORM");
    expect(ACTIVE_APPLICATION_SOURCES).toContain("QUALTRICS");
  });
});

describe("the public page collects nothing", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/(public)/participar/page.tsx"),
    "utf8",
  );

  /**
   * The digital consent is accepted in Qualtrics BEFORE any datum is collected,
   * the name included. A form on this page would necessarily collect one first,
   * which is the exact order the study must not work in (D-031).
   */
  it("renders no form, input or server action", () => {
    expect(page).not.toMatch(/<form/);
    expect(page).not.toMatch(/<input/i);
    expect(page).not.toMatch(/useActionState|"use server"/);
  });
});

// ---------------------------------------------------------------------------
// Eligibility reasons
// ---------------------------------------------------------------------------

const reason = (over: Partial<EligibilityReason> = {}): EligibilityReason => ({
  id: "r1",
  code: "FUERA_DE_RANGO",
  category: "DID_NOT_MEET_CRITERIA",
  labelEs: "No cumple un criterio de inclusión",
  labelEn: null,
  appliesTo: ["INELIGIBLE"],
  position: 0,
  active: true,
  ...over,
});

describe("when a reason is required", () => {
  it("demands one for an exclusion and for a review", () => {
    expect(requiresReason("INELIGIBLE")).toBe(true);
    expect(requiresReason("REVIEW_REQUIRED")).toBe(true);
  });

  /**
   * A reason recorded beside an inclusion would be a clinical justification —
   * exactly the Category C statement this database must not hold.
   */
  it("accepts none at all for an eligible determination", () => {
    expect(acceptsReason("ELIGIBLE")).toBe(false);
    expect(requiresReason("ELIGIBLE")).toBe(false);
    expect(
      validateReason({ status: "ELIGIBLE", reason: reason({ appliesTo: ["ELIGIBLE"] }), note: null }),
    ).toBe("reasonNotAllowed");
  });

  it("permits but does not force one for a waitlist", () => {
    expect(acceptsReason("WAITLIST")).toBe(true);
    expect(requiresReason("WAITLIST")).toBe(false);
    expect(validateReason({ status: "WAITLIST", reason: null, note: null })).toBeNull();
  });

  it("refuses an exclusion with no reason", () => {
    expect(validateReason({ status: "INELIGIBLE", reason: null, note: null })).toBe(
      "reasonRequired",
    );
  });

  it("refuses a reason that does not apply to the determination", () => {
    expect(
      validateReason({
        status: "REVIEW_REQUIRED",
        reason: reason({ appliesTo: ["INELIGIBLE"] }),
        note: null,
      }),
    ).toBe("reasonNotApplicable");
  });

  it("never requires a reason it would then refuse", () => {
    // A status that demands a reason must also accept one, or nothing could be
    // recorded for it at all.
    for (const s of ELIGIBILITY_STATUSES) {
      if (requiresReason(s)) expect(acceptsReason(s)).toBe(true);
    }
  });
});

describe("the reason note", () => {
  it("is capped and single-line", () => {
    expect(isValidReasonNote("Reagendar en septiembre")).toBe(true);
    expect(isValidReasonNote("a".repeat(REASON_NOTE_MAX_LENGTH))).toBe(true);
    expect(isValidReasonNote("a".repeat(REASON_NOTE_MAX_LENGTH + 1))).toBe(false);
  });

  /**
   * Newlines are what turn a one-line note into a clinical narrative, so they
   * are refused rather than trimmed.
   */
  it("refuses anything with line breaks", () => {
    expect(isValidReasonNote("linea uno\nlinea dos")).toBe(false);
    expect(isValidReasonNote("linea uno\r\nlinea dos")).toBe(false);
  });

  it("is rejected by validateReason when too long", () => {
    expect(
      validateReason({
        status: "INELIGIBLE",
        reason: reason(),
        note: "a".repeat(REASON_NOTE_MAX_LENGTH + 1),
      }),
    ).toBe("noteTooLong");
  });
});

describe("choosing among configured reasons", () => {
  const reasons = [
    reason({ id: "b", code: "B", position: 2, appliesTo: ["INELIGIBLE"] }),
    reason({ id: "a", code: "A", position: 1, appliesTo: ["INELIGIBLE", "WAITLIST"] }),
    reason({ id: "off", code: "OFF", position: 0, appliesTo: ["INELIGIBLE"], active: false }),
  ];

  it("returns only active, applicable reasons in configured order", () => {
    expect(reasonsFor(reasons, "INELIGIBLE").map((r) => r.id)).toEqual(["a", "b"]);
    expect(reasonsFor(reasons, "WAITLIST").map((r) => r.id)).toEqual(["a"]);
  });

  it("offers nothing for a determination that takes no reason", () => {
    expect(reasonsFor(reasons, "ELIGIBLE")).toEqual([]);
  });
});

describe("reason categories", () => {
  it("carries the CONSORT groupings a flow diagram reports under", () => {
    for (const c of ["DID_NOT_MEET_CRITERIA", "DECLINED", "OTHER"] as const) {
      expect(ELIGIBILITY_REASON_CATEGORIES).toContain(c);
    }
  });

  /**
   * A category names WHETHER a criterion was met, never WHICH one. If a category
   * ever encodes a clinical concept, the boundary in
   * docs/research-data-boundaries.md has moved without a decision.
   */
  it("names no clinical concept", () => {
    const clinical = /diagnos|symptom|medicat|depress|anxiet|psych|score|severity|salud|sintoma/i;
    for (const c of ELIGIBILITY_REASON_CATEGORIES) {
      expect(c).not.toMatch(clinical);
    }
  });
});

// ---------------------------------------------------------------------------
// The migration keeps the same promises the code does
// ---------------------------------------------------------------------------

describe("migration 0007", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0007_intake_and_exclusions.sql"),
    "utf8",
  );

  it("refuses identifiable and research mappings in the database, not only in code", () => {
    expect(sql).toMatch(/qualtrics_field_mappings_no_identifiable/);
    expect(sql).toMatch(/source_class in \('ANONYMOUS_ID','OPERATIONAL'\)/);
  });

  it("requires a reason for an exclusion at the database level", () => {
    expect(sql).toMatch(/screenings_reason_required/);
  });

  it("is additive only", () => {
    // Nothing in this migration may drop or rewrite existing data. A `drop
    // table`, `drop column` or bare `update` here would be a destructive change
    // that was never reviewed as one.
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/^\s*update\s+/im);
    expect(sql).not.toMatch(/delete\s+from/i);
  });
});
