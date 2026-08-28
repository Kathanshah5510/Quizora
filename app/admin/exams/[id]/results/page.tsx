import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { buildResultSummary } from "@/lib/results/resultDomain";
import ResultsFilterBar from "./ResultsFilterBar";
import ReleaseToggle from "./ReleaseToggle";

export const metadata: Metadata = { title: "Results" };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  IN_PROGRESS: { label: "In Progress",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  SUBMITTED:   { label: "Submitted",    cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  EXPIRED:     { label: "Expired",      cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  ABANDONED:   { label: "Abandoned",    cls: "bg-muted text-muted-foreground" },
};

const GRADING_MAP: Record<string, { label: string; cls: string }> = {
  COMPLETE: { label: "Graded",   cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PARTIAL:  { label: "Partial",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  PENDING:  { label: "Pending",  cls: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 25;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; gradingStatus?: string; search?: string; page?: string }>;
}

export default async function ResultsPage({ params, searchParams }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;
  const sp = await searchParams;
  const statusFilter = sp.status;
  const gradingFilter = sp.gradingStatus;
  const search = sp.search?.trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, resultRelease: true, course: { select: { code: true, name: true } } },
  });
  if (!exam) notFound();

  const where = {
    examId,
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(gradingFilter ? { result: { gradingStatus: gradingFilter as never } } : {}),
    ...(search
      ? {
          OR: [
            { studentId: { contains: search, mode: "insensitive" as const } },
            { studentName: { contains: search, mode: "insensitive" as const } },
            { studentEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const anyReleased =
    exam.resultRelease === "MANUAL"
      ? (await db.result.count({ where: { attempt: { examId }, isReleased: true } })) > 0
      : false;

  const [total, attempts] = await Promise.all([
    db.examAttempt.count({ where }),
    db.examAttempt.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        studentId: true,
        studentName: true,
        studentEmail: true,
        attemptNumber: true,
        status: true,
        submittedAt: true,
        startedAt: true,
        result: {
          select: {
            totalScore: true,
            maxScore: true,
            gradingStatus: true,
            isReleased: true,
            releasedAt: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/admin/exams/${examId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {exam.title}
          </Link>
          <h1 className="text-xl font-bold text-foreground mt-1">Results</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {exam.course.code} · {total} attempt{total !== 1 ? "s" : ""}
            {" · Release: "}
            <span className="font-medium">{exam.resultRelease === "AUTO" ? "Automatic" : "Manual"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exam.resultRelease === "MANUAL" && (
            <ReleaseToggle examId={examId} anyReleased={anyReleased} />
          )}
          <Link
            href={`/api/admin/exams/${examId}/results/export`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
          >
            Export CSV
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ResultsFilterBar
        examId={examId}
        currentStatus={statusFilter}
        currentGradingStatus={gradingFilter}
        currentSearch={search}
      />

      {/* Table */}
      {attempts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {total === 0 ? "No attempts yet." : "No attempts match the current filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Grading</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Score</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">%</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attempts.map((a) => {
                  const st = STATUS_MAP[a.status] ?? STATUS_MAP.SUBMITTED;
                  const result = a.result ? buildResultSummary(a.result) : null;
                  const gs = result ? (GRADING_MAP[result.gradingStatus] ?? GRADING_MAP.PENDING) : null;

                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {a.studentName}
                        {a.attemptNumber > 1 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">#{a.attemptNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.studentId}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{a.studentEmail}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {gs ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${gs.cls}`}>
                            {gs.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {result
                          ? `${result.totalScore.toFixed(2)} / ${result.maxScore.toFixed(2)}`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {result?.percentage != null
                          ? `${result.percentage.toFixed(1)}%`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {a.submittedAt ? formatDateTime(a.submittedAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/exams/${examId}/results/${a.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`?${new URLSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), ...(gradingFilter ? { gradingStatus: gradingFilter } : {}), ...(search ? { search } : {}), page: String(page - 1) })}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`?${new URLSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), ...(gradingFilter ? { gradingStatus: gradingFilter } : {}), ...(search ? { search } : {}), page: String(page + 1) })}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
