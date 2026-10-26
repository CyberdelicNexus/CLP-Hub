import { redirect } from "next/navigation";
import { TEAM_BASE_PATH } from "@/domain/navigation";

/**
 * Sessions now live inside each cohort's own workspace page (D-068) — the
 * cross-cohort table this page used to show is gone; a session only ever
 * matters in the context of the one cohort going through it. This route
 * stays only so old links keep working. `/equipo/sesiones/[id]` (the
 * attendance register) is unaffected and still lives at its own path.
 */
export default async function SessionsRedirect() {
  redirect(`${TEAM_BASE_PATH}/cohortes`);
}
