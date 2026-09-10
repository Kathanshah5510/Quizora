import { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  PUBLISHED: { label: "Published", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CLOSED: { label: "Closed", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const STAT_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))",
  "linear-gradient(135deg, oklch(0.45 0.20 295), oklch(0.52 0.22 320))",
  "linear-gradient(135deg, oklch(0.40 0.18 320), oklch(0.48 0.20 264))",
];

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [examCount, courseCount, userCount, liveExams, recentExams] = await Promise.all([
    db.exam.count({ where: { isDeleted: false } }),
    db.course.count({ where: { isDeleted: false } }),
    db.user.count({ where: { isActive: true } }),
    db.exam.findMany({
      where: { isDeleted: false, status: { in: ["ACTIVE", "PUBLISHED"] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        course: { select: { code: true } },
        _count: { select: { attempts: true } },
      },
    }),
    db.exam.findMany({
      where: { isDeleted: false },
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        course: { select: { code: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Stat cards */}
      <div className={`grid grid-cols-1 gap-4 ${user?.role === "SUPER_ADMIN" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <StatCard label="Courses" value={courseCount} href="/admin/courses" gradientIndex={0} />
        <StatCard label="Exams" value={examCount} href="/admin/exams" gradientIndex={1} />
        {user?.role === "SUPER_ADMIN" && (
          <StatCard label="Admins" value={userCount} href="/admin/users" gradientIndex={2} />
        )}
      </div>

      {/* Live / Published exams */}
      {liveExams.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.65 0.18 160 / 0.5)", background: "oklch(0.96 0.02 160 / 0.3)" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "oklch(0.65 0.18 160 / 0.3)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.55 0.18 160)" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "oklch(0.45 0.18 160)" }} />
            </span>
            <h2 className="text-sm font-semibold" style={{ color: "oklch(0.32 0.12 160)" }}>
              Live &amp; Published
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "oklch(0.65 0.18 160 / 0.2)" }}>
            {liveExams.map((exam) => {
              const isActive = exam.status === "ACTIVE";
              return (
                <div key={exam.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
                    style={
                      isActive
                        ? { background: "oklch(0.85 0.12 160 / 0.5)", color: "oklch(0.32 0.12 160)" }
                        : { background: "oklch(0.88 0.08 264 / 0.5)", color: "oklch(0.35 0.15 264)" }
                    }
                  >
                    {isActive ? "Active" : "Published"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{exam.course.code}</span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{exam.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {exam._count.attempts} attempt{exam._count.attempts !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive && (
                      <Link href={`/admin/exams/${exam.id}/monitor`} className="text-xs font-medium hover:underline" style={{ color: "oklch(0.42 0.16 160)" }}>
                        Monitor →
                      </Link>
                    )}
                    <Link href={`/admin/exams/${exam.id}/results`} className="text-xs text-primary hover:underline font-medium">
                      Results →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent exams */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-card-foreground">Recent Exams</h2>
          <Link href="/admin/exams" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>

        {recentExams.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No exams yet.{" "}
            <Link href="/admin/exams/new" className="text-primary hover:underline">
              Create the first exam →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Course</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Questions</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentExams.map((exam) => {
                const s = STATUS_MAP[exam.status] ?? STATUS_MAP.DRAFT;
                return (
                  <tr key={exam.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/admin/exams/${exam.id}`} className="hover:text-primary transition-colors">
                        {exam.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
                        {exam.course.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {exam._count.questions}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {formatDate(exam.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  gradientIndex,
}: {
  label: string;
  value: number;
  href: string;
  gradientIndex: number;
}) {
  const gradients = [
    "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))",
    "linear-gradient(135deg, oklch(0.45 0.20 295), oklch(0.52 0.22 320))",
    "linear-gradient(135deg, oklch(0.40 0.18 320), oklch(0.48 0.20 264))",
  ];
  const gradient = gradients[gradientIndex % gradients.length];

  return (
    <Link
      href={href}
      className="rounded-xl p-5 block group transition-transform hover:-translate-y-0.5"
      style={{
        background: gradient,
        boxShadow: "0 4px 20px oklch(0.51 0.22 264 / 0.3)",
      }}
    >
      <p className="text-sm font-medium text-white/80">{label}</p>
      <p className="mt-1 text-4xl font-black text-white">{value}</p>
    </Link>
  );
}
