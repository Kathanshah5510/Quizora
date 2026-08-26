import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import QuestionReorderList from "./QuestionReorderList";

export const metadata: Metadata = { title: "Questions" };

const TYPE_LABELS: Record<string, string> = {
  MCQ: "MCQ",
  MSQ: "MSQ",
  TRUE_FALSE: "T/F",
  SHORT_TEXT: "Text",
  NUMERICAL: "Num",
  IMAGE_BASED: "Image",
};

const TYPE_FULL_LABELS: Record<string, string> = {
  MCQ: "Single Correct",
  MSQ: "Multi Correct",
  TRUE_FALSE: "True / False",
  SHORT_TEXT: "Short Text",
  NUMERICAL: "Numerical",
  IMAGE_BASED: "Image-Based",
};

const TYPE_COLORS: Record<string, string> = {
  MCQ: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MSQ: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  TRUE_FALSE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SHORT_TEXT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  NUMERICAL: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  IMAGE_BASED: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

export default async function QuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, status: true, defaultMarks: true },
  });
  if (!exam) redirect("/admin/exams");

  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { displayOrder: "asc" },
    include: {
      options: {
        select: { text: true, isCorrect: true, displayOrder: true },
        orderBy: { displayOrder: "asc" },
      },
      mediaAsset: { select: { storageKey: true } },
    },
  });

  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const canEdit = exam.status !== "CLOSED";

  // Type breakdown for summary card
  const typeCounts: Record<string, { count: number; marks: number }> = {};
  for (const q of questions) {
    if (!typeCounts[q.type]) typeCounts[q.type] = { count: 0, marks: 0 };
    typeCounts[q.type].count += 1;
    typeCounts[q.type].marks += Number(q.marks);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/exams" className="hover:text-foreground transition-colors">Exams</Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}`} className="hover:text-foreground transition-colors truncate max-w-[200px]">
            {exam.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">Questions</span>
        </div>
        <div className="flex items-center justify-between gap-4 mt-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Questions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalMarks} mark{totalMarks !== 1 ? "s" : ""} total
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Link
                href={`/admin/exams/${examId}/questions/import`}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                ↑ Import CSV
              </Link>
              <Link
                href={`/admin/exams/${examId}/questions/new`}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                + Add Question
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Summary card — only when questions exist */}
      {questions.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-card-foreground">Question Summary</p>
            <span className="text-xs text-muted-foreground">
              Order stored canonically — randomization is independent
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeCounts).map(([type, { count, marks }]) => (
              <div
                key={type}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${TYPE_COLORS[type] ?? "bg-muted text-muted-foreground"}`}
              >
                <span className="font-semibold">{count}</span>
                <span>{TYPE_FULL_LABELS[type] ?? type}</span>
                <span className="opacity-60">· {marks}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No questions yet.</p>
          {canEdit && (
            <Link
              href={`/admin/exams/${examId}/questions/new`}
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Add the first question →
            </Link>
          )}
        </div>
      ) : (
        <QuestionReorderList
          examId={examId}
          questions={questions.map((q) => ({
            id: q.id,
            type: q.type,
            text: q.text,
            marks: Number(q.marks),
            negativeMarks: Number(q.negativeMarks),
            displayOrder: q.displayOrder,
            optionCount: q.options.length,
            correctCount: q.options.filter((o) => o.isCorrect).length,
            options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
            numericalAnswer: q.numericalAnswer !== null ? Number(q.numericalAnswer) : null,
            numericalTolerance: q.numericalTolerance !== null ? Number(q.numericalTolerance) : null,
            textAnswer: q.textAnswer,
            mediaUrl: q.mediaAsset ? `/${q.mediaAsset.storageKey}` : null,
          }))}
          typeLabels={TYPE_LABELS}
          typeColors={TYPE_COLORS}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
