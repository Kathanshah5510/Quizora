import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import CourseForm from "@/components/admin/CourseForm";
import CourseToggleButton from "./CourseToggleButton";
import { updateCourseAction } from "../actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Course" };

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      exams: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          availabilityStart: true,
          availabilityEnd: true,
          _count: { select: { questions: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  });

  if (!course) notFound();

  const boundUpdateAction = updateCourseAction.bind(null, course.id);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/courses"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Courses
          </Link>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold text-foreground">{course.name}</h1>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground">
              {course.code}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                course.isActive
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {course.isActive ? "Active" : "Archived"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created by {course.createdBy.name} · {formatDate(course.createdAt)}
          </p>
        </div>
        <CourseToggleButton courseId={course.id} isActive={course.isActive} />
      </div>

      {/* Edit form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-card-foreground mb-4">Edit Course</h2>
        <CourseForm
          action={boundUpdateAction}
          defaultValues={{
            name: course.name,
            code: course.code,
            description: course.description ?? "",
          }}
          submitLabel="Save Changes"
        />
      </div>

      {/* Exams in this course */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-card-foreground">
            Exams ({course.exams.length})
          </h2>
          <Link
            href={`/admin/exams/new?courseId=${course.id}`}
            className="text-sm text-primary hover:underline"
          >
            + Add Exam
          </Link>
        </div>
        {course.exams.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No exams in this course yet.{" "}
            <Link href={`/admin/exams/new?courseId=${course.id}`} className="text-primary hover:underline">
              Create the first exam →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Questions</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {course.exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{exam.title}</td>
                  <td className="px-4 py-3">
                    <ExamStatusBadge status={exam.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{exam._count.questions}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/exams/${exam.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ExamStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    PUBLISHED: { label: "Published", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    CLOSED: { label: "Closed", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
