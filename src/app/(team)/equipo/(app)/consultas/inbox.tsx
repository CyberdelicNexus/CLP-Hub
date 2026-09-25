import Link from "next/link";
import { ArrowLeft, MessageCircleQuestionMark } from "lucide-react";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/domain/inquiry";
import { avatarInitials, inquiryPreview, listTimeLabel } from "@/domain/inquiry-view";
import { cn } from "@/lib/utils";
import type { InquiryRow } from "@/services/inquiries";
import { CloseButton, ReplyComposer, type InquiryLabels } from "./inquiry-forms";

export interface InboxLabels extends InquiryLabels {
  title: string;
  subtitle: string;
  tabs: Record<InquiryStatus, string>;
  /** Singular titles for a handled conversation (its name is erased). */
  handledTitle: Record<"ANSWERED" | "CLOSED", string>;
  empty: string;
  selectPrompt: string;
  privacyNote: string;
  back: string;
  answeredNote: (by: string | null, when: string) => string;
  closedNote: (by: string | null, when: string) => string;
  handledBy: string;
  listAria: string;
}

/**
 * The inquiry inbox laid out like a chat app (D-088): the conversations on the
 * left, the open one on the right, a message bar at the foot.
 *
 * It is a chat only in appearance. The visitor's question is shown as the
 * incoming message while the inquiry is pending; once it is answered or
 * closed the text is erased (docs D-088), so a handled conversation is one
 * line saying who dealt with it and when. Selection lives in the URL
 * (`?consulta=`), so every row is a plain link and the page needs no client
 * state. On a phone it shows one pane at a time.
 */
export function InquiryInbox({
  labels,
  basePath,
  filter,
  rows,
  selected,
  pendingCount,
  timeZone,
  now,
}: {
  labels: InboxLabels;
  basePath: string;
  filter: InquiryStatus;
  rows: InquiryRow[];
  selected: InquiryRow | null;
  pendingCount: number;
  timeZone: string;
  now: Date;
}) {
  const long = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone });
  const dayOnly = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone });
  const clock = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone });
  // Only plain strings cross into the client components.
  const formLabels: InquiryLabels = {
    replyLabel: labels.replyLabel,
    placeholder: labels.placeholder,
    hint: labels.hint,
    send: labels.send,
    sending: labels.sending,
    close: labels.close,
    closeConfirm: labels.closeConfirm,
    errors: labels.errors,
  };

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[32rem] overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/10">
      {/* ---- Conversations ---- */}
      <section
        aria-label={labels.listAria}
        className={cn(
          "flex w-full shrink-0 flex-col border-r md:w-80 lg:w-96",
          selected ? "max-md:hidden" : null,
        )}
      >
        <header className="space-y-3 border-b p-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{labels.title}</h1>
            <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
          </div>
          <nav className="flex gap-1 rounded-xl bg-muted p-1" aria-label={labels.title}>
            {INQUIRY_STATUSES.map((value) => (
              <Link
                key={value}
                href={`${basePath}?estado=${value}`}
                aria-current={value === filter ? "page" : undefined}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  value === filter ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {labels.tabs[value]}
                {value === "NEW" && pendingCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] text-primary-foreground" data-numeric>
                    {pendingCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </header>

        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
            {rows.map((row) => {
              const isNew = row.status === "NEW";
              const active = selected?.id === row.id;
              const when = row.handledAt ?? row.createdAt;
              return (
                <li key={row.id}>
                  <Link
                    href={`${basePath}?estado=${filter}&consulta=${row.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                      active ? "bg-muted" : null,
                    )}
                  >
                    <Avatar name={row.name} muted={!isNew} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", isNew ? "font-semibold" : "text-muted-foreground")}>
                          {isNew ? row.name : labels.handledTitle[row.status as "ANSWERED" | "CLOSED"]}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
                          {listTimeLabel(when, now, timeZone)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-muted-foreground">
                          {isNew
                            ? inquiryPreview(row.message)
                            : row.handledByName
                              ? `${labels.handledBy} ${row.handledByName}`
                              : ""}
                        </p>
                        {isNew ? <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-primary" /> : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- The open conversation ---- */}
      <section className={cn("flex min-w-0 flex-1 flex-col bg-muted/30", selected ? null : "max-md:hidden")}>
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
              <Link
                href={`${basePath}?estado=${filter}`}
                aria-label={labels.back}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
              >
                <ArrowLeft className="size-5" aria-hidden />
              </Link>
              <Avatar name={selected.name} muted={selected.status !== "NEW"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {selected.status === "NEW" ? selected.name : labels.handledTitle[selected.status as "ANSWERED" | "CLOSED"]}
                </p>
                {selected.status === "NEW" ? (
                  <p className="truncate text-xs text-muted-foreground" data-numeric>
                    {selected.email}
                  </p>
                ) : null}
              </div>
              {selected.status === "NEW" ? <CloseButton inquiryId={selected.id} labels={formLabels} /> : null}
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <p className="mx-auto w-fit rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
                {dayOnly.format(selected.createdAt)}
              </p>

              {selected.status === "NEW" ? (
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 shadow-sm sm:max-w-[70%]">
                  <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
                  <p className="mt-1 text-right text-[0.7rem] text-muted-foreground" data-numeric>
                    {clock.format(selected.createdAt)}
                  </p>
                </div>
              ) : (
                <p className="mx-auto max-w-md rounded-xl bg-card px-4 py-2.5 text-center text-xs text-muted-foreground shadow-sm">
                  {selected.status === "ANSWERED"
                    ? labels.answeredNote(selected.handledByName, selected.handledAt ? long.format(selected.handledAt) : "")
                    : labels.closedNote(selected.handledByName, selected.handledAt ? long.format(selected.handledAt) : "")}
                </p>
              )}
            </div>

            {selected.status === "NEW" ? <ReplyComposer inquiryId={selected.id} labels={formLabels} /> : null}
          </>
        ) : (
          <div className="grid flex-1 place-content-center justify-items-center gap-3 p-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-card text-muted-foreground shadow-sm">
              <MessageCircleQuestionMark className="size-8" aria-hidden />
            </span>
            <p className="text-base font-medium">{labels.selectPrompt}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{labels.privacyNote}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ name, muted }: { name: string | null; muted: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium",
        muted ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
      )}
    >
      {name ? avatarInitials(name) : <MessageCircleQuestionMark className="size-5" />}
    </span>
  );
}
