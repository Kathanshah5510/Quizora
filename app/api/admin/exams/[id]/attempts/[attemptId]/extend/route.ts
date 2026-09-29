import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExamAccess } from "@/lib/courseAccess";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const { id: examId, attemptId } = await params;
  if (!(await requireExamAccess(examId))) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const minutes = Number(body.minutes);
  if (!minutes || !Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    return NextResponse.json({ error: "Minutes must be an integer between 1 and 120" }, { status: 400 });
  }

  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId, status: "IN_PROGRESS" },
    select: { id: true, expiresAt: true, studentName: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or not in progress" }, { status: 404 });
  }

  const newExpiresAt = new Date(attempt.expiresAt.getTime() + minutes * 60 * 1000);
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { expiresAt: newExpiresAt },
  });

  return NextResponse.json({
    success: true,
    newExpiresAt: newExpiresAt.toISOString(),
    studentName: attempt.studentName,
    minutesAdded: minutes,
  });
}
