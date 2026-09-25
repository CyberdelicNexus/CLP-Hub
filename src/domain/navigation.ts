import type { Permission } from "./permissions";

/**
 * Team dashboard sections. Labels come from messages/*.json under
 * `nav.<key>`; the `path` segment is stable and Spanish.
 * Visibility is derived from permissions, never from role names.
 */
export interface NavSection {
  key: string;
  path: string;
  /** Any of these permissions makes the section visible. */
  permissions: readonly Permission[];
}

export const TEAM_NAV: readonly NavSection[] = [
  { key: "overview", path: "", permissions: [] },
  // Questions come before applications: a person asks before they apply (D-088).
  { key: "inquiries", path: "consultas", permissions: ["inquiries.manage"] },
  { key: "applications", path: "solicitudes", permissions: ["applications.read"] },
  { key: "participants", path: "participantes", permissions: ["participants.read"] },
  { key: "screening", path: "evaluacion", permissions: ["screening.read"] },
  // Sessions and communications stay folded into the cohort workspace
  // (D-068, 2026-09-18) — every role that could see either also has
  // cohorts.read, so nothing is stranded there. Content came back as its own
  // entry (2026-09-19 request: "bring back the content tab") once authoring
  // it grew into a real editor rather than a raw-JSON form — worth its own
  // destination again, not just a link buried in a session's accordion.
  { key: "cohorts", path: "cohortes", permissions: ["cohorts.read"] },
  { key: "content", path: "contenido", permissions: ["content.read"] },
  { key: "calendar", path: "calendario", permissions: ["cohorts.read"] },
  { key: "logistics", path: "logistica-vr", permissions: ["logistics.read"] },
  { key: "tasks", path: "tareas", permissions: ["tasks.read"] },
  { key: "alerts", path: "alertas", permissions: ["alerts.read"] },
  { key: "team", path: "equipo", permissions: ["team.read"] },
  { key: "settings", path: "configuracion", permissions: ["study.settings.manage"] },
];

export const TEAM_BASE_PATH = "/equipo";

export function sectionByPath(path: string): NavSection | undefined {
  return TEAM_NAV.find((s) => s.path === path);
}
