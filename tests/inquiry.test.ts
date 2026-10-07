import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INQUIRY_MESSAGE_MAX_LENGTH,
  INQUIRY_REPLY_MAX_LENGTH,
  normalizeInquiry,
  validateInquiry,
  validateReply,
} from "@/domain/inquiry";
import { replyEmail, staffNotification } from "@/domain/inquiry-mail";
import { hasPermission, PERMISSIONS } from "@/domain/permissions";
import { STAFF_ROLES } from "@/domain/roles";
import { TEAM_NAV } from "@/domain/navigation";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ok = { name: "Persona Sintética", email: "sintetica@example.org", message: "¿Cuánto dura cada sesión?" };

describe("inquiry validation (D-088)", () => {
  it("accepts a name, an email and a message", () => {
    expect(validateInquiry(ok)).toEqual({});
  });

  it("requires all three, rejects a mistyped email and caps the message", () => {
    expect(validateInquiry({ name: "", email: "", message: "" })).toEqual({
      name: "required",
      email: "required",
      message: "required",
    });
    expect(validateInquiry({ ...ok, email: "sintetica@example" }).email).toBe("invalidEmail");
    expect(validateInquiry({ ...ok, message: "a".repeat(INQUIRY_MESSAGE_MAX_LENGTH + 1) }).message).toBe("tooLong");
  });

  it("trims, collapses the name's spaces and keeps the message's line breaks", () => {
    expect(normalizeInquiry({ name: "  Ana   Prueba ", email: " a@b.co ", message: "  Hola\n\nGracias  " })).toEqual({
      name: "Ana Prueba",
      email: "a@b.co",
      message: "Hola\n\nGracias",
    });
  });

  it("validates a reply", () => {
    expect(validateReply("   ")).toBe("required");
    expect(validateReply("Cada sesión dura una hora.")).toBeNull();
    expect(validateReply("a".repeat(INQUIRY_REPLY_MAX_LENGTH + 1))).toBe("tooLong");
  });
});

describe("the two emails an inquiry causes (D-088)", () => {
  it("tells staff one arrived WITHOUT saying what was asked or by whom", () => {
    const one = staffNotification({ count: 1, inboxUrl: "https://hub.example/equipo/consultas" });
    expect(one.text).toContain("https://hub.example/equipo/consultas");
    expect(one.text).not.toContain(ok.message);
    expect(one.text).not.toContain(ok.email);
    expect(staffNotification({ count: 4, inboxUrl: null }).text).toMatch(/4 consultas nuevas/);
  });

  it("quotes the person's own question in their language, since the Hub keeps no copy", () => {
    const es = replyEmail({ locale: "es", reply: "Una hora.", question: "Línea 1\nLínea 2" });
    expect(es.text).toContain("> Línea 1\n> Línea 2");
    expect(es.text.startsWith("Una hora.")).toBe(true);
    expect(replyEmail({ locale: "en", reply: "x", question: "q" }).subject).toMatch(/Reply to your question/);
    expect(replyEmail({ locale: "gl", reply: "x", question: "q" }).subject).toMatch(/Resposta/);
  });
});

describe("who can answer inquiries (D-088)", () => {
  it("is exactly ADMIN, STUDY_MANAGER and RESEARCHER, and it reveals the nav entry", () => {
    const holders = STAFF_ROLES.filter((r) => hasPermission([r], "inquiries.manage"));
    expect([...holders].sort()).toEqual(["ADMIN", "RESEARCHER", "STUDY_MANAGER"]);
    expect(PERMISSIONS).toContain("inquiries.manage");
    expect(TEAM_NAV.find((s) => s.key === "inquiries")).toMatchObject({
      path: "consultas",
      permissions: ["inquiries.manage"],
    });
  });
});

describe("the inquiry inbox keeps as little as possible (D-088)", () => {
  const sql = read("supabase/migrations/0023_inquiries.sql");
  const service = read("src/services/inquiries.ts");

  it("makes an answered inquiry holding text impossible in the database", () => {
    expect(sql).toMatch(/inquiries_handled_has_no_text/);
    expect(sql).toMatch(/status = 'NEW' or \(name is null and email is null and message is null\)/);
  });

  it("erases the text in the same statement that marks it handled, and stores no reply", () => {
    expect(service).toMatch(/set\(\{ status, name: null, email: null, message: null/);
    // No column for it (the word appears in the header comment, which says so).
    expect(sql.slice(sql.indexOf("create table"), sql.indexOf("create index"))).not.toMatch(/\n\s+reply/);
  });

  it("sends the reply before erasing anything, so a failed email loses nothing", () => {
    const answer = service.slice(service.indexOf("export async function answerInquiry"));
    expect(answer.indexOf("sendMail(")).toBeGreaterThan(-1);
    expect(answer.indexOf("sendMail(")).toBeLessThan(answer.indexOf('handle(studyId, inquiryId, actorId, "ANSWERED")'));
    expect(answer).toMatch(/if \(!sent\.ok\) throw new InquiryMailError/);
  });

  it("puts nothing a person typed into an audit row", () => {
    const audits = [...service.matchAll(/recordAuditEvent\([\s\S]*?\n\s*\}\);/g)].map((m) => m[0]).join("\n");
    expect(audits.length).toBeGreaterThan(0);
    expect(audits).not.toMatch(/\bmessage\b|\bemail\b|\bname\b|reply/);
  });

  it("reads the study on the server and only the four expected fields from the request", () => {
    const action = read("src/app/(public)/clearlight/contacto/actions.ts");
    expect(action).toMatch(/getOpenRecruitmentStudy\(\)/);
    const keys = [...action.matchAll(/text\(form, "([^"]+)"\)/g)].map((m) => m[1]).sort();
    expect(keys).toEqual(["email", "mensaje", "nombre", "website"]);
  });
});

describe("the mail sender (D-088)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    vi.stubEnv("DATABASE_URL", "postgres://x");
    return import("@/services/mailer");
  }

  it("does nothing and says so when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { sendMail } = await load({ RESEND_API_KEY: "", MAIL_FROM: "" });
    expect(await sendMail({ to: ["a@b.co"], subject: "s", text: "t" })).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend with the key, the sender, the recipients and the reply-to", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const { sendMail } = await load({ RESEND_API_KEY: "re_test", MAIL_FROM: "Clear Light <c@example.org>" });
    const result = await sendMail({ to: ["a@b.co", "c@d.co"], subject: "S", text: "T", replyTo: "staff@example.org" });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toEqual({
      from: "Clear Light <c@example.org>",
      to: ["a@b.co", "c@d.co"],
      subject: "S",
      text: "T",
      reply_to: "staff@example.org",
    });
  });

  it("reports a refusal or a network failure instead of pretending it sent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));
    let mod = await load({ RESEND_API_KEY: "re_test", MAIL_FROM: "c@example.org" });
    expect(await mod.sendMail({ to: ["a@b.co"], subject: "s", text: "t" })).toEqual({ ok: false, reason: "rejected" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    mod = await load({ RESEND_API_KEY: "re_test", MAIL_FROM: "c@example.org" });
    expect(await mod.sendMail({ to: ["a@b.co"], subject: "s", text: "t" })).toEqual({ ok: false, reason: "network" });
  });
});
