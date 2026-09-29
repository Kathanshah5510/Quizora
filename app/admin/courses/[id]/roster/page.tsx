import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCourse } from "@/lib/courseAccess";
import RosterAddForm from "@/components/admin/RosterAddForm";
import RosterCsvUpload from "@/components/admin/RosterCsvUpload";
import RemoveCourseStudentButton from "./RemoveCourseStudentButton";
import { addCourseStudentAction, uploadCourseRosterCSVAction } from "./actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Course Roster" };

export default async function CourseRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!(await canAccessCourse(user, id))) notFound();

  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      roster: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!course) notFound();

  const boundAddStudent = addCourseStudentAction.bind(null, course.id);
  const boundUploadCSV = uploadCourseRosterCSVAction.bind(null, course.id);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <Link
            href={`/admin/courses/${course.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            ← Back to Course
          </Link>
          {course.roster.length > 0 && (
            <a
              href={`/api/admin/courses/${course.id}/roster/csv`}
              className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              Export CSV
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/admin/courses" className="hover:text-foreground transition-colors">
            Courses
          </Link>
          <span>/</span>
          <Link href={`/admin/courses/${course.id}`} className="hover:text-foreground transition-colors">
            {course.code}
          </Link>
          <span>/</span>
          <span>Roster</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-2">Course Roster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {course.roster.length} student{course.roster.length !== 1 ? "s" : ""} enrolled
        </p>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
        Students on this list are copied into every new exam's roster automatically when you create it.
        Editing this list doesn't change exams that already exist — use{" "}
        <span className="font-medium">Sync from course roster</span> on an individual exam's roster page for that.
      </div>

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
            Enrolled Students ({course.roster.length})
          </h2>
        </div>

        {course.roster.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No students on the course roster yet. Add them individually or upload a CSV.
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
                {course.roster.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-foreground">{student.studentId}</td>
                    <td className="px-4 py-3 text-foreground">{student.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{student.email}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {formatDate(student.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <RemoveCourseStudentButton courseId={course.id} studentId={student.studentId} />
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
