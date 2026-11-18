import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPLICATION_NOTIFY_PER_HOUR, applicationStaffNotification } from "@/domain/application-mail";
import { applicationNoticeHtml } from "@/emails/html";

const read = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

describe("the staff notice for a new application (D-152)", () => {
  it("links to Solicitudes and names nobody", () => {
    const one = applicationStaffNotification({ count: 1, listUrl: "https://hub.example/hub/solicitudes" });
    expect(one.subject).toBe("Nueva solicitud en el Hub de Clear Light");
    expect(one.text).toContain("https://hub.example/hub/solicitudes");
    expect(one.text).not.toMatch(/@|\+34|P-[A-Z]{2}\d/);
    expect(applicationStaffNotification({ count: 3, listUrl: null }).text).toMatch(/3 solicitudes pendientes/);
  });

  it("renders in the branded frame with the button only when the Hub's address is known", () => {
    expect(applicationNoticeHtml({ count: 1, listUrl: "https://hub.example/hub/solicitudes" })).toContain(
      "Abrir Solicitudes",
    );
    expect(applicationNoticeHtml({ count: 1, listUrl: null })).not.toContain("Abrir Solicitudes");
  });

  it("goes to the same people as a consulta notice, after the response, under an hourly cap", () => {
    const svc = read("src", "services", "application-notify.ts");
    const inquiries = read("src", "services", "inquiries.ts");
    const action = read("src", "app", "(public)", "clearlight", "participar", "actions.ts");
    expect(svc).toContain("staffNotificationRecipients(studyId)");
    expect(inquiries).toContain("staffNotificationRecipients(studyId)");
    expect(svc).toContain("recent > APPLICATION_NOTIFY_PER_HOUR");
    expect(APPLICATION_NOTIFY_PER_HOUR).toBeGreaterThan(0);
    expect(action).toMatch(/after\(async \(\) => \{[\s\S]*await notifyStaffOfApplication\(study\.id\)/);
  });
});
