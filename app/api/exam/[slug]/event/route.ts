import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTimerState } from "@/lib/exam/timer";

const TAB_VIOLATION_EVENTS = ["TAB_SWITCHED", "VISIBILITY_CHANGED"] as const;
const MAX_TAB_VIOLATIONS = 2;

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
      tabViolations: true,
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

  // Log event
  await db.examEvent.create({
    data: {
      attemptId,
      eventType,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  // Tab violation counting
  const isTabViolation = (TAB_VIOLATION_EVENTS as readonly string[]).includes(eventType);
  let newTabViolations = attempt.tabViolations;
  let autoSubmitted = false;

  if (isTabViolation) {
    newTabViolations = attempt.tabViolations + 1;

    if (newTabViolations >= MAX_TAB_VIOLATIONS) {
      // Auto-submit: exceeded violation limit
      await db.examAttempt.update({
        where: { id: attemptId },
        data: {
          tabViolations: newTabViolations,
          status: "SUBMITTED",
          submittedAt: now,
        },
      });
      await db.examEvent.create({
        data: {
          attemptId,
          eventType: "AUTO_SUBMITTED",
          metadata: { reason: "TAB_VIOLATION", violations: newTabViolations },
        },
      });
      autoSubmitted = true;
    } else {
      await db.examAttempt.update({
        where: { id: attemptId },
        data: { tabViolations: newTabViolations, lastActiveAt: now },
      });
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
    maxTabViolations: MAX_TAB_VIOLATIONS,
    autoSubmitted,
    remainingSeconds: timer.remainingSeconds,
    ...(autoSubmitted ? { status: "SUBMITTED" } : {}),
  });
}
