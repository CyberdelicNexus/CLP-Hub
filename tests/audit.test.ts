import { describe, expect, it } from "vitest";
import { buildAuditRow } from "@/audit/record";

describe("buildAuditRow", () => {
  it("builds a row for a staff actor", () => {
    const row = buildAuditRow({
      studyId: "s1",
      actor: { type: "STAFF", id: "u1" },
      action: "user.locale_changed",
      entityType: "user",
      entityId: "u1",
      before: { preferredLocale: "es" },
      after: { preferredLocale: "en" },
    });
    expect(row).toMatchObject({
      studyId: "s1",
      actorType: "STAFF",
      actorId: "u1",
      action: "user.locale_changed",
      entityType: "user",
      entityId: "u1",
      beforeJson: { preferredLocale: "es" },
      afterJson: { preferredLocale: "en" },
      metadata: null,
    });
  });

  it("stores a null actor id for SYSTEM", () => {
    const row = buildAuditRow({
      actor: { type: "SYSTEM" },
      action: "seed.applied",
      entityType: "study",
      entityId: "s1",
    });
    expect(row.actorType).toBe("SYSTEM");
    expect(row.actorId).toBeNull();
    expect(row.studyId).toBeNull();
  });

  it("rejects malformed actions (mirrors the DB check constraint)", () => {
    expect(() =>
      buildAuditRow({ actor: { type: "SYSTEM" }, action: "BadAction.x", entityType: "a", entityId: "1" }),
    ).toThrow(/Invalid audit action/);
    expect(() =>
      buildAuditRow({ actor: { type: "SYSTEM" }, action: "no_dot" as `${string}.${string}`, entityType: "a", entityId: "1" }),
    ).toThrow(/Invalid audit action/);
  });

  it("requires an entity reference", () => {
    expect(() =>
      buildAuditRow({ actor: { type: "SYSTEM" }, action: "x.y", entityType: "", entityId: "1" }),
    ).toThrow(/entityType/);
  });
});
