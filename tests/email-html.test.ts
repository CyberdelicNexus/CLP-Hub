import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOGO_CID,
  esc,
  inquiryReplyHtml,
  participantMessageHtml,
  richText,
  staffNoticeHtml,
} from "@/emails/html";
import { LOGO_PNG_BASE64 } from "@/emails/logo";

describe("the Hub's branded emails (D-119)", () => {
  /** A reply or a template is typed by a person; it must never become markup. */
  it("escapes everything a person typed", () => {
    const html = inquiryReplyHtml({
      locale: "es",
      reply: '<script>alert(1)</script> & "hola"',
      question: "<img src=x onerror=alert(1)>",
      siteUrl: null,
    });
    expect(html).not.toMatch(/<script>|<img src=x/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;hola&quot;");
    expect(esc(`'"<>&`)).toBe("&#39;&quot;&lt;&gt;&amp;");
  });

  it("makes https links clickable and keeps paragraphs and line breaks", () => {
    const html = richText("Primera línea\nsegunda\n\nCuestionario: https://example.com/q?a=1&b=2");
    expect(html).toContain("Primera línea<br>segunda");
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).toContain('<a href="https://example.com/q?a=1&amp;b=2"');
  });

  it("does not link anything that is not https", () => {
    expect(richText("javascript:alert(1) http://example.com")).not.toContain("<a ");
  });

  it("refers to the inline logo, not a remote image", () => {
    const html = staffNoticeHtml({ count: 1, inboxUrl: null });
    expect(html).toContain(`src="cid:${LOGO_CID}"`);
    expect(html).not.toMatch(/<img[^>]+src="https?:/);
  });

  /** D-088: the notice says that something arrived, never what or from whom. */
  it("keeps the question out of the staff notice", () => {
    const html = staffNoticeHtml({ count: 2, inboxUrl: "https://numadelic.org/hub/consultas" });
    expect(html).toContain("Hay 2 consultas sin responder");
    expect(html).toContain('href="https://numadelic.org/hub/consultas"');
  });

  it("speaks the inquiry's language and quotes the question", () => {
    const en = inquiryReplyHtml({ locale: "en", reply: "Thanks", question: "How long?", siteUrl: null });
    expect(en).toContain('lang="en"');
    expect(en).toContain("Your question");
    expect(en).toContain("How long?");
    expect(inquiryReplyHtml({ locale: "gl", reply: "x", question: "q", siteUrl: null })).toContain("A túa consulta");
  });

  it("stays far below Gmail's 102 KB clipping limit", () => {
    const html = participantMessageHtml({ subject: "Asunto", body: "a ".repeat(1000), siteUrl: "https://numadelic.org/clearlight" });
    expect(Buffer.byteLength(html)).toBeLessThan(40 * 1024);
  });

  it("ships a small inline logo, embedded in code and matching its source file", () => {
    const bytes = readFileSync(join(process.cwd(), "src/emails/assets/logo-112.png"));
    expect(bytes.length).toBeLessThan(20 * 1024);
    expect(LOGO_PNG_BASE64).toBe(bytes.toString("base64"));
  });

  /** React rendering needs react-dom/server, which Next refuses in server code. */
  it("renders without React", () => {
    const source = readFileSync(join(process.cwd(), "src/emails/html.ts"), "utf8");
    expect(source).not.toMatch(/from "(react|react-dom[^"]*|react-email)"/);
  });
});
