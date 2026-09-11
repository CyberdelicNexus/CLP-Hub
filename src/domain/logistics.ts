/**
 * VR device logistics (Phase 6).
 *
 * A device here is EQUIPMENT, not a person. Nothing on a device or its
 * assignment is research data: it is asset tracking that happens to be attached
 * to a participant code (docs/research-data-boundaries.md, Category A/B).
 *
 * Two things this module deliberately does NOT do:
 *
 * - It never infers readiness. `VR_READINESS_STATES` is reported by staff or by
 *   the participant through a simple form (D-003); no telemetry, no "we saw the
 *   headset connect so it must be ready". A readiness this application guessed
 *   would be a statement about a participant's setup that nobody checked.
 * - It never decides who gets a device. Assignment is a staff action.
 */

/**
 * Where a device is in its cycle. From the founder's brief via
 * docs/domain-model.md, kept verbatim so the vocabulary staff already use is the
 * vocabulary in the database.
 */
export const DEVICE_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "ACTIVE",
  "RETURN_REQUESTED",
  "RETURN_IN_TRANSIT",
  "RETURNED",
  "CLEANING",
  "MAINTENANCE",
] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export function isDeviceStatus(v: unknown): v is DeviceStatus {
  return typeof v === "string" && (DEVICE_STATUSES as readonly string[]).includes(v);
}

/** A device in one of these is out with a participant and cannot be re-assigned. */
export const DEVICE_STATUSES_IN_USE: readonly DeviceStatus[] = [
  "RESERVED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "ACTIVE",
  "RETURN_REQUESTED",
  "RETURN_IN_TRANSIT",
];

/** A device in one of these is back with the team but not yet ready to go out. */
export const DEVICE_STATUSES_IN_SERVICE: readonly DeviceStatus[] = [
  "RETURNED",
  "CLEANING",
  "MAINTENANCE",
];

export function isAvailableForAssignment(status: DeviceStatus): boolean {
  return status === "AVAILABLE";
}

export function isInUse(status: DeviceStatus): boolean {
  return DEVICE_STATUSES_IN_USE.includes(status);
}

/**
 * Permitted moves.
 *
 * Not strictly forward, unlike the cohort lifecycle (D-023), because logistics
 * genuinely goes backwards: a shipment gets recalled before it arrives, a device
 * comes back from maintenance to the shelf, a return is cancelled because the
 * participant kept it for one more session. Refusing those would push staff into
 * recording something untrue.
 *
 * What IS refused is a jump that skips the physical world — a device cannot go
 * from AVAILABLE straight to RETURNED, because it was never anywhere to come
 * back from.
 */
export const DEVICE_TRANSITIONS: Record<DeviceStatus, readonly DeviceStatus[]> = {
  AVAILABLE: ["RESERVED", "PREPARING", "MAINTENANCE"],
  RESERVED: ["PREPARING", "AVAILABLE", "MAINTENANCE"],
  PREPARING: ["SHIPPED", "DELIVERED", "RESERVED", "AVAILABLE", "MAINTENANCE"],
  // DELIVERED directly: handed over in person at the initial visit rather than
  // posted, which is the common case for this study.
  SHIPPED: ["DELIVERED", "RETURN_IN_TRANSIT", "MAINTENANCE"],
  DELIVERED: ["ACTIVE", "RETURN_REQUESTED", "MAINTENANCE"],
  ACTIVE: ["RETURN_REQUESTED", "MAINTENANCE"],
  RETURN_REQUESTED: ["RETURN_IN_TRANSIT", "RETURNED", "ACTIVE", "MAINTENANCE"],
  RETURN_IN_TRANSIT: ["RETURNED", "MAINTENANCE"],
  RETURNED: ["CLEANING", "MAINTENANCE", "AVAILABLE"],
  CLEANING: ["AVAILABLE", "MAINTENANCE"],
  MAINTENANCE: ["CLEANING", "AVAILABLE", "RETURNED"],
};

export function canTransitionDevice(from: DeviceStatus, to: DeviceStatus): boolean {
  if (from === to) return false;
  return DEVICE_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Setup readiness
// ---------------------------------------------------------------------------

/**
 * Whether the participant's setup is working. REPORTED, never inferred (D-003).
 *
 * NEEDS_SUPPORT is its own value rather than a flavour of NOT_READY, for the
 * same reason TECHNICAL_FAILURE is not ABSENT (D-024): "it does not work and I
 * need help" is a different operational fact from "it is not set up yet", and
 * folding them together loses the one that requires someone to act.
 */
export const VR_READINESS_STATES = ["UNKNOWN", "READY", "NOT_READY", "NEEDS_SUPPORT"] as const;
export type VrReadiness = (typeof VR_READINESS_STATES)[number];

export function isVrReadiness(v: unknown): v is VrReadiness {
  return typeof v === "string" && (VR_READINESS_STATES as readonly string[]).includes(v);
}

/** Readiness values that mean somebody has to do something. */
export const READINESS_NEEDING_ACTION: readonly VrReadiness[] = [
  "NOT_READY",
  "NEEDS_SUPPORT",
  "UNKNOWN",
];

export function readinessNeedsAction(state: VrReadiness): boolean {
  return READINESS_NEEDING_ACTION.includes(state);
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

/**
 * Operational things that go wrong with equipment.
 *
 * Equipment problems only. There is deliberately no category for anything that
 * happened to a *person* — an adverse event is Category C and belongs in the
 * institution's approved system, not in a logistics table
 * (docs/research-data-boundaries.md).
 */
export const INCIDENT_KINDS = [
  "NOT_DELIVERED",
  "DAMAGED",
  "LOST",
  "HARDWARE_FAULT",
  "SOFTWARE_FAULT",
  "CONNECTIVITY",
  "NOT_RETURNED",
  "OTHER",
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export function isIncidentKind(v: unknown): v is IncidentKind {
  return typeof v === "string" && (INCIDENT_KINDS as readonly string[]).includes(v);
}

/**
 * The incident description. Equipment, not people — the form says so, and the
 * cap keeps it to a sentence or two. Its content is never copied into an audit
 * snapshot, the same rule the visit note follows (D-035).
 */
export const INCIDENT_DESCRIPTION_MAX_LENGTH = 500;

export function isValidIncidentDescription(text: string): boolean {
  return text.length <= INCIDENT_DESCRIPTION_MAX_LENGTH;
}

/** Device asset code, e.g. "VR-014". Configuration per study. */
export const DEVICE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
export const DEVICE_LABEL_MAX_LENGTH = 120;

// ---------------------------------------------------------------------------
// What needs attention
// ---------------------------------------------------------------------------

/**
 * A single assignment's outstanding logistics step.
 *
 * Same discipline as `src/domain/next-step.ts`: every value names a MISSING
 * RECORD or an overdue date, never a judgement about a participant.
 */
export const LOGISTICS_STEPS = [
  "PREPARE_DEVICE",
  "HAND_OVER_OR_SHIP",
  "CONFIRM_RECEIPT",
  "CONFIRM_SETUP",
  "REQUEST_RETURN",
  "CONFIRM_RETURN",
  "RESOLVE_INCIDENT",
  "CLOSE",
  "NONE",
] as const;
export type LogisticsStep = (typeof LOGISTICS_STEPS)[number];

export interface AssignmentSnapshot {
  deviceStatus: DeviceStatus;
  handedOverAt: Date | null;
  receivedAt: Date | null;
  readiness: VrReadiness;
  expectedReturnAt: Date | null;
  returnedAt: Date | null;
  closedAt: Date | null;
  openIncidents: number;
}

export function logisticsStep(a: AssignmentSnapshot, now: Date = new Date()): LogisticsStep {
  if (a.closedAt) return "NONE";

  // An open incident outranks the pipeline: a device reported broken is not
  // waiting on a shipping step, it is waiting on a person.
  if (a.openIncidents > 0) return "RESOLVE_INCIDENT";

  if (a.returnedAt) return "CLOSE";
  if (!a.handedOverAt) {
    return a.deviceStatus === "PREPARING" ? "HAND_OVER_OR_SHIP" : "PREPARE_DEVICE";
  }
  if (!a.receivedAt) return "CONFIRM_RECEIPT";
  if (a.readiness !== "READY") return "CONFIRM_SETUP";

  // Only once the expected return date has actually passed. Nagging before it
  // does trains people to ignore the flag.
  if (a.expectedReturnAt && a.expectedReturnAt.getTime() < now.getTime()) {
    return a.deviceStatus === "RETURN_REQUESTED" || a.deviceStatus === "RETURN_IN_TRANSIT"
      ? "CONFIRM_RETURN"
      : "REQUEST_RETURN";
  }

  return "NONE";
}

/** Steps that should be visible on an operations dashboard. */
export const ATTENTION_STEPS: readonly LogisticsStep[] = [
  "RESOLVE_INCIDENT",
  "CONFIRM_RECEIPT",
  "CONFIRM_SETUP",
  "REQUEST_RETURN",
  "CONFIRM_RETURN",
];

export function needsAttention(step: LogisticsStep): boolean {
  return ATTENTION_STEPS.includes(step);
}
