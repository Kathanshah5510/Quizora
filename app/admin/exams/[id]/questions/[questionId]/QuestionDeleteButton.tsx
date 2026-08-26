"use client";

import { useState, useTransition } from "react";

interface Props {
  action: () => Promise<{ error: string | null; success: boolean }>;
}

export default function QuestionDeleteButton({ action }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && !result.success && result.error) {
        setError(result.error);
        setConfirming(false);
      }
      // On success, the server action redirects
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-500">{error}</span>}
        <span className="text-xs text-muted-foreground">Delete this question?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Deleting…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
    >
      Delete
    </button>
  );
}
