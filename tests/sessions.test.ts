import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_STATUSES,
  canTransitionSession,
  countsAsAbsent,
  countsAsPresent,
  isNeutralOutcome,
  SESSION_STATUSES,
  SESSION_TRANSITIONS,
  tallyAttendance,
  type AttendanceStatus,
} from "@/domain/session";

/**
 * The brief states TECHNICAL_FAILURE ≠ ABSENT. These tests exist so that
 * distinction cannot be lost by a later refactor: someone whose headset failed
 * did not fail to turn up, and counting them as absent would misattribute an
 * equipment problem to the participant.
 */
describe("TECHNICAL_FAILURE is not an absence", () => {
  it("is neither present nor absent", () => {
    expect(countsAsPresent("TECHNICAL_FAILURE")).toBe(false);
    expect(countsAsAbsent("TECHNICAL_FAILURE")).toBe(false);
  });

  it("is excluded from adherence figures entirely", () => {
    expect(isNeutralOutcome("TECHNICAL_FAILURE")).toBe(true);
  });

  it("is counted in its own bucket, never folded into absences", () => {
    const tally = tallyAttendance(["TECHNICAL_FAILURE", "TECHNICAL_FAILURE", "ABSENT"]);
    expect(tally.technicalFailure).toBe(2);
    expect(tally.absent).toBe(1);
    expect(tally.present).toBe(0);
  });

  it("does not change the absence count when failures are added", () => {
    const before = tallyAttendance(["ATTENDED", "ABSENT"]);
    const after = tallyAttendance(["ATTENDED", "ABSENT", "TECHNICAL_FAILURE", "TECHNICAL_FAILURE"]);
    expect(after.absent).toBe(before.absent);
    expect(after.present).toBe(before.present);
  });

  it("keeps ABSENT as the only status attributable as a real absence", () => {
    const absent = ATTENDANCE_STATUSES.filter(countsAsAbsent);
    expect(absent).toEqual(["ABSENT"]);
  });
});

describe("attendance semantics", () => {
  it("treats attending late as attending", () => {
    expect(countsAsPresent("LATE")).toBe(true);
    expect(countsAsAbsent("LATE")).toBe(false);
  });

  it("partitions every status into exactly one of present / absent / neutral", () => {
    for (const s of ATTENDANCE_STATUSES) {
      const buckets = [countsAsPresent(s), countsAsAbsent(s), isNeutralOutcome(s)].filter(Boolean);
      expect(buckets, `${s} must fall in exactly one bucket`).toHaveLength(1);
    }
  });

  it("tallies every status and loses none", () => {
    const all = [...ATTENDANCE_STATUSES] as AttendanceStatus[];
    const tally = tallyAttendance(all);
    const total =
      tally.present + tally.absent + tally.technicalFailure + tally.excused + tally.withdrawn + tally.expected;
    expect(total).toBe(all.length);
  });

  it("starts an empty register at zero everywhere", () => {
    expect(tallyAttendance([])).toEqual({
      present: 0,
      absent: 0,
      technicalFailure: 0,
      excused: 0,
      expected: 0,
      withdrawn: 0,
    });
  });

  it("does not treat an excused absence as an absence", () => {
    // Excused means the absence was agreed in advance; blaming it as
    // non-adherence would be wrong.
    expect(countsAsAbsent("EXCUSED")).toBe(false);
    expect(tallyAttendance(["EXCUSED"]).absent).toBe(0);
  });
});

describe("session lifecycle", () => {
  it("keeps held and cancelled terminal", () => {
    expect(SESSION_TRANSITIONS.HELD).toEqual([]);
    expect(SESSION_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("never reopens a session back to SCHEDULED", () => {
    for (const from of SESSION_STATUSES) {
      expect(canTransitionSession(from, "SCHEDULED")).toBe(false);
    }
  });

  it("allows a scheduled session to be held or cancelled", () => {
    expect(canTransitionSession("SCHEDULED", "HELD")).toBe(true);
    expect(canTransitionSession("SCHEDULED", "CANCELLED")).toBe(true);
  });
});
