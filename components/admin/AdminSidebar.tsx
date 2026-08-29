"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Exams", href: "/admin/exams" },
  { label: "Admins", href: "/admin/users", superAdminOnly: true },
  { label: "Profile", href: "/admin/profile" },
];

interface Props {
  role: "SUPER_ADMIN" | "ADMIN";
}

export default function AdminSidebar({ role }: Props) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "SUPER_ADMIN");

  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex h-14 items-center px-5 border-b border-border">
        <span className="text-lg font-bold text-foreground tracking-tight">Quizora</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border">
        <p className="px-3 text-xs text-muted-foreground truncate">
          {role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
        </p>
      </div>
    </aside>
  );
}
