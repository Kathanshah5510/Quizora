import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import ExamForm from "@/components/admin/ExamForm";
import { createExamAction } from "../actions";

export const metadata: Metadata = { title: "New Exam" };

export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { courseId } = await searchParams;

  const courses = await db.course.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true },
  });

  if (courses.length === 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link href="/admin/exams" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Exams
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No active courses found.</p>
          <Link href="/admin/courses/new" className="mt-4 inline-block text-sm text-primary hover:underline">
            Create a course first →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/exams" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Exams
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">New Exam</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exam will be saved as a Draft. Publish it when ready.
        </p>
      </div>

      <ExamForm
        action={createExamAction}
        courses={courses}
        defaultValues={{ courseId, allowBacktracking: true, durationMinutes: 60, attemptsAllowed: 1, defaultMarks: 1, defaultNegativeMarks: 0 }}
        submitLabel="Create Exam"
      />
    </div>
  );
}
