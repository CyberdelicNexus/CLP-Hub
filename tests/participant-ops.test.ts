import { describe, expect, it } from "vitest";
import {
  canTransitionConsent,
  CONSENT_STATUSES,
  CONSENT_TRANSITIONS,
  enrollmentStatusForConsent,
  isActiveConsent,
} from "@/domain/consent";
import {
  canTransitionEligibility,
  canTransitionEnrollment,
  ELIGIBILITY_STATUSES,
  ENROLLMENT_STATUSES,
  ENROLLMENT_TRANSITIONS,
  PHASE_3_ENROLLMENT_STATUSES,
} from "@/domain/participant-state";
import {
  canCarryResult,
  canTransitionScreening,
  SCREENING_STATUSES,
  SCREENING_TRANSITIONS,
} from "@/domain/screening";

describe("eligibility transitions", () => {
  it("never returns to PENDING once a result has been recorded", () => {
    for (const from of ELIGIBILITY_STATUSES) {
      expect(canTransitionEligibility(from, "PENDING")).toBe(false);
    }
  });

  it("rejects a no-op transition", () => {
    for (const s of ELIGIBILITY_STATUSES) {
      expect(canTransitionEligibility(s, s)).toBe(false);
    }
  });

  it("allows a determination made elsewhere to be corrected later", () => {
    // The app records what the researchers decided; it is not entitled to
    // refuse a correction. The audit log is what makes it accountable.
    expect(canTransitionEligibility("INELIGIBLE", "ELIGIBLE")).toBe(true);
    expect(canTransitionEligibility("ELIGIBLE", "REVIEW_REQUIRED")).toBe(true);
    expect(canTransitionEligibility("WAITLIST", "ELIGIBLE")).toBe(true);
  });
});

describe("enrollment transitions", () => {
  it("only allows entry at CONSENT_PENDING from no status at all", () => {
    for (const s of ENROLLMENT_STATUSES) {
      expect(canTransitionEnrollment(null, s)).toBe(s === "CONSENT_PENDING");
    }
  });

  it("keeps WITHDRAWN and COMPLETED terminal", () => {
    expect(ENROLLMENT_TRANSITIONS.WITHDRAWN).toEqual([]);
    expect(ENROLLMENT_TRANSITIONS.COMPLETED).toEqual([]);
    for (const to of ENROLLMENT_STATUSES) {
      expect(canTransitionEnrollment("WITHDRAWN", to)).toBe(false);
      expect(canTransitionEnrollment("COMPLETED", to)).toBe(false);
    }
  });

  it("never re-enters the pipeline at CONSENT_PENDING", () => {
    for (const from of ENROLLMENT_STATUSES) {
      expect(canTransitionEnrollment(from, "CONSENT_PENDING")).toBe(false);
    }
  });

  it("only lists known statuses as targets", () => {
    const known = new Set<string>(ENROLLMENT_STATUSES);
    for (const targets of Object.values(ENROLLMENT_TRANSITIONS)) {
      for (const t of targets) expect(known.has(t)).toBe(true);
    }
  });

  it("marks the statuses Phase 2 cannot reach", () => {
    // Randomization and cohort assignment are deferred to Phase 3 (D-017);
    // the vocabulary is complete but these must stay unreachable for now.
    expect(PHASE_3_ENROLLMENT_STATUSES).toEqual(["RANDOMIZED", "COHORT_ASSIGNED"]);
  });
});

describe("screening transitions", () => {
  it("makes every finished state terminal", () => {
    for (const s of ["COMPLETED", "NO_SHOW", "CANCELLED"] as const) {
      expect(SCREENING_TRANSITIONS[s]).toEqual([]);
    }
  });

  it("never reopens a screening back to SCHEDULED", () => {
    for (const from of SCREENING_STATUSES) {
      expect(canTransitionScreening(from, "SCHEDULED")).toBe(false);
    }
  });

  it("only lets a completed screening carry a result", () => {
    for (const s of SCREENING_STATUSES) {
      expect(canCarryResult(s)).toBe(s === "COMPLETED");
    }
  });
});

describe("consent", () => {
  it("keeps DECLINED and WITHDRAWN terminal", () => {
    expect(CONSENT_TRANSITIONS.DECLINED).toEqual([]);
    expect(CONSENT_TRANSITIONS.WITHDRAWN).toEqual([]);
  });

  it("never lets a staff action set SUPERSEDED directly", () => {
    // SUPERSEDED is only ever set by the service when a newer consent replaces
    // this one, so it must not appear as a target anywhere in the map.
    for (const targets of Object.values(CONSENT_TRANSITIONS)) {
      expect(targets).not.toContain("SUPERSEDED");
    }
    for (const from of CONSENT_STATUSES) {
      expect(canTransitionConsent(from, "SUPERSEDED")).toBe(false);
    }
  });

  it("allows only the two real decisions from PENDING", () => {
    expect(canTransitionConsent("PENDING", "CONSENTED")).toBe(true);
    expect(canTransitionConsent("PENDING", "DECLINED")).toBe(true);
    expect(canTransitionConsent("PENDING", "WITHDRAWN")).toBe(false);
  });

  it("treats only PENDING and CONSENTED as in force", () => {
    expect(isActiveConsent("PENDING")).toBe(true);
    expect(isActiveConsent("CONSENTED")).toBe(true);
    for (const s of ["DECLINED", "WITHDRAWN", "SUPERSEDED"] as const) {
      expect(isActiveConsent(s)).toBe(false);
    }
  });

  it("enrols on consent and on nothing else", () => {
    expect(enrollmentStatusForConsent("CONSENTED")).toBe("ENROLLED");
    for (const s of ["PENDING", "DECLINED", "WITHDRAWN", "SUPERSEDED"] as const) {
      expect(enrollmentStatusForConsent(s)).toBeNull();
    }
  });

  it("does not un-enrol on withdrawal — that is a separate decision", () => {
    expect(enrollmentStatusForConsent("WITHDRAWN")).toBeNull();
  });
});
