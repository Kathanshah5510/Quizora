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
  const indexParam = searchParams.get("index"); // 0-based position in randomized order

  if (!attemptId || !sessionToken) {
    return NextResponse.json(
      { error: "attemptId and X-Session-Token header are required" },
      { status: 400 }
    );
  }

  const index = indexParam !== null ? parseInt(indexParam, 10) : 0;
  if (isNaN(index) || index < 0) {
    return NextResponse.json({ error: "index must be a non-negative integer" }, { status: 400 });
  }

  // Per-attempt rate limit: 30/min — generous for navigation but blocks hammering
  const rl = checkRateLimit(`question:${attemptId}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many question requests", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  // Load attempt — verify session token and slug together
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
      randomizedOptionOrders: true,
      exam: {
        select: {
          id: true,
          allowBacktracking: true,
          timerMode: true,
          perQuestionSeconds: true,
          fullScreenRequired: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  // Check attempt is still active
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Attempt is no longer active", status: attempt.status }, { status: 409 });
  }

  // Check timer — auto-expire if needed
  const now = new Date();
  const timer = computeTimerState(attempt.expiresAt, now);
  if (timer.isExpired) {
    await db.examAttempt.update({
      where: { id: attemptId },
      data: { status: "EXPIRED", submittedAt: attempt.expiresAt },
    });
    return NextResponse.json({ error: "Attempt has expired", status: "EXPIRED" }, { status: 409 });
  }

  // Resolve question ID from randomized order
  const questionOrder = attempt.randomizedQuestionOrder as string[];
  const totalQuestions = questionOrder.length;

  if (index >= totalQuestions) {
    return NextResponse.json(
      { error: `Index ${index} out of range (total: ${totalQuestions})` },
      { status: 400 }
    );
  }

  const questionId = questionOrder[index];

  // Load question — NEVER include isCorrect, textAnswer, numericalAnswer
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      type: true,
      text: true,
      marks: true,
      negativeMarks: true,
      mediaAsset: { select: { storageKey: true, filename: true } },
      options: {
        select: {
          id: true,
          text: true,
          mediaAsset: { select: { storageKey: true, filename: true } },
          // isCorrect intentionally excluded
        },
      },
      // textAnswer, numericalAnswer intentionally excluded
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Apply server-stored option randomization order
  const optionOrders = attempt.randomizedOptionOrders as Record<string, string[]>;
  const orderedOptionIds = optionOrders[questionId] ?? question.options.map((o) => o.id);
  const optionMap = new Map(question.options.map((o) => [o.id, o]));
  const orderedOptions = orderedOptionIds
    .map((id) => optionMap.get(id))
    .filter(Boolean)
    .map((o) => ({
      id: o!.id,
      text: o!.text,
      mediaUrl: o!.mediaAsset ? `/${o!.mediaAsset.storageKey}` : null,
    }));

  // Load student's saved response for this question (if any)
  const savedResponse = await db.studentResponse.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    select: {
      selectedOptionIds: true,
      textAnswer: true,
      numericalAnswer: true,
    },
  });

  return NextResponse.json({
    question: {
      id: question.id,
      type: question.type,
      text: question.text,
      marks: Number(question.marks),
      negativeMarks: Number(question.negativeMarks),
      mediaUrl: question.mediaAsset ? `/${question.mediaAsset.storageKey}` : null,
      options: orderedOptions,
    },
    index,
    totalQuestions,
    allowBacktracking: attempt.exam.allowBacktracking,
    remainingSeconds: timer.remainingSeconds,
    timerMode: attempt.exam.timerMode,
    perQuestionSeconds: attempt.exam.perQuestionSeconds ?? null,
    fullScreenRequired: attempt.exam.fullScreenRequired,
    savedResponse: savedResponse
      ? {
          selectedOptionIds: savedResponse.selectedOptionIds ?? null,
          textAnswer: savedResponse.textAnswer ?? null,
          numericalAnswer:
            savedResponse.numericalAnswer !== null
              ? Number(savedResponse.numericalAnswer)
              : null,
        }
      : null,
  });
}
