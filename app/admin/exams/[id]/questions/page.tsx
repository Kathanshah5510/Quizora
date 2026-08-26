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
    include: { options: { select: { isCorrect: true }, orderBy: { displayOrder: "asc" } } },
  });

  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const canEdit = exam.status !== "CLOSED";

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
            <Link
              href={`/admin/exams/${examId}/questions/new`}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              + Add Question
            </Link>
          )}
        </div>
      </div>

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
          }))}
          typeLabels={TYPE_LABELS}
          typeColors={TYPE_COLORS}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
