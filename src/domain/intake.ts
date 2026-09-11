/**
 * Where participants enter the study, and the Qualtrics boundary (Phase 4a).
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE
 * --------------------------------------
 * Initial screening happens in Qualtrics. The person accepts the digital consent
 * there *before* any data about them — including their name — is collected. The
 * identifiable half of that screening stays in Qualtrics. CLP Hub holds the
 * anonymized half and an opaque reference back.
 *
 * So this application does not import, copy, mirror or display identifiable
 * screening data, and there is no code here that could. A future integration is
 * to be READ-ONLY and field-by-field opt-in; the structure for configuring and
 * testing it exists below, but **no transfer is implemented** — see
 * `FIELD_CLASSES_NEVER_TRANSFERABLE`, which is also a database check constraint
 * in migration 0007 rather than a promise made by application code.
 */

/**
 * How a participant entered is recorded once, as `applications.source` — see
 * `APPLICATION_SOURCES` in ./recruitment.ts, which gains QUALTRICS in this phase.
 * A second "intake source" vocabulary is deliberately NOT introduced here: two
 * fields answering the same question drift apart, and the funnel counts that
 * feed the flow diagram already read the application row.
 */

// ---------------------------------------------------------------------------
// The external reference
// ---------------------------------------------------------------------------

/**
 * The anonymized handle that ties a CLP Hub participant to their Qualtrics
 * response — e.g. a response ID such as "R_1a2B3c4D5e6F7g8".
 *
 * It is an identifier and nothing else. The pattern rejects whitespace and
 * punctuation beyond `_ - . :` so it cannot quietly become a place to write
 * "María, la del jueves", which would put an identifiable datum in the very
 * column meant to keep identity out.
 */
export const EXTERNAL_REF_PATTERN = /^[\w.:-]{1,120}$/;
export const EXTERNAL_REF_MAX_LENGTH = 120;

export function isValidExternalRef(value: string): boolean {
  return EXTERNAL_REF_PATTERN.test(value);
}

/**
 * A Qualtrics response ID looks like `R_` + 15 or 16 alphanumerics. Offered as a
 * *hint* for the UI, never as a gate: a study may legitimately key on a panel ID
 * or a custom embedded field, and refusing those would push staff into using the
 * note fields instead.
 */
export const QUALTRICS_RESPONSE_ID_HINT = /^R_[A-Za-z0-9]{15,16}$/;

export function looksLikeQualtricsResponseId(value: string): boolean {
  return QUALTRICS_RESPONSE_ID_HINT.test(value);
}

// ---------------------------------------------------------------------------
// Field classification for a future read-only integration
// ---------------------------------------------------------------------------

/**
 * What a Qualtrics field contains, mapped onto the three data categories in
 * docs/research-data-boundaries.md.
 */
export const QUALTRICS_FIELD_CLASSES = [
  /** The opaque response/panel identifier. Carries no identity by itself. */
  "ANONYMOUS_ID",
  /** Category B study operations: consent *status*, completion flag, timestamps. */
  "OPERATIONAL",
  /** Category A identity: name, email, phone, address. */
  "IDENTIFIABLE",
  /** Category C research/clinical: answers, scores, health history. */
  "RESEARCH",
] as const;
export type QualtricsFieldClass = (typeof QUALTRICS_FIELD_CLASSES)[number];

export function isQualtricsFieldClass(v: unknown): v is QualtricsFieldClass {
  return typeof v === "string" && (QUALTRICS_FIELD_CLASSES as readonly string[]).includes(v);
}

/**
 * Classes that may never be mapped for transfer.
 *
 * IDENTIFIABLE is refused because there is no authorization to move identifiable
 * screening data out of Qualtrics, and the moment such authorization exists it
 * should arrive as an explicit, recorded decision that changes this list — not
 * as someone quietly ticking a box in an admin screen.
 *
 * RESEARCH is refused because it is Category C and refused everywhere.
 *
 * Enforced by a check constraint on `qualtrics_field_mappings`, so a row that
 * violates it cannot exist even if application code is wrong.
 */
export const FIELD_CLASSES_NEVER_TRANSFERABLE: readonly QualtricsFieldClass[] = [
  "IDENTIFIABLE",
  "RESEARCH",
];

export const FIELD_CLASSES_TRANSFERABLE: readonly QualtricsFieldClass[] = [
  "ANONYMOUS_ID",
  "OPERATIONAL",
];

export function isTransferableFieldClass(cls: QualtricsFieldClass): boolean {
  return !FIELD_CLASSES_NEVER_TRANSFERABLE.includes(cls);
}

/**
 * Where a mapped Qualtrics field is allowed to land in CLP Hub.
 *
 * A closed list, on purpose: an integration that could write to an arbitrary
 * column would be an integration that could write a name into one. Each target
 * below is a Category A-free, Category C-free operational field.
 */
export const INTAKE_TARGETS = [
  /** `participants.external_ref` */
  "participant.externalRef",
  /** `participants.recruitment_status` */
  "participant.recruitmentStatus",
  /** `consents.status` for the DIGITAL_QUALTRICS consent */
  "consent.digitalStatus",
  /** `consents.decided_at` for the DIGITAL_QUALTRICS consent */
  "consent.digitalDecidedAt",
  /** `screenings.external_record_id` */
  "screening.externalRecordId",
  /** `screenings.completed_at` */
  "screening.completedAt",
] as const;
export type IntakeTarget = (typeof INTAKE_TARGETS)[number];

export function isIntakeTarget(v: unknown): v is IntakeTarget {
  return typeof v === "string" && (INTAKE_TARGETS as readonly string[]).includes(v);
}

/**
 * The class each target is permitted to receive. `participant.externalRef` takes
 * the anonymous ID; everything else is operational. No target accepts
 * IDENTIFIABLE or RESEARCH, which is the same guarantee stated twice — once as
 * a source restriction and once as a destination restriction.
 */
export const TARGET_FIELD_CLASS: Record<IntakeTarget, QualtricsFieldClass> = {
  "participant.externalRef": "ANONYMOUS_ID",
  "participant.recruitmentStatus": "OPERATIONAL",
  "consent.digitalStatus": "OPERATIONAL",
  "consent.digitalDecidedAt": "OPERATIONAL",
  "screening.externalRecordId": "OPERATIONAL",
  "screening.completedAt": "OPERATIONAL",
};

/**
 * Modes a configured integration can be in.
 *
 * There is no "LIVE" value. The only two states this application supports today
 * are "switched off" and "exercised against anonymized or synthetic data", which
 * is what "deja preparada una estructura segura para probar" asks for and is as
 * far as the current authorization goes. Adding a live mode is a schema change
 * plus a recorded decision, not a configuration flip.
 */
export const INTEGRATION_MODES = ["DISABLED", "TEST_ANONYMIZED"] as const;
export type IntegrationMode = (typeof INTEGRATION_MODES)[number];

export function isIntegrationMode(v: unknown): v is IntegrationMode {
  return typeof v === "string" && (INTEGRATION_MODES as readonly string[]).includes(v);
}

/** A single configured mapping, as services and UI see it. */
export interface QualtricsFieldMapping {
  id: string;
  /** The Qualtrics question/embedded-data key, e.g. "QID12" or "consentAccepted". */
  sourceField: string;
  sourceClass: QualtricsFieldClass;
  target: IntakeTarget;
  /** Explicit per-field opt-in. A mapping exists but is inert until this is true. */
  enabled: boolean;
}

export const SOURCE_FIELD_PATTERN = /^[\w.:-]{1,80}$/;

/**
 * Validate one mapping. Pure, unit-tested, and the same rules the database
 * enforces — belt and braces, because this is the check that keeps identifiable
 * data out if someone builds the transfer layer later.
 */
export type MappingProblem =
  | "invalidSourceField"
  | "unknownTarget"
  | "classNeverTransferable"
  | "classTargetMismatch";

export function validateMapping(input: {
  sourceField: string;
  sourceClass: QualtricsFieldClass;
  target: IntakeTarget;
}): MappingProblem | null {
  if (!SOURCE_FIELD_PATTERN.test(input.sourceField)) return "invalidSourceField";
  if (!isIntakeTarget(input.target)) return "unknownTarget";
  if (!isTransferableFieldClass(input.sourceClass)) return "classNeverTransferable";
  if (TARGET_FIELD_CLASS[input.target] !== input.sourceClass) return "classTargetMismatch";
  return null;
}

/**
 * The guard a transfer implementation would have to pass.
 *
 * It exists now, unused, so that whoever writes that implementation finds a
 * refusal already written rather than an empty file and a deadline. It returns
 * the fields that may be read; it never performs a read, and there is no HTTP
 * client, credential or webhook anywhere in this repository.
 */
export function selectTransferableFields(
  mappings: readonly QualtricsFieldMapping[],
  mode: IntegrationMode,
): QualtricsFieldMapping[] {
  if (mode === "DISABLED") return [];
  return mappings.filter(
    (m) =>
      m.enabled &&
      isTransferableFieldClass(m.sourceClass) &&
      TARGET_FIELD_CLASS[m.target] === m.sourceClass,
  );
}
