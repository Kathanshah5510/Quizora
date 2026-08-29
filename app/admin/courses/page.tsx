import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, truncate } from "@/lib/utils";
import DeleteButton from "@/components/admin/DeleteButton";
import { deleteCourseAction } from "./actions";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const courses = await db.course.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { exams: true } },
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          + New Course
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No courses yet.</p>
          <Link
            href="/admin/courses/new"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Create your first course →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Description</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Exams</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/admin/courses/${course.id}`} className="hover:text-primary transition-colors">
                      {course.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground">
                      {course.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {course.description ? truncate(course.description, 60) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{course._count.exams}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        course.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {course.isActive ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {formatDate(course.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteButton
                        onDelete={deleteCourseAction.bind(null, course.id)}
                        confirmMessage={`Delete "${course.name}"? This hides the course from all lists. Associated exams are not affected.`}
                        label="Delete"
                        variant="ghost"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
