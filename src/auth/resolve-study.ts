/**
 * Pure study-selection logic (unit-tested). The requested id comes from a
 * preference cookie and is only honoured if it matches an active membership.
 */
export function resolveActiveStudyId(
  memberships: ReadonlyArray<{ studyId: string }>,
  requested: string | undefined,
): string | null {
  if (memberships.length === 0) return null;
  if (requested && memberships.some((m) => m.studyId === requested)) return requested;
  return memberships[0].studyId;
}
