"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { uploadContentImageAction } from "./actions";

/**
 * A small file-picker button that uploads straight to the `content-images`
 * bucket (`uploadContentImageAction`) and hands the caller back a public URL
 * — used by both `CoverBanner` and `MediaBlock`'s IMAGE form, alongside
 * (not instead of) the existing "paste a URL" input; either path ends at the
 * same `url` field on the block, so nothing about the block schema changes.
 */
export function ImageUploadButton({
  onUploaded,
  label,
  errorLabels,
  className,
}: {
  onUploaded: (url: string) => void;
  label: string;
  errorLabels: Record<string, string>;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again after an error
    if (!file) return;
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadContentImageAction(formData);
    setPending(false);
    if (result.url) onUploaded(result.url);
    else setError(result.error ?? "failed");
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-3.5" aria-hidden />
        )}
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{errorLabels[error] ?? error}</p> : null}
    </div>
  );
}
