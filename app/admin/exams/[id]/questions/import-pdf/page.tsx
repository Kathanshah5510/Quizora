import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import PdfImportClient from "./PdfImportClient";

export const metadata: Metadata = { title: "Import Questions from PDF" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ImportPdfPage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, status: true, course: { select: { code: true } } },
  });
  if (!exam) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div>
        <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <Link href="/admin/exams" className="hover:text-foreground transition-colors">Exams</Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}`} className="hover:text-foreground transition-colors">
            {exam.title}
          </Link>
          <span>/</span>
          <Link href={`/admin/exams/${examId}/questions`} className="hover:text-foreground transition-colors">
            Questions
          </Link>
          <span>/</span>
          <span className="text-foreground">Import from PDF</span>
        </nav>
        <h1 className="text-xl font-bold text-foreground mt-2">Import Questions from PDF</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {exam.course.code} · {exam.title}
        </p>
      </div>

      {exam.status === "CLOSED" && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          This exam is closed. Question import is not allowed.
        </div>
      )}

      {exam.status !== "CLOSED" && <PdfImportClient examId={examId} />}

      {/* Other import options */}
      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Other import options</p>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/exams/${examId}/questions/import`}
            className="text-sm text-primary hover:underline"
          >
            Import from CSV / Excel →
          </Link>
          <span className="text-border">|</span>
          <Link
            href={`/admin/exams/${examId}/questions/new`}
            className="text-sm text-primary hover:underline"
          >
            Add manually →
          </Link>
        </div>
      </div>
    </div>
  );
}
