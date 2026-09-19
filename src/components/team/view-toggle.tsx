import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

/** Plain links, not client state — the view is a URL, shareable and works without JS. */
export function ViewToggle({
  current,
  hrefFor,
  labels,
}: {
  current: "list" | "kanban";
  hrefFor: (view: "list" | "kanban") => string;
  labels: { list: string; kanban: string };
}) {
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
      <Link
        href={hrefFor("list")}
        aria-current={current === "list" ? "true" : undefined}
        className={
          current === "list"
            ? "inline-flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-xs font-medium shadow-soft"
            : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        }
      >
        <List className="size-3.5" aria-hidden />
        {labels.list}
      </Link>
      <Link
        href={hrefFor("kanban")}
        aria-current={current === "kanban" ? "true" : undefined}
        className={
          current === "kanban"
            ? "inline-flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-xs font-medium shadow-soft"
            : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        }
      >
        <LayoutGrid className="size-3.5" aria-hidden />
        {labels.kanban}
      </Link>
    </div>
  );
}
