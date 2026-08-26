import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Exams" };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  PUBLISHED: { label: "Published", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CLOSED: { label: "Closed", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export default async function ExamsPage() {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const exams = await db.exam.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { id: true, name: true, code: true } },
      _count: { select: { questions: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {exams.length} exam{exams.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/exams/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          + New Exam
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No exams yet.</p>
          <Link href="/admin/exams/new" className="mt-4 inline-block text-sm text-primary hover:underline">
            Create your first exam →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Course</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Questions</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exams.map((exam) => {
                  const s = STATUS_MAP[exam.status] ?? STATUS_MAP.DRAFT;
                  return (
                    <tr key={exam.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs">
                        <Link href={`/admin/exams/${exam.id}`} className="hover:text-primary transition-colors">
                          {exam.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/courses/${exam.course.id}`}>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground hover:bg-muted/70 transition-colors">
                            {exam.course.code}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{exam.durationMinutes} min</td>
                      <td className="px-4 py-3 text-muted-foreground">{exam._count.questions}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {formatDate(exam.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/exams/${exam.id}`} className="text-xs text-primary hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
