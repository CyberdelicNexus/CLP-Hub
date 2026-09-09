"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentBlocks } from "@/components/content/blocks";
import { bodySchema, type ContentBody } from "@/domain/content";
import {
  createContentAction,
  createDraftAction,
  publishVersionAction,
  saveVersionAction,
  setStatusAction,
  type ContentActionState,
} from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: ContentActionState = { error: null };

export interface Labels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function ErrorLine({ state, errors }: { state: ContentActionState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
      {state.detail ? <span className="font-mono"> — {state.detail}</span> : null}
    </p>
  );
}

export function CreateContentForm({
  types,
  sessions,
  labels,
}: {
  types: { value: string; label: string; needsSession: boolean }[];
  sessions: { id: string; label: string }[];
  labels: Labels & {
    type: string;
    key: string;
    keyHelp: string;
    title: string;
    session: string;
  };
}) {
  const [state, action, pending] = useActionState(createContentAction, initial);
  const [type, setType] = useState("");
  const needsSession = types.find((t) => t.value === type)?.needsSession ?? false;

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="type">{labels.type}</Label>
        <select
          id="type"
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="" disabled />
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {needsSession ? (
        <div className="space-y-1.5">
          <Label htmlFor="sessionTemplateId">{labels.session}</Label>
          <select id="sessionTemplateId" name="sessionTemplateId" required className={SELECT_CLASS}>
            <option value="" disabled selected />
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div aria-hidden />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="key">{labels.key}</Label>
        <Input id="key" name="key" required maxLength={61} placeholder="preparacion-vr" />
        <p className="text-xs text-muted-foreground">{labels.keyHelp}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">{labels.title}</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>

      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

/**
 * Version editor.
 *
 * The body is edited as the block JSON with live validation and a preview
 * rendered by the very same component the public page uses, so what an author
 * sees here is what a participant gets. A friendlier block-by-block editor is a
 * known follow-up (D-028) — this is deliberately the honest interim: it cannot
 * save an invalid body, and it never hides what is being stored.
 */
export function VersionEditor({
  contentId,
  versionId,
  initialTitle,
  initialBody,
  labels,
}: {
  contentId: string;
  versionId: string;
  initialTitle: string;
  initialBody: ContentBody;
  labels: Labels & {
    title: string;
    body: string;
    bodyHelp: string;
    preview: string;
    previewEmpty: string;
    valid: string;
  };
}) {
  const [state, action, pending] = useActionState(saveVersionAction, initial);
  const [raw, setRaw] = useState(() => JSON.stringify(initialBody, null, 2));

  // Live validation drives the preview; the server validates again on save.
  let parsed: ContentBody | null = null;
  let localError: string | null = null;
  try {
    const json = JSON.parse(raw || "[]");
    const checked = bodySchema.safeParse(json);
    if (checked.success) parsed = checked.data;
    else {
      const issue = checked.error.issues[0];
      localError = issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "invalid";
    }
  } catch {
    localError = "JSON";
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="contentId" value={contentId} />
        <input type="hidden" name="versionId" value={versionId} />

        <div className="space-y-1.5">
          <Label htmlFor="title">{labels.title}</Label>
          <Input id="title" name="title" defaultValue={initialTitle} required maxLength={200} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">{labels.body}</Label>
          <textarea
            id="body"
            name="body"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            rows={18}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            aria-invalid={localError ? true : undefined}
            aria-describedby="bodyHelp"
          />
          <p id="bodyHelp" className="text-xs text-muted-foreground">
            {labels.bodyHelp}
          </p>
          {localError ? (
            <p role="alert" className="font-mono text-xs text-destructive">
              {localError}
            </p>
          ) : (
            <p className="text-xs text-[var(--status-success-fg)]">{labels.valid}</p>
          )}
        </div>

        <ErrorLine state={state} errors={labels.errors} />
        <div>
          <Button type="submit" size="sm" className="rounded-lg" disabled={pending || Boolean(localError)}>
            {pending ? labels.submitting : labels.submit}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {labels.preview}
        </p>
        <div className="rounded-2xl bg-background p-5 ring-1 ring-foreground/10">
          {parsed && parsed.length > 0 ? (
            <ContentBlocks body={parsed} />
          ) : (
            <p className="text-sm text-muted-foreground">{labels.previewEmpty}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function VersionStatusForm({
  contentId,
  versionId,
  options,
  labels,
}: {
  contentId: string;
  versionId: string;
  options: { value: string; label: string }[];
  labels: Labels;
}) {
  const [state, action, pending] = useActionState(setStatusAction, initial);
  if (options.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="versionId" value={versionId} />
      {options.map((o) => (
        <Button
          key={o.value}
          type="submit"
          name="status"
          value={o.value}
          variant="outline"
          size="sm"
          className="rounded-lg"
          disabled={pending}
        >
          {o.label}
        </Button>
      ))}
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

export function PublishForm({
  contentId,
  versionId,
  labels,
}: {
  contentId: string;
  versionId: string;
  labels: Labels & { note: string };
}) {
  const [state, action, pending] = useActionState(publishVersionAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="versionId" value={versionId} />
      <div>
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{labels.note}</p>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

export function NewDraftForm({
  contentId,
  versionId,
  labels,
}: {
  contentId: string;
  versionId: string;
  labels: Labels & { note: string };
}) {
  const [state, action, pending] = useActionState(createDraftAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="versionId" value={versionId} />
      <div>
        <Button type="submit" variant="outline" size="sm" className="rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{labels.note}</p>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
