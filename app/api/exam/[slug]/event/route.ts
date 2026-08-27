import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";
import { checkRateLimit } from "@/lib/exam/rateLimit";

const TAB_VIOLATION_EVENTS = ["TAB_SWITCHED", "VISIBILITY_CHANGED"] as const;

const BodySchema = z.object({
  attemptId: z.string(),
  sessionToken: z.string(),
  eventType: z.enum([
    "TAB_SWITCHED",
    "VISIBILITY_CHANGED",
    "FULLSCREEN_EXITED",
    "REFRESHED",
    "HEARTBEAT_MISSED",
    "WARNING_ISSUED",
  ]),
  metadata: z.record(z.unknown()).optional(),
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

  const { attemptId, sessionToken, eventType, metadata } = body;

  // Per-attempt rate limit: 20/min — prevents event spam while accommodating real-time monitoring
  const rl = checkRateLimit(`event:${attemptId}`, 20, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many event reports", retryAfterSeconds: rl.retryAfterSeconds },
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
      maxTabViolationsSnapshot: true, // Immutable snapshot from exam config at attempt creation
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
    await db.examAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status: "EXPIRED", submittedAt: attempt.expiresAt },
    });
    return NextResponse.json({ error: "Attempt has expired", status: "EXPIRED" }, { status: 409 });
  }

  // Log event
  await db.examEvent.create({
    data: {
      attemptId,
      eventType,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  const isTabViolation = (TAB_VIOLATION_EVENTS as readonly string[]).includes(eventType);
  let newTabViolations = 0;
  let autoSubmitted = false;

  if (isTabViolation) {
    // Atomic increment eliminates the TOCTOU race: each concurrent request receives
    // a distinct post-increment value from the database, so exactly one request
    // will observe the threshold being crossed.
    const updated = await db.examAttempt.update({
      where: { id: attemptId },
      data: { tabViolations: { increment: 1 }, lastActiveAt: now },
      select: { tabViolations: true },
    });
    newTabViolations = updated.tabViolations;

    if (newTabViolations >= attempt.maxTabViolationsSnapshot) {
      // Conditional update: only the request that first observes status=IN_PROGRESS
      // will actually transition to SUBMITTED. Concurrent requests get count=0 and
      // return autoSubmitted=true without double-writing the event.
      const submitResult = await db.examAttempt.updateMany({
        where: { id: attemptId, status: "IN_PROGRESS" },
        data: { status: "SUBMITTED", submittedAt: now },
      });

      if (submitResult.count > 0) {
        await db.examEvent.create({
          data: {
            attemptId,
            eventType: "AUTO_SUBMITTED",
            metadata: { reason: "TAB_VIOLATION", violations: newTabViolations } as Prisma.InputJsonValue,
          },
        });
      }
      autoSubmitted = true;
    }
  } else {
    await db.examAttempt.update({
      where: { id: attemptId },
      data: { lastActiveAt: now },
    });
  }

  return NextResponse.json({
    recorded: true,
    tabViolations: newTabViolations,
    maxTabViolations: attempt.maxTabViolationsSnapshot,
    autoSubmitted,
    remainingSeconds: timer.remainingSeconds,
    ...(autoSubmitted ? { status: "SUBMITTED" } : {}),
  });
}
