import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_STAGES,
  COMMUNICATION_STATUSES,
  IDENTIFYING_VARIABLES,
  STORES_RENDERED_MESSAGE,
  TEMPLATE_BODY_MAX_LENGTH,
  TEMPLATE_VARIABLES,
  extractVariables,
  isManualOnly,
  renderTemplate,
  unknownVariables,
  validateTemplateBody,
} from "@/domain/communication";
import { AUTHORABLE_CONTENT_TYPES, CONTENT_TYPES } from "@/domain/content";

describe("nothing sends a message", () => {
  const domain = readFileSync(join(process.cwd(), "src/domain/communication.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/services/communications.ts"), "utf8");
  const actions = readFileSync(
    join(process.cwd(), "src/app/(team)/equipo/(app)/comunicaciones/actions.ts"),
    "utf8",
  );

  /**
   * The guarantee is "no send path exists", and an absolute is far easier to
   * audit than a set of guards — the same argument D-018 makes about
   * randomization. If someone adds a client, this fails loudly.
   */
  it("has no HTTP client, credential or endpoint anywhere in the feature", () => {
    for (const source of [domain, service, actions]) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/axios|XMLHttpRequest|nodemailer|twilio/i);
      expect(source).not.toMatch(/api[_-]?key|apiToken|accessToken|bearer/i);
      expect(source).not.toMatch(/https?:\/\/(?!\S*example\.com)[a-z]/i);
    }
  });

  it("offers no delivery status it could not verify", () => {
    // Nothing here observes delivery, so DELIVERED or FAILED would be a claim.
    expect([...COMMUNICATION_STATUSES]).toEqual(["SENT", "SKIPPED"]);
  });

  it("treats WhatsApp as manual, always", () => {
    expect(isManualOnly("WHATSAPP")).toBe(true);
  });
});

describe("the variable allow-list", () => {
  /**
   * A template is staff-authored text that ends up in a message to a
   * participant. If it could interpolate an arbitrary field, one badly-chosen
   * placeholder would put a screening result in a WhatsApp group.
   */
  it("exposes nothing clinical and no contact channel", () => {
    const forbidden =
      /eligib|consent|screening|result|arm|allocation|email|correo|telefono|phone|diagnos/i;
    for (const v of TEMPLATE_VARIABLES) {
      expect(v).not.toMatch(forbidden);
    }
  });

  it("finds the placeholders a body uses", () => {
    expect(extractVariables("Hola {{nombre}}, el {{fecha}} a las {{hora}}")).toEqual([
      "nombre",
      "fecha",
      "hora",
    ]);
  });

  it("deduplicates repeated placeholders", () => {
    expect(extractVariables("{{nombre}} y {{nombre}}")).toEqual(["nombre"]);
  });

  it("refuses a body that uses anything outside the list", () => {
    expect(unknownVariables("Hola {{email}}")).toEqual(["email"]);
    expect(validateTemplateBody("Hola {{email}}")).toBe("unknownVariable");
    expect(validateTemplateBody("Hola {{eligibilityStatus}}")).toBe("unknownVariable");
  });

  it("accepts a body that only uses allowed ones", () => {
    expect(validateTemplateBody("Hola {{nombre}}, nos vemos el {{fecha}}.")).toBeNull();
  });

  it("refuses an empty or oversized body", () => {
    expect(validateTemplateBody("   ")).toBe("empty");
    expect(validateTemplateBody("a".repeat(TEMPLATE_BODY_MAX_LENGTH + 1))).toBe("tooLong");
  });
});

describe("rendering", () => {
  const opts = { canReadContact: true };

  it("substitutes the values it was given", () => {
    const out = renderTemplate("Hola {{nombre}}, el {{fecha}}.", {
      nombre: "Ana",
      fecha: "4 de mayo",
    }, opts);
    expect(out.text).toBe("Hola Ana, el 4 de mayo.");
    expect(out.missing).toEqual([]);
  });

  /**
   * A message that quietly reads "nos vemos el  a las " gets sent. One that
   * reads "nos vemos el ⟨fecha⟩ a las ⟨hora⟩" gets fixed.
   */
  it("marks an unsupplied value instead of emptying it", () => {
    const out = renderTemplate("Nos vemos el {{fecha}} a las {{hora}}.", {}, opts);
    expect(out.text).toContain("⟨fecha⟩");
    expect(out.text).toContain("⟨hora⟩");
    expect(out.missing).toEqual(["fecha", "hora"]);
  });

  /**
   * Without contact permission the name falls back to the code rather than
   * being blanked: "Hola P-000042," is at least honest about what the sender
   * was allowed to see.
   */
  it("falls back to the code when the name may not be read", () => {
    const out = renderTemplate(
      "Hola {{nombre}}.",
      { nombre: "Ana", codigo: "P-000042" },
      { canReadContact: false },
    );
    expect(out.text).toBe("Hola P-000042.");
    expect(out.redacted).toEqual(["nombre"]);
    expect(out.text).not.toContain("Ana");
  });

  it("names every identifying variable so none is missed", () => {
    for (const v of IDENTIFYING_VARIABLES) {
      const out = renderTemplate(`{{${v}}}`, { [v]: "secreto", codigo: "P-1" }, {
        canReadContact: false,
      });
      expect(out.text).not.toContain("secreto");
    }
  });

  /**
   * One pass over the ORIGINAL body, so a value containing `{{nombre}}` is
   * inserted as those literal characters and never re-scanned.
   */
  it("does not re-scan substituted values as placeholders", () => {
    const out = renderTemplate("{{lugar}}", { lugar: "{{nombre}}", nombre: "Ana" }, opts);
    expect(out.text).toBe("{{nombre}}");
    expect(out.text).not.toContain("Ana");
  });

  it("leaves an unknown placeholder inert", () => {
    // Unreachable for a saved template, but a hand-edited row must not
    // interpolate something unexpected either.
    const out = renderTemplate("{{email}}", {}, opts);
    expect(out.text).not.toMatch(/@/);
  });
});

describe("what a send record holds", () => {
  const schema = readFileSync(join(process.cwd(), "src/db/schema/communications.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/services/communications.ts"), "utf8");
  const composer = readFileSync(
    join(process.cwd(), "src/app/(team)/equipo/(app)/comunicaciones/message-composer.tsx"),
    "utf8",
  );

  it("declares that the rendered message is not stored", () => {
    expect(STORES_RENDERED_MESSAGE).toBe(false);
  });

  /**
   * `template_body` holds the TEMPLATE with its placeholders intact. Storing the
   * rendered text would copy the person's name, date and location into a second
   * table (D-039).
   */
  it("stores the template body, not the rendered text", () => {
    expect(schema).toMatch(/templateBody/);
    expect(service).toMatch(/templateBody: template\.bodyEs/);
    // Comments stripped: the service explains that rendering happens in the
    // browser, and the explanation has to be allowed to name the function.
    expect(stripComments(service)).not.toMatch(/renderTemplate/);
  });

  it("has no column for a reply or an inbound message", () => {
    expect(stripComments(schema)).not.toMatch(/reply|inbound|conversation|thread/i);
  });

  /**
   * The rendered text exists only in the browser. If it were a hidden field it
   * would be posted, and then stored.
   */
  it("never submits the rendered text from the composer", () => {
    const form = composer.slice(composer.indexOf("<form action={action}"));
    expect(form).not.toMatch(/name="(text|body|message|rendered)"/);
    expect(form).toMatch(/name="templateId"/);
  });
});

describe("message templates live in one place", () => {
  /**
   * The content system had WHATSAPP_TEMPLATE and EMAIL_TEMPLATE types. Offering
   * both those and communication_templates would be two places to write the same
   * message (D-039).
   */
  it("keeps the retired content types readable but unofferable", () => {
    expect(CONTENT_TYPES).toContain("WHATSAPP_TEMPLATE");
    expect(AUTHORABLE_CONTENT_TYPES).not.toContain("WHATSAPP_TEMPLATE");
    expect(AUTHORABLE_CONTENT_TYPES).not.toContain("EMAIL_TEMPLATE");
  });
});

describe("stages cover the meeting's list", () => {
  it("has a stage for each template the meeting asked for", () => {
    // Ten were named: confirmation, screening scheduling, info request,
    // eligibility, waitlist, initial session, reminder, headset instructions,
    // follow-up, closing.
    expect(COMMUNICATION_STAGES).toHaveLength(10);
  });

  it("names nothing clinical", () => {
    const clinical = /diagnos|symptom|therap|treatment|score/i;
    for (const s of COMMUNICATION_STAGES) {
      expect(s).not.toMatch(clinical);
    }
  });
});

describe("migration 0012", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0012_communications.sql"), "utf8");

  it("has no column that would enable sending", () => {
    expect(sql).not.toMatch(/api_key|api_token|access_token|webhook|scheduled_for/i);
  });

  it("offers only statuses a person can attest to", () => {
    expect(sql).toMatch(/create type communication_status as enum \('SENT','SKIPPED'\)/);
  });

  it("is purely additive", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/rename\s+column/i);
  });
});

describe("the seeded templates obey the allow-list", () => {
  const seed = readFileSync(join(process.cwd(), "scripts/seed.ts"), "utf8");

  it("uses no placeholder outside the allow-list", () => {
    const block = seed.slice(
      seed.indexOf("const DEMO_TEMPLATES = ["),
      seed.indexOf("/** Obviously fake applicants"),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(unknownVariables(block)).toEqual([]);
  });
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
