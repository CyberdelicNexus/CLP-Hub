import Script from "next/script";
import { CalendarClock, ExternalLink } from "lucide-react";
import type { TrelloBoardData, TrelloLabel } from "@/services/trello";

/**
 * The team's Trello board: general project tasks, separate from this study's
 * own operational task list below it.
 *
 * Since 2026-11-10 (D-149) it shows the board's lists and cards, read
 * server-side from Trello's public API (`getTrelloBoard`), not cached. Every
 * card links to Trello, where changes are made; nothing here writes back.
 *
 * When the board can't be read (private board, Trello down) it falls back to
 * Trello's documented compact embed: a `<blockquote>` link that Trello's
 * `embed.min.js` turns into a board preview. A raw `<iframe>` of trello.com is
 * not an option: Trello's `frame-ancestors` CSP blocks it.
 */
export function TrelloBoard({
  boardUrl,
  board,
  timeZone,
  now,
  labels,
}: {
  boardUrl: string | null;
  board: TrelloBoardData | null;
  timeZone: string;
  /** The request's time, so an overdue card is judged once per render. */
  now: Date;
  labels: {
    notConnected: string;
    notConnectedHelp: string;
    open: string;
    emptyList: string;
    readOnly: string;
    done: string;
  };
}) {
  if (!boardUrl) {
    return (
      <div className="rounded-xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">{labels.notConnected}</p>
        <p className="mt-1">{labels.notConnectedHelp}</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <blockquote className="trello-board-compact m-0 flex items-center justify-center bg-muted/30 p-4">
          <a
            href={boardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {labels.open}
          </a>
        </blockquote>
        <Script src="https://p.trellocdn.com/embed.min.js" strategy="afterInteractive" />
      </div>
    );
  }

  const dueFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{labels.readOnly}</span>
        <a
          href={board.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {labels.open}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      <div className="grid auto-cols-[16rem] grid-flow-col gap-3 overflow-x-auto pb-2">
        {board.lists.map((list) => (
          <section key={list.id} aria-label={list.name} className="flex min-h-24 flex-col gap-2 rounded-2xl bg-muted/40 p-3">
            <h3 className="flex items-center gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <span className="truncate">{list.name}</span>
              <span className="ml-auto shrink-0 tabular-nums">{list.cards.length}</span>
            </h3>
            {list.cards.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">{labels.emptyList}</p>
            ) : (
              <ul className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto">
                {list.cards.map((card) => {
                  const dueAt = card.due ? new Date(card.due).getTime() : null;
                  const overdue = dueAt !== null && !card.dueComplete && dueAt < now.getTime();
                  return (
                    <li key={card.id}>
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col gap-1.5 rounded-xl bg-card p-2.5 text-sm shadow-soft transition-shadow duration-200 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {card.labels.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {card.labels.map((l, i) => (
                              <LabelChip key={`${l.name}-${i}`} label={l} />
                            ))}
                          </span>
                        ) : null}
                        <span className="leading-snug">{card.name}</span>
                        {card.due ? (
                          <span
                            data-numeric
                            className={
                              card.dueComplete
                                ? "inline-flex w-fit items-center gap-1 rounded-md bg-[var(--status-success-bg)] px-1.5 py-0.5 text-[0.7rem] text-[var(--status-success-fg)]"
                                : overdue
                                  ? "inline-flex w-fit items-center gap-1 rounded-md bg-[var(--status-critical-bg)] px-1.5 py-0.5 text-[0.7rem] text-[var(--status-critical-fg)]"
                                  : "inline-flex w-fit items-center gap-1 text-[0.7rem] text-muted-foreground"
                            }
                          >
                            <CalendarClock className="size-3" aria-hidden />
                            {dueFormat.format(new Date(card.due))}
                            {card.dueComplete ? ` · ${labels.done}` : null}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Trello's label colours, by their base name (a `_light`/`_dark` suffix shares it). */
const LABEL_COLORS: Record<string, string> = {
  green: "#4bce97",
  yellow: "#e2b203",
  orange: "#fea362",
  red: "#f87168",
  purple: "#9f8fef",
  blue: "#579dff",
  sky: "#6cc3e0",
  lime: "#94c748",
  pink: "#e774bb",
  black: "#8590a2",
};

function LabelChip({ label }: { label: TrelloLabel }) {
  const hex = label.color ? LABEL_COLORS[label.color.replace(/_(light|dark)$/, "")] : undefined;
  if (!label.name) {
    // A colour-only label, drawn as Trello does: a short bar.
    return <span aria-hidden className="h-1.5 w-8 rounded-full" style={{ background: hex ?? "var(--border)" }} />;
  }
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground"
      style={{ background: hex ? `color-mix(in oklch, ${hex} 28%, var(--card))` : "var(--muted)" }}
    >
      {label.name}
    </span>
  );
}
