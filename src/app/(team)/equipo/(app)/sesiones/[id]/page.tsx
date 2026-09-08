import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { ATTENDANCE_STATUSES } from "@/domain/session";
import { getSessionDetail } from "@/services/sessions";
import { AttendanceRow, RefreshRegisterForm, SessionStatusForm } from "../session-forms";
import { attendanceTone, sessionTone } from "../tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sessions");
  return { title: t("detailTitle") };
}

/**
 * One session and its register.
 *
 * The tally is shown as separate counts, never as a single attendance
 * percentage: folding TECHNICAL_FAILURE into an absence figure would blame
 * participants for equipment problems (see src/domain/session.ts).
 */
export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("sessions.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { id } = await params;
  const includeContact = ctx.permissions.has("participants.contact.read");
  const detail = await getSessionDetail(ctx.study.id, id, { scope: ctx.cohortScope, includeContact });
  if (!detail) notFound();

  const canManageSession = ctx.permissions.has("sessions.manage");
  const canManageAttendance = ctx.permissions.has("attendance.manage");
  const { session, cohort, register, tally } = detail;

  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("sessions.error.invalid"),
    notFound: t("sessions.error.notFound"),
    failed: t("sessions.error.failed"),
  };
  const base = { submit: t("common.save"), submitting: t("common.loading"), errors };

  const statusOptions =
    session.status === "SCHEDULED"
      ? [
          { value: "HELD", label: t("sessions.action.HELD") },
          { value: "CANCELLED", label: t("sessions.action.CANCELLED") },
        ]
      : [];

  const counters: { key: keyof typeof tally; tone: "success" | "critical" | "warning" | "neutral" }[] = [
    { key: "present", tone: "success" },
    { key: "absent", tone: "critical" },
    { key: "technicalFailure", tone: "warning" },
    { key: "excused", tone: "neutral" },
    { key: "withdrawn", tone: "neutral" },
    { key: "expected", tone: "neutral" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={`${TEAM_BASE_PATH}/sesiones`}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("sessions.backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`${TEAM_BASE_PATH}/cohortes/${cohort.id}`}
            data-numeric
            className="rounded text-xs font-medium tracking-wide text-muted-foreground uppercase underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {cohort.code}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{session.name}</h1>
          <p data-numeric className="text-sm text-muted-foreground">
            {formatDate(session.scheduledStart, ctx.study.timezone)}
            {session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">{t(`sessions.modality.${session.modality}`)}</StatusBadge>
          <StatusBadge tone={sessionTone(session.status)}>
            {t(`sessions.status.${session.status}`)}
          </StatusBadge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("sessions.register")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Separate counters, deliberately not one percentage. */}
            <div className="flex flex-wrap gap-2">
              {counters.map(({ key, tone }) => (
                <StatusBadge key={key} tone={tone}>
                  {t(`sessions.tally.${key}`)}{" "}
                  <span data-numeric className="ml-1 font-semibold">
                    {tally[key]}
                  </span>
                </StatusBadge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("sessions.tallyNote")}</p>

            {register.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("sessions.emptyRegister")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {register.map((r) => (
                  <li
                    key={r.participantId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`${TEAM_BASE_PATH}/participantes/${r.participantId}`}
                        data-numeric
                        className="rounded font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {r.code}
                      </Link>
                      {includeContact ? (
                        <span className="ml-2 text-sm text-muted-foreground">{r.fullName ?? "—"}</span>
                      ) : null}
                    </div>
                    {canManageAttendance ? (
                      <div className="w-56">
                        <AttendanceRow
                          sessionId={session.id}
                          participantId={r.participantId}
                          current={r.status}
                          options={ATTENDANCE_STATUSES.map((s) => ({
                            value: s,
                            label: t(`sessions.attendance.${s}`),
                          }))}
                          labels={base}
                        />
                      </div>
                    ) : (
                      <StatusBadge tone={attendanceTone(r.status)}>
                        {t(`sessions.attendance.${r.status}`)}
                      </StatusBadge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sessions.manage")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManageSession ? (
                <>
                  <SessionStatusForm
                    sessionId={session.id}
                    options={statusOptions}
                    labels={{ ...base, terminal: t("sessions.terminal") }}
                  />
                  <div className="border-t border-border pt-4">
                    <RefreshRegisterForm
                      sessionId={session.id}
                      labels={{
                        ...base,
                        submit: t("sessions.refreshRegister"),
                        help: t("sessions.refreshRegisterHelp"),
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("sessions.readOnly")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone }).format(
    value,
  );
}
