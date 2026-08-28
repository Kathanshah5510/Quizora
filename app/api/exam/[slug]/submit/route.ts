import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";
import { autoGradeAttempt } from "@/lib/grading/autoGradeAttempt";

const BodySchema = z.object({
  attemptId: z.string(),
  sessionToken: z.string(),
});

function generateSubmissionId(): string {
  // Format: QZ-YYYYMMDD-RANDOM8 — human-readable confirmation code
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `QZ-${date}-${rand}`;
}

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

  const { attemptId, sessionToken } = body;

  const attempt = await db.examAttempt.findFirst({
    where: {
      id: attemptId,
      sessionToken,
      exam: { slug },
    },
    select: {
      id: true,
      status: true,
      submissionId: true,
      submittedAt: true,
      expiresAt: true,
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  // Idempotent: already submitted/expired — return the authoritative stored state
  if (attempt.status === "SUBMITTED" || attempt.status === "EXPIRED") {
    return NextResponse.json({
      submitted: true,
      submissionId: attempt.submissionId,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      status: attempt.status,
    });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Attempt cannot be submitted", status: attempt.status }, { status: 409 });
  }

  const now = new Date();
  const timer = computeTimerState(attempt.expiresAt, now);

  // If already expired, record as EXPIRED instead of SUBMITTED
  if (timer.isExpired) {
    // Use updateMany with conditional status filter to avoid race with other expiry writers
    const expireResult = await db.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status: "EXPIRED", submittedAt: attempt.expiresAt },
    });
    await db.examEvent.create({
      data: {
        attemptId,
        eventType: "TIMER_EXPIRED",
        metadata: Prisma.JsonNull,
      },
    });
    // Auto-grade on expiry (idempotent — safe even if another path already graded)
    let gradingStatus: string | undefined;
    if (expireResult.count > 0) {
      try {
        const graded = await autoGradeAttempt(attemptId);
        gradingStatus = graded?.gradingStatus;
      } catch {
        // Grading failure must not fail the submission response
      }
    }
    return NextResponse.json({
      submitted: true,
      submissionId: null,
      submittedAt: attempt.expiresAt.toISOString(),
      status: "EXPIRED",
      ...(gradingStatus !== undefined ? { gradingStatus } : {}),
    });
  }

  // Generate a submission ID before the conditional update.
  // If another concurrent request wins the race, this value is discarded;
  // the student always receives the ID that is actually in the database.
  const submissionId = generateSubmissionId();

  // Atomic conditional update: only updates the row if it is still IN_PROGRESS.
  // PostgreSQL acquires a row lock on UPDATE; a concurrent request waits, then
  // re-evaluates the WHERE clause and gets count=0 if we already moved to SUBMITTED.
  const result = await db.examAttempt.updateMany({
    where: { id: attemptId, status: "IN_PROGRESS" },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      submissionId,
    },
  });

  if (result.count === 0) {
    // A concurrent request (manual submit, auto-submit, or tab-violation) already
    // transitioned this attempt. Read back the authoritative stored state.
    const existing = await db.examAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true, submissionId: true, submittedAt: true },
    });
    return NextResponse.json({
      submitted: true,
      submissionId: existing?.submissionId ?? null,
      submittedAt: existing?.submittedAt?.toISOString() ?? null,
      status: existing?.status ?? "SUBMITTED",
    });
  }

  await db.examEvent.create({
    data: {
      attemptId,
      eventType: "MANUALLY_SUBMITTED",
      metadata: Prisma.JsonNull,
    },
  });

  // Auto-grade synchronously so gradingStatus is available in the response
  let gradingStatus: string | undefined;
  try {
    const graded = await autoGradeAttempt(attemptId);
    gradingStatus = graded?.gradingStatus;
  } catch {
    // Grading failure must not fail the submission response
  }

  return NextResponse.json({
    submitted: true,
    submissionId,
    submittedAt: now.toISOString(),
    status: "SUBMITTED",
    ...(gradingStatus !== undefined ? { gradingStatus } : {}),
  });
}
