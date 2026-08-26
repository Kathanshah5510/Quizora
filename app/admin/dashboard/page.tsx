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

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [examCount, courseCount, userCount, recentExams] = await Promise.all([
    db.exam.count(),
    db.course.count(),
    db.user.count(),
    db.exam.findMany({
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Courses" value={courseCount} href="/admin/courses" />
        <StatCard label="Exams" value={examCount} href="/admin/exams" />
        {user?.role === "SUPER_ADMIN" && <StatCard label="Admins" value={userCount} href="/admin/users" />}
      </div>

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

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-5 hover:bg-muted/30 transition-colors block">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-card-foreground">{value}</p>
    </Link>
  );
}
