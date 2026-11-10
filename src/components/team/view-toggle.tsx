import Link from "next/link";
import { Columns3, LayoutGrid, List, type LucideIcon } from "lucide-react";

type View = "gallery" | "kanban" | "list";

const ICONS: Record<View, LucideIcon> = { gallery: LayoutGrid, kanban: Columns3, list: List };

/**
 * Plain links, not client state — the view is a URL, shareable and works without JS.
 *
 * A gallery view is offered only when its label is passed (Solicitudes,
 * 2026-10-28); the order is then gallery · kanban · list, as asked for there.
 * Pages without one keep list · kanban, and a page with no list omits its label.
 */
export function ViewToggle<V extends View>({
  current,
  hrefFor,
  labels,
}: {
  current: V;
  hrefFor: (view: V) => string;
  labels: { kanban: string; list?: string; gallery?: string };
}) {
  const views = (
    labels.gallery ? ["gallery", "kanban", "list"].filter((v) => labels[v as View]) : ["list", "kanban"]
  ) as V[];
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
      {views.map((view) => {
        const Icon: LucideIcon = ICONS[view];
        return (
          <Link
            key={view}
            href={hrefFor(view)}
            aria-current={current === view ? "true" : undefined}
            className={
              current === view
                ? "inline-flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-xs font-medium shadow-soft"
                : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            <Icon className="size-3.5" aria-hidden />
            {labels[view]}
          </Link>
        );
      })}
    </div>
  );
}
