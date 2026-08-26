"use client";

import { useActionState, useEffect, useRef } from "react";
import type { RosterActionState } from "@/app/admin/exams/[id]/roster/actions";

type Props = {
  action: (prev: RosterActionState, formData: FormData) => Promise<RosterActionState>;
};

const initial: RosterActionState = { error: "", success: false };

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

export default function RosterAddForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Student added to roster.
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="studentId" className="block text-sm font-medium text-foreground">
          Student ID <span className="text-destructive">*</span>
        </label>
        <input
          id="studentId"
          name="studentId"
          type="text"
          required
          pattern="\d{9}"
          placeholder="9-digit ID, e.g. 202301001"
          disabled={pending}
          className={inputCls}
          maxLength={9}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Full Name <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Rahul Sharma"
          disabled={pending}
          className={inputCls}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email <span className="text-destructive">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="202301001@dau.ac.in"
          disabled={pending}
          className={inputCls}
        />
        <p className="text-xs text-muted-foreground">Must match {`{studentId}@dau.ac.in`}</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {pending ? "Adding…" : "Add Student"}
      </button>
    </form>
  );
}
