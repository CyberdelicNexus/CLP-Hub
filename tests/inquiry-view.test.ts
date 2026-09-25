import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avatarInitials, inquiryPreview, listTimeLabel } from "@/domain/inquiry-view";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("inquiry chat list helpers (D-088)", () => {
  it("previews a question on one line, cut on a word", () => {
    expect(inquiryPreview("¿Cuánto dura\n\n cada   sesión?")).toBe("¿Cuánto dura cada sesión?");
    const long = "palabra ".repeat(30);
    const p = inquiryPreview(long, 40);
    expect(p.endsWith("…")).toBe(true);
    expect(p.length).toBeLessThanOrEqual(41);
    expect(p).not.toMatch(/palabr…$/);
    expect(inquiryPreview(null)).toBe("");
  });

  it("takes up to two initials with accents folded", () => {
    expect(avatarInitials("María José Fernández")).toBe("MJ");
    expect(avatarInitials("Álvaro")).toBe("A");
    expect(avatarInitials("  ")).toBe("?");
    expect(avatarInitials(null)).toBe("?");
  });

  it("shows the clock time today and the day otherwise, in the study's timezone", () => {
    const now = new Date("2026-09-25T15:30:00Z");
    expect(listTimeLabel(new Date("2026-09-25T14:40:00Z"), now, "Europe/Madrid")).toBe("16:40");
    expect(listTimeLabel(new Date("2026-09-22T09:00:00Z"), now, "Europe/Madrid")).toMatch(/22\s+sept/);
    // 23:30 UTC on the 24th is already the 25th in Madrid, so it counts as today there.
    expect(listTimeLabel(new Date("2026-09-24T23:30:00Z"), now, "Europe/Madrid")).toBe("01:30");
  });
});

describe("the chat-style inbox keeps the privacy design (D-088)", () => {
  const inbox = read("src/app/(team)/equipo/(app)/consultas/inbox.tsx");
  const page = read("src/app/(team)/equipo/(app)/consultas/page.tsx");

  it("selects a conversation through a validated id in the URL, looked up in this study only", () => {
    expect(page).toMatch(/UUID\.test\(params\.consulta\)/);
    expect(page).toMatch(/getInquiry\(ctx\.study\.id, wanted\)/);
    expect(read("src/services/inquiries.ts")).toMatch(/eq\(inquiries\.studyId, studyId\)/);
  });

  it("shows text only for a pending inquiry; a handled one shows a note and no name or email", () => {
    expect(inbox).toMatch(/selected\.status === "NEW" \? \(/);
    expect(inbox).toMatch(/isNew\s*\? inquiryPreview\(row\.message\)/);
    expect(inbox).toMatch(/labels\.answeredNote\(/);
  });

  it("passes only plain strings to the client components, and the composer sends on Ctrl or Cmd + Enter, never plain Enter", () => {
    expect(inbox).toMatch(/const formLabels: InquiryLabels/);
    expect(inbox).not.toMatch(/labels=\{labels\}/);
    const forms = read("src/app/(team)/equipo/(app)/consultas/inquiry-forms.tsx");
    expect(forms).toMatch(/e\.key === "Enter" && \(e\.ctrlKey \|\| e\.metaKey\)/);
  });

  it("asks before closing, since closing erases the text", () => {
    expect(read("src/app/(team)/equipo/(app)/consultas/inquiry-forms.tsx")).toMatch(/window\.confirm\(labels\.closeConfirm\)/);
  });
});
