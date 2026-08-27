import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";
import { checkRateLimit } from "@/lib/exam/rateLimit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attemptId");
  // Token is read only from the X-Session-Token header — never from URL query params
  const sessionToken = req.headers.get("x-session-token");

  if (!attemptId || !sessionToken) {
    return NextResponse.json(
      { error: "attemptId and X-Session-Token header are required" },
      { status: 400 }
    );
  }

  // Per-attempt rate limit: timer is polled every 30s; 10/min allows 5x the expected rate
  const rl = checkRateLimit(`timer:${attemptId}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many timer requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
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
    await db.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        status: "EXPIRED",
        submittedAt: attempt.expiresAt,
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
