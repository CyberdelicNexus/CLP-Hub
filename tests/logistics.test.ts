import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEVICE_STATUSES,
  DEVICE_TRANSITIONS,
  INCIDENT_KINDS,
  INCIDENT_DESCRIPTION_MAX_LENGTH,
  VR_READINESS_STATES,
  canTransitionDevice,
  isAvailableForAssignment,
  isValidIncidentDescription,
  logisticsStep,
  needsAttention,
  readinessNeedsAction,
  type AssignmentSnapshot,
} from "@/domain/logistics";
import { hasPermission } from "@/domain/permissions";

const snap = (over: Partial<AssignmentSnapshot> = {}): AssignmentSnapshot => ({
  deviceStatus: "RESERVED",
  handedOverAt: null,
  receivedAt: null,
  readiness: "UNKNOWN",
  expectedReturnAt: null,
  returnedAt: null,
  closedAt: null,
  openIncidents: 0,
  ...over,
});

const day = 24 * 60 * 60 * 1000;

describe("device lifecycle", () => {
  it("refuses a jump that skips the physical world", () => {
    // A device cannot come back from somewhere it was never sent.
    expect(canTransitionDevice("AVAILABLE", "RETURNED")).toBe(false);
    expect(canTransitionDevice("AVAILABLE", "ACTIVE")).toBe(false);
    expect(canTransitionDevice("RESERVED", "RETURNED")).toBe(false);
  });

  /**
   * Unlike the cohort lifecycle (D-023), logistics genuinely goes backwards: a
   * shipment is recalled, a return is cancelled because the participant kept it
   * for one more session. Refusing those would make staff record something
   * untrue.
   */
  it("allows the reversals that actually happen", () => {
    expect(canTransitionDevice("RESERVED", "AVAILABLE")).toBe(true);
    expect(canTransitionDevice("RETURN_REQUESTED", "ACTIVE")).toBe(true);
    expect(canTransitionDevice("MAINTENANCE", "AVAILABLE")).toBe(true);
  });

  it("refuses a no-op", () => {
    for (const s of DEVICE_STATUSES) {
      expect(canTransitionDevice(s, s)).toBe(false);
    }
  });

  it("can reach maintenance from anywhere, because breakage is not scheduled", () => {
    for (const s of DEVICE_STATUSES) {
      if (s === "MAINTENANCE") continue;
      expect(DEVICE_TRANSITIONS[s]).toContain("MAINTENANCE");
    }
  });

  it("never leaves a status with nowhere to go", () => {
    for (const s of DEVICE_STATUSES) {
      expect(DEVICE_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it("offers only AVAILABLE for a new assignment", () => {
    for (const s of DEVICE_STATUSES) {
      expect(isAvailableForAssignment(s)).toBe(s === "AVAILABLE");
    }
  });
});

describe("readiness is reported, never inferred", () => {
  it("starts as UNKNOWN rather than assuming not ready", () => {
    // "Nobody has told us" is a different fact from "it does not work", and
    // defaulting to NOT_READY would be the application asserting the second.
    expect(VR_READINESS_STATES[0]).toBe("UNKNOWN");
    expect(snap().readiness).toBe("UNKNOWN");
  });

  /**
   * NEEDS_SUPPORT is its own value rather than a flavour of NOT_READY, the same
   * argument D-024 makes about TECHNICAL_FAILURE and ABSENT: folding them loses
   * the one that requires someone to act.
   */
  it("keeps NEEDS_SUPPORT separate from NOT_READY", () => {
    expect(VR_READINESS_STATES).toContain("NEEDS_SUPPORT");
    expect(readinessNeedsAction("NEEDS_SUPPORT")).toBe(true);
    expect(readinessNeedsAction("NOT_READY")).toBe(true);
    expect(readinessNeedsAction("READY")).toBe(false);
  });

  it("contains no inference in the domain module", () => {
    // Comments stripped: the module explains what it refuses to do, and the
    // explanation has to be allowed to name it.
    const source = stripComments(
      readFileSync(join(process.cwd(), "src/domain/logistics.ts"), "utf8"),
    );
    expect(source).not.toMatch(/telemetry|heartbeat|lastSeen|autoReady/i);
  });
});

describe("the outstanding logistics step", () => {
  it("walks the pipeline in order", () => {
    expect(logisticsStep(snap())).toBe("PREPARE_DEVICE");
    expect(logisticsStep(snap({ deviceStatus: "PREPARING" }))).toBe("HAND_OVER_OR_SHIP");
    expect(logisticsStep(snap({ deviceStatus: "SHIPPED", handedOverAt: new Date() }))).toBe(
      "CONFIRM_RECEIPT",
    );
    expect(
      logisticsStep(
        snap({ deviceStatus: "DELIVERED", handedOverAt: new Date(), receivedAt: new Date() }),
      ),
    ).toBe("CONFIRM_SETUP");
  });

  /**
   * An open incident outranks the pipeline. A device reported broken is not
   * waiting on a shipping step, it is waiting on a person.
   */
  it("puts an open incident above everything else", () => {
    expect(logisticsStep(snap({ openIncidents: 1 }))).toBe("RESOLVE_INCIDENT");
    expect(
      logisticsStep(
        snap({
          deviceStatus: "ACTIVE",
          handedOverAt: new Date(),
          receivedAt: new Date(),
          readiness: "READY",
          openIncidents: 2,
        }),
      ),
    ).toBe("RESOLVE_INCIDENT");
  });

  const active = {
    deviceStatus: "ACTIVE" as const,
    handedOverAt: new Date(),
    receivedAt: new Date(),
    readiness: "READY" as const,
  };

  /**
   * Nagging before the due date trains people to ignore the flag, so nothing is
   * outstanding until the date has actually passed.
   */
  it("says nothing about a return that is not yet due", () => {
    const future = new Date(Date.now() + 7 * day);
    expect(logisticsStep(snap({ ...active, expectedReturnAt: future }))).toBe("NONE");
  });

  it("asks for the return once the date has passed", () => {
    const past = new Date(Date.now() - day);
    expect(logisticsStep(snap({ ...active, expectedReturnAt: past }))).toBe("REQUEST_RETURN");
    expect(
      logisticsStep(
        snap({ ...active, deviceStatus: "RETURN_REQUESTED", expectedReturnAt: past }),
      ),
    ).toBe("CONFIRM_RETURN");
  });

  it("asks for the logistics to be closed once the device is back", () => {
    expect(logisticsStep(snap({ ...active, returnedAt: new Date() }))).toBe("CLOSE");
  });

  it("says nothing at all once closed", () => {
    expect(
      logisticsStep(snap({ ...active, returnedAt: new Date(), closedAt: new Date(), openIncidents: 3 })),
    ).toBe("NONE");
  });

  it("flags for attention only the steps a person has to act on", () => {
    expect(needsAttention("RESOLVE_INCIDENT")).toBe(true);
    expect(needsAttention("CONFIRM_RETURN")).toBe(true);
    expect(needsAttention("NONE")).toBe(false);
    expect(needsAttention("PREPARE_DEVICE")).toBe(false);
  });
});

describe("incidents are about equipment", () => {
  /**
   * An adverse event is Category C and belongs in the institution's approved
   * system, not in a logistics table. If a kind ever names something that
   * happened to a person, that boundary has moved without a decision.
   */
  it("names nothing that happens to a person", () => {
    const clinical = /injur|harm|advers|health|dizz|sick|nausea|salud|mareo|lesion/i;
    for (const kind of INCIDENT_KINDS) {
      expect(kind).not.toMatch(clinical);
    }
  });

  it("caps the description", () => {
    expect(isValidIncidentDescription("a".repeat(INCIDENT_DESCRIPTION_MAX_LENGTH))).toBe(true);
    expect(isValidIncidentDescription("a".repeat(INCIDENT_DESCRIPTION_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("the service does not duplicate what already exists", () => {
  const schema = readFileSync(join(process.cwd(), "src/db/schema/logistics.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/services/logistics.ts"), "utf8");

  /**
   * Who handles a participant's equipment is participant_responsibilities with
   * role VR_EQUIPMENT (D-035). A column here would be the same fact written
   * twice, and the two would drift.
   */
  it("stores no responsible of its own", () => {
    // Stripped for the same reason: the schema's comment says out loud that the
    // column is deliberately absent, which is the documentation this test backs.
    expect(stripComments(schema)).not.toMatch(/responsibleUserId|responsible_user_id/);
    expect(service).toMatch(/participantResponsibilities/);
    expect(service).toMatch(/VR_EQUIPMENT/);
  });

  /** The next session is cohort_sessions, read at display time, not copied. */
  it("stores no next-session date of its own", () => {
    expect(stripComments(schema)).not.toMatch(/nextSession|next_session/);
  });

  it("writes an audit row for every write", () => {
    const writes = service.match(/^export async function (set|assign|record|report|resolve|close|create)\w+/gm) ?? [];
    expect(writes.length).toBeGreaterThan(5);
    // Every transaction in this service records something.
    const transactions = service.match(/getDb\(\)\.transaction/g) ?? [];
    const audits = service.match(/recordAuditEvent\(tx,/g) ?? [];
    expect(audits.length).toBeGreaterThanOrEqual(transactions.length);
  });

  it("never snapshots an incident description into the audit log", () => {
    const auditBlocks = service.match(/recordAuditEvent\(tx, \{[\s\S]*?\n    \}\);/g) ?? [];
    for (const block of auditBlocks) {
      expect(block).not.toMatch(/description:\s*description/);
      expect(block).not.toMatch(/resolution:\s*resolution/);
    }
    expect(service).toMatch(/hasDescription/);
  });
});

describe("logistics permissions", () => {
  it("lets the logistics role manage devices and the researcher not see them", () => {
    expect(hasPermission(["LOGISTICS"], "logistics.manage")).toBe(true);
    expect(hasPermission(["RESEARCHER"], "logistics.read")).toBe(false);
  });

  it("does not let a facilitator change inventory", () => {
    expect(hasPermission(["FACILITATOR"], "logistics.manage")).toBe(false);
  });
});

describe("migration 0011", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0011_vr_logistics.sql"), "utf8");

  it("keeps a device with at most one person, and a person with at most one device", () => {
    expect(sql).toMatch(/device_assignments_one_open_per_device/);
    expect(sql).toMatch(/device_assignments_one_open_per_participant/);
  });

  it("refuses dates that contradict the physical world", () => {
    expect(sql).toMatch(/device_assignments_dates_ordered/);
  });

  it("requires a timestamp behind any reported readiness", () => {
    expect(sql).toMatch(/device_assignments_readiness_reported/);
  });

  it("is purely additive", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/rename\s+column/i);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
