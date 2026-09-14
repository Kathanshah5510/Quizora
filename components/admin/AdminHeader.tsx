"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/(auth)/login/actions";
import ThemeToggle from "@/components/ThemeToggle";
import MobileMenuButton from "@/components/admin/MobileMenuButton";
import { Pending } from "@/components/Spinner";

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
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6">
      {/* Mobile hamburger — left side */}
      <MobileMenuButton role={user.role} />

      {/* Right side controls */}
      <div className="flex items-center gap-3 ml-auto">
        <ThemeToggle />
        <span className="hidden sm:block text-sm font-medium" style={{ color: "oklch(0.52 0.04 264)" }}>
          {user.name}
        </span>
        <button
          onClick={handleLogout}
          disabled={pending}
          className="btn-primary rounded-lg px-3 py-1.5 text-sm font-semibold"
        >
          {pending ? <Pending>Signing out…</Pending> : "Sign out"}
        </button>
      </div>
    </header>
  );
}
