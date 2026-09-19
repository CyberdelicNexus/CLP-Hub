"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, ExternalLink, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { relinkSessionAction, type ContentActionState } from "../contenido/actions";

const initial: ContentActionState = { error: null };

export interface AssignableContentOption {
  id: string;
  /** Title if it has a version yet, else its key. */
  label: string;
  /** Where it's attached today, for the picker to show "(currently: S2)". */
  currentSessionName: string | null;
}

/** Distinct colour per slot kind — "a different gradient colour or outline
 * in the preparación and integración divs" (2026-09-19). */
const TONE_RING: Record<"mint" | "sky", string> = {
  mint: "ring-1 ring-inset ring-[color-mix(in_oklch,var(--surface-mint-ink)_35%,transparent)]",
  sky: "ring-1 ring-inset ring-[color-mix(in_oklch,var(--surface-sky-ink)_35%,transparent)]",
};

/**
 * One session's content slot (preparation or integration): once content is
 * assigned it's shown as a compact bookmark card — icon, title, three
 * actions (open, copy link, edit) — never the full rendered page inline
 * (2026-09-19: "don't preview the page in the box, just add a bookmark").
 * Unassigned, it offers the same "pick an existing piece of content" toggle
 * from D-070, or a link to create a new one.
 */
export function ContentSlot({
  label,
  tone,
  content,
  emptyLabel,
  createHref,
  createLabel,
  editLabel,
  publicPath,
  viewLabel,
  copyLabel,
  copiedLabel,
  canManageContent,
  sessionTemplateId,
  assignable,
  pickLabel,
  pickNoneLabel,
  pickPlaceholder,
  assignLabel,
}: {
  label: string;
  tone: "mint" | "sky";
  content: { contentId: string; title: string } | null;
  emptyLabel: string;
  createHref: string | null;
  createLabel: string;
  editLabel: string;
  publicPath: string | null;
  viewLabel: string;
  copyLabel: string;
  copiedLabel: string;
  canManageContent: boolean;
  sessionTemplateId: string;
  assignable: AssignableContentOption[];
  pickLabel: string;
  pickNoneLabel: string;
  pickPlaceholder: string;
  assignLabel: string;
}) {
  return (
    <div className={`rounded-xl border border-transparent bg-card p-3 ${TONE_RING[tone]}`}>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>

      {content ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <Bookmark className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate text-sm font-medium">{content.title}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {publicPath ? (
              <a
                href={publicPath}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "xs", className: "rounded-md gap-1" })}
              >
                <ExternalLink className="size-3" aria-hidden />
                {viewLabel}
              </a>
            ) : null}
            {publicPath ? <CopyLinkButton path={publicPath} label={copyLabel} copiedLabel={copiedLabel} /> : null}
            {canManageContent ? (
              <Link
                href={`${TEAM_BASE_PATH}/contenido/${content.contentId}`}
                className={buttonVariants({ variant: "outline", size: "xs", className: "rounded-md gap-1" })}
              >
                <Pencil className="size-3" aria-hidden />
                {editLabel}
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          {canManageContent ? (
            <PickExisting
              sessionTemplateId={sessionTemplateId}
              options={assignable}
              pickLabel={pickLabel}
              noneLabel={pickNoneLabel}
              placeholder={pickPlaceholder}
              assignLabel={assignLabel}
            />
          ) : null}
          {createHref ? (
            <Link
              href={createHref}
              className="inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {createLabel}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PickExisting({
  sessionTemplateId,
  options,
  pickLabel,
  noneLabel,
  placeholder,
  assignLabel,
}: {
  sessionTemplateId: string;
  options: AssignableContentOption[];
  pickLabel: string;
  noneLabel: string;
  placeholder: string;
  assignLabel: string;
}) {
  const [state, action, pending] = useActionState(relinkSessionAction, initial);
  if (options.length === 0) return null;

  return (
    <details className="group/pick">
      <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
        {pickLabel}
      </summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="sessionTemplateId" value={sessionTemplateId} />
        <select
          name="contentId"
          required
          defaultValue=""
          className="h-8 min-w-40 flex-1 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.currentSessionName ? ` — ${o.currentSessionName}` : ""}
            </option>
          ))}
        </select>
        <Button type="submit" size="xs" variant="outline" className="rounded-md" disabled={pending}>
          {assignLabel}
        </Button>
        {state.error ? <p className="w-full text-xs text-destructive">{noneLabel}</p> : null}
      </form>
    </details>
  );
}

function CopyLinkButton({ path, label, copiedLabel }: { path: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="rounded-md"
      onClick={() => {
        const url = `${window.location.origin}${path}`;
        navigator.clipboard
          .writeText(url)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => {
            /* Clipboard permission denied — the link is still visible via "view". */
          });
      }}
    >
      {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
