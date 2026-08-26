import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import CourseForm from "@/components/admin/CourseForm";
import { createCourseAction } from "../actions";

export const metadata: Metadata = { title: "New Course" };

export default async function NewCoursePage() {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/courses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Courses
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">New Course</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <CourseForm action={createCourseAction} submitLabel="Create Course" />
      </div>
    </div>
  );
}
