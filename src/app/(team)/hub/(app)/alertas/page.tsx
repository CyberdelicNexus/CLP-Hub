import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ALERT_STATUSES, type AlertSeverity, type AlertStatus } from "@/domain/automation";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listAlerts } from "@/services/automation";
import { AcknowledgeForm, ResolveForm } from "./alert-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("alerts") };
}

/**
 * Alerts (Phase 8).
 *
 * What does not add up in the study's records: an allocation with no consent
 * behind it, a cohort running below its configured minimum, a headset past the
 * date it was due back, an exclusion with no reason attached.
 *
 * EVERY ROW IS ABOUT THE DATA, NOT ABOUT A PERSON. The detail column carries
 * codes — `P-000042`, `C-2026-A`, `VR-07` — because this is the screen most
 * likely to be left open on a shared monitor, and because an alert that needed
 * somebody's name to explain itself would be the wrong alert.
 *
 * Nothing here concludes anything. "Somebody should look" is the whole claim,
 * and the two buttons are a person saying they have looked and, separately, that
 * they have dealt with it. The system never resolves its own alerts: doing so
 * would erase the record that something was wrong for two weeks.
 */
export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("alerts.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const params = await searchParams;
  const filter = (ALERT_STATUSES as readonly string[]).includes(params.estado ?? "")
    ? (params.estado as AlertStatus)
    : undefined;

  const rows = await listAlerts(ctx.study.id, { status: filter });

  const labels = {
    submit: t("common.save"),
    submitting: t("common.loading"),
    errors: {
      forbidden: t("alerts.errors.forbidden"),
      invalid: t("alerts.errors.invalid"),
      notFound: t("alerts.errors.notFound"),
      failed: t("alerts.errors.failed"),
    },
  };

  const formatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.study.timezone,
  });

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.alerts")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("alerts.subtitle")}</p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("alerts.filter")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href={`${TEAM_BASE_PATH}/alertas`}
            className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <StatusBadge tone={filter ? "neutral" : "info"}>{t("common.all")}</StatusBadge>
          </Link>
          {ALERT_STATUSES.map((value) => (
            <Link
              key={value}
              href={`${TEAM_BASE_PATH}/alertas?estado=${value}`}
              className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <StatusBadge tone={value === filter ? "info" : "neutral"}>
                {t(`alerts.status.${value}`)}
              </StatusBadge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("nav.alerts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("alerts.boundary")}</p>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("alerts.noAlerts")}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((alert) => {
                // The subject is shown as whichever code the alert points at.
                // A study-level alert has none, and that is correct: an
                // exclusion count belongs to the study, not to one of the people.
                const subject =
                  alert.participantCode ?? alert.cohortCode ?? alert.deviceCode ?? null;

                return (
                  <li key={alert.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{t(`alerts.kind.${alert.kind}`)}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge tone={severityTone(alert.severity)}>
                            {t(`alerts.severityLabel.${alert.severity}`)}
                          </StatusBadge>
                          <StatusBadge tone={alert.status === "RESOLVED" ? "success" : "neutral"}>
                            {t(`alerts.status.${alert.status}`)}
                          </StatusBadge>
                          {subject ? <span data-numeric>{subject}</span> : null}
                          {alert.detail && alert.detail !== subject ? (
                            <span data-numeric>{alert.detail}</span>
                          ) : null}
                          <span data-numeric>
                            {t("alerts.raisedAt")}: {formatter.format(alert.raisedAt)}
                          </span>
                          {/*
                            Shown only once it has drifted from raisedAt. "Still
                            true as of" is the useful half of a problem that has
                            been open for a fortnight.
                          */}
                          {alert.lastSeenAt.getTime() - alert.raisedAt.getTime() > 60_000 ? (
                            <span data-numeric>
                              {t("alerts.lastSeen")}: {formatter.format(alert.lastSeenAt)}
                            </span>
                          ) : null}
                          {alert.acknowledgedByName ? (
                            <span>
                              {t("alerts.acknowledgedBy")}: {alert.acknowledgedByName}
                            </span>
                          ) : null}
                        </div>
                        {alert.resolutionNote ? (
                          <p className="max-w-2xl text-sm text-muted-foreground">
                            {alert.resolutionNote}
                          </p>
                        ) : null}
                      </div>

                      {alert.status === "OPEN" ? (
                        <AcknowledgeForm
                          alertId={alert.id}
                          labels={{ ...labels, submit: t("alerts.acknowledge") }}
                        />
                      ) : null}
                    </div>

                    {alert.status !== "RESOLVED" ? (
                      <ResolveForm
                        alertId={alert.id}
                        labels={{
                          ...labels,
                          submit: t("alerts.resolve"),
                          note: t("alerts.resolutionNote"),
                        }}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function severityTone(severity: AlertSeverity): StatusTone {
  switch (severity) {
    case "CRITICAL":
      return "critical";
    case "WARNING":
      return "warning";
    default:
      return "info";
  }
}
