import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listParticipantAudit } from "@/services/audit-trail";

/**
 * The participant's history of recorded changes (Phase 4d).
 *
 * The audit log has been written since Phase 0 but nothing in the product could
 * read it back, which made "consultar el historial de cambios" a database task.
 * This is that read.
 *
 * WHAT IS SHOWN: what happened, when, and who did it, plus the NAMES of the
 * fields that changed. Not their values. `before_json` / `after_json` can carry
 * contact fields on rows written by earlier phases, and sensitive names are
 * dropped from the list entirely rather than shown redacted — "email ●●●" still
 * tells the reader an email was touched, which in a small study is itself
 * informative.
 *
 * Snapshot values are deliberately NOT requested here. Exposing them is a
 * separate decision with a separate retention question attached
 * (docs/research-data-boundaries.md, open item 4), and a panel that quietly
 * showed them would settle that question by accident.
 */
export async function AuditPanel({
  studyId,
  participantId,
  timezone,
}: {
  studyId: string;
  participantId: string;
  timezone: string;
}) {
  const t = await getTranslations();
  const entries = await listParticipantAudit(studyId, participantId, { limit: 50 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("audit.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{t("audit.note")}</p>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("audit.empty")}</p>
        ) : (
          <ol className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{actionLabel(t, e.action)}</span>
                  <span data-numeric className="text-xs text-muted-foreground">
                    {formatDate(e.createdAt, timezone)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {e.actorName ?? t(`audit.actor.${e.actorType}`)}
                  </span>
                </div>
                {e.changedFields.length > 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    {e.changedFields.join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The separator an audit action uses in the MESSAGE FILES.
 *
 * The stored action keeps its dot — `<entity>.<verb>` is the database
 * vocabulary and `src/audit/record.ts` validates that shape. But next-intl
 * reads a dot in a key as nesting and rejects the whole namespace as malformed,
 * which made every page that loaded messages log INVALID_KEY. Translating the
 * separator at lookup time keeps both conventions intact.
 */
const MESSAGE_KEY_SEPARATOR = "__";

/**
 * A translated label for an audit action, falling back to the raw
 * `<entity>.<verb>` key.
 *
 * The fallback is deliberate: a new action added by a later phase should appear
 * in the history immediately, looking slightly raw, rather than being invisible
 * until someone remembers to add a translation. A missing label is a cosmetic
 * problem; a missing history entry is a wrong answer to "what happened".
 */
function actionLabel(t: (key: string) => string, action: string): string {
  const key = `audit.action.${action.replace(".", MESSAGE_KEY_SEPARATOR)}`;
  try {
    const label = t(key);
    // next-intl returns the key itself when there is no message for it.
    return label === key ? action : label;
  } catch {
    return action;
  }
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
