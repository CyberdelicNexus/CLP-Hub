"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bodySchema, type ContentBody } from "@/domain/content";
import { BlockEditor, type Labels as BlockEditorLabels } from "./block-editor";
import { CoverBanner } from "./cover-banner";
import {
  createContentAction,
  createDraftAction,
  publishVersionAction,
  relinkSessionAction,
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
  defaultType,
  defaultSessionTemplateId,
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
  /** Deep-linked from a session's content slot (cohort workspace) so staff don't re-pick what they already clicked. */
  defaultType?: string;
  defaultSessionTemplateId?: string;
}) {
  const [state, action, pending] = useActionState(createContentAction, initial);
  const [type, setType] = useState(defaultType ?? "");
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
          {/*
            `defaultValue` on the select, never `selected` on the option: React
            warns about the latter and then ignores it, which would leave this
            field pre-filled with the first session rather than empty — a
            required field that looks answered is worse than one that looks
            empty. Same shape as every other select in the team area.
          */}
          <select
            id="sessionTemplateId"
            name="sessionTemplateId"
            required
            defaultValue={defaultSessionTemplateId ?? ""}
            className={SELECT_CLASS}
          >
            <option value="" disabled />
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
 * Which S0–S6 session this preparation/integration content belongs to —
 * editable after creation, not just chosen once when the content is first
 * made (2026-09-19 request: "add a property that lets you relate content to
 * the preparation or integration of the S0–S6 session list"). Reassigning
 * moves it: a content row has exactly one session at a time.
 */
export function RelinkSessionForm({
  contentId,
  sessionTemplateId,
  sessions,
  labels,
}: {
  contentId: string;
  sessionTemplateId: string | null;
  sessions: { id: string; label: string }[];
  labels: Labels & { field: string };
}) {
  const [state, action, pending] = useActionState(relinkSessionAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="contentId" value={contentId} />
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="relink-sessionTemplateId">{labels.field}</Label>
        <select
          id="relink-sessionTemplateId"
          name="sessionTemplateId"
          required
          defaultValue={sessionTemplateId ?? ""}
          className={SELECT_CLASS}
        >
          <option value="" disabled />
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <div className="w-full">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

/**
 * Single-column, edit-in-place — "just like Notion pages" (2026-09-19
 * follow-up). The cover banner, title and block canvas ARE the page; there
 * is no separate preview column any more (the earlier two-column version,
 * D-071, is what this replaces). `BlockEditor` and `CoverBanner` already
 * render close to their real published shape on their own; this component
 * is mostly plumbing — local state for the three pieces a save submits
 * (title, cover, blocks), a live schema check to disable Save on an invalid
 * body, and the hidden inputs the server action reads.
 */
export function VersionEditor({
  contentId,
  versionId,
  initialTitle,
  initialBody,
  initialCoverImageUrl,
  initialCoverImagePosition,
  labels,
  editorLabels,
  coverLabels,
}: {
  contentId: string;
  versionId: string;
  initialTitle: string;
  initialBody: ContentBody;
  initialCoverImageUrl: string | null;
  initialCoverImagePosition: number;
  labels: Labels & { title: string };
  editorLabels: BlockEditorLabels;
  coverLabels: { add: string; url: string; position: string; remove: string };
}) {
  const [state, action, pending] = useActionState(saveVersionAction, initial);
  const [blocks, setBlocks] = useState<ContentBody>(initialBody);
  const [title, setTitle] = useState(initialTitle);
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl ?? "");
  const [coverImagePosition, setCoverImagePosition] = useState(initialCoverImagePosition);

  // Re-validated on every change (blocks are already typed, so this only
  // ever catches a field a block's own inputs let through empty, like a
  // still-blank URL) — the server validates again on save regardless.
  const checked = bodySchema.safeParse(blocks);
  const localError = checked.success
    ? null
    : (() => {
        const issue = checked.error.issues[0];
        return issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "invalid";
      })();

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="contentId" value={contentId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="coverImageUrl" value={coverImageUrl} />
      <input type="hidden" name="coverImagePosition" value={coverImagePosition} />
      <input type="hidden" name="body" value={JSON.stringify(blocks)} />

      <div className="rounded-2xl bg-background p-6 ring-1 ring-foreground/10">
        <CoverBanner
          url={coverImageUrl}
          position={coverImagePosition}
          onUrlChange={setCoverImageUrl}
          onPositionChange={setCoverImagePosition}
          labels={coverLabels}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={labels.title}
          maxLength={200}
          required
          className="mb-2 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
        />
        <BlockEditor blocks={blocks} onChange={setBlocks} labels={editorLabels} />
      </div>

      {localError ? (
        <p role="alert" className="font-mono text-xs text-destructive">
          {localError}
        </p>
      ) : null}
      <ErrorLine state={state} errors={labels.errors} />
      <div>
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending || Boolean(localError)}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
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
