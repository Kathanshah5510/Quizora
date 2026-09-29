"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncRosterFromCourseAction } from "./actions";
import { Pending } from "@/components/Spinner";

export default function SyncFromCourseButton({ examId }: { examId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      const result = await syncRosterFromCourseAction(examId);
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage(
          result.added && result.added > 0
            ? `Added ${result.added} student${result.added !== 1 ? "s" : ""}`
            : "Already up to date"
        );
        router.refresh();
      }
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={pending}
        className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {pending ? <Pending>Syncing…</Pending> : "Sync from Course Roster"}
      </button>
      {message && <span className="text-xs text-muted-foreground whitespace-nowrap">{message}</span>}
    </span>
  );
}
