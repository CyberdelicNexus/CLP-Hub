import "server-only";
import { getEnv } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Trello, read-only (2026-09-18 request; lists and cards since 2026-11-10,
 * D-149). Off by default like every other external integration in this app:
 * `TRELLO_BOARD_URL` is configuration (an env var), not a value in code (rule
 * 6). Nothing here writes back to Trello.
 */
export function getTrelloBoardUrl(): string | null {
  return getEnv().TRELLO_BOARD_URL ?? null;
}

export interface TrelloLabel {
  name: string;
  /** Trello's colour name ("green", "sky_dark"…), or null for a colourless label. */
  color: string | null;
}

export interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
  dueComplete: boolean;
  labels: TrelloLabel[];
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
  cards: TrelloCard[];
}

export interface TrelloBoardData {
  name: string;
  url: string;
  lists: TrelloList[];
}

/** A board short link from a board URL: trello.com/b/<shortLink>/<slug>. */
function boardShortLink(url: string): string | null {
  const m = /trello\.com\/b\/([A-Za-z0-9]{6,12})(?:\/|$)/.exec(url);
  return m ? m[1] : null;
}

/**
 * The board's open lists and visible cards, read from Trello's public REST API
 * with no key: it answers for a board whose visibility is "public" and refuses
 * a private one, so the board's own sharing setting is the switch.
 *
 * Only what the board view shows is requested: a card's name, labels, due date
 * and link. Never its description, comments, members or attachments. Fetched
 * per request and not cached, so no card content is stored by this app. Any
 * failure (private board, Trello down, slow) returns null, and the page falls
 * back to the plain link.
 */
export async function getTrelloBoard(): Promise<TrelloBoardData | null> {
  const boardUrl = getTrelloBoardUrl();
  const id = boardUrl ? boardShortLink(boardUrl) : null;
  if (!boardUrl || !id) return null;

  const params = new URLSearchParams({
    fields: "name,url",
    lists: "open",
    list_fields: "name,pos",
    cards: "visible",
    card_fields: "name,idList,due,dueComplete,labels,pos,shortUrl",
  });

  try {
    const res = await fetch(`https://api.trello.com/1/boards/${id}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      logger.warn({ event: "trello.board_unavailable", status: res.status }, "trello board not readable");
      return null;
    }
    const raw = (await res.json()) as {
      name: string;
      url: string;
      lists?: { id: string; name: string; pos: number }[];
      cards?: {
        id: string;
        name: string;
        idList: string;
        due: string | null;
        dueComplete: boolean;
        labels?: { name: string; color: string | null }[];
        pos: number;
        shortUrl: string;
      }[];
    };

    const cards = [...(raw.cards ?? [])].sort((a, b) => a.pos - b.pos);
    const lists = [...(raw.lists ?? [])]
      .sort((a, b) => a.pos - b.pos)
      .map((l) => ({
        id: l.id,
        name: l.name,
        cards: cards
          .filter((c) => c.idList === l.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            due: c.due,
            dueComplete: c.dueComplete,
            labels: (c.labels ?? []).map((x) => ({ name: x.name, color: x.color })),
            url: c.shortUrl,
          })),
      }));

    return { name: raw.name, url: raw.url || boardUrl, lists };
  } catch (err) {
    logger.warn(
      { event: "trello.board_unavailable", err: err instanceof Error ? err.message : String(err) },
      "trello board not readable",
    );
    return null;
  }
}
