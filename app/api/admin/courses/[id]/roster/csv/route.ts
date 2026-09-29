import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { requireCourseAccess } from "@/lib/courseAccess";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await requireCourseAccess(id))) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const course = await db.course.findUnique({ where: { id }, select: { code: true } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const roster = await db.courseRoster.findMany({
    where: { courseId: id },
    orderBy: { createdAt: "asc" },
    select: { studentId: true, name: true, email: true, createdAt: true },
  });

  const lines = ["Student ID,Name,Email,Added", ...roster.map((s) =>
    `${s.studentId},${JSON.stringify(s.name)},${JSON.stringify(s.email)},${s.createdAt.toISOString().slice(0, 10)}`
  )];

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="course-roster-${course.code}.csv"`,
    },
  });
}
