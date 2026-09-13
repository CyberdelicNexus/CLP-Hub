import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEAM_NAV } from "@/domain/navigation";
import { hasPermission, PERMISSIONS, permissionsForRoles } from "@/domain/permissions";
import { STAFF_ROLES } from "@/domain/roles";
import { isValidScreeningUrl, isValidTimezone } from "@/services/study-settings";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("study settings", () => {
  /**
   * This URL is where every applicant is sent (D-031). `https` is not a
   * preference: an `http` value would downgrade the connection of every person
   * who follows the recruitment page's only outbound link.
   */
  it("accepts only an https URL with no whitespace", () => {
    expect(isValidScreeningUrl("https://example.com/survey")).toBe(true);
    expect(isValidScreeningUrl("http://example.com/survey")).toBe(false);
    expect(isValidScreeningUrl("https://example.com/a b")).toBe(false);
    expect(isValidScreeningUrl("example.com")).toBe(false);
    expect(isValidScreeningUrl("")).toBe(false);
  });

  it("bounds the URL the same way the database does", () => {
    // Migration 0013 caps it at 500 with length(), after 0007's {1,500} regex
    // turned out to be invalid in Postgres.
    expect(isValidScreeningUrl(`https://example.com/${"a".repeat(479)}`)).toBe(true);
    expect(isValidScreeningUrl(`https://example.com/${"a".repeat(500)}`)).toBe(false);
  });

  /** Asked of the runtime, not of a hand-maintained list that would go stale. */
  it("accepts a timezone the runtime can actually resolve", () => {
    expect(isValidTimezone("Europe/Madrid")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });

  /**
   * The code appears in participant codes, exports and every audit row.
   * Renaming it would silently re-label history, so the form does not offer it.
   */
  it("does not offer the study code for editing", () => {
    const service = read("src/services/study-settings.ts");
    const form = read("src/app/(team)/equipo/(app)/configuracion/settings-forms.tsx");
    expect(service).not.toMatch(/code: patch\.code|patch\.code/);
    expect(form).not.toMatch(/name="code"/);
  });

  it("writes only the fields that actually changed into the audit row", () => {
    const service = read("src/services/study-settings.ts");
    // A form that posts every field on every save would otherwise log five
    // changes when somebody fixed a typo.
    expect(service).toMatch(/if \(next\[key\] !== current\[key\]\)/);
    expect(service).toMatch(/if \(Object\.keys\(after\)\.length === 0\) return;/);
  });

  it("keeps settings to whoever configures the study", () => {
    expect(hasPermission(["ADMIN"], "study.settings.manage")).toBe(true);
    for (const role of STAFF_ROLES.filter((r) => r !== "ADMIN")) {
      expect(hasPermission([role], "study.settings.manage"), role).toBe(false);
    }
  });
});

describe("team membership", () => {
  const service = read("src/services/staff.ts");
  const actions = read("src/app/(team)/equipo/(app)/equipo/actions.ts");

  /**
   * An application that could mint a login would be an account-creation surface
   * behind a single compromised session. Accounts live in Supabase Auth; this
   * application grants roles to people who already exist (D-044).
   */
  it("cannot create an account", () => {
    for (const source of [service, actions]) {
      expect(source).not.toMatch(/insert\(users\)|signUp|createUser|admin\.createUser/);
    }
  });

  /** "Who could see this in March" has to stay answerable. */
  it("revokes by stamping the row rather than deleting it", () => {
    expect(service).toMatch(/revokedAt: new Date\(\), revokedBy: params\.actorId/);
    expect(service).not.toMatch(/\.delete\(userRoles\)/);
  });

  it("audits both the grant and the revocation", () => {
    expect(service).toMatch(/action: "user_role\.granted"/);
    expect(service).toMatch(/action: "user_role\.revoked"/);
  });

  it("separates seeing the team from changing it", () => {
    expect(hasPermission(["STUDY_MANAGER"], "team.read")).toBe(true);
    expect(hasPermission(["STUDY_MANAGER"], "team.manage")).toBe(false);
    expect(hasPermission(["ADMIN"], "team.manage")).toBe(true);
  });

  /**
   * The page derives each member's capabilities from `permissionsForRoles`
   * rather than restating them. A screen that listed them in its own words would
   * drift from the matrix within a release (CLAUDE.md rule 8).
   */
  it("derives displayed capabilities from the permission matrix", () => {
    const page = read("src/app/(team)/equipo/(app)/equipo/page.tsx");
    expect(page).toMatch(/permissionsForRoles\(member\.roles\)/);
    // Sanity: the derivation it relies on works.
    const granted = permissionsForRoles(["FACILITATOR"]);
    expect(granted.has("sessions.manage")).toBe(true);
    expect(granted.has("study.settings.manage")).toBe(false);
    expect(PERMISSIONS.filter((p) => granted.has(p)).length).toBe(granted.size);
  });
});

describe("every dashboard section is real", () => {
  /**
   * The `[section]` stub route answered any unknown path under /equipo with a
   * "Próximamente" card. Now that every nav entry has a route of its own, a
   * stub would turn a typo into a false promise — so it is gone, and a wrong
   * path is a 404.
   */
  it("has no coming-soon placeholder left", () => {
    const layout = read("src/app/(team)/equipo/(app)/layout.tsx");
    expect(layout).not.toMatch(/ComingSoon/);
    for (const messages of ["messages/es.json", "messages/en.json"]) {
      expect(read(messages), messages).not.toMatch(/comingSoon/);
    }
  });

  it("gives every nav entry a page", () => {
    for (const section of TEAM_NAV) {
      const path = section.path
        ? `src/app/(team)/equipo/(app)/${section.path}/page.tsx`
        : "src/app/(team)/equipo/(app)/page.tsx";
      expect(() => read(path), section.key).not.toThrow();
    }
  });
});
