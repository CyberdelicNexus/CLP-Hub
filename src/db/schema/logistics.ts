import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { deviceStatusEnum, incidentKindEnum, vrReadinessEnum } from "./enums";
import { participants } from "./participants";
import { studies } from "./studies";
import { users } from "./users";

/**
 * The VR headset inventory (Phase 6).
 *
 * Equipment, not people. A device row carries an asset code, a model and a
 * status — nothing about a participant, and nothing research-related.
 */
export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    /** Asset code, e.g. "VR-014". Configuration per study. */
    code: text("code").notNull(),
    model: text("model"),
    /** Manufacturer serial. Asset data; no participant is identifiable from it. */
    serial: text("serial"),
    status: deviceStatusEnum("status").notNull().default("AVAILABLE"),
    /** Deactivated, never deleted: assignment history must stay readable. */
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("devices_code_unique").on(t.studyId, t.code),
    index("devices_status_idx").on(t.studyId, t.status),
  ],
);

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

/**
 * One device out with one participant, and everything that happened to it.
 *
 * NOTE WHAT IS ABSENT: there is no `responsible_user_id`. Who handles a
 * participant's equipment is already `participant_responsibilities` with role
 * VR_EQUIPMENT (D-035), and a second column for the same fact would drift from
 * it (D-038). The logistics views join to that table instead.
 *
 * Likewise no "next session" column: that is `cohort_sessions` for the
 * participant's cohort, read at display time rather than copied here where it
 * would go stale the moment a session moved.
 *
 * Historical: an assignment is closed, never deleted, and a re-issue is a new
 * row. At most one open assignment per device and per participant.
 */
export const deviceAssignments = pgTable(
  "device_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    /** When the team gave it out or posted it. */
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    /** When the participant confirmed it arrived. */
    receivedAt: timestamp("received_at", { withTimezone: true }),
    /** Reported by staff or the participant, never inferred (D-003). */
    readiness: vrReadinessEnum("readiness").notNull().default("UNKNOWN"),
    readinessReportedAt: timestamp("readiness_reported_at", { withTimezone: true }),
    expectedReturnAt: timestamp("expected_return_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    /** Logistics finished: returned, checked, nothing outstanding. */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    assignedBy: uuid("assigned_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("device_assignments_device_idx").on(t.deviceId, t.createdAt),
    index("device_assignments_participant_idx").on(t.participantId, t.createdAt),
    index("device_assignments_study_idx").on(t.studyId, t.closedAt),
  ],
);

export type DeviceAssignment = typeof deviceAssignments.$inferSelect;
export type NewDeviceAssignment = typeof deviceAssignments.$inferInsert;

/**
 * Something that went wrong with the equipment.
 *
 * EQUIPMENT ONLY. There is deliberately no category and no place here for
 * anything that happened to a person — an adverse event is Category C and
 * belongs in the institution's approved system
 * (docs/research-data-boundaries.md). The description is capped and the form
 * says so in Spanish.
 */
export const deviceIncidents = pgTable(
  "device_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .notNull()
      .references(() => studies.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    /** Null when the device was not out with anyone at the time. */
    assignmentId: uuid("assignment_id").references(() => deviceAssignments.id),
    kind: incidentKindEnum("kind").notNull(),
    description: text("description"),
    reportedBy: uuid("reported_by").references(() => users.id),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
  },
  (t) => [
    index("device_incidents_device_idx").on(t.deviceId, t.reportedAt),
    index("device_incidents_open_idx").on(t.studyId, t.resolvedAt),
    index("device_incidents_assignment_idx").on(t.assignmentId),
  ],
);

export type DeviceIncident = typeof deviceIncidents.$inferSelect;
export type NewDeviceIncident = typeof deviceIncidents.$inferInsert;
