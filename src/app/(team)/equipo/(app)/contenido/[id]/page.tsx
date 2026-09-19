import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentBlocks } from "@/components/content/blocks";
import { isEditable, isSessionContentType, parseBody, publicPathFor, type ContentStatus } from "@/domain/content";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { getContentDetail } from "@/services/content";
import { listSessionTemplates } from "@/services/sessions";
import { NewDraftForm, PublishForm, RelinkSessionForm, VersionEditor, VersionStatusForm } from "../content-forms";
import { CoverImage } from "@/components/content/cover-image";
import { contentTone } from "../tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("content");
  return { title: t("detailTitle") };
}

/**
 * One piece of content and its version history.
 *
 * The working version (DRAFT or REVIEW) is editable; the published one is not,
 * because publishing never mutates a published row. To change what is live you
 * start a new draft from it.
 */
export default async function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("content.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { id } = await params;
  const detail = await getContentDetail(ctx.study.id, id, "es");
  if (!detail) notFound();

  const canManage = ctx.permissions.has("content.manage");
  const canPublish = ctx.permissions.has("content.publish");
  const { content, versions } = detail;

  const isSessionContent = isSessionContentType(content.type);
  const sessions = isSessionContent && canManage ? await listSessionTemplates(ctx.study.id) : [];

  const working = versions.find((v) => isEditable(v.status as ContentStatus));
  const published = versions.find((v) => v.status === "PUBLISHED");
  const publicPath = publicPathFor({
    type: content.type,
    key: content.key,
    sessionCode: content.sessionCode,
  });

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
  const base = { submit: t("common.save"), submitting: t("common.loading"), errors };

  const workingBody = working ? parseBody(working.body).blocks : [];
  const publishedBody = published ? parseBody(published.body).blocks : [];

  return (
    <div className="space-y-6">
      <Link
        href={`${TEAM_BASE_PATH}/contenido`}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("content.backToList")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{content.key}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {published?.title ?? working?.title ?? content.key}
          </h1>
          {publicPath ? (
            published ? (
              <a
                href={publicPath}
                className="inline-flex items-center gap-1 rounded font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {publicPath}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : (
              <p className="font-mono text-xs text-muted-foreground">
                {publicPath} · {t("content.notLive")}
              </p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">{t("content.notPublic")}</p>
          )}
        </div>
        <StatusBadge tone="info">{t(`content.type.${content.type}`)}</StatusBadge>
      </header>

      {isSessionContent ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("content.field.session")}</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <RelinkSessionForm
                contentId={content.id}
                sessionTemplateId={content.sessionTemplateId}
                sessions={sessions.map((s) => ({ id: s.id, label: s.nameEs }))}
                labels={{
                  ...base,
                  submit: t("content.relinkSubmit"),
                  field: t("content.field.session"),
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{content.sessionCode ?? "—"}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Working version -------------------------------------------------- */}
      {working ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {t("content.working")}
              <StatusBadge tone={contentTone(working.status as ContentStatus)}>
                {t(`content.status.${working.status}`)} · v{working.versionNumber}
              </StatusBadge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage ? (
              <VersionEditor
                contentId={content.id}
                versionId={working.id}
                initialTitle={working.title}
                initialBody={workingBody}
                initialCoverImageUrl={working.coverImageUrl}
                initialCoverImagePosition={working.coverImagePosition}
                labels={{
                  ...base,
                  submit: t("content.saveDraft"),
                  title: t("content.field.title"),
                }}
                coverLabels={{
                  add: t("content.field.coverImageAdd"),
                  url: t("content.field.coverImage"),
                  position: t("content.field.coverImagePosition"),
                  remove: t("content.field.coverImageRemove"),
                }}
                editorLabels={{
                  empty: t("content.blockEditor.empty"),
                  remove: t("content.blockEditor.remove"),
                  drag: t("content.blockEditor.drag"),
                  insert: t("content.blockEditor.insert"),
                  done: t("content.blockEditor.done"),
                  addMedia: t("content.blockEditor.addMedia"),
                  blockType: {
                    TEXT: t("content.blockType.TEXT"),
                    VIDEO: t("content.blockType.VIDEO"),
                    IMAGE: t("content.blockType.IMAGE"),
                    BOOKMARK: t("content.blockType.BOOKMARK"),
                    CHECKLIST: t("content.blockType.CHECKLIST"),
                    CALLOUT: t("content.blockType.CALLOUT"),
                    CONTEMPLATION: t("content.blockType.CONTEMPLATION"),
                    BUTTON: t("content.blockType.BUTTON"),
                    TECHNICAL_STEP: t("content.blockType.TECHNICAL_STEP"),
                    SUPPORT_BOX: t("content.blockType.SUPPORT_BOX"),
                  },
                  calloutTone: {
                    INFO: t("content.calloutTone.INFO"),
                    WARNING: t("content.calloutTone.WARNING"),
                    SUPPORT: t("content.calloutTone.SUPPORT"),
                  },
                  field: {
                    md: t("content.blockField.md"),
                    url: t("content.blockField.url"),
                    caption: t("content.blockField.caption"),
                    alt: t("content.blockField.alt"),
                    title: t("content.blockField.title"),
                    description: t("content.blockField.description"),
                    items: t("content.blockField.items"),
                    addItem: t("content.blockField.addItem"),
                    removeItem: t("content.blockField.removeItem"),
                    step: t("content.blockField.step"),
                    label: t("content.blockField.label"),
                    contactLabel: t("content.blockField.contactLabel"),
                    contactUrl: t("content.blockField.contactUrl"),
                  },
                }}
              />
            ) : (
              <>
                <CoverImage url={working.coverImageUrl} position={working.coverImagePosition} bleed={false} />
                <ContentBlocks body={workingBody} />
              </>
            )}

            <div className="flex flex-wrap items-end gap-6 border-t border-border pt-5">
              {canManage ? (
                <VersionStatusForm
                  contentId={content.id}
                  versionId={working.id}
                  options={
                    working.status === "DRAFT"
                      ? [{ value: "REVIEW", label: t("content.action.REVIEW") }]
                      : [{ value: "DRAFT", label: t("content.action.DRAFT") }]
                  }
                  labels={base}
                />
              ) : null}
              {canPublish ? (
                <PublishForm
                  contentId={content.id}
                  versionId={working.id}
                  labels={{
                    ...base,
                    submit: t("content.publish"),
                    note: published
                      ? t("content.publishReplaces", { version: published.versionNumber })
                      : t("content.publishFirst"),
                  }}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Live version ------------------------------------------------------ */}
      {published ? (
        // Collapsed by default (2026-09-19 request) — staff editing a draft
        // don't need the published page open beside it every time; it's a
        // reference they open on demand, not something that belongs on screen
        // by default. A plain <details>, same JS-free pattern as the filter
        // dropdowns elsewhere in this app — not <Card>, whose own vertical
        // padding would double up with the <summary>/<CardContent> here.
        <details className="group/live overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-4">
            <span className="flex flex-wrap items-center gap-2 font-heading text-base leading-snug font-medium">
              {t("content.live")}
              <StatusBadge tone="success">v{published.versionNumber}</StatusBadge>
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/live:rotate-180"
              aria-hidden
            />
          </summary>
          <CardContent className="space-y-5 pb-4">
            <div className="rounded-2xl bg-background p-6 ring-1 ring-foreground/10">
              {published.coverImageUrl ? (
                <div className="mb-4">
                  <CoverImage url={published.coverImageUrl} position={published.coverImagePosition} />
                </div>
              ) : null}
              <h2 className="mb-4 text-xl font-semibold">{published.title}</h2>
              <ContentBlocks body={publishedBody} />
            </div>
            {canManage && !working ? (
              <NewDraftForm
                contentId={content.id}
                versionId={published.id}
                labels={{
                  ...base,
                  submit: t("content.newDraft"),
                  note: t("content.newDraftNote"),
                }}
              />
            ) : null}
          </CardContent>
        </details>
      ) : null}

      {/* History ----------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("content.history")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <span data-numeric className="font-medium">
                  v{v.versionNumber}
                </span>
                <StatusBadge tone={contentTone(v.status as ContentStatus)}>
                  {t(`content.status.${v.status}`)}
                </StatusBadge>
                <span className="min-w-0 truncate text-sm">{v.title}</span>
                <span data-numeric className="ml-auto text-xs text-muted-foreground">
                  {v.publishedAt
                    ? t("content.publishedOn", { date: formatDate(v.publishedAt, ctx.study.timezone) })
                    : formatDate(v.createdAt, ctx.study.timezone)}
                  {v.createdByName ? ` · ${v.createdByName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    value,
  );
}
