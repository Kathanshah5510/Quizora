"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  examId: string;
  /** True if any results are currently released */
  anyReleased: boolean;
}

export default function ReleaseToggle({ examId, anyReleased }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleToggle(release: boolean) {
    setError(null);
    const res = await fetch(`/api/admin/exams/${examId}/results/release`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isReleased: release }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update release status");
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => handleToggle(true)}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "Updating…" : "Release All"}
        </button>
        {anyReleased && (
          <button
            onClick={() => handleToggle(false)}
            disabled={isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Hide All
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
