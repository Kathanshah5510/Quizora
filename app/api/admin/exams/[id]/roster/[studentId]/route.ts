import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, studentId } = await params;
  const deleted = await db.studentRoster.deleteMany({
    where: { examId: id, studentId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Student not found on roster" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
