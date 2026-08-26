"use client";

import { useActionState } from "react";
import type { CourseActionState } from "@/app/admin/courses/actions";

type Props = {
  action: (prev: CourseActionState, formData: FormData) => Promise<CourseActionState>;
  defaultValues?: { name?: string; code?: string; description?: string };
  submitLabel?: string;
};

const initialState: CourseActionState = { error: "", success: false };

export default function CourseForm({ action, defaultValues, submitLabel = "Save" }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Course saved successfully.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Course Name <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Machine Learning"
            defaultValue={defaultValues?.name}
            disabled={pending}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-sm font-medium text-foreground">
            Course Code <span className="text-destructive">*</span>
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            placeholder="e.g. IE403"
            defaultValue={defaultValues?.code}
            disabled={pending}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">Letters and numbers only. Automatically uppercased.</p>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Optional course description"
            defaultValue={defaultValues?.description}
            disabled={pending}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
