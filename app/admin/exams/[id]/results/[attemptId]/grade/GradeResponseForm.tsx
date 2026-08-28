"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  examId: string;
  attemptId: string;
  responseId: string;
  maxMarks: number;
  currentEarned: number | null;
}

export default function GradeResponseForm({
  examId,
  attemptId,
  responseId,
  maxMarks,
  currentEarned,
}: Props) {
  const [value, setValue] = useState(
    currentEarned != null ? String(currentEarned) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > maxMarks) {
      setError(`Enter a value between 0 and ${maxMarks}`);
      return;
    }

    const res = await fetch(
      `/api/admin/exams/${examId}/attempts/${attemptId}/responses/${responseId}/grade`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ earnedMarks: num }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save grade");
      return;
    }

    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min={0}
          max={maxMarks}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
            setError(null);
          }}
          className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="0"
          required
        />
        <span className="text-sm text-muted-foreground">/ {maxMarks}</span>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {saved && (
        <span className="text-xs text-green-700 dark:text-green-400 font-medium">Saved</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </form>
  );
}
