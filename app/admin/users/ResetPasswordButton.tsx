"use client";

import { useState, useTransition } from "react";
import { resetAdminPasswordAction } from "./actions";
import { Pending } from "@/components/Spinner";

export default function ResetPasswordButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSet() {
    setError(null);
    startTransition(async () => {
      const result = await resetAdminPasswordAction(userId, password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setOpen(false);
        setPassword("");
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  if (success) {
    return <span className="text-xs text-green-600 dark:text-green-400">Password reset ✓</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
      >
        Reset Password
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1.5">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 8)"
        autoFocus
        className="rounded border border-border bg-background px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-ring"
        onKeyDown={(e) => {
          if (e.key === "Enter" && password.length >= 8) handleSet();
          if (e.key === "Escape") { setOpen(false); setPassword(""); setError(null); }
        }}
      />
      <span className="flex gap-1.5">
        <button
          type="button"
          onClick={handleSet}
          disabled={isPending || password.length < 8}
          className="rounded border border-border px-2 py-0.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isPending ? <Pending>Saving…</Pending> : "Set"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPassword(""); setError(null); }}
          className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </span>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
