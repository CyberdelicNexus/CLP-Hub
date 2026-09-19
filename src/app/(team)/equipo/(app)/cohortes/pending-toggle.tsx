"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * "Pendientes de esta cohorte" splits into two boards, shown one at a time
 * — "two buttons, either sticky notes or tasks" (2026-09-19 request). Both
 * are still fetched and rendered server-side; this only decides which of
 * the two already-rendered slots is visible, so there's no extra request
 * when switching.
 */
export function PendingToggle({
  tasksLabel,
  notesLabel,
  tasks,
  notes,
}: {
  tasksLabel: string;
  notesLabel: string;
  tasks: React.ReactNode;
  notes: React.ReactNode;
}) {
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
        {(["tasks", "notes"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              tab === value ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "tasks" ? tasksLabel : notesLabel}
          </button>
        ))}
      </div>
      <div hidden={tab !== "tasks"}>{tasks}</div>
      <div hidden={tab !== "notes"}>{notes}</div>
    </div>
  );
}
