import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, ExternalLink } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTHORABLE_CONTENT_TYPES, isSessionContentType, publicPathFor } from "@/domain/content";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { listContents } from "@/services/content";
import { listSessionTemplates } from "@/services/sessions";
import { CreateContentForm } from "./content-forms";
import { contentTone } from "./tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("content") };
}

/**
 * Study content index. Shows what is live, what is being worked on, and where
 * each page can be read publicly.
 */
export default async function ContentPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("content.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("content.manage");
  // Spanish is authoritative for study content (D-009).
  const [rows, sessions] = await Promise.all([
    listContents(ctx.study.id, "es"),
    canManage ? listSessionTemplates(ctx.study.id) : [],
  ]);

  const errors = {
    forbidden: t("common.noAccess"),
    invalid: t("content.error.invalid"),
    invalidBody: t("content.error.invalidBody"),
    notEditable: t("content.error.notEditable"),
    duplicateKey: t("content.error.duplicateKey"),
    noSession: t("content.error.noSession"),
    notFound: t("content.error.notFound"),
    failed: t("content.error.failed"),
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.content")}</h1>
        <p className="text-sm text-muted-foreground">{t("content.subtitle")}</p>
      </header>

      <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
        {t("content.boundary")}
      </p>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("content.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("content.emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left">
                <tr className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3">{t("content.table.title")}</th>
                  <th scope="col" className="px-4 py-3">{t("content.table.type")}</th>
                  <th scope="col" className="px-4 py-3">{t("content.table.live")}</th>
                  <th scope="col" className="px-4 py-3">{t("content.table.working")}</th>
                  <th scope="col" className="px-4 py-3">{t("content.table.page")}</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t("content.table.open")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href = `${TEAM_BASE_PATH}/contenido/${row.id}`;
                  const publicPath = publicPathFor({
                    type: row.type,
                    key: row.key,
                    sessionCode: row.sessionCode,
                  });
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          href={href}
                          className="rounded font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {row.publishedTitle ?? row.key}
                        </Link>
                        {isSessionContentType(row.type) && row.sessionName ? (
                          <span className="block text-xs text-muted-foreground">{row.sessionName}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t(`content.type.${row.type}`)}
                      </td>
                      <td className="px-4 py-3">
                        {row.publishedVersion ? (
                          <StatusBadge tone="success">
                            {t("content.status.PUBLISHED")} · v{row.publishedVersion}
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.workingStatus ? (
                          <StatusBadge tone={contentTone(row.workingStatus)}>
                            {t(`content.status.${row.workingStatus}`)} · v{row.workingVersion}
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {publicPath && row.publishedVersion ? (
                          <a
                            href={publicPath}
                            className="inline-flex items-center gap-1 rounded font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {publicPath}
                            <ExternalLink className="size-3" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {publicPath ? t("content.notLive") : t("content.notPublic")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={href}
                          aria-label={`${t("content.table.open")} ${row.key}`}
                          className="inline-flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("content.createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateContentForm
              types={AUTHORABLE_CONTENT_TYPES.map((type) => ({
                value: type,
                label: t(`content.type.${type}`),
                needsSession: isSessionContentType(type),
              }))}
              sessions={sessions.map((s) => ({ id: s.id, label: s.nameEs }))}
              labels={{
                submit: t("content.create"),
                submitting: t("common.loading"),
                type: t("content.field.type"),
                key: t("content.field.key"),
                keyHelp: t("content.field.keyHelp"),
                title: t("content.field.title"),
                session: t("content.field.session"),
                errors,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
