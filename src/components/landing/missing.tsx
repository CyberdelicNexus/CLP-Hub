import { isProduction } from "@/config/env";
import type { Missing as MissingItem } from "@/content/landing/clear-light";

/**
 * A protocol value the study team has not supplied yet.
 *
 * Development and staging render a visible, unmistakable marker so nobody
 * mistakes the gap for finished copy. Production renders nothing, and the page
 * itself refuses to publish while any marker remains (src/app/(public)/page.tsx).
 */
export function Missing({ item }: { item: MissingItem }) {
  if (isProduction()) return null;
  return (
    <span className="missing" role="note" title={item.needs}>
      FALTA CONTENIDO APROBADO: {item.key}
    </span>
  );
}
