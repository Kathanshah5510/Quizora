"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

interface Props {
  examId: string;
  currentStatus?: string;
  currentGradingStatus?: string;
  currentSearch?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "EXPIRED", label: "Expired" },
  { value: "IN_PROGRESS", label: "In Progress" },
];

const GRADING_OPTIONS = [
  { value: "", label: "All grading" },
  { value: "COMPLETE", label: "Graded" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Pending" },
];

export default function ResultsFilterBar({
  examId,
  currentStatus,
  currentGradingStatus,
  currentSearch,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const navigate = useCallback(
    (overrides: Record<string, string>) => {
      const sp = new URLSearchParams({
        ...(currentStatus ? { status: currentStatus } : {}),
        ...(currentGradingStatus ? { gradingStatus: currentGradingStatus } : {}),
        ...(currentSearch ? { search: currentSearch } : {}),
        ...overrides,
      });
      // Remove keys that are empty (reset filter)
      Array.from(sp.entries()).forEach(([k, v]) => { if (!v) sp.delete(k); });
      startTransition(() => router.push(`/admin/exams/${examId}/results?${sp.toString()}`));
    },
    [examId, currentStatus, currentGradingStatus, currentSearch, router]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <input
        type="search"
        placeholder="Search student name, ID or email…"
        defaultValue={currentSearch}
        onChange={(e) => navigate({ search: e.target.value, page: "1" })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-64"
      />

      {/* Status filter */}
      <select
        value={currentStatus ?? ""}
        onChange={(e) => navigate({ status: e.target.value, page: "1" })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Grading status filter */}
      <select
        value={currentGradingStatus ?? ""}
        onChange={(e) => navigate({ gradingStatus: e.target.value, page: "1" })}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {GRADING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Clear all */}
      {(currentStatus || currentGradingStatus || currentSearch) && (
        <button
          onClick={() => navigate({ status: "", gradingStatus: "", search: "", page: "1" })}
          className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
