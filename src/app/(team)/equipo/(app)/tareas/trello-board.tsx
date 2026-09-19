import Script from "next/script";

/**
 * Read-only preview of the team's Trello board (2026-09-18 request, fixed
 * 2026-09-19) — general project tasks, separate from this study's own
 * operational task list below it. No API key, no card data ever touches
 * this server. See src/services/trello.ts for why the URL is configuration.
 *
 * NOT a raw `<iframe src={boardUrl}>` — that was tried first and Trello's
 * own `frame-ancestors` CSP blocks it outright for any third-party site.
 * Trello's actual documented embed
 * (developer.atlassian.com/cloud/trello/guides/embedding/embedding-boards)
 * is a `<blockquote>` link plus their own `embed.min.js`, which Trello's
 * script then replaces with a compact, non-interactive board view served
 * from an embed-specific endpoint their CSP does allow framing. Until that
 * script runs (or if it's blocked, e.g. by an ad-blocker treating a
 * third-party embed script as trackable — a real possibility for exactly
 * this kind of tag), the blockquote is a plain link, which is why it isn't
 * hidden behind the script the way a loading spinner would be: it is
 * already the fallback.
 */
export function TrelloBoard({
  boardUrl,
  notConnectedLabel,
  notConnectedHelp,
  openLabel,
}: {
  boardUrl: string | null;
  notConnectedLabel: string;
  notConnectedHelp: string;
  openLabel: string;
}) {
  if (!boardUrl) {
    return (
      <div className="rounded-xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">{notConnectedLabel}</p>
        <p className="mt-1">{notConnectedHelp}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <blockquote className="trello-board-compact m-0 flex items-center justify-center bg-muted/30 p-4">
        <a
          href={boardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {openLabel}
        </a>
      </blockquote>
      <Script src="https://p.trellocdn.com/embed.min.js" strategy="afterInteractive" />
    </div>
  );
}
