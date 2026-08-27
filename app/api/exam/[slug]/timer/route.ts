import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attemptId");
  // Accept token from header (preferred — never logged) or query param (legacy fallback)
  const sessionToken =
    req.headers.get("x-session-token") ?? searchParams.get("sessionToken");

  if (!attemptId || !sessionToken) {
    return NextResponse.json(
      { error: "attemptId and sessionToken are required" },
      { status: 400 }
    );
  }

  const attempt = await db.examAttempt.findFirst({
    where: {
      id: attemptId,
      sessionToken,
      exam: { slug },
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      exam: {
        select: {
          timerMode: true,
          perQuestionSeconds: true,
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  // Update lastActiveAt (heartbeat)
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { lastActiveAt: new Date() },
  });

  const now = new Date();
  const timer = computeTimerState(attempt.expiresAt, now);

  // Auto-submit if expired and still in progress
  if (timer.isExpired && attempt.status === "IN_PROGRESS") {
    await db.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: "EXPIRED",
        submittedAt: attempt.expiresAt, // Submission time = when it expired, not now
      },
    });

    return NextResponse.json({
      remainingSeconds: 0,
      isExpired: true,
      expiresAt: attempt.expiresAt.toISOString(),
      status: "EXPIRED",
      timerMode: attempt.exam.timerMode,
      perQuestionSeconds: attempt.exam.perQuestionSeconds ?? null,
    });
  }

  return NextResponse.json({
    remainingSeconds: timer.remainingSeconds,
    isExpired: timer.isExpired,
    expiresAt: attempt.expiresAt.toISOString(),
    status: attempt.status,
    timerMode: attempt.exam.timerMode,
    perQuestionSeconds: attempt.exam.perQuestionSeconds ?? null,
  });
}
