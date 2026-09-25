"use client";

import { useActionState } from "react";
import { CircleX, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INQUIRY_REPLY_MAX_LENGTH } from "@/domain/inquiry";
import { answerInquiryAction, closeInquiryAction, type InquiryActionState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: InquiryActionState = { error: null };

export interface InquiryLabels {
  replyLabel: string;
  placeholder: string;
  hint: string;
  send: string;
  sending: string;
  close: string;
  closeConfirm: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: InquiryActionState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/**
 * The message bar at the foot of the chat. The reply is emailed to the person
 * and never stored. Enter writes a new line and Ctrl or Cmd + Enter sends: an
 * email cannot be unsent, so a stray Enter must not send it.
 */
export function ReplyComposer({ inquiryId, labels }: { inquiryId: string; labels: InquiryLabels }) {
  const [state, action, pending] = useActionState(answerInquiryAction, initial);
  return (
    <form action={action} className="space-y-2 border-t bg-card p-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <ErrorLine state={state} errors={labels.errors} />
      <div className="flex items-end gap-2">
        <textarea
          name="reply"
          rows={1}
          required
          maxLength={INQUIRY_REPLY_MAX_LENGTH}
          aria-label={labels.replyLabel}
          placeholder={labels.placeholder}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-2xl border border-input bg-background px-3.5 py-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          size="icon-lg"
          className="size-10 rounded-full"
          disabled={pending}
          aria-label={pending ? labels.sending : labels.send}
          title={labels.send}
        >
          <SendHorizontal aria-hidden />
        </Button>
      </div>
      <p className="px-1 text-xs text-muted-foreground">{labels.hint}</p>
    </form>
  );
}

/** Close without replying (spam, or answered elsewhere). Also erases the text, so it asks first. */
export function CloseButton({ inquiryId, labels }: { inquiryId: string; labels: InquiryLabels }) {
  const [state, action, pending] = useActionState(closeInquiryAction, initial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(labels.closeConfirm)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <ErrorLine state={state} errors={labels.errors} />
      {/* Text on a wide screen; an icon on a phone, where the name needs the room. */}
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending} title={labels.close} aria-label={labels.close}>
        <CircleX aria-hidden className="sm:hidden" />
        <span className="max-sm:hidden">{labels.close}</span>
      </Button>
    </form>
  );
}
