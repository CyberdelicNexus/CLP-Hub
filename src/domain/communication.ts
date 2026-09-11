/**
 * Message templates and the record of sending them (Phase 7).
 *
 * NOTHING IN THIS APPLICATION SENDS A WHATSAPP MESSAGE, and nothing here can.
 * There is no API client, no token, no webhook and no queue (D-004). A template
 * is rendered, shown, and copied to the clipboard by a person, who pastes it
 * into WhatsApp themselves and then marks it as sent. `tests/communication.test.ts`
 * asserts the absence rather than trusting it.
 *
 * The reason is not technical caution. An automated message to a participant in
 * a psychological trial is a touchpoint the protocol has to approve, and a
 * system that *could* send one would eventually send one by accident.
 */

/** Where a message sits in the participant's journey. Operational, not clinical. */
export const COMMUNICATION_STAGES = [
  "APPLICATION_RECEIVED",
  "SCREENING_SCHEDULING",
  "INFO_REQUEST",
  "ELIGIBILITY_CONFIRMED",
  "WAITLIST",
  "INITIAL_SESSION_SCHEDULING",
  "SESSION_REMINDER",
  "VR_INSTRUCTIONS",
  "FOLLOW_UP",
  "CLOSING",
] as const;
export type CommunicationStage = (typeof COMMUNICATION_STAGES)[number];

export function isCommunicationStage(v: unknown): v is CommunicationStage {
  return typeof v === "string" && (COMMUNICATION_STAGES as readonly string[]).includes(v);
}

/**
 * WHATSAPP is always manual (D-004). EMAIL exists in the vocabulary because
 * logistics email may later be automatable, but nothing sends that either today.
 */
export const COMMUNICATION_CHANNELS = ["WHATSAPP", "EMAIL"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export function isCommunicationChannel(v: unknown): v is CommunicationChannel {
  return typeof v === "string" && (COMMUNICATION_CHANNELS as readonly string[]).includes(v);
}

/** Channels a person must copy and paste by hand. WhatsApp, always. */
export const MANUAL_ONLY_CHANNELS: readonly CommunicationChannel[] = ["WHATSAPP"];

export function isManualOnly(channel: CommunicationChannel): boolean {
  return MANUAL_ONLY_CHANNELS.includes(channel);
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

/**
 * The complete list of placeholders a template may contain.
 *
 * A CLOSED LIST, and that is the whole safety model. A template is staff-authored
 * text that ends up in a message to a participant; if it could interpolate an
 * arbitrary field, one badly-chosen placeholder would put a screening result or
 * an email address into a WhatsApp group.
 *
 * Note what is NOT here: no eligibility, no consent status, no screening result,
 * no arm, no allocation, no email address, no phone number. Nothing from
 * Category C, and nothing from Category A beyond the participant's own first
 * name — which is gated separately below.
 */
export const TEMPLATE_VARIABLES = [
  /** The pseudonymous code, e.g. "P-000042". Always safe. */
  "codigo",
  /** The person's first name. Requires participants.contact.read to render. */
  "nombre",
  "fecha",
  "hora",
  "lugar",
  /** Display name of the responsible staff member. */
  "responsable",
  /** Cohort code, e.g. "C-2026-A". */
  "cohorte",
  /** A link the study wants to hand out. */
  "enlace",
  /** Free operational instructions supplied at render time, not stored. */
  "instrucciones",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export function isTemplateVariable(v: unknown): v is TemplateVariable {
  return typeof v === "string" && (TEMPLATE_VARIABLES as readonly string[]).includes(v);
}

/**
 * Variables that reveal who the person is.
 *
 * Rendering one requires `participants.contact.read`. Without it the placeholder
 * is replaced with the participant's code instead of being blanked: a message
 * reading "Hola ," is worse than one reading "Hola P-000042," — the second is at
 * least honest about what the sender was allowed to see.
 */
export const IDENTIFYING_VARIABLES: readonly TemplateVariable[] = ["nombre"];

export function isIdentifying(v: TemplateVariable): boolean {
  return IDENTIFYING_VARIABLES.includes(v);
}

/**
 * `{{variable}}`: no spaces, no expressions, no nesting.
 *
 * The name part is deliberately permissive — letters, digits and underscores in
 * any case — so that ANYTHING shaped like a placeholder is captured and then
 * checked against the allow-list. A stricter pattern would quietly ignore
 * `{{eligibilityStatus}}`, which would pass validation and then be sent to a
 * participant as literal text.
 */
export const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Every placeholder in a template body, in order, deduplicated. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1]);
  }
  return [...found];
}

/** Placeholders that are not in the allow-list. Empty means the body is valid. */
export function unknownVariables(body: string): string[] {
  return extractVariables(body).filter((v) => !isTemplateVariable(v));
}

export const TEMPLATE_BODY_MAX_LENGTH = 2000;
export const TEMPLATE_NAME_MAX_LENGTH = 120;
export const TEMPLATE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,47}$/;

export type TemplateProblem = "unknownVariable" | "tooLong" | "empty";

export function validateTemplateBody(body: string): TemplateProblem | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "empty";
  if (trimmed.length > TEMPLATE_BODY_MAX_LENGTH) return "tooLong";
  if (unknownVariables(trimmed).length > 0) return "unknownVariable";
  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export type TemplateValues = Partial<Record<TemplateVariable, string>>;

export interface RenderOptions {
  /** False strips identifying variables down to the participant code. */
  canReadContact: boolean;
  /** Shown wherever a value was not supplied, so gaps are visible before sending. */
  placeholder?: string;
}

export interface RenderedMessage {
  text: string;
  /** Variables the template used but no value was supplied for. */
  missing: TemplateVariable[];
  /** Identifying variables replaced by the code because of permissions. */
  redacted: TemplateVariable[];
}

/**
 * Substitute values into a template.
 *
 * Deliberately NOT a template engine. It does one pass of literal replacement
 * over an allow-listed set of names: no conditionals, no loops, no nested
 * lookups, and no way for a value to be re-scanned as a placeholder — a value
 * containing `{{nombre}}` is inserted as those literal characters, because the
 * regex runs once over the original body rather than over the result.
 *
 * Unsupplied variables are left as a visible marker rather than emptied. A
 * message that quietly reads "nos vemos el  a las " gets sent; one that reads
 * "nos vemos el ⟨fecha⟩ a las ⟨hora⟩" gets fixed.
 */
export function renderTemplate(
  body: string,
  values: TemplateValues,
  options: RenderOptions,
): RenderedMessage {
  const placeholder = options.placeholder ?? "⟨?⟩";
  const missing: TemplateVariable[] = [];
  const redacted: TemplateVariable[] = [];

  const text = body.replace(VARIABLE_PATTERN, (_match, rawName: string) => {
    if (!isTemplateVariable(rawName)) {
      // Unreachable for a saved template — validateTemplateBody refuses these —
      // but a body hand-edited in the database must not silently interpolate
      // something unexpected either.
      return placeholder;
    }

    const name: TemplateVariable = rawName;

    if (isIdentifying(name) && !options.canReadContact) {
      redacted.push(name);
      return values.codigo ?? placeholder;
    }

    const value = values[name];
    if (value === undefined || value === "") {
      missing.push(name);
      return `⟨${name}⟩`;
    }
    return value;
  });

  return { text, missing: [...new Set(missing)], redacted: [...new Set(redacted)] };
}

// ---------------------------------------------------------------------------
// The record of sending
// ---------------------------------------------------------------------------

/**
 * What a `communications` row means.
 *
 * SENT is a human saying "I pasted this and sent it". Nothing observes delivery,
 * so there is deliberately no DELIVERED or FAILED: this application cannot know
 * either, and a status it cannot verify would be a claim rather than a record.
 */
export const COMMUNICATION_STATUSES = ["SENT", "SKIPPED"] as const;
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export function isCommunicationStatus(v: unknown): v is CommunicationStatus {
  return typeof v === "string" && (COMMUNICATION_STATUSES as readonly string[]).includes(v);
}

/**
 * WHAT IS NEVER STORED: the rendered message.
 *
 * A `communications` row records which template was used, for whom, when, and by
 * whom — plus the template body AS IT STOOD, with its placeholders still in
 * place. That answers "what did we send P-000042 on the 4th" without copying the
 * person's name, date and location into a second table, and without this
 * application ever holding a WhatsApp conversation.
 *
 * Replies are not stored at all. There is no inbound path.
 */
export const STORES_RENDERED_MESSAGE = false;
