import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import QuestionForm from "@/components/admin/QuestionForm";
import QuestionDeleteButton from "./QuestionDeleteButton";
import { updateQuestionAction, deleteQuestionAction } from "../actions";

export const metadata: Metadata = { title: "Edit Question" };

const TYPE_LABELS: Record<string, string> = {
  MCQ: "Single Correct (MCQ)",
  MSQ: "Multiple Correct (MSQ)",
  TRUE_FALSE: "True / False",
  SHORT_TEXT: "Short Text",
  NUMERICAL: "Numerical",
  IMAGE_BASED: "Image-Based",
};

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string; questionId: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId, questionId } = await params;

  const [exam, question] = await Promise.all([
    db.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, status: true },
    }),
    db.question.findFirst({
      where: { id: questionId, examId },
      include: {
        options: { orderBy: { displayOrder: "asc" } },
        _count: { select: { responses: true } },
        mediaAsset: { select: { id: true, storageKey: true, filename: true } },
      },
    }),
  ]);

  if (!exam) redirect("/admin/exams");
  if (!question) notFound();

  const hasResponses = question._count.responses > 0;
  const isLocked = exam.status === "CLOSED" || hasResponses;

  const boundUpdate = updateQuestionAction.bind(null, examId, questionId);
  const boundDelete = deleteQuestionAction.bind(null, examId, questionId);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/admin/exams" className="hover:text-foreground transition-colors">Exams</Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}`} className="hover:text-foreground transition-colors truncate max-w-[140px]">
            {exam.title}
          </Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}/questions`} className="hover:text-foreground transition-colors">
            Questions
          </Link>
          <span>/</span>
          <span className="text-foreground">{TYPE_LABELS[question.type] ?? question.type}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mt-3">
          <h1 className="text-xl font-bold text-foreground">Edit Question</h1>
          {!isLocked && (
            <QuestionDeleteButton action={boundDelete} />
          )}
        </div>
      </div>

      {hasResponses && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          This question has student responses and cannot be edited.
        </div>
      )}

      {exam.status === "CLOSED" && !hasResponses && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          The exam is closed. Questions cannot be edited.
        </div>
      )}

      {!isLocked ? (
        <QuestionForm
          examId={examId}
          isEdit
          defaultValues={{
            type: question.type as Parameters<typeof QuestionForm>[0]["defaultValues"] extends { type?: infer T } ? T : never,
            text: question.text,
            marks: Number(question.marks),
            negativeMarks: Number(question.negativeMarks),
            options: question.options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              displayOrder: o.displayOrder,
            })),
            numericalAnswer: question.numericalAnswer !== null ? Number(question.numericalAnswer) : null,
            numericalTolerance: question.numericalTolerance !== null ? Number(question.numericalTolerance) : null,
            textAnswer: question.textAnswer,
            mediaAsset: question.mediaAsset
              ? {
                  id: question.mediaAsset.id,
                  url: `/${question.mediaAsset.storageKey}`,
                  filename: question.mediaAsset.filename,
                }
              : null,
          }}
          onSubmit={boundUpdate}
          submitLabel="Save Question"
        />
      ) : (
        <QuestionReadOnly question={question} />
      )}
    </div>
  );
}

function QuestionReadOnly({ question }: { question: { type: string; text: string; marks: unknown; negativeMarks: unknown; options: { text: string; isCorrect: boolean }[]; numericalAnswer: unknown; textAnswer: string | null } }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">{question.type.replace("_", " ")}</p>
        <p className="text-base text-foreground whitespace-pre-wrap">{question.text}</p>
        {question.options.length > 0 && (
          <ul className="mt-4 space-y-2">
            {question.options.map((o, i) => (
              <li key={i} className={`flex items-center gap-2 text-sm ${o.isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-foreground"}`}>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${o.isCorrect ? "border-green-500 bg-green-500" : "border-border"}`}>
                  {o.isCorrect && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {o.text}
              </li>
            ))}
          </ul>
        )}
        {question.numericalAnswer !== null && (
          <p className="mt-3 text-sm text-foreground">
            <span className="font-medium">Answer:</span> {String(question.numericalAnswer)}
          </p>
        )}
        {question.textAnswer && (
          <p className="mt-3 text-sm text-foreground">
            <span className="font-medium">Answer:</span> {question.textAnswer}
          </p>
        )}
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <span>Marks: {String(question.marks)}</span>
          <span>Negative: {String(question.negativeMarks)}</span>
        </div>
      </div>
    </div>
  );
}
