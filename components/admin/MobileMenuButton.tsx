"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Exams", href: "/admin/exams" },
  { label: "Admins", href: "/admin/users", superAdminOnly: true },
  { label: "Profile", href: "/admin/profile" },
];

interface Props {
  role: "SUPER_ADMIN" | "ADMIN";
}

export default function MobileMenuButton({ role }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "SUPER_ADMIN");

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HamburgerIcon />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col md:hidden">
            {/* Brand + close */}
            <div className="flex h-14 items-center justify-between px-5 border-b border-border">
              <span className="text-lg font-bold text-foreground tracking-tight">Quizora</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 py-3 border-t border-border">
              <p className="px-3 text-xs text-muted-foreground">
                {role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
