"use client";

import { useRef, useState } from "react";

interface CurrentAsset {
  id: string;
  url: string;
  filename?: string;
}

interface MediaUploaderProps {
  defaultAsset?: CurrentAsset | null;
  onChange: (asset: CurrentAsset | null) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

export default function MediaUploader({ defaultAsset, onChange }: MediaUploaderProps) {
  const [current, setCurrent] = useState<CurrentAsset | null>(defaultAsset ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("File too large. Maximum size is 5 MB.");
      return;
    }

    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      const asset: CurrentAsset = { id: data.id, url: data.url, filename: data.filename };
      setCurrent(asset);
      onChange(asset);
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    setCurrent(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {current ? (
        <div className="relative inline-block rounded-lg border border-border overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.filename ?? "Question image"}
            className="block max-h-64 max-w-full object-contain bg-muted"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 rounded-full bg-black/60 hover:bg-black/80 text-white w-6 h-6 flex items-center justify-center text-xs transition-colors"
            title="Remove image"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors px-6 py-8 text-sm text-muted-foreground disabled:opacity-50"
        >
          {uploading ? (
            <>
              <span className="text-lg">⏳</span>
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <span className="text-2xl">🖼</span>
              <span className="font-medium text-foreground">Click to upload image</span>
              <span className="text-xs">JPEG, PNG, GIF, WebP — max 5 MB</span>
            </>
          )}
        </button>
      )}

      {!current && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {current ? "Replace image" : ""}
        </button>
      )}

      {current && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Replace image"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleFileChange}
      />

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
