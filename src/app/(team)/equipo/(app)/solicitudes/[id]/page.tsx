import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import type { QuestionOption } from "@/db/schema";
import {
  ApplicationStatusBadge,
  RecruitmentStatusBadge,
} from "@/components/team/application-status-badge";
import { NoAccess } from "@/components/team/no-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import {
  APPLICATION_STATUS_TRANSITIONS,
  type ApplicationStatus,
  type RecruitmentStatus,
} from "@/domain/recruitment";
import { getApplicationDetail } from "@/services/recruitment";
import { StatusForm, type StatusOption } from "../status-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications");
  return { title: t("detailTitle") };
}

/**
 * One application. Contact details are fetched only with
 * `participants.contact.read`; answers are shown to anyone with
 * `applications.read` because they are the substance of the submission, and are
 * operational by configuration (D-014).
 */
export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("applications.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { id } = await params;
  const includeContact = ctx.permissions.has("participants.contact.read");
  const detail = await getApplicationDetail(ctx.study.id, id, { includeContact });
  if (!detail) notFound();

  const locale = await getLocale();
  const canManage = ctx.permissions.has("applications.manage");
  const status = detail.application.status as ApplicationStatus;

  const options: StatusOption[] = canManage
    ? APPLICATION_STATUS_TRANSITIONS[status].map((next) => ({
        value: next,
        label: t(`applications.action.${next}`),
      }))
    : [];

  return (
    <div className="space-y-6">
      <Link
        href={`${TEAM_BASE_PATH}/solicitudes`}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("applications.backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p data-numeric className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {detail.participant.code}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("applications.detailTitle")}</h1>
          <p data-numeric className="text-sm text-muted-foreground">
            {t("applications.submittedOn", {
              date: formatDate(detail.application.submittedAt, ctx.study.timezone),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ApplicationStatusBadge status={status} label={t(`applications.status.${status}`)} />
          <RecruitmentStatusBadge
            status={detail.participant.recruitmentStatus as RecruitmentStatus}
            label={t(`applications.recruitment.${detail.participant.recruitmentStatus}`)}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("applications.answers")}</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.answers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("applications.noAnswers")}</p>
            ) : (
              <dl className="divide-y divide-border">
                {detail.answers.map((answer) => (
                  <div key={answer.questionId} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm text-muted-foreground">
                      {(locale === "en" && answer.labelEn) || answer.labelEs}
                    </dt>
                    <dd className="text-sm sm:col-span-2">
                      {formatAnswer(answer.value, answer.options, locale, {
                        yes: t("common.yes"),
                        no: t("common.no"),
                      })}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("applications.contact")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!includeContact ? (
                <p className="text-sm text-muted-foreground">{t("applications.contactHidden")}</p>
              ) : (
                <dl className="space-y-3 text-sm">
                  <Field label={t("applications.field.name")} value={detail.contact?.fullName} />
                  <Field label={t("applications.field.email")} value={detail.contact?.email} />
                  <Field label={t("applications.field.phone")} value={detail.contact?.phone} />
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("applications.triage")}</CardTitle>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <StatusForm
                  applicationId={detail.application.id}
                  options={options}
                  labels={{
                    legend: t("applications.triage"),
                    submit: t("common.save"),
                    submitting: t("common.loading"),
                    terminal: t("applications.terminal"),
                    errors: {
                      forbidden: t("common.noAccess"),
                      invalid: t("applications.error.invalid"),
                      failed: t("applications.error.failed"),
                    },
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("applications.readOnly")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value ?? "—"}</dd>
    </div>
  );
}

/**
 * Choice answers store the configured option *value*; staff should read its
 * label. Unknown values are shown as-is rather than hidden, so an answer to a
 * question whose options later changed is still visible.
 */
function formatAnswer(
  value: string | string[] | boolean,
  options: QuestionOption[] | null,
  locale: string,
  labels: { yes: string; no: string },
): string {
  if (typeof value === "boolean") return value ? labels.yes : labels.no;

  const label = (v: string) => {
    const option = options?.find((o) => o.value === v);
    if (!option) return v;
    return locale === "en" && option.label_en ? option.label_en : option.label_es;
  };

  return Array.isArray(value) ? value.map(label).join(", ") : label(value);
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
