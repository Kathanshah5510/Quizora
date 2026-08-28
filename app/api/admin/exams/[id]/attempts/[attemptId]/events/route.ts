import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, attemptId } = await params;

  // Scope attempt to this exam
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      studentEmail: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      tabViolations: true,
      ipAddress: true,
      userAgent: true,
      exam: { select: { title: true, course: { select: { code: true } } } },
    },
  });

  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  const events = await db.examEvent.findMany({
    where: { attemptId },
    orderBy: { recordedAt: "asc" },
    select: {
      id: true,
      eventType: true,
      metadata: true,
      recordedAt: true,
    },
  });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      studentId: attempt.studentId,
      studentName: attempt.studentName,
      studentEmail: attempt.studentEmail,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      tabViolations: attempt.tabViolations,
      ipAddress: attempt.ipAddress,
      userAgent: attempt.userAgent,
      examTitle: attempt.exam.title,
      courseCode: attempt.exam.course.code,
    },
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      metadata: e.metadata,
      recordedAt: e.recordedAt.toISOString(),
    })),
    totalEvents: events.length,
  });
}
