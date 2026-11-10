import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { RESPONSIBILITY_ROLES, type ResponsibilityRole } from "@/domain/responsibility";
import type { InitialVisit } from "@/db/schema";
import type { ResponsibleRow } from "@/services/participant-care";
import {
  AssignResponsibleForm,
  CloseVisitForm,
  RevokeResponsibleForm,
  VisitNotesForm,
} from "../care-forms";

/**
 * The initial visit and who is running it (Phase 4d).
 *
 * One panel rather than two, because the meeting's question was a single
 * operational one: "who is taking this person through their first visit, and
 * when". Splitting the responsible from the appointment would put the two halves
 * of that answer on different parts of the screen.
 */
export async function CarePanel(props: CareProps) {
  const t = await getTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("care.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <CareDetails {...props} />
      </CardContent>
    </Card>
  );
}

interface CareProps {
  participantId: string;
  responsibles: ResponsibleRow[];
  visits: InitialVisit[];
  candidates: { id: string; displayName: string }[];
  canManage: boolean;
  timezone: string;
  formBase: { submit: string; submitting: string; errors: Record<string, string> };
  /** The visit's forms start unfolded; the modal exists for them. */
  visitFormsOpen?: boolean;
}

/**
 * The panel's content, also shown in the modal on a cohort's visit card
 * (D-140). The date is not here: it is booked on that card.
 */
export async function CareDetails({
  participantId,
  responsibles,
  visits,
  candidates,
  canManage,
  timezone,
  formBase,
  visitFormsOpen = false,
}: CareProps) {
  const t = await getTranslations();
  const open = visits.find((v) => v.status === "SCHEDULED") ?? null;
  const byRole = new Map(responsibles.map((r) => [r.role, r]));

  const notesHelp = t("care.notesHelp");
  const options = candidates.map((c) => ({ id: c.id, label: c.displayName }));
  const editable = canManage && options.length > 0;

  return (
    <div className="space-y-4">
      {/* Responsibles ---------------------------------------------------- */}
      <section className="space-y-1">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("care.responsibles")}
        </h3>

        <ul className="divide-y divide-border">
          {RESPONSIBILITY_ROLES.map((role: ResponsibilityRole) => {
            const held = byRole.get(role);
            return (
              <li key={role} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
                <span className="w-28 shrink-0 text-sm font-medium">{t(`care.role.${role}`)}</span>

                {editable ? (
                  <AssignResponsibleForm
                    participantId={participantId}
                    role={role}
                    candidates={options}
                    current={held ? { userId: held.userId, displayName: held.displayName } : null}
                    labels={{
                      ...formBase,
                      submit: t("care.assign"),
                      replace: t("care.replace"),
                      person: t("care.person"),
                    }}
                  />
                ) : held ? (
                  <StatusBadge tone="info">{held.displayName}</StatusBadge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {canManage ? t("care.noCandidates") : t("care.unassigned")}
                  </span>
                )}

                {canManage && held ? (
                  <RevokeResponsibleForm
                    participantId={participantId}
                    role={role}
                    labels={{ ...formBase, submit: t("care.revoke") }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        {/*
          Said plainly because cohort_staff DOES widen visibility (D-022), and
          someone reading this screen could reasonably assume this does too.
        */}
        <p className="text-xs text-muted-foreground">{t("care.noVisibilityNote")}</p>
      </section>

      {/* Initial visit --------------------------------------------------- */}
      <section className="space-y-2 border-t border-border pt-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("care.visit")}
        </h3>

        {visits.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("care.noVisits")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {visits.map((v) => (
              <li key={v.id} className="space-y-1 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge tone={visitTone(v.status)}>
                    {t(`care.visitStatus.${v.status}`)}
                  </StatusBadge>
                  <span data-numeric className="text-sm text-muted-foreground">
                    {v.scheduledAt
                      ? formatDate(v.scheduledAt, timezone)
                      : formatDate(v.createdAt, timezone)}
                  </span>
                  {v.location ? <span className="text-sm">{v.location}</span> : null}
                </div>
                {v.notes ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">{v.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage && open ? (
          <details open={visitFormsOpen}>
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              {t("care.recordVisit")}
            </summary>
            <div className="mt-3 space-y-4 rounded-xl bg-muted/50 p-4">
              <CloseVisitForm
                participantId={participantId}
                visitId={open.id}
                options={["COMPLETED", "NO_SHOW", "CANCELLED"].map((s) => ({
                  value: s,
                  label: t(`care.visitAction.${s}`),
                }))}
                labels={{
                  ...formBase,
                  submit: t("care.recordVisit"),
                  outcome: t("care.outcome"),
                  notes: t("care.notes"),
                  notesHelp,
                }}
              />
              <VisitNotesForm
                participantId={participantId}
                visitId={open.id}
                currentNotes={open.notes}
                currentLocation={open.location}
                labels={{
                  ...formBase,
                  submit: t("care.saveNotes"),
                  location: t("care.location"),
                  notes: t("care.notes"),
                  notesHelp,
                }}
              />
            </div>
          </details>
        ) : !open ? (
          <p className="text-xs text-muted-foreground">{t("care.bookOnCard")}</p>
        ) : null}
      </section>
    </div>
  );
}

function visitTone(status: string): "neutral" | "success" | "warning" | "critical" | "info" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "SCHEDULED":
      return "info";
    case "NO_SHOW":
      // A warning, not an error: someone not turning up is an operational fact
      // about a day, not a failure attributable to the person.
      return "warning";
    default:
      return "neutral";
  }
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
