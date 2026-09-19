import { redirect } from "next/navigation";
import { TEAM_BASE_PATH } from "@/domain/navigation";

/**
 * Cohort detail lives on the workspace page now (`?cohorte=<id>`, D-068) —
 * this route stays only so old links (bookmarks, anything still pointing at
 * `/cohortes/[id]`) keep working.
 */
export default async function CohortDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`${TEAM_BASE_PATH}/cohortes?cohorte=${id}`);
}
