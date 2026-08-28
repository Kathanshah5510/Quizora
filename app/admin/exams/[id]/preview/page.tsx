import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildRandomizedOrders } from "@/lib/exam/randomize";

export const metadata: Metadata = { title: "Exam Preview" };
export const dynamic = "force-dynamic"; // re-randomize on each load

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;
  const sp = await searchParams;
  const qParam = sp.q;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      description: true,
      instructorName: true,
      durationMinutes: true,
      timerMode: true,
      perQuestionSeconds: true,
      allowBacktracking: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      fullScreenRequired: true,
      course: { select: { code: true, name: true } },
    },
  });
  if (!exam) notFound();

  const rawQuestions = await db.question.findMany({
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
        select: { id: true, text: true, isCorrect: true, displayOrder: true },
      },
    },
  });

  if (rawQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-xl border border-border bg-card px-8 py-10 text-center max-w-md space-y-3">
          <p className="text-sm font-medium text-foreground">No questions added yet.</p>
          <p className="text-xs text-muted-foreground">Add questions before previewing this exam.</p>
          <Link
            href={`/admin/exams/${examId}/questions`}
            className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Manage Questions →
          </Link>
        </div>
      </div>
    );
  }

  // Build randomized order (server-side, not stored)
  const { questionOrder, optionOrders } = buildRandomizedOrders(
    rawQuestions.map((q) => ({
      id: q.id,
      displayOrder: q.displayOrder,
      optionIds: q.options.map((o) => o.id),
    })),
    exam.randomizeQuestions,
    exam.randomizeOptions
  );

  // Map questions by ID for O(1) access
  const questionById = new Map(rawQuestions.map((q) => [q.id, q]));

  // Ordered questions with randomized options
  const orderedQuestions = questionOrder.map((qId, idx) => {
    const q = questionById.get(qId)!;
    const orderedOptionIds = optionOrders[qId] ?? q.options.map((o) => o.id);
    const optionById = new Map(q.options.map((o) => [o.id, o]));
    return {
      ...q,
      index: idx,
      options: orderedOptionIds.map((oid) => optionById.get(oid)!).filter(Boolean),
    };
  });

  const totalQuestions = orderedQuestions.length;
  const currentIndex = Math.min(
    Math.max(0, qParam !== undefined ? parseInt(qParam, 10) : 0),
    totalQuestions - 1
  );

  const currentQ = orderedQuestions[currentIndex];
  const hasPrev = currentIndex > 0 && exam.allowBacktracking;
  const hasNext = currentIndex < totalQuestions - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner — always visible */}
      <div className="sticky top-0 z-50 bg-amber-500 dark:bg-amber-600 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-900 dark:text-amber-100 uppercase tracking-wide">
            PREVIEW MODE
          </span>
          <span className="text-xs text-amber-800 dark:text-amber-200">
            This is an admin preview — no attempt is created and no data is saved.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/exams/${examId}/preview`}
            className="rounded-md bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 transition-colors"
          >
            Re-randomize
          </Link>
          <Link
            href={`/admin/exams/${examId}`}
            className="rounded-md border border-amber-700 px-3 py-1 text-xs font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-600/30 transition-colors"
          >
            Exit Preview
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Exam header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">{exam.course.name} · {exam.instructorName}</p>
          {exam.description && (
            <p className="text-sm text-muted-foreground">{exam.description}</p>
          )}
        </div>

        {/* Simulated timer bar */}
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {exam.timerMode === "WHOLE_QUIZ"
                ? `${exam.durationMinutes} min total`
                : exam.perQuestionSeconds
                ? `${exam.perQuestionSeconds}s per question`
                : "No per-question timer set"}
            </span>
            {exam.allowBacktracking && (
              <span className="text-xs rounded bg-muted px-2 py-0.5">Backtracking ON</span>
            )}
            {exam.fullScreenRequired && (
              <span className="text-xs rounded bg-muted px-2 py-0.5">Full Screen Required</span>
            )}
          </div>
          <div className="font-mono text-sm font-medium text-foreground">
            Q {currentIndex + 1} / {totalQuestions}
          </div>
        </div>

        {/* Question navigator (if backtracking on) */}
        {exam.allowBacktracking && (
          <div className="flex flex-wrap gap-1.5">
            {orderedQuestions.map((_, i) => (
              <Link
                key={i}
                href={`/admin/exams/${examId}/preview?q=${i}`}
                className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-medium border transition-colors ${
                  i === currentIndex
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {i + 1}
              </Link>
            ))}
          </div>
        )}

        {/* Question card */}
        <div className="rounded-xl border border-border bg-card px-6 py-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">Q{currentIndex + 1}</span>
                <span className="text-xs rounded bg-muted px-1.5 py-0.5 font-mono">{currentQ.type}</span>
                <span className="text-xs text-muted-foreground">
                  {Number(currentQ.marks)} mark{Number(currentQ.marks) !== 1 ? "s" : ""}
                  {Number(currentQ.negativeMarks) > 0 && ` · -${Number(currentQ.negativeMarks)} negative`}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground">{currentQ.text}</p>
            </div>
          </div>

          {/* Answer area — display only, no interaction */}
          {currentQ.options.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">
                {currentQ.type === "MSQ" ? "Select all that apply:" : "Select one:"}
              </p>
              {currentQ.options.map((opt, i) => (
                <div
                  key={opt.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm cursor-default"
                >
                  <span className="w-5 h-5 flex items-center justify-center rounded-full border border-border text-xs text-muted-foreground shrink-0">
                    {currentQ.type === "MSQ" ? "□" : "○"}
                  </span>
                  <span className="text-foreground">{opt.text}</span>
                  {/* In preview, show correct answer for admin reference */}
                  {opt.isCorrect && (
                    <span className="ml-auto text-xs text-green-700 dark:text-green-400 font-medium shrink-0">
                      ✓ correct
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentQ.type === "NUMERICAL" && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">Enter numerical answer:</p>
              <div className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground italic">
                [Numerical input field]
              </div>
              {currentQ.numericalAnswer != null && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  Correct: {Number(currentQ.numericalAnswer)}
                  {currentQ.numericalTolerance != null && ` ±${Number(currentQ.numericalTolerance)}`}
                </p>
              )}
            </div>
          )}

          {currentQ.type === "SHORT_TEXT" && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">Enter your answer:</p>
              <div className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground italic min-h-[80px]">
                [Text input area]
              </div>
              {currentQ.textAnswer && (
                <p className="text-xs text-green-700 dark:text-green-400">
                  Expected: {currentQ.textAnswer}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          {hasPrev ? (
            <Link
              href={`/admin/exams/${examId}/preview?q=${currentIndex - 1}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              ← Previous
            </Link>
          ) : (
            <div />
          )}

          {!exam.allowBacktracking && !hasPrev && (
            <p className="text-xs text-muted-foreground">
              Backtracking OFF — students cannot go back
            </p>
          )}

          {hasNext ? (
            <Link
              href={`/admin/exams/${examId}/preview?q=${currentIndex + 1}`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Next →
            </Link>
          ) : (
            <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-default">
              Submit Exam (preview)
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Randomization: questions {exam.randomizeQuestions ? "ON" : "OFF"} ·
          options {exam.randomizeOptions ? "ON" : "OFF"} ·
          Reload page to re-randomize
        </p>
      </div>
    </div>
  );
}
