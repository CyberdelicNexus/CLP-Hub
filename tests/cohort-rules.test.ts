import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COHORT_STATUSES,
  assessCohortSize,
  checkArmCompatibility,
  sizeBlocksTransition,
  sizeIsCheckedAt,
} from "@/domain/cohort";

describe("cohort size", () => {
  it("reports a cohort with no configured bounds as unbounded", () => {
    const size = assessCohortSize({ members: 3, minSize: null, maxSize: null });
    expect(size.verdict).toBe("UNBOUNDED");
    expect(size.remaining).toBeNull();
    expect(size.needed).toBe(0);
  });

  it("counts what is missing and what is left", () => {
    const size = assessCohortSize({ members: 4, minSize: 6, maxSize: 8 });
    expect(size.verdict).toBe("UNDER");
    expect(size.needed).toBe(2);
    expect(size.remaining).toBe(4);
  });

  it("treats both bounds as inclusive", () => {
    expect(assessCohortSize({ members: 6, minSize: 6, maxSize: 8 }).verdict).toBe("WITHIN");
    expect(assessCohortSize({ members: 8, minSize: 6, maxSize: 8 }).verdict).toBe("WITHIN");
    expect(assessCohortSize({ members: 5, minSize: 6, maxSize: 8 }).verdict).toBe("UNDER");
    expect(assessCohortSize({ members: 9, minSize: 6, maxSize: 8 }).verdict).toBe("OVER");
  });

  it("handles a single bound", () => {
    expect(assessCohortSize({ members: 2, minSize: 6, maxSize: null }).verdict).toBe("UNDER");
    expect(assessCohortSize({ members: 9, minSize: null, maxSize: 8 }).verdict).toBe("OVER");
    expect(assessCohortSize({ members: 7, minSize: null, maxSize: 8 }).verdict).toBe("WITHIN");
  });

  /**
   * The bounds are CONFIGURATION. If "6" or "8" ever appears as a constant in
   * the domain, one trial's group size has leaked into every study
   * (non-negotiable 6).
   */
  it("hardcodes no group size", () => {
    const source = readFileSync(join(process.cwd(), "src/domain/cohort.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/\b[68]\b/);
  });
});

describe("when the size rule bites", () => {
  /**
   * Only at ACTIVE. A cohort has to be allowed to pass through being too small
   * on its way to being the right size, and refusing assignments on size was
   * already rejected in D-023 as the app overruling an operational judgement.
   */
  it("checks only the moment a cohort is said to be running", () => {
    for (const status of COHORT_STATUSES) {
      expect(sizeIsCheckedAt(status)).toBe(status === "ACTIVE");
    }
  });

  it("blocks an under-sized activation and says which way it is wrong", () => {
    const under = assessCohortSize({ members: 4, minSize: 6, maxSize: 8 });
    expect(sizeBlocksTransition("ACTIVE", under)).toBe("UNDER");

    const over = assessCohortSize({ members: 9, minSize: 6, maxSize: 8 });
    expect(sizeBlocksTransition("ACTIVE", over)).toBe("OVER");
  });

  it("lets an under-sized cohort move through the earlier stages freely", () => {
    const under = assessCohortSize({ members: 1, minSize: 6, maxSize: 8 });
    for (const status of COHORT_STATUSES) {
      if (status === "ACTIVE") continue;
      expect(sizeBlocksTransition(status, under)).toBeNull();
    }
  });

  it("never blocks a cohort whose study configured no bounds", () => {
    const unbounded = assessCohortSize({ members: 0, minSize: null, maxSize: null });
    expect(sizeBlocksTransition("ACTIVE", unbounded)).toBeNull();
  });

  it("does not block a cohort that is within its bounds", () => {
    const within = assessCohortSize({ members: 7, minSize: 6, maxSize: 8 });
    expect(sizeBlocksTransition("ACTIVE", within)).toBeNull();
  });
});

describe("arm compatibility", () => {
  it("lets a cohort with no arm take anyone", () => {
    expect(checkArmCompatibility({ cohortArmId: null, participantArmId: null })).toBe("OK");
    expect(checkArmCompatibility({ cohortArmId: null, participantArmId: "arm-a" })).toBe("OK");
  });

  it("accepts a participant allocated to the cohort's own arm", () => {
    expect(checkArmCompatibility({ cohortArmId: "arm-a", participantArmId: "arm-a" })).toBe("OK");
  });

  /**
   * THE ACCIDENT THIS PREVENTS. A control participant sitting in an experimental
   * cohort makes the recorded allocation and the group actually attended
   * disagree, and every attendance figure built on the cohort is then wrong.
   */
  it("refuses a participant allocated to a different arm", () => {
    expect(checkArmCompatibility({ cohortArmId: "arm-a", participantArmId: "arm-b" })).toBe(
      "MISMATCH",
    );
  });

  /**
   * Unallocated is NOT "compatible by default". Assigning someone to an
   * arm-specific cohort before anyone knows their arm is the other half of the
   * same accident.
   */
  it("refuses a participant with no allocation recorded", () => {
    expect(checkArmCompatibility({ cohortArmId: "arm-a", participantArmId: null })).toBe(
      "ARM_NOT_RECORDED",
    );
  });
});

describe("migration 0009", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0009_cohort_rules.sql"), "utf8");

  it("renames capacity rather than dropping it", () => {
    expect(sql).toMatch(/rename column capacity to max_size/);
    expect(sql).not.toMatch(/drop\s+column/i);
  });

  it("explains the rename's impact in the file", () => {
    expect(sql).toMatch(/IMPACT/);
  });

  it("deletes nothing", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it("configures no group size of its own", () => {
    // The migration adds the columns; it must not seed a default 6-8 into every
    // study that runs it.
    expect(sql).not.toMatch(/default\s+[68]\b/i);
  });
});

describe("a cohort move is one transaction", () => {
  const source = readFileSync(join(process.cwd(), "src/services/cohorts.ts"), "utf8");

  it("removes and re-inserts inside a single transaction", () => {
    const fn = source.slice(
      source.indexOf("export async function transferToCohort"),
      source.indexOf("/** Assign a staff member to run a cohort"),
    );
    expect(fn).toMatch(/getDb\(\)\.transaction/);
    expect(fn).toMatch(/removedAt: new Date\(\)/);
    expect(fn).toMatch(/\.insert\(participantCohortAssignments\)/);
    // And it records the move as a move, not as two unrelated events.
    expect(fn).toMatch(/cohort_assignment\.moved/);
    expect(fn).toMatch(/movedFrom/);
  });
});
