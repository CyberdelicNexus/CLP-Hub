import { describe, expect, it } from "vitest";
import { resolveActiveStudyId } from "@/auth/resolve-study";
import { TEAM_NAV, sectionByPath } from "@/domain/navigation";
import { permissionsForRoles } from "@/domain/permissions";

describe("resolveActiveStudyId", () => {
  const memberships = [{ studyId: "a" }, { studyId: "b" }];

  it("returns null without memberships", () => {
    expect(resolveActiveStudyId([], "a")).toBeNull();
  });

  it("honours a requested study the user belongs to", () => {
    expect(resolveActiveStudyId(memberships, "b")).toBe("b");
  });

  it("ignores a requested study the user does NOT belong to", () => {
    expect(resolveActiveStudyId(memberships, "forged-id")).toBe("a");
  });

  it("falls back to the first membership when nothing is requested", () => {
    expect(resolveActiveStudyId(memberships, undefined)).toBe("a");
  });
});

describe("navigation visibility", () => {
  const visible = (roles: Parameters<typeof permissionsForRoles>[0]) => {
    const perms = permissionsForRoles(roles);
    return TEAM_NAV.filter((s) => s.permissions.length === 0 || s.permissions.some((p) => perms.has(p))).map(
      (s) => s.key,
    );
  };

  it("has unique, Spanish, URL-safe paths", () => {
    const paths = TEAM_NAV.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^[a-z-]*$/);
  });

  it("shows all 12 sections to ADMIN", () => {
    // Was 13 before D-068 folded sessions/communications/content into the
    // cohort workspace nav entry; content came back (2026-09-19, D-070) once
    // it grew a real editor, and calendar is new — net 13 -> 10 -> 12.
    expect(visible(["ADMIN"])).toHaveLength(12);
  });

  it("hides settings and team from non-admins", () => {
    for (const role of ["STUDY_MANAGER", "FACILITATOR", "RESEARCHER", "LOGISTICS"] as const) {
      expect(visible([role])).not.toContain("settings");
    }
    expect(visible(["FACILITATOR"])).not.toContain("team");
  });

  it("hides logistics from researchers and screening from logistics", () => {
    expect(visible(["RESEARCHER"])).not.toContain("logistics");
    expect(visible(["LOGISTICS"])).not.toContain("screening");
  });

  it("resolves sections by path", () => {
    expect(sectionByPath("cohortes")?.key).toBe("cohorts");
    expect(sectionByPath("does-not-exist")).toBeUndefined();
  });
});
