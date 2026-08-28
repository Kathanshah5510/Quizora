import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { buildResultSummary } from "@/lib/results/resultDomain";

export const metadata: Metadata = { title: "Attempt Review" };

const GRADING_MAP: Record<string, { label: string; cls: string }> = {
  COMPLETE: { label: "Graded",  cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PARTIAL:  { label: "Partial", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  PENDING:  { label: "Pending", cls: "bg-muted text-muted-foreground" },
};

const Q_GRADE_MAP: Record<string, { cls: string }> = {
  graded:  { cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  pending: { cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  skipped: { cls: "bg-muted text-muted-foreground" },
};

interface Props {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function AttemptReviewPage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId, attemptId } = await params;

  // Load attempt scoped by examId — prevents cross-exam access
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      studentEmail: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      expiresAt: true,
      submissionId: true,
      tabViolations: true,
      exam: {
        select: {
          id: true,
          title: true,
          durationMinutes: true,
          textGradingMode: true,
          course: { select: { code: true, name: true } },
        },
      },
      responses: {
        select: {
          questionId: true,
          selectedOptionIds: true,
          textAnswer: true,
          numericalAnswer: true,
        },
      },
      result: {
        select: {
          totalScore: true,
          maxScore: true,
          gradingStatus: true,
          isReleased: true,
          releasedAt: true,
          perQuestionMarks: true,
        },
      },
    },
  });

  if (!attempt) notFound();

  // Load questions ordered by displayOrder, with all options including correct flag
  // This data is admin-only — correct answers are never sent to students
  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      type: true,
      text: true,
      marks: true,
      negativeMarks: true,
      numericalAnswer: true,
      numericalTolerance: true,
      textAnswer: true,
      displayOrder: true,
      options: {
        orderBy: { displayOrder: "asc" },
        select: { id: true, text: true, isCorrect: true },
      },
    },
  });

  const responseMap = new Map(attempt.responses.map((r) => [r.questionId, r]));
  const perQ = (attempt.result?.perQuestionMarks ?? {}) as Record<
    string,
    { earned: number; max: number; isCorrect: boolean; status: string }
  >;

  const resultSummary = attempt.result ? buildResultSummary(attempt.result) : null;
  const durationMs = attempt.submittedAt
    ? attempt.submittedAt.getTime() - attempt.startedAt.getTime()
    : null;
  const durationMin = durationMs !== null ? Math.round(durationMs / 60000) : null;

  const gs = resultSummary ? GRADING_MAP[resultSummary.gradingStatus] : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link
          href={`/admin/exams/${examId}/results`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Results
        </Link>
        <h1 className="text-xl font-bold text-foreground mt-1">Attempt Review</h1>
      </div>

      {/* Student + Attempt Info */}
      <div className="rounded-xl border border-border bg-card px-6 py-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Student</p>
          <p className="font-medium text-foreground mt-0.5">{attempt.studentName}</p>
          <p className="text-xs text-muted-foreground font-mono">{attempt.studentId}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{attempt.studentEmail}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Exam</p>
          <p className="font-medium text-foreground mt-0.5">{attempt.exam.title}</p>
          <p className="text-xs text-muted-foreground">{attempt.exam.course.code}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Attempt</p>
          <p className="font-medium text-foreground mt-0.5">#{attempt.attemptNumber}</p>
          <p className="text-xs text-muted-foreground capitalize">{attempt.status.toLowerCase().replace("_", " ")}</p>
          {attempt.tabViolations > 0 && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
              {attempt.tabViolations} tab violation{attempt.tabViolations !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Started</p>
          <p className="text-sm text-foreground mt-0.5">{formatDateTime(attempt.startedAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Submitted</p>
          <p className="text-sm text-foreground mt-0.5">
            {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-sm text-foreground mt-0.5">
            {durationMin !== null ? `${durationMin} min` : "—"}
            <span className="text-muted-foreground"> / {attempt.exam.durationMinutes} min</span>
          </p>
        </div>
        {attempt.submissionId && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-muted-foreground">Submission ID</p>
            <p className="font-mono text-xs text-foreground mt-0.5">{attempt.submissionId}</p>
          </div>
        )}
      </div>

      {/* Score Summary */}
      {resultSummary ? (
        <div className="rounded-xl border border-border bg-card px-6 py-5 flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {resultSummary.totalScore.toFixed(2)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}/ {resultSummary.maxScore.toFixed(2)}
              </span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Percentage</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {resultSummary.percentage != null ? `${resultSummary.percentage.toFixed(1)}%` : "—"}
            </p>
          </div>
          {gs && (
            <div>
              <p className="text-xs text-muted-foreground">Grading Status</p>
              <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${gs.cls}`}>
                {gs.label}
              </span>
            </div>
          )}
          {resultSummary.gradingStatus !== "COMPLETE" && (
            <Link
              href={`/admin/exams/${examId}/results/${attemptId}/grade`}
              className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Grade Pending Questions →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-6 py-4 text-sm text-muted-foreground">
          No result record yet. The attempt may still be in progress or grading has not run.
        </div>
      )}

      {/* Per-question breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Question Responses</h2>
        {questions.map((q, idx) => {
          const resp = responseMap.get(q.id) ?? null;
          const grade = perQ[q.id] ?? null;
          const gradeInfo = grade ? Q_GRADE_MAP[grade.status] : null;
          const selectedIds = new Set(
            Array.isArray(resp?.selectedOptionIds) ? (resp!.selectedOptionIds as string[]) : []
          );

          return (
            <div key={q.id} className="rounded-xl border border-border bg-card px-6 py-5 space-y-3">
              {/* Question header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">Q{idx + 1}</span>
                    <span className="text-xs rounded bg-muted px-1.5 py-0.5 font-mono">{q.type}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">{q.text}</p>
                </div>
                <div className="shrink-0 text-right">
                  {grade ? (
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-semibold">
                        {grade.earned.toFixed(2)} / {grade.max.toFixed(2)}
                      </p>
                      {gradeInfo && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${gradeInfo.cls}`}>
                          {grade.status}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      — / {Number(q.marks).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Options (MCQ / MSQ / TRUE_FALSE / IMAGE_BASED) */}
              {q.options.length > 0 && (
                <div className="space-y-1.5 pl-2">
                  {q.options.map((opt) => {
                    const selected = selectedIds.has(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                          selected && opt.isCorrect
                            ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                            : selected && !opt.isCorrect
                            ? "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
                            : opt.isCorrect && !selected
                            ? "bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                            : "border border-transparent"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground w-4 shrink-0">
                          {selected ? "●" : "○"}
                        </span>
                        <span className={`flex-1 ${selected ? "font-medium" : ""} ${opt.isCorrect ? "text-foreground" : "text-muted-foreground"}`}>
                          {opt.text}
                        </span>
                        {opt.isCorrect && (
                          <span className="text-xs text-green-700 dark:text-green-400 font-medium shrink-0">correct</span>
                        )}
                        {selected && !opt.isCorrect && (
                          <span className="text-xs text-red-700 dark:text-red-400 font-medium shrink-0">wrong</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* NUMERICAL */}
              {q.type === "NUMERICAL" && (
                <div className="pl-2 space-y-1 text-sm">
                  <div className="flex gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Student answered: </span>
                      <span className={`font-mono font-medium ${resp?.numericalAnswer != null ? "text-foreground" : "text-muted-foreground"}`}>
                        {resp?.numericalAnswer != null ? Number(resp.numericalAnswer).toString() : "skipped"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Correct answer: </span>
                      <span className="font-mono font-medium text-green-700 dark:text-green-400">
                        {q.numericalAnswer != null ? Number(q.numericalAnswer).toString() : "—"}
                        {q.numericalTolerance != null && ` ±${Number(q.numericalTolerance)}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SHORT_TEXT */}
              {q.type === "SHORT_TEXT" && (
                <div className="pl-2 space-y-1 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Student answered: </span>
                    <span className={`font-medium ${resp?.textAnswer ? "text-foreground" : "text-muted-foreground"}`}>
                      {resp?.textAnswer || "skipped"}
                    </span>
                  </div>
                  {q.textAnswer && (
                    <div>
                      <span className="text-xs text-muted-foreground">Expected answer: </span>
                      <span className="font-medium text-green-700 dark:text-green-400">{q.textAnswer}</span>
                    </div>
                  )}
                  {grade?.status === "pending" && (
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      Requires manual grading
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
