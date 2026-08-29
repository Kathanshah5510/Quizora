import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";
const QuestionForm = dynamic(() => import("@/components/admin/QuestionForm"), {
  loading: () => <div className="animate-pulse rounded-xl bg-muted h-64" />,
});
import { createQuestionAction } from "../actions";

export const metadata: Metadata = { title: "New Question" };

export default async function NewQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, status: true, defaultMarks: true, defaultNegativeMarks: true },
  });
  if (!exam) redirect("/admin/exams");

  if (exam.status === "CLOSED") redirect(`/admin/exams/${examId}/questions`);

  const boundAction = createQuestionAction.bind(null, examId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link
            href={`/admin/exams/${examId}/questions`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            ← Back to Questions
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/exams" className="hover:text-foreground transition-colors">
            Exams
          </Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}`} className="hover:text-foreground transition-colors truncate max-w-[160px]">
            {exam.title}
          </Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}/questions`} className="hover:text-foreground transition-colors">
            Questions
          </Link>
          <span>/</span>
          <span className="text-foreground">New</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mt-3">Add Question</h1>
      </div>

      <QuestionForm
        examId={examId}
        defaultValues={{
          marks: Number(exam.defaultMarks),
          negativeMarks: Number(exam.defaultNegativeMarks),
        }}
        onSubmit={boundAction}
        submitLabel="Add Question"
      />
    </div>
  );
}
