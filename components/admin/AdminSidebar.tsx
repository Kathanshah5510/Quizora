"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
  },
  {
    label: "Courses",
    href: "/admin/courses",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
    ),
  },
  {
    label: "Exams",
    href: "/admin/exams",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Admins",
    href: "/admin/users",
    superAdminOnly: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/admin/profile",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    ),
  },
];

interface Props {
  role: "SUPER_ADMIN" | "ADMIN";
}

export default function AdminSidebar({ role }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "SUPER_ADMIN");

  return (
    <aside
      className="hidden md:flex w-56 flex-col"
      style={{ background: "oklch(0.11 0.03 264)" }}
    >
      {/* Brand */}
      <div
        className="flex h-14 items-center px-4"
        style={{ borderBottom: "1px solid oklch(1 0 0 / 0.08)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg font-black text-xs text-white flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, oklch(0.55 0.25 264), oklch(0.60 0.22 295))",
              boxShadow: "0 2px 8px oklch(0.51 0.22 264 / 0.5)",
            }}
          >
            Q
          </div>
          <span className="text-base font-bold text-white tracking-tight">Quizora</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                active ? "sidebar-link-active" : "sidebar-link"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role badge */}
      <div
        className="px-4 py-3"
        style={{ borderTop: "1px solid oklch(1 0 0 / 0.08)" }}
      >
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: "oklch(0.55 0.22 264 / 0.2)",
            color: "oklch(0.72 0.15 264)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "oklch(0.65 0.22 264)" }}
          />
          {role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
        </div>
      </div>
    </aside>
  );
}
