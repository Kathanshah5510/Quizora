"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/(auth)/login/actions";

interface Props {
  user: { name: string; email: string; role: string };
}

export default function AdminHeader({ user }: Props) {
  const [pending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(() => {
      logoutAction();
    });
  };

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b border-border bg-card px-6">
      <span className="hidden sm:block text-sm text-muted-foreground">{user.name}</span>
      <button
        onClick={handleLogout}
        disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </header>
  );
}
