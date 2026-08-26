"use client";

import { useActionState } from "react";
import type { RosterCSVState } from "@/app/admin/exams/[id]/roster/actions";

type Props = {
  action: (prev: RosterCSVState, formData: FormData) => Promise<RosterCSVState>;
};

const initial: RosterCSVState = { error: "", success: false };

export default function RosterCsvUpload({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.success && state.stats && (
        <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400 space-y-1">
          <p className="font-medium">Import complete ({state.stats.total} rows processed)</p>
          <p>✓ {state.stats.added} student{state.stats.added !== 1 ? "s" : ""} added or updated</p>
          {state.stats.errors > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              ⚠ {state.stats.errors} row{state.stats.errors !== 1 ? "s" : ""} skipped due to validation errors
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="csv" className="block text-sm font-medium text-foreground">
          CSV File <span className="text-destructive">*</span>
        </label>
        <input
          id="csv"
          name="csv"
          type="file"
          accept=".csv,.txt"
          required
          disabled={pending}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70 disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          Format: <code className="font-mono bg-muted px-1 rounded">student_id,name,email</code> — one student per row, header row optional. Max 2 MB.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {pending ? "Uploading…" : "Upload CSV"}
      </button>
    </form>
  );
}
