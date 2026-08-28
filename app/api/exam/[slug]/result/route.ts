import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildResultSummary, isResultVisibleToStudent } from "@/lib/results/resultDomain";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attemptId");
  const sessionToken = req.headers.get("x-session-token");

  if (!attemptId || !sessionToken) {
    return NextResponse.json(
      { error: "attemptId and X-Session-Token header are required" },
      { status: 400 }
    );
  }

  // Verify session — same pattern as all other exam routes
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, sessionToken, exam: { slug } },
    select: {
      id: true,
      status: true,
      studentId: true,
      studentName: true,
      startedAt: true,
      submittedAt: true,
      exam: {
        select: {
          title: true,
          resultRelease: true,
        },
      },
      result: {
        select: {
          totalScore: true,
          maxScore: true,
          gradingStatus: true,
          isReleased: true,
          releasedAt: true,
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  if (attempt.status === "IN_PROGRESS" || attempt.status === "ABANDONED") {
    return NextResponse.json(
      { error: "Results are available only after the exam is submitted" },
      { status: 400 }
    );
  }

  if (!attempt.result) {
    return NextResponse.json({ visible: false, reason: "GRADING_PENDING" });
  }

  const summary = buildResultSummary(attempt.result);
  const visible = isResultVisibleToStudent(
    attempt.exam.resultRelease as "AUTO" | "MANUAL",
    summary.gradingStatus,
    attempt.result.isReleased
  );

  if (!visible) {
    return NextResponse.json({
      visible: false,
      reason:
        attempt.exam.resultRelease === "AUTO"
          ? "GRADING_INCOMPLETE"
          : "NOT_RELEASED",
    });
  }

  return NextResponse.json({
    visible: true,
    examTitle: attempt.exam.title,
    studentName: attempt.studentName,
    studentId: attempt.studentId,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalScore: summary.totalScore,
    maxScore: summary.maxScore,
    percentage: summary.percentage,
    gradingStatus: summary.gradingStatus,
  });
}
