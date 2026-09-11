import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NEXT_STEPS,
  isTimeSensitive,
  nextStep,
  outstandingSteps,
  type ParticipantSnapshot,
} from "@/domain/next-step";
import {
  RESPONSIBILITY_ROLES,
  VISIT_NOTES_MAX_LENGTH,
  VISIT_STATUSES,
  canTransitionVisit,
  isValidVisitNotes,
} from "@/domain/responsibility";

/** Someone at the very start: nothing recorded at all. */
const fresh = (over: Partial<ParticipantSnapshot> = {}): ParticipantSnapshot => ({
  enrollmentStatus: null,
  hasScreeningResult: false,
  hasOpenScreening: false,
  activeConsentTypes: [],
  requiresPhysicalConsent: null,
  hasAllocation: false,
  hasCohort: false,
  initialVisitStatus: null,
  hasInitialSessionResponsible: false,
  ...over,
});

describe("the next step is about a missing record", () => {
  it("asks for a screening to be booked when none exists", () => {
    expect(nextStep(fresh())).toBe("SCHEDULE_SCREENING");
  });

  it("asks for the outcome once one is booked", () => {
    expect(nextStep(fresh({ hasOpenScreening: true }))).toBe("RECORD_SCREENING_RESULT");
  });

  it("walks the pipeline in order", () => {
    const screened = fresh({ hasScreeningResult: true });
    expect(nextStep(screened)).toBe("RECORD_DIGITAL_CONSENT");

    const consented = fresh({ hasScreeningResult: true, activeConsentTypes: ["DIGITAL"] });
    expect(nextStep(consented)).toBe("RECORD_ALLOCATION");

    const allocated = fresh({
      hasScreeningResult: true,
      activeConsentTypes: ["DIGITAL"],
      hasAllocation: true,
      requiresPhysicalConsent: false,
    });
    expect(nextStep(allocated)).toBe("ASSIGN_COHORT");
  });

  /**
   * THE RULE THIS MODULE MUST NOT BREAK. An INELIGIBLE participant's next step
   * is still whatever record is missing. The application does not withhold a
   * step because it has formed an opinion about whether someone should proceed —
   * that is a protocol decision, and the eligibility badge beside the step is
   * what tells staff not to go on (non-negotiable 3).
   */
  it("never consults eligibility", () => {
    // Comments are stripped: the module explains this rule in prose, and the
    // prose has to be allowed to name the thing it is refusing to look at.
    const source = readFileSync(join(process.cwd(), "src/domain/next-step.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/eligibilityStatus|ELIGIBLE|INELIGIBLE|WAITLIST/);
  });

  it("stops entirely once someone has withdrawn or completed", () => {
    expect(nextStep(fresh({ enrollmentStatus: "WITHDRAWN" }))).toBe("NONE");
    expect(nextStep(fresh({ enrollmentStatus: "COMPLETED" }))).toBe("NONE");
    expect(outstandingSteps(fresh({ enrollmentStatus: "WITHDRAWN" }))).toEqual([]);
  });
});

describe("the physical consent step", () => {
  const base = {
    hasScreeningResult: true,
    activeConsentTypes: ["DIGITAL"] as const,
    hasAllocation: true,
  };

  it("appears only where the arm is configured to sign in person", () => {
    expect(nextStep(fresh({ ...base, requiresPhysicalConsent: true }))).toBe(
      "RECORD_PHYSICAL_CONSENT",
    );
    expect(nextStep(fresh({ ...base, requiresPhysicalConsent: false }))).toBe("ASSIGN_COHORT");
  });

  /**
   * `null` means "not yet allocated", which must not be read as `false`. Before
   * an arm is known, the app has no grounds to say a physical consent is
   * missing, and inventing one would be the application asserting a protocol
   * requirement of its own.
   */
  it("is never asserted before an allocation exists", () => {
    const unallocated = fresh({
      hasScreeningResult: true,
      activeConsentTypes: ["DIGITAL"],
      requiresPhysicalConsent: null,
    });
    expect(nextStep(unallocated)).toBe("RECORD_ALLOCATION");
    expect(outstandingSteps(unallocated)).not.toContain("RECORD_PHYSICAL_CONSENT");
  });
});

describe("the initial visit steps", () => {
  const inCohort = {
    hasScreeningResult: true,
    activeConsentTypes: ["DIGITAL"] as const,
    hasAllocation: true,
    requiresPhysicalConsent: false,
    hasCohort: true,
  };

  it("asks for the visit to be booked", () => {
    expect(nextStep(fresh(inCohort))).toBe("SCHEDULE_INITIAL_VISIT");
  });

  /**
   * An appointment with nobody attached is the one that gets missed, so naming
   * the responsible comes before recording the outcome.
   */
  it("asks who is running it before asking how it went", () => {
    expect(nextStep(fresh({ ...inCohort, initialVisitStatus: "SCHEDULED" }))).toBe(
      "ASSIGN_INITIAL_RESPONSIBLE",
    );
    expect(
      nextStep(
        fresh({ ...inCohort, initialVisitStatus: "SCHEDULED", hasInitialSessionResponsible: true }),
      ),
    ).toBe("COMPLETE_INITIAL_VISIT");
  });

  it("reports follow-up once the visit is closed", () => {
    expect(nextStep(fresh({ ...inCohort, initialVisitStatus: "COMPLETED" }))).toBe("IN_FOLLOW_UP");
    expect(nextStep(fresh({ ...inCohort, initialVisitStatus: "NO_SHOW" }))).toBe("IN_FOLLOW_UP");
  });
});

describe("outstanding steps", () => {
  it("lists everything missing, in the same order as the single next step", () => {
    const all = outstandingSteps(fresh());
    expect(all[0]).toBe(nextStep(fresh()));
    expect(all).toContain("RECORD_DIGITAL_CONSENT");
    expect(all).toContain("RECORD_ALLOCATION");
  });

  it("agrees with nextStep on its first element whenever anything is outstanding", () => {
    const cases: ParticipantSnapshot[] = [
      fresh(),
      fresh({ hasOpenScreening: true }),
      fresh({ hasScreeningResult: true }),
      fresh({ hasScreeningResult: true, activeConsentTypes: ["DIGITAL"], hasAllocation: true, requiresPhysicalConsent: true }),
    ];
    for (const c of cases) {
      const steps = outstandingSteps(c);
      if (steps.length > 0) expect(steps[0]).toBe(nextStep(c));
    }
  });
});

describe("visual weight", () => {
  it("is reserved for the two steps that fail silently", () => {
    for (const step of NEXT_STEPS) {
      const expected = step === "COMPLETE_INITIAL_VISIT" || step === "ASSIGN_INITIAL_RESPONSIBLE";
      expect(isTimeSensitive(step)).toBe(expected);
    }
  });
});

describe("visits and responsibilities", () => {
  it("names the two responsibilities the meeting asked for", () => {
    expect([...RESPONSIBILITY_ROLES]).toEqual(["INITIAL_SESSION", "VR_EQUIPMENT"]);
  });

  it("does not let a visit that happened be un-happened", () => {
    for (const from of VISIT_STATUSES) {
      if (from === "SCHEDULED") continue;
      for (const to of VISIT_STATUSES) {
        expect(canTransitionVisit(from, to)).toBe(false);
      }
    }
    expect(canTransitionVisit("SCHEDULED", "COMPLETED")).toBe(true);
    expect(canTransitionVisit("SCHEDULED", "NO_SHOW")).toBe(true);
  });

  it("caps the operational note", () => {
    expect(isValidVisitNotes("a".repeat(VISIT_NOTES_MAX_LENGTH))).toBe(true);
    expect(isValidVisitNotes("a".repeat(VISIT_NOTES_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("free text never reaches the audit log", () => {
  const service = readFileSync(join(process.cwd(), "src/services/participant-care.ts"), "utf8");

  /**
   * The audit table is append-only, so anything written there cannot later be
   * erased. Presence of a note is recorded; its content is not.
   */
  it("records whether a note exists, not what it says", () => {
    const auditBlocks = service.match(/recordAuditEvent\(tx, \{[\s\S]*?\n    \}\);/g) ?? [];
    expect(auditBlocks.length).toBeGreaterThan(0);
    for (const block of auditBlocks) {
      expect(block).not.toMatch(/\bnotes:\s*(notes|current\.notes)/);
      expect(block).not.toMatch(/\blocation:\s*location/);
    }
    expect(service).toMatch(/hasNotes/);
  });
});

describe("the audit read is a read", () => {
  const service = readFileSync(join(process.cwd(), "src/services/audit-trail.ts"), "utf8");

  it("never writes to the audit table", () => {
    expect(service).not.toMatch(/\.insert\(auditEvents\)/);
    expect(service).not.toMatch(/\.update\(auditEvents\)/);
    expect(service).not.toMatch(/\.delete\(/);
  });

  it("drops sensitive field names rather than listing them redacted", () => {
    // A "email ●●●" marker still tells the reader an email was touched, which
    // in a small study is itself informative.
    expect(service).toMatch(/SENSITIVE_FIELDS/);
    for (const field of ["fullName", "email", "phone", "reasonNote", "notes"]) {
      expect(service).toMatch(new RegExp(`"${field}"`));
    }
  });

  it("returns snapshot values only when explicitly asked", () => {
    expect(service).toMatch(/includeSnapshots\s*=\s*false/);
  });
});

describe("migration 0010", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0010_responsibles_and_visits.sql"),
    "utf8",
  );

  it("allows only one active holder per responsibility", () => {
    expect(sql).toMatch(/participant_responsibilities_one_active/);
    expect(sql).toMatch(/where revoked_at is null/);
  });

  it("allows only one open visit per participant", () => {
    expect(sql).toMatch(/initial_visits_one_open/);
    expect(sql).toMatch(/where status = 'SCHEDULED'/);
  });

  it("caps the free-text fields in the database", () => {
    expect(sql).toMatch(/initial_visits_notes_length/);
    expect(sql).toMatch(/initial_visits_location_length/);
  });

  it("is purely additive", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/^\s*alter table (?!participant_responsibilities|initial_visits)/im);
  });
});
