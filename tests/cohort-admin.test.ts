import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasPermission } from "@/domain/permissions";
import { SESSION_TEMPLATE_CODE_PATTERN } from "@/domain/session";
import { STAGE_CODE_PATTERN } from "@/domain/program-stage";
import { STAFF_ROLES } from "@/domain/roles";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * Cohort editing, archiving and deletion (2026-09-28 request, D-089).
 *
 * There is no wired-up test database in this suite (see tests/settings.test.ts's
 * own note on the same constraint), so — matching that file's own pattern —
 * these read the service source as text and assert the shapes that matter,
 * rather than exercising the transactions against a real Postgres.
 */
describe("cohort editing and archiving", () => {
  const service = read("src/services/cohorts.ts");

  it("edits status and stage through their own actions, never through updateCohort", () => {
    // advanceCohortStatus and setCohortStage carry rules (the forward-only
    // lifecycle, the size check, the arm check) that a generic field edit
    // must not bypass by quietly accepting a `status` or `currentStageId` key.
    const updateFn = service.slice(
      service.indexOf("export async function updateCohort"),
      service.indexOf("export async function archiveCohort"),
    );
    expect(updateFn).not.toMatch(/status:/);
    expect(updateFn).not.toMatch(/currentStageId/);
  });

  it("writes only the fields that actually changed into the audit row", () => {
    expect(service).toMatch(/if \(patch\[key\] !== current\[key\]\)/);
  });

  it("archiving and unarchiving are reversible flags, not a new CohortStatus", () => {
    expect(service).toMatch(/archivedAt: now/);
    expect(service).toMatch(/archivedAt: null/);
    // Never a value assigned to the `status` column by either function.
    const archiveFn = service.slice(
      service.indexOf("export async function archiveCohort"),
      service.indexOf("export async function unarchiveCohort"),
    );
    expect(archiveFn).not.toMatch(/\.set\(\{ status:/);
  });

  it("audits create, update, archive, unarchive and delete", () => {
    for (const action of [
      "cohort.created",
      "cohort.updated",
      "cohort.archived",
      "cohort.unarchived",
      "cohort.deleted",
    ]) {
      expect(service, action).toMatch(new RegExp(`action: "${action.replace(".", "\\.")}"`));
    }
  });
});

describe("cohort deletion (D-089)", () => {
  const service = read("src/services/cohorts.ts");
  const deleteStart = service.indexOf("export async function deleteCohort");
  const deleteFn = service.slice(
    deleteStart,
    service.indexOf("export async function recordRandomization", deleteStart),
  );

  it("refuses to run without a written reason", () => {
    expect(deleteFn).toMatch(/if \(!reason\) throw new ConflictError\("deleteReasonRequired"\)/);
  });

  it("records the audit row, with the reason, before the destructive deletes", () => {
    const auditAt = deleteFn.indexOf('action: "cohort.deleted"');
    const firstDelete = deleteFn.indexOf("tx.delete(");
    expect(auditAt).toBeGreaterThan(-1);
    expect(firstDelete).toBeGreaterThan(-1);
    expect(auditAt).toBeLessThan(firstDelete);
    expect(deleteFn).toMatch(/metadata: \{\s*reason,/);
  });

  it("never puts a participant's name or code in the audit snapshot", () => {
    // Only counts. D-037's redaction stance: this is the one place in the
    // codebase that erases the rows themselves, so what stays behind must not
    // become a second, unredacted place identities are readable from.
    expect(deleteFn).not.toMatch(/participantCode/);
    expect(deleteFn).not.toMatch(/fullName/);
  });

  it("never deletes the participants themselves, only their assignment to this cohort", () => {
    expect(deleteFn).not.toMatch(/tx\.delete\(participants\)/);
    expect(deleteFn).toMatch(/tx\.delete\(participantCohortAssignments\)/);
  });

  it("cascades sessions before assignments and staff, and drops the cohort last", () => {
    const order = [
      "tx.delete(cohortSessions)",
      "tx.delete(participantCohortAssignments)",
      "tx.delete(cohorts)",
    ].map((needle) => deleteFn.indexOf(needle));
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order[0]).toBeLessThan(order[2]);
    expect(order[1]).toBeLessThan(order[2]);
  });
});

describe("session templates and programme stages: an admin surface, not just a seed", () => {
  const sessionsService = read("src/services/sessions.ts");
  const stagesService = read("src/services/program-stages.ts");

  it("codes follow the same lowercase-snake shape the database check constraint enforces", () => {
    expect(SESSION_TEMPLATE_CODE_PATTERN.test("vida")).toBe(true);
    expect(SESSION_TEMPLATE_CODE_PATTERN.test("orientacion_grupal")).toBe(true);
    expect(SESSION_TEMPLATE_CODE_PATTERN.test("Vida")).toBe(false);
    expect(SESSION_TEMPLATE_CODE_PATTERN.test("")).toBe(false);
    expect(STAGE_CODE_PATTERN.test("preparacion")).toBe(true);
    expect(STAGE_CODE_PATTERN.test("Preparación")).toBe(false);
  });

  it("audits every write on both tables", () => {
    for (const action of [
      "session_template.created",
      "session_template.updated",
      "session_template.activated",
      "session_template.deactivated",
    ]) {
      expect(sessionsService, action).toMatch(new RegExp(`"${action.replace(".", "\\.")}"`));
    }
    for (const action of [
      "program_stage.created",
      "program_stage.updated",
      "program_stage.activated",
      "program_stage.deactivated",
    ]) {
      expect(stagesService, action).toMatch(new RegExp(`"${action.replace(".", "\\.")}"`));
    }
  });

  it("retires a template or stage by flag, never by deleting the row", () => {
    // Past sessions and content already point at these by id (D-026, D-029);
    // deleting the row would orphan them, so setActive is the only removal path.
    expect(sessionsService).not.toMatch(/\.delete\(sessionTemplates\)/);
    expect(stagesService).not.toMatch(/\.delete\(programStages\)/);
  });
});

describe("permissions: who may reconfigure the programme vs. who may run a cohort", () => {
  it("gates session template and stage configuration on study.settings.manage, ADMIN only", () => {
    // Same reasoning as automation rules (D-044): a facilitator who schedules a
    // session for their own cohort should not be able to redefine what every
    // cohort's sessions are.
    for (const role of STAFF_ROLES.filter((r) => r !== "ADMIN")) {
      expect(hasPermission([role], "study.settings.manage"), role).toBe(false);
    }
    expect(hasPermission(["ADMIN"], "study.settings.manage")).toBe(true);
  });

  it("gates cohort edit, archive and delete on cohorts.manage, same as create", () => {
    const actions = read("src/app/(team)/equipo/(app)/cohortes/actions.ts");
    for (const fn of ["updateCohortAction", "archiveCohortAction", "unarchiveCohortAction", "deleteCohortAction"]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.slice(0, body.indexOf("\n}")), fn).toMatch(/assertPermission\(ctx, "cohorts\.manage"\)/);
    }
  });

  it("gates programme configuration actions on study.settings.manage", () => {
    const actions = read("src/app/(team)/equipo/(app)/configuracion/actions.ts");
    for (const fn of [
      "createProgramStageAction",
      "updateProgramStageAction",
      "toggleProgramStageAction",
      "createSessionTemplateAction",
      "updateSessionTemplateAction",
      "toggleSessionTemplateAction",
    ]) {
      const body = actions.slice(actions.indexOf(`export async function ${fn}`));
      expect(body.slice(0, body.indexOf("\n}")), fn).toMatch(/assertPermission\(ctx, "study\.settings\.manage"\)/);
    }
  });
});
