import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      durationMinutes: true,
      availabilityStart: true,
      availabilityEnd: true,
      course: { select: { code: true } },
      _count: { select: { roster: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const attempts = await db.examAttempt.findMany({
    where: { examId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      studentEmail: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      lastActiveAt: true,
      tabViolations: true,
      submissionId: true,
      ipAddress: true,
    },
  });

  // Counts
  const inProgressCount = attempts.filter((a) => a.status === "IN_PROGRESS").length;
  const submittedCount = attempts.filter((a) => a.status === "SUBMITTED").length;
  const expiredCount = attempts.filter((a) => a.status === "EXPIRED").length;
  const abandonedCount = attempts.filter((a) => a.status === "ABANDONED").length;
  const flaggedCount = attempts.filter((a) => a.tabViolations > 0).length;

  // Recent events across all attempts for this exam (last 30)
  const recentEvents = await db.examEvent.findMany({
    where: { attempt: { examId } },
    orderBy: { recordedAt: "desc" },
    take: 30,
    select: {
      id: true,
      eventType: true,
      metadata: true,
      recordedAt: true,
      attempt: {
        select: {
          id: true,
          studentName: true,
          studentId: true,
        },
      },
    },
  });

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      courseCode: exam.course.code,
      durationMinutes: exam.durationMinutes,
      availabilityStart: exam.availabilityStart?.toISOString() ?? null,
      availabilityEnd: exam.availabilityEnd?.toISOString() ?? null,
    },
    stats: {
      enrolled: exam._count.roster,
      totalAttempts: attempts.length,
      inProgress: inProgressCount,
      submitted: submittedCount,
      expired: expiredCount,
      abandoned: abandonedCount,
      flagged: flaggedCount,
      notStarted: Math.max(0, exam._count.roster - attempts.length),
    },
    attempts: attempts.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.studentName,
      studentEmail: a.studentEmail,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      lastActiveAt: a.lastActiveAt.toISOString(),
      tabViolations: a.tabViolations,
      submissionId: a.submissionId,
    })),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      metadata: e.metadata,
      recordedAt: e.recordedAt.toISOString(),
      studentName: e.attempt.studentName,
      studentId: e.attempt.studentId,
      attemptId: e.attempt.id,
    })),
    generatedAt: new Date().toISOString(),
  });
}
