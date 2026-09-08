import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acceptsAssignments,
  canTransitionCohort,
  COHORT_STATUSES,
  nextCohortStatus,
} from "@/domain/cohort";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "@/domain/permissions";
import { ALLOCATION_METHODS, manualEntryProvider } from "@/domain/randomization";

describe("cohort lifecycle", () => {
  it("moves forward only", () => {
    expect(canTransitionCohort("PLANNING", "RECRUITING")).toBe(true);
    expect(canTransitionCohort("PLANNING", "COMPLETED")).toBe(true);
    // Backwards is refused: sessions and attendance already depend on the stage.
    expect(canTransitionCohort("ACTIVE", "PLANNING")).toBe(false);
    expect(canTransitionCohort("COMPLETED", "ACTIVE")).toBe(false);
  });

  it("refuses a no-op transition", () => {
    for (const s of COHORT_STATUSES) expect(canTransitionCohort(s, s)).toBe(false);
  });

  it("ends the lifecycle at COMPLETED", () => {
    expect(nextCohortStatus("FOLLOW_UP")).toBe("COMPLETED");
    expect(nextCohortStatus("COMPLETED")).toBeNull();
  });

  it("only accepts assignments before the programme starts", () => {
    for (const s of COHORT_STATUSES) {
      expect(acceptsAssignments(s)).toBe(
        s === "PLANNING" || s === "RECRUITING" || s === "PREPARATION",
      );
    }
  });
});

describe("randomization", () => {
  it("offers manual entry as the only method", () => {
    expect(ALLOCATION_METHODS).toEqual(["MANUAL_ENTRY"]);
  });

  it("passes through exactly what it was given, choosing nothing", () => {
    const when = new Date("2026-09-08T10:00:00.000Z");
    const out = manualEntryProvider.resolve({
      armId: "arm-1",
      allocatedAt: when,
      externalRecordId: "EXT-1",
    });
    expect(out).toEqual({
      armId: "arm-1",
      allocatedAt: when,
      externalRecordId: "EXT-1",
      method: "MANUAL_ENTRY",
    });
  });

  it("is deterministic — the same input always yields the same allocation", () => {
    const when = new Date("2026-09-08T10:00:00.000Z");
    const input = { armId: "arm-1", allocatedAt: when, externalRecordId: null };
    const runs = Array.from({ length: 25 }, () => manualEntryProvider.resolve(input).armId);
    expect(new Set(runs).size).toBe(1);
  });

  /**
   * The non-negotiable is "no randomization algorithm anywhere". This asserts it
   * structurally rather than trusting review: if someone adds a source of
   * randomness to the domain module, this fails.
   */
  it("contains no source of randomness in the randomization domain module", () => {
    const source = readFileSync(join(process.cwd(), "src/domain/randomization.ts"), "utf8");
    // Comments are stripped first: the module's own warning names these very
    // tokens, and a comment saying "do not add Math.random" is not a violation.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/crypto\.getRandomValues/);
    expect(code).not.toMatch(/randomUUID|randomInt|randomBytes/);
    expect(code).not.toMatch(/\bshuffle\b/i);
    // Sanity check that stripping left real code behind to inspect.
    expect(code).toMatch(/manualEntryProvider/);
  });
});

describe("cohort scoping permissions", () => {
  it("defines cohorts.read.all as a distinct key", () => {
    expect(PERMISSIONS).toContain("cohorts.read.all");
    expect(PERMISSIONS).toContain("randomization.manage");
  });

  it("narrows facilitators but not the study-wide roles", () => {
    // Facilitators hold cohorts.read but NOT cohorts.read.all, which is what
    // makes the cohort_staff narrowing apply to them.
    expect(hasPermission(["FACILITATOR"], "cohorts.read")).toBe(true);
    expect(hasPermission(["FACILITATOR"], "cohorts.read.all")).toBe(false);

    for (const role of ["ADMIN", "STUDY_MANAGER", "RESEARCHER", "LOGISTICS"] as const) {
      expect(hasPermission([role], "cohorts.read.all")).toBe(true);
    }
  });

  it("keeps allocation recording away from roles that only observe", () => {
    expect(hasPermission(["RESEARCHER"], "randomization.read")).toBe(true);
    expect(hasPermission(["RESEARCHER"], "randomization.manage")).toBe(false);
    expect(hasPermission(["FACILITATOR"], "randomization.read")).toBe(false);
    expect(hasPermission(["STUDY_MANAGER"], "randomization.manage")).toBe(true);
  });

  it("grants every permission to ADMIN and no unknown keys to anyone", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const [role, granted] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of granted) {
        expect(known.has(p), `${role} has unknown permission ${p}`).toBe(true);
      }
    }
    expect(ROLE_PERMISSIONS.ADMIN.length).toBe(PERMISSIONS.length);
  });
});
