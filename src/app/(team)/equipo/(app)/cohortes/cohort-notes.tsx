"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTE_COLORS, type NoteColor } from "@/domain/cohort-note";
import { createCohortNoteAction, deleteCohortNoteAction, type CohortState } from "./actions";

const initial: CohortState = { error: null };

const SWATCH_CLASS: Record<NoteColor, string> = {
  LILAC: "bg-surface-lilac",
  PEACH: "bg-surface-peach",
  MINT: "bg-surface-mint",
  SKY: "bg-surface-sky",
};

const CARD_CLASS: Record<NoteColor, string> = {
  LILAC: "bg-surface-lilac text-surface-lilac-ink",
  PEACH: "bg-surface-peach text-surface-peach-ink",
  MINT: "bg-surface-mint text-surface-mint-ink",
  SKY: "bg-surface-sky text-surface-sky-ink",
};

/**
 * A quick coloured reminder for the team, separate from the audited task
 * checklist above it — "a place to leave sticky notes with different
 * colours" (2026-09-19 request). Create and delete only; a note is never
 * edited in place, same spirit as the rest of this app preferring a new
 * record over mutating history, just without the version machinery a real
 * content edit gets, since this isn't research or permission data.
 */
export function CreateNoteForm({
  cohortId,
  labels,
}: {
  cohortId: string;
  labels: { placeholder: string; submit: string; submitting: string; color: string; error: string };
}) {
  const [state, action, pending] = useActionState(createCohortNoteAction, initial);
  const [color, setColor] = useState<NoteColor>("LILAC");

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="space-y-2">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="color" value={color} />
      <textarea
        name="body"
        required
        maxLength={280}
        rows={2}
        placeholder={labels.placeholder}
        className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label={labels.color}>
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "size-5 rounded-full ring-1 ring-inset ring-foreground/10 transition-transform",
                SWATCH_CLASS[c],
                color === c && "ring-2 ring-ring ring-offset-1 ring-offset-background",
              )}
            />
          ))}
        </div>
        <Button type="submit" size="xs" variant="outline" className="rounded-md" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
      {state.error ? <p className="text-xs text-destructive">{labels.error}</p> : null}
    </form>
  );
}

export function NoteCard({
  note,
  canManage,
  removeLabel,
}: {
  note: { id: string; cohortId: string; color: NoteColor; body: string; authorName: string | null };
  canManage: boolean;
  removeLabel: string;
}) {
  const [state, action, pending] = useActionState(deleteCohortNoteAction, initial);
  if (state.ok) return null;

  return (
    <div className={cn("flex flex-col gap-2 rounded-xl p-3 text-sm shadow-soft", CARD_CLASS[note.color])}>
      <p className="leading-relaxed break-words">{note.body}</p>
      <div className="flex items-center justify-between gap-2 text-xs opacity-70">
        <span className="truncate">{note.authorName ?? ""}</span>
        {canManage ? (
          <form action={action}>
            <input type="hidden" name="noteId" value={note.id} />
            <input type="hidden" name="cohortId" value={note.cohortId} />
            <button
              type="submit"
              aria-label={removeLabel}
              disabled={pending}
              className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
