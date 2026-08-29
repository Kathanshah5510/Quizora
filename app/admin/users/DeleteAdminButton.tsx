"use client";

import { useState, useTransition } from "react";
import { deleteAdminAction } from "./actions";

interface Props {
  userId: string;
  adminName: string;
  isSelf: boolean;
}

export default function DeleteAdminButton({ userId, adminName, isSelf }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (isSelf) return null;

  const handleClick = () => {
    if (!confirm(`Delete "${adminName}"? This action cannot be undone.`)) return;
    setError("");
    startTransition(async () => {
      const result = await deleteAdminAction(userId);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400 max-w-xs">{error}</span>
      )}
    </span>
  );
}
