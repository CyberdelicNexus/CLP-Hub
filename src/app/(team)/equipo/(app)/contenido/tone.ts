import type { StatusTone } from "@/components/status-badge";
import type { ContentStatus } from "@/domain/content";

/** The single place content workflow statuses map to colour. */
const TONES: Record<ContentStatus, StatusTone> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export function contentTone(status: ContentStatus): StatusTone {
  return TONES[status];
}
