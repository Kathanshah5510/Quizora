import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import QuestionImport from "@/components/admin/QuestionImport";

export const metadata: Metadata = { title: "Import Questions" };

export default async function ImportQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, status: true },
  });
  if (!exam) redirect("/admin/exams");
  if (exam.status === "CLOSED") redirect(`/admin/exams/${examId}/questions`);

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
          <Link href="/admin/exams" className="hover:text-foreground transition-colors">Exams</Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}`} className="hover:text-foreground transition-colors truncate max-w-[160px]">
            {exam.title}
          </Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}/questions`} className="hover:text-foreground transition-colors">
            Questions
          </Link>
          <span>/</span>
          <span className="text-foreground">Import from CSV</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mt-3">Import Questions from CSV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload any CSV or text file — AI extracts and normalizes questions regardless of column format.
        </p>
      </div>

      <QuestionImport examId={examId} />
    </div>
  );
}
