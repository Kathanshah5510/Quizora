import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import RosterAddForm from "@/components/admin/RosterAddForm";
import RosterCsvUpload from "@/components/admin/RosterCsvUpload";
import RemoveStudentButton from "@/components/admin/RemoveStudentButton";
import { addStudentAction, uploadRosterCSVAction } from "./actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Exam Roster" };

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      allowExternalStudents: true,
      roster: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!exam) notFound();

  const boundAddStudent = addStudentAction.bind(null, exam.id);
  const boundUploadCSV = uploadRosterCSVAction.bind(null, exam.id);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link
            href={`/admin/exams/${exam.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            ← Back to Exam
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/exams" className="hover:text-foreground transition-colors">
            Exams
          </Link>
          <span>/</span>
          <Link href={`/admin/exams/${exam.id}`} className="hover:text-foreground transition-colors">
            {exam.title}
          </Link>
          <span>/</span>
          <span>Roster</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-2">Student Roster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {exam.roster.length} student{exam.roster.length !== 1 ? "s" : ""} enrolled
          {exam.allowExternalStudents && " · External students allowed (roster is optional)"}
        </p>
      </div>

      {exam.allowExternalStudents && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
          This exam allows external students. Any student with a valid 9-digit ID and{" "}
          <code>@dau.ac.in</code> email can attempt it, even if not on the roster.
        </div>
      )}

      {/* Add student + CSV upload */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Add Student</h2>
          <RosterAddForm action={boundAddStudent} />
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Import from CSV</h2>
          <RosterCsvUpload action={boundUploadCSV} />
        </div>
      </div>

      {/* Roster table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-card-foreground">
            Enrolled Students ({exam.roster.length})
          </h2>
        </div>

        {exam.roster.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No students on the roster yet. Add them individually or upload a CSV.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Added</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exam.roster.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-foreground">{student.studentId}</td>
                    <td className="px-4 py-3 text-foreground">{student.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{student.email}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {formatDate(student.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <RemoveStudentButton examId={exam.id} studentId={student.studentId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
