"use client";

import { useState } from "react";

export default function CopySlugButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}/exam/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
    >
      {copied ? "Copied!" : "Copy URL"}
    </button>
  );
}
