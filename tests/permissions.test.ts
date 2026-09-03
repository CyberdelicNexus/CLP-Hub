import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, permissionsForRoles, ROLE_PERMISSIONS } from "@/domain/permissions";
import { STAFF_ROLES } from "@/domain/roles";
import { assertPermission, AuthorizationError, can } from "@/auth/authorize";

describe("permission matrix", () => {
  it("defines a permission list for every role", () => {
    for (const role of STAFF_ROLES) expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
  });

  it("ADMIN holds every permission", () => {
    for (const p of PERMISSIONS) expect(hasPermission(["ADMIN"], p)).toBe(true);
  });

  it("RESEARCHER never sees contact data or logistics", () => {
    expect(hasPermission(["RESEARCHER"], "participants.contact.read")).toBe(false);
    expect(hasPermission(["RESEARCHER"], "logistics.read")).toBe(false);
    expect(hasPermission(["RESEARCHER"], "communications.manage")).toBe(false);
  });

  it("LOGISTICS sees contact data but no screening or consent detail", () => {
    expect(hasPermission(["LOGISTICS"], "participants.contact.read")).toBe(true);
    expect(hasPermission(["LOGISTICS"], "screening.read")).toBe(false);
    expect(hasPermission(["LOGISTICS"], "consent.read")).toBe(false);
  });

  it("FACILITATOR cannot approve communications or manage the team", () => {
    expect(hasPermission(["FACILITATOR"], "communications.approve")).toBe(false);
    expect(hasPermission(["FACILITATOR"], "team.manage")).toBe(false);
  });

  it("only ADMIN can manage study settings and the team", () => {
    for (const role of STAFF_ROLES) {
      const expected = role === "ADMIN";
      expect(hasPermission([role], "study.settings.manage")).toBe(expected);
      expect(hasPermission([role], "team.manage")).toBe(expected);
    }
  });

  it("multiple roles union their permissions", () => {
    const set = permissionsForRoles(["RESEARCHER", "LOGISTICS"]);
    expect(set.has("exports.research")).toBe(true);
    expect(set.has("logistics.manage")).toBe(true);
    expect(set.has("team.manage")).toBe(false);
  });
});

describe("assertPermission", () => {
  const subject = { roles: ["FACILITATOR" as const], study: { id: "study-1" } };

  it("passes when allowed", () => {
    expect(() => assertPermission(subject, "sessions.manage")).not.toThrow();
    expect(can(subject, "sessions.manage")).toBe(true);
  });

  it("throws a typed error when denied", () => {
    expect(() => assertPermission(subject, "communications.approve")).toThrow(AuthorizationError);
    try {
      assertPermission(subject, "communications.approve");
    } catch (e) {
      expect((e as AuthorizationError).permission).toBe("communications.approve");
      expect((e as AuthorizationError).studyId).toBe("study-1");
    }
  });
});
