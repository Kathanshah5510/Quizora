import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import CopyQuestionsClient from "./CopyQuestionsClient";

export const metadata: Metadata = { title: "Copy Questions" };

export default async function CopyQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: targetExamId } = await params;

  const targetExam = await db.exam.findUnique({
    where: { id: targetExamId },
    select: { id: true, title: true, status: true },
  });
  if (!targetExam || targetExam.status === "CLOSED") notFound();

  // All other non-deleted exams with at least 1 non-deleted question
  const sourceExams = await db.exam.findMany({
    where: { id: { not: targetExamId }, isDeleted: false },
    orderBy: [{ course: { code: "asc" } }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      course: { select: { code: true } },
      questions: {
        where: { isDeleted: false },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          type: true,
          text: true,
          marks: true,
          options: { select: { id: true }, where: {} },
        },
      },
    },
  });

  const exams = sourceExams
    .filter((e) => e.questions.length > 0)
    .map((e) => ({
      id: e.id,
      title: e.title,
      courseCode: e.course.code,
      questions: e.questions.map((q) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        marks: Number(q.marks),
        optionCount: q.options.length,
      })),
    }));

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link
            href={`/admin/exams/${targetExamId}/questions`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            ← Back to Questions
          </Link>
        </div>
        <h1 className="text-xl font-bold text-foreground">Copy Questions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Into <span className="font-medium text-foreground">{targetExam.title}</span>
        </p>
      </div>

      {exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No other exams with questions found. Create another exam with questions first.
          </p>
        </div>
      ) : (
        <CopyQuestionsClient targetExamId={targetExamId} exams={exams} />
      )}
    </div>
  );
}
