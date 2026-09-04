import { describe, expect, it } from "vitest";
import {
  extractContact,
  validateAnswers,
  type FormQuestion,
} from "@/domain/application-form";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_TRANSITIONS,
  canTransitionApplication,
  formatParticipantCode,
  LONG_TEXT_MAX_LENGTH,
  normalizeEmail,
  recruitmentStatusForApplication,
  type ApplicationStatus,
} from "@/domain/recruitment";

const question = (over: Partial<FormQuestion> & Pick<FormQuestion, "key" | "type">): FormQuestion => ({
  id: `id-${over.key}`,
  required: false,
  options: null,
  ...over,
});

describe("application status transitions", () => {
  it("keeps terminal states terminal", () => {
    expect(APPLICATION_STATUS_TRANSITIONS.NOT_PURSUED).toEqual([]);
    expect(APPLICATION_STATUS_TRANSITIONS.WITHDRAWN).toEqual([]);
  });

  it("never allows a transition back into SUBMITTED", () => {
    for (const from of APPLICATION_STATUSES) {
      expect(canTransitionApplication(from, "SUBMITTED")).toBe(false);
    }
  });

  it("only lists known statuses as targets", () => {
    const known = new Set<string>(APPLICATION_STATUSES);
    for (const targets of Object.values(APPLICATION_STATUS_TRANSITIONS)) {
      for (const t of targets) expect(known.has(t)).toBe(true);
    }
  });

  it("never lists a state as a transition to itself", () => {
    for (const [from, targets] of Object.entries(APPLICATION_STATUS_TRANSITIONS)) {
      expect(targets).not.toContain(from as ApplicationStatus);
    }
  });

  it("maps only forward-moving statuses onto the recruitment funnel", () => {
    expect(recruitmentStatusForApplication("SUBMITTED")).toBe("APPLICATION_SUBMITTED");
    expect(recruitmentStatusForApplication("IN_REVIEW")).toBe("PRESCREEN");
    expect(recruitmentStatusForApplication("ACCEPTED_FOR_SCREENING")).toBe("SCREENING_PENDING");
    // Closing an application must not rewind or advance the participant.
    expect(recruitmentStatusForApplication("NOT_PURSUED")).toBeNull();
    expect(recruitmentStatusForApplication("WITHDRAWN")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  it("does not merge distinct addresses by stripping dots or plus tags", () => {
    // Provider-specific rules would wrongly link two different people.
    expect(normalizeEmail("a.b@example.com")).not.toBe(normalizeEmail("ab@example.com"));
    expect(normalizeEmail("a+study@example.com")).not.toBe(normalizeEmail("a@example.com"));
  });
});

describe("formatParticipantCode", () => {
  it("zero-pads to a stable width", () => {
    expect(formatParticipantCode(1)).toBe("P-000001");
    expect(formatParticipantCode(123456)).toBe("P-123456");
  });

  it("matches the database check constraint", () => {
    const pattern = /^P-[0-9]{6,}$/;
    for (const n of [1, 42, 999999, 1000000]) {
      expect(formatParticipantCode(n)).toMatch(pattern);
    }
  });
});

describe("validateAnswers", () => {
  it("reports required fields that are blank", () => {
    const questions = [question({ key: "full_name", type: "SHORT_TEXT", required: true })];
    const result = validateAnswers(questions, { full_name: "   " });
    expect(result.ok).toBe(false);
    expect(result.errors.full_name).toBe("required");
  });

  it("accepts an optional field left blank without recording a value", () => {
    const questions = [question({ key: "phone", type: "PHONE" })];
    const result = validateAnswers(questions, { phone: "" });
    expect(result.ok).toBe(true);
    expect(result.values.size).toBe(0);
  });

  it("rejects malformed email", () => {
    const questions = [question({ key: "email", type: "EMAIL", required: true })];
    expect(validateAnswers(questions, { email: "nope" }).errors.email).toBe("invalidEmail");
    expect(validateAnswers(questions, { email: "a@b.co" }).ok).toBe(true);
  });

  it("rejects choices outside the configured options", () => {
    const questions = [
      question({ key: "referral", type: "SELECT", options: [{ value: "web" }] }),
    ];
    expect(validateAnswers(questions, { referral: "web" }).ok).toBe(true);
    // A tampered client cannot inject an unconfigured option value.
    expect(validateAnswers(questions, { referral: "injected" }).errors.referral).toBe(
      "invalidOption",
    );
  });

  it("keeps multi-select answers as arrays and validates every entry", () => {
    const questions = [
      question({
        key: "availability",
        type: "MULTI_SELECT",
        required: true,
        options: [{ value: "am" }, { value: "pm" }],
      }),
    ];
    const ok = validateAnswers(questions, { availability: ["am", "pm"] });
    expect(ok.values.get("id-availability")).toEqual(["am", "pm"]);

    const bad = validateAnswers(questions, { availability: ["am", "evil"] });
    expect(bad.errors.availability).toBe("invalidOption");

    const empty = validateAnswers(questions, {});
    expect(empty.errors.availability).toBe("required");
  });

  it("treats a required boolean as must-be-checked", () => {
    const questions = [question({ key: "contact_consent", type: "BOOLEAN", required: true })];
    expect(validateAnswers(questions, {}).errors.contact_consent).toBe("required");
    expect(validateAnswers(questions, { contact_consent: "on" }).ok).toBe(true);
    expect(validateAnswers(questions, { contact_consent: "on" }).values.get("id-contact_consent")).toBe(
      true,
    );
  });

  it("caps free text so a long clinical narrative cannot be pasted in", () => {
    const questions = [question({ key: "notes", type: "LONG_TEXT" })];
    const tooLong = "x".repeat(LONG_TEXT_MAX_LENGTH + 1);
    expect(validateAnswers(questions, { notes: tooLong }).errors.notes).toBe("tooLong");
  });

  it("ignores submitted fields that are not configured questions", () => {
    const questions = [question({ key: "email", type: "EMAIL", required: true })];
    const result = validateAnswers(questions, { email: "a@b.co", surprise: "value" });
    expect(result.ok).toBe(true);
    expect(result.values.size).toBe(1);
  });
});

describe("extractContact", () => {
  it("pulls contact fields out by their well-known keys", () => {
    const questions = [
      question({ key: "full_name", type: "SHORT_TEXT" }),
      question({ key: "email", type: "EMAIL" }),
      question({ key: "phone", type: "PHONE" }),
      question({ key: "city", type: "SHORT_TEXT" }),
    ];
    const values = new Map<string, string | string[] | boolean>([
      ["id-full_name", "Persona Sintética"],
      ["id-email", "a@b.co"],
      ["id-city", "Ciudad"],
    ]);
    expect(extractContact(questions, values)).toEqual({
      fullName: "Persona Sintética",
      email: "a@b.co",
      phone: undefined,
    });
  });

  it("returns nothing when the study configures no contact questions", () => {
    const questions = [question({ key: "city", type: "SHORT_TEXT" })];
    const values = new Map<string, string | string[] | boolean>([["id-city", "Ciudad"]]);
    expect(extractContact(questions, values)).toEqual({
      fullName: undefined,
      email: undefined,
      phone: undefined,
    });
  });
});
