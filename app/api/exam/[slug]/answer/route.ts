import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";
import { checkRateLimit } from "@/lib/exam/rateLimit";

const BodySchema = z.object({
  attemptId: z.string(),
  sessionToken: z.string(),
  questionId: z.string(),
  // Exactly one of these should be populated depending on question type
  selectedOptionIds: z.array(z.string()).nullable().optional(),
  textAnswer: z.string().nullable().optional(),
  numericalAnswer: z.number().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { attemptId, sessionToken, questionId, selectedOptionIds, textAnswer, numericalAnswer } = body;

  // Per-attempt rate limit: 30/min — allows rapid answer cycling without blocking normal exam use
  const rl = checkRateLimit(`answer:${attemptId}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many answer submissions", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  // Validate session
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
      exam: { select: { id: true } },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Attempt is no longer active", status: attempt.status }, { status: 409 });
  }

  // Server-authoritative expiry check
  const now = new Date();
  const timer = computeTimerState(attempt.expiresAt, now);
  if (timer.isExpired) {
    await db.examAttempt.update({
      where: { id: attemptId },
      data: { status: "EXPIRED", submittedAt: attempt.expiresAt },
    });
    return NextResponse.json({ error: "Attempt has expired", status: "EXPIRED" }, { status: 409 });
  }

  // Verify the question belongs to this exam
  const question = await db.question.findFirst({
    where: { id: questionId, examId: attempt.exam.id },
    select: { id: true, type: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found in this exam" }, { status: 404 });
  }

  // Prisma Json fields require Prisma.JsonNull (not JS null) to store null
  const selectedOptionIdsJson =
    selectedOptionIds == null ? Prisma.JsonNull : selectedOptionIds;

  // Upsert answer — idempotent; retries are safe
  const response = await db.studentResponse.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: {
      attemptId,
      questionId,
      selectedOptionIds: selectedOptionIdsJson,
      textAnswer: textAnswer ?? null,
      numericalAnswer: numericalAnswer ?? null,
    },
    update: {
      selectedOptionIds: selectedOptionIdsJson,
      textAnswer: textAnswer ?? null,
      numericalAnswer: numericalAnswer ?? null,
      updatedAt: now,
    },
    select: { id: true, savedAt: true, updatedAt: true },
  });

  // Update heartbeat
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { lastActiveAt: now },
  });

  return NextResponse.json({
    saved: true,
    responseId: response.id,
    savedAt: response.updatedAt.toISOString(),
    remainingSeconds: timer.remainingSeconds,
  });
}
