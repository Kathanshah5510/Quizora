import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateNavigation } from "@/lib/exam/navigation";
import { computeTimerState } from "@/lib/exam/timer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: { attemptId?: string; sessionToken?: string; fromIndex?: number; toIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { attemptId, sessionToken, fromIndex, toIndex } = body;
  if (!attemptId || !sessionToken || fromIndex === undefined || toIndex === undefined) {
    return NextResponse.json(
      { error: "attemptId, sessionToken, fromIndex, and toIndex are required" },
      { status: 400 }
    );
  }

  if (
    typeof fromIndex !== "number" ||
    typeof toIndex !== "number" ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex)
  ) {
    return NextResponse.json({ error: "fromIndex and toIndex must be integers" }, { status: 400 });
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
      randomizedQuestionOrder: true,
      exam: { select: { allowBacktracking: true } },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Attempt is no longer active", status: attempt.status }, { status: 409 });
  }

  const now = new Date();
  const timer = computeTimerState(attempt.expiresAt, now);
  if (timer.isExpired) {
    await db.examAttempt.update({
      where: { id: attemptId },
      data: { status: "EXPIRED", submittedAt: attempt.expiresAt },
    });
    return NextResponse.json({ error: "Attempt has expired", status: "EXPIRED" }, { status: 409 });
  }

  const questionOrder = attempt.randomizedQuestionOrder as string[];
  const totalQuestions = questionOrder.length;

  const navError = validateNavigation({
    fromIndex,
    toIndex,
    totalQuestions,
    allowBacktracking: attempt.exam.allowBacktracking,
  });

  if (navError === "BACKWARD_NOT_ALLOWED") {
    return NextResponse.json(
      { error: "Backtracking is not allowed in this exam", code: "BACKWARD_NOT_ALLOWED" },
      { status: 403 }
    );
  }
  if (navError === "INDEX_OUT_OF_RANGE") {
    return NextResponse.json(
      { error: `Index ${toIndex} is out of range (total: ${totalQuestions})`, code: "INDEX_OUT_OF_RANGE" },
      { status: 400 }
    );
  }
  if (navError === "SAME_INDEX") {
    return NextResponse.json(
      { error: "fromIndex and toIndex are the same", code: "SAME_INDEX" },
      { status: 400 }
    );
  }

  // Navigation allowed — update heartbeat
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { lastActiveAt: now },
  });

  return NextResponse.json({
    allowed: true,
    toIndex,
    remainingSeconds: timer.remainingSeconds,
  });
}
