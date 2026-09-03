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
  { key: "applications", path: "solicitudes", permissions: ["applications.read"] },
  { key: "participants", path: "participantes", permissions: ["participants.read"] },
  { key: "screening", path: "evaluacion", permissions: ["screening.read"] },
  { key: "cohorts", path: "cohortes", permissions: ["cohorts.read"] },
  { key: "sessions", path: "sesiones", permissions: ["sessions.read"] },
  { key: "communications", path: "comunicaciones", permissions: ["communications.read"] },
  { key: "logistics", path: "logistica-vr", permissions: ["logistics.read"] },
  { key: "content", path: "contenido", permissions: ["content.read"] },
  { key: "tasks", path: "tareas", permissions: ["tasks.read"] },
  { key: "alerts", path: "alertas", permissions: ["alerts.read"] },
  { key: "team", path: "equipo", permissions: ["team.read"] },
  { key: "settings", path: "configuracion", permissions: ["study.settings.manage"] },
];

export const TEAM_BASE_PATH = "/equipo";

export function sectionByPath(path: string): NavSection | undefined {
  return TEAM_NAV.find((s) => s.path === path);
}
