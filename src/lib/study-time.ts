/**
 * A `datetime-local` value ("2026-11-03T18:30") is a wall-clock time with no
 * zone. These read and write it in the STUDY's timezone, so a visit typed as
 * 18:30 is 18:30 in Madrid whatever zone the server runs in (2026-10-28,
 * D-136). Older forms still use `new Date(value)`, i.e. the server's zone.
 */

/** The zone's offset from UTC at `instant`, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "2026-11-03T18:30" in `timeZone` → the instant. Null if malformed. */
export function parseStudyLocal(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle a guess that landed on the other side of a DST change.
  let instant = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  instant = guess - offsetMinutes(new Date(instant), timeZone) * 60000;
  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** The instant as a `datetime-local` value in `timeZone`. */
export function toStudyLocal(instant: Date, timeZone: string): string {
  const shifted = new Date(instant.getTime() + offsetMinutes(instant, timeZone) * 60000);
  return shifted.toISOString().slice(0, 16);
}
