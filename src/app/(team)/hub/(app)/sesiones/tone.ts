import type { StatusTone } from "@/components/status-badge";
import type { AttendanceStatus, SessionStatus } from "@/domain/session";

/** The single place session and attendance statuses map to colour. */
const SESSION_TONES: Record<SessionStatus, StatusTone> = {
  SCHEDULED: "info",
  HELD: "success",
  CANCELLED: "neutral",
};

/**
 * TECHNICAL_FAILURE gets its own tone — warning, not critical and not the same
 * neutral as an excused absence. It signals "something went wrong with the
 * equipment", which is a problem to fix, and it must never look like ABSENT.
 */
const ATTENDANCE_TONES: Record<AttendanceStatus, StatusTone> = {
  EXPECTED: "neutral",
  ATTENDED: "success",
  LATE: "success",
  ABSENT: "critical",
  EXCUSED: "neutral",
  TECHNICAL_FAILURE: "warning",
  WITHDRAWN: "neutral",
};

export function sessionTone(status: SessionStatus): StatusTone {
  return SESSION_TONES[status];
}

export function attendanceTone(status: AttendanceStatus): StatusTone {
  return ATTENDANCE_TONES[status];
}
