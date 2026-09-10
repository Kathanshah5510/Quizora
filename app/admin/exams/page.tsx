import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import DeleteButton from "@/components/admin/DeleteButton";
import { deleteExamAction } from "./actions";

export const metadata: Metadata = { title: "Exams" };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: "Draft",     cls: "bg-muted text-muted-foreground" },
  PUBLISHED: { label: "Published", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ACTIVE:    { label: "Active",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CLOSED:    { label: "Closed",    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

interface Props {
  searchParams: Promise<{ status?: string; course?: string }>;
}

export default async function ExamsPage({ searchParams }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const statusFilter = sp.status;
  const courseFilter = sp.course;

  const [exams, courses] = await Promise.all([
    db.exam.findMany({
      where: {
        isDeleted: false,
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(courseFilter ? { courseId: courseFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    }),
    db.course.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const statuses = ["DRAFT", "PUBLISHED", "ACTIVE", "CLOSED"] as const;

  function filterHref(params: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (params.status) p.set("status", params.status);
    if (params.course) p.set("course", params.course);
    const str = p.toString();
    return `/admin/exams${str ? `?${str}` : ""}`;
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {exams.length} exam{exams.length !== 1 ? "s" : ""}
            {(statusFilter || courseFilter) && " matching filters"}
          </p>
        </div>
        <Link
          href="/admin/exams/new"
          className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold"
        >
          + New Exam
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <Link
            href={filterHref({ course: courseFilter })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              !statusFilter
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            All
          </Link>
          {statuses.map((s) => {
            const meta = STATUS_MAP[s];
            return (
              <Link
                key={s}
                href={filterHref({ status: s, course: courseFilter })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {meta.label}
              </Link>
            );
          })}
        </div>

        {/* Course filter */}
        {courses.length > 0 && (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 overflow-x-auto max-w-full">
            <Link
              href={filterHref({ status: statusFilter })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                !courseFilter
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All courses
            </Link>
            {courses.map((c) => (
              <Link
                key={c.id}
                href={filterHref({ status: statusFilter, course: c.id })}
                className={`rounded-md px-3 py-1.5 text-xs font-mono font-medium whitespace-nowrap transition-colors ${
                  courseFilter === c.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c.code}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {exams.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {statusFilter || courseFilter
              ? "No exams match the current filters."
              : "No exams yet."}
          </p>
          {!statusFilter && !courseFilter && (
            <Link href="/admin/exams/new" className="mt-4 inline-block text-sm text-primary hover:underline">
              Create your first exam →
            </Link>
          )}
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Duration</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qs</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Attempts</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Closes</th>
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
                        <Link href={`/admin/exams/${exam.id}`} className="hover:text-primary transition-colors line-clamp-1">
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
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {exam.durationMinutes} min
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {exam._count.questions}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {exam._count.attempts > 0 ? (
                          <Link
                            href={`/admin/exams/${exam.id}/results`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {exam._count.attempts}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                        {exam.availabilityEnd ? formatDate(exam.availabilityEnd) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {formatDate(exam.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link href={`/admin/exams/${exam.id}`} className="text-xs text-primary hover:underline">
                            Open
                          </Link>
                          <DeleteButton
                            onDelete={deleteExamAction.bind(null, exam.id)}
                            confirmMessage={`Delete "${exam.title}"? This will hide it from all lists. The data is preserved.`}
                            label="Delete"
                            variant="ghost"
                          />
                        </div>
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
