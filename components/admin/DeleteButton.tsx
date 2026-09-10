"use client";

import { useState, useTransition } from "react";

interface DeleteButtonProps {
  onDelete: () => Promise<{ error?: string; success?: boolean }>;
  confirmMessage?: string;
  label?: string;
  className?: string;
  variant?: "danger" | "ghost";
}

export default function DeleteButton({
  onDelete,
  label = "Delete",
  className,
  variant = "danger",
}: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result?.error) setError(result.error);
    });
  }

  const base =
    variant === "ghost"
      ? "text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:underline disabled:opacity-50"
      : "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50";

  if (confirming) {
    return (
      <span className="inline-flex flex-col gap-1">
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/60 transition-colors"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </span>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className={className ?? base}
      >
        {isPending ? "Deleting…" : label}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
