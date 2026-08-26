import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";

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
      exam: {
        select: {
          resultRelease: true,
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  // Idempotent: already submitted
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
    await db.examAttempt.update({
      where: { id: attemptId },
      data: { status: "EXPIRED", submittedAt: attempt.expiresAt },
    });
    await db.examEvent.create({
      data: {
        attemptId,
        eventType: "TIMER_EXPIRED",
        metadata: Prisma.JsonNull,
      },
    });
    return NextResponse.json({
      submitted: true,
      submissionId: null,
      submittedAt: attempt.expiresAt.toISOString(),
      status: "EXPIRED",
    });
  }

  const submissionId = generateSubmissionId();

  await db.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      submittedAt: now,
      submissionId,
    },
  });

  await db.examEvent.create({
    data: {
      attemptId,
      eventType: "MANUALLY_SUBMITTED",
      metadata: Prisma.JsonNull,
    },
  });

  return NextResponse.json({
    submitted: true,
    submissionId,
    submittedAt: now.toISOString(),
    status: "SUBMITTED",
  });
}
