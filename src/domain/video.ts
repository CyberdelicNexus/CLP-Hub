/**
 * Recognise a VIDEO block's URL well enough to play it on the page instead
 * of only linking out to it (2026-09-19: "we don't want users to go to
 * another page to watch the video"). Three shapes:
 *   - a direct media file → a native <video>, which is just a media element
 *     pointed at a URL, not a third-party embed.
 *   - a YouTube or Vimeo page → their own iframe embed, on privacy-leaning
 *     domains where each offers one (`youtube-nocookie.com`).
 *   - anything else → unrecognised; the caller falls back to a link card,
 *     since embedding an arbitrary host's page in an iframe would hand it
 *     a frame with no idea what it does with that.
 */
export type VideoEmbed =
  | { kind: "file" }
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "link" };

const FILE_PATTERN = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

export function resolveVideoEmbed(url: string): VideoEmbed {
  if (FILE_PATTERN.test(url)) return { kind: "file" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "link" };
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    if (id) return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = parsed.pathname.startsWith("/embed/")
      ? parsed.pathname.split("/")[2]
      : parsed.searchParams.get("v");
    if (id) return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  return { kind: "link" };
}
