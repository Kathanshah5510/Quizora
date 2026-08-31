"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/(auth)/login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import MobileMenuButton from "@/components/admin/MobileMenuButton";

interface Props {
  user: { name: string; email: string; role: "SUPER_ADMIN" | "ADMIN" };
}

export default function AdminHeader({ user }: Props) {
  const [pending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(() => {
      logoutAction();
    });
  };

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      {/* Mobile hamburger — left side */}
      <MobileMenuButton role={user.role} />

      {/* Right side controls */}
      <div className="flex items-center gap-2 ml-auto">
        <ThemeToggle />
        <span className="hidden sm:block text-sm text-muted-foreground">{user.name}</span>
        <button
          onClick={handleLogout}
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
