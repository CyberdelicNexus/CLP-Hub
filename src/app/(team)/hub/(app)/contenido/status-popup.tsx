"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { NewDraftForm, PublishForm, VersionStatusForm } from "./content-forms";
import { contentTone } from "./tone";

/**
 * The list's status cell as a button that opens the same status-change
 * actions the detail page offers, in a popup — "make them buttons and a
 * pop-up appears with the options to change" (2026-09-19 request), scoped to
 * this list for now (see D-071: extending the pattern to every other list in
 * the app is separate, larger work, not done in this pass).
 */
export function StatusPopup({
  contentId,
  row,
  labels,
  canPublish,
}: {
  contentId: string;
  row: {
    workingStatus: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED" | null;
    workingVersion: number | null;
    workingVersionId: string | null;
    publishedVersion: number | null;
    publishedVersionId: string | null;
  };
  labels: {
    title: string;
    live: string;
    none: string;
    submit: string;
    submitting: string;
    errors: Record<string, string>;
    statusLabel: Record<string, string>;
    action: { DRAFT: string; REVIEW: string };
    publish: string;
    /** Pre-formatted with the current published version number, if any —
     * computed server-side since that number varies per row. */
    publishNote: string;
    newDraft: string;
    newDraftNote: string;
  };
  canPublish: boolean;
}) {
  const base = { submit: labels.submit, submitting: labels.submitting, errors: labels.errors };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex flex-wrap items-center gap-1.5 rounded-lg p-1 -m-1 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        {row.publishedVersion ? (
          <StatusBadge tone="success">
            {labels.live} · v{row.publishedVersion}
          </StatusBadge>
        ) : null}
        {row.workingStatus ? (
          <StatusBadge tone={contentTone(row.workingStatus)}>
            {labels.statusLabel[row.workingStatus]} · v{row.workingVersion}
          </StatusBadge>
        ) : null}
        {!row.publishedVersion && !row.workingStatus ? (
          <span className="text-xs text-muted-foreground">{labels.none}</span>
        ) : null}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {row.workingVersionId && row.workingStatus ? (
            <VersionStatusForm
              contentId={contentId}
              versionId={row.workingVersionId}
              options={
                row.workingStatus === "DRAFT"
                  ? [{ value: "REVIEW", label: labels.action.REVIEW }]
                  : [{ value: "DRAFT", label: labels.action.DRAFT }]
              }
              labels={base}
            />
          ) : null}
          {canPublish && row.workingVersionId ? (
            <PublishForm
              contentId={contentId}
              versionId={row.workingVersionId}
              labels={{ ...base, submit: labels.publish, note: labels.publishNote }}
            />
          ) : null}
          {row.publishedVersionId && !row.workingVersionId ? (
            <NewDraftForm
              contentId={contentId}
              versionId={row.publishedVersionId}
              labels={{ ...base, submit: labels.newDraft, note: labels.newDraftNote }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
