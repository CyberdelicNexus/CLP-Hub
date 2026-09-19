"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

/**
 * The page's optional cover — a thin banner, not a full block, that fades
 * into the page background at its bottom edge so it reads as an ambient
 * backdrop for the title rather than a big photo the reader scrolls past
 * (2026-09-19 follow-up: "only showing a thin horizontal banner... the
 * image should fade to the background colour at the bottom"). Horizontal
 * position is always centred; only the vertical crop focus is adjustable
 * ("keep the image always centred, but add an option to reposition in the
 * Y axis") via `object-position`'s Y component, 0 (top of the image) to
 * 100 (bottom).
 */
export function CoverBanner({
  url,
  position,
  onUrlChange,
  onPositionChange,
  labels,
}: {
  url: string;
  position: number;
  onUrlChange: (url: string) => void;
  onPositionChange: (position: number) => void;
  labels: { add: string; url: string; position: string; remove: string };
}) {
  const [editingUrl, setEditingUrl] = useState(false);

  if (!url) {
    return editingUrl ? (
      <div className="flex items-center gap-2 pb-2">
        <input
          autoFocus
          type="text"
          placeholder="https://…"
          className="h-8 flex-1 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUrlChange(e.currentTarget.value.trim());
              setEditingUrl(false);
            }
            if (e.key === "Escape") setEditingUrl(false);
          }}
          onBlur={(e) => {
            if (e.currentTarget.value.trim()) onUrlChange(e.currentTarget.value.trim());
            setEditingUrl(false);
          }}
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditingUrl(true)}
        className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ImagePlus className="size-3.5" aria-hidden />
        {labels.add}
      </button>
    );
  }

  return (
    <div className="group/cover relative -mx-6 -mt-6 mb-4 h-40 overflow-hidden sm:h-52">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        style={{ objectPosition: `center ${position}%` }}
      />
      {/* Fades the banner into the page background rather than ending on a
          hard edge. */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />

      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover/cover:opacity-100">
        <label className="flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[0.65rem] text-muted-foreground shadow-soft ring-1 ring-border">
          {labels.position}
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(e) => onPositionChange(Number(e.target.value))}
            className="h-1 w-16 accent-primary"
          />
        </label>
        <button
          type="button"
          aria-label={labels.remove}
          onClick={() => onUrlChange("")}
          className="flex size-6 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-soft ring-1 ring-border transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}

