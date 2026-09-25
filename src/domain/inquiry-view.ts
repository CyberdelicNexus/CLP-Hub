/**
 * Pure presentation helpers for the inquiry inbox (D-088), kept out of the
 * components so they can be tested. Nothing here touches storage.
 */
import { initialOf } from "./recruitment";

/** One line of the question for the chat list: whitespace collapsed, cut on a word. */
export function inquiryPreview(message: string | null, max = 90): string {
  if (!message) return "";
  const flat = message.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Up to two initials for the avatar, accents folded. Falls back to "?". */
export function avatarInitials(name: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.slice(0, 2).map((w) => initialOf(w));
  return letters.join("");
}

/**
 * The time shown at the right of a chat-list row: the clock time today, the day
 * and month otherwise, both in the study's timezone.
 */
export function listTimeLabel(date: Date, now: Date, timeZone: string, locale = "es-ES"): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  if (day(date) === day(now)) {
    return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short" }).format(date);
}
