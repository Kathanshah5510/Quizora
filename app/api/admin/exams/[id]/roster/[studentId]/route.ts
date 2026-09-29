import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExamAccess } from "@/lib/courseAccess";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id, studentId } = await params;
  if (!(await requireExamAccess(id))) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const deleted = await db.studentRoster.deleteMany({
    where: { examId: id, studentId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Student not found on roster" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
