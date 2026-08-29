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
  confirmMessage = "Are you sure you want to delete this? This action cannot be undone.",
  label = "Delete",
  className,
  variant = "danger",
}: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
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

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={className ?? base}
      >
        {isPending ? "Deleting…" : label}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
