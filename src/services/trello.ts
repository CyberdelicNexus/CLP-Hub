import "server-only";
import { getEnv } from "@/config/env";

/**
 * Trello, read-only iframe embed (2026-09-18 request). Off by default like
 * every other external integration in this app — `TRELLO_BOARD_URL` is
 * configuration (an env var), not a value in code, same non-negotiable-6
 * reasoning as everywhere else: which board to show is this team's own
 * setup, never hardcoded here. Nothing in this codebase writes back to
 * Trello or calls its API; the board must have public link sharing enabled
 * for Trello to allow framing it at all.
 */
export function getTrelloBoardUrl(): string | null {
  return getEnv().TRELLO_BOARD_URL ?? null;
}
