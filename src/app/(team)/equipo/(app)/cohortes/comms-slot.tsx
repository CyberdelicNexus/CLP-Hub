"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { relinkTemplateSessionAction, type CommsState } from "../comunicaciones/actions";

const initial: CommsState = { error: null };

export interface AssignableTemplateOption {
  id: string;
  label: string;
  currentSessionName: string | null;
}

/**
 * A session's assigned message templates, mirroring `ContentSlot`'s pattern
 * (2026-09-19 request: "do the same [as content] — see what's assigned,
 * assign one, copy it to paste into mail or WhatsApp"). Copying puts the
 * template's raw wording — placeholders intact — on the clipboard; nothing
 * here sends anything or renders a message with real values, same boundary
 * `communications.ts` already holds everywhere else (D-004/D-039).
 */
export function CommsSlot({
  assigned,
  emptyLabel,
  editLabel,
  copyLabel,
  copiedLabel,
  canManage,
  sessionTemplateId,
  assignable,
  pickLabel,
  pickNoneLabel,
  pickPlaceholder,
  assignLabel,
}: {
  assigned: { id: string; nameEs: string; bodyEs: string }[];
  emptyLabel: string;
  editLabel: string;
  copyLabel: string;
  copiedLabel: string;
  canManage: boolean;
  sessionTemplateId: string;
  assignable: AssignableTemplateOption[];
  pickLabel: string;
  pickNoneLabel: string;
  pickPlaceholder: string;
  assignLabel: string;
}) {
  return (
    <div className="space-y-2.5">
      {assigned.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {assigned.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.nameEs}</span>
              <CopyBodyButton body={c.bodyEs} label={copyLabel} copiedLabel={copiedLabel} />
              {canManage ? (
                <Link
                  href={`${TEAM_BASE_PATH}/comunicaciones`}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3" aria-hidden />
                  {editLabel}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canManage ? (
        <PickExisting
          sessionTemplateId={sessionTemplateId}
          options={assignable}
          pickLabel={pickLabel}
          noneLabel={pickNoneLabel}
          placeholder={pickPlaceholder}
          assignLabel={assignLabel}
        />
      ) : null}
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
  options: AssignableTemplateOption[];
  pickLabel: string;
  noneLabel: string;
  placeholder: string;
  assignLabel: string;
}) {
  const [state, action, pending] = useActionState(relinkTemplateSessionAction, initial);
  if (options.length === 0) return null;

  return (
    <details className="group/pick">
      <summary className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
        {pickLabel}
      </summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="sessionTemplateId" value={sessionTemplateId} />
        <select
          name="templateId"
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

function CopyBodyButton({ body, label, copiedLabel }: { body: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="shrink-0 rounded-md"
      onClick={() => {
        navigator.clipboard
          .writeText(body)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => {
            /* Clipboard permission denied. */
          });
      }}
    >
      {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
      {copied ? copiedLabel : label}
    </Button>
  );
}
