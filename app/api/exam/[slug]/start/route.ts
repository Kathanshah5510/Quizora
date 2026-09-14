import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkExamAccess } from "@/lib/exam/examAccess";
import { isValidStudentId, isValidStudentEmail } from "@/lib/exam/studentIdentity";
import { buildRandomizedOrders } from "@/lib/exam/randomize";
import { checkRateLimit } from "@/lib/exam/rateLimit";

const BodySchema = z.object({
  studentId: z.string().trim(),
  email: z.string().trim().toLowerCase(),
  name: z.string().trim().min(1),
  deviceFingerprint: z.string().optional(),
  // Present when reconnecting from the same browser tab/session (stored in sessionStorage).
  // If it matches the attempt's current sessionToken, the grace period is waived.
  resumeToken: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { studentId, email, name, deviceFingerprint, resumeToken } = body;

  // Rate limit keyed by studentId+slug so 130+ students from the same NAT/IP
  // (university lab, corporate network) each get their own independent bucket.
  // A single student is limited to 5 start attempts per minute; concurrent
  // students from the same IP never share a bucket and are never blocked by
  // each other. A loose IP-level guard covers unauthenticated pre-parse abuse.
  const ipRl = checkRateLimit(`start:ip:${ip ?? "unknown"}`, 600, 60); // 600/min per IP — prevents raw flood
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts from this network. Please wait.", retryAfterSeconds: ipRl.retryAfterSeconds },
      { status: 429 }
    );
  }
  const studentRl = checkRateLimit(`start:${studentId}:${slug}`, 5, 60); // 5/min per student per exam
  if (!studentRl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait.", retryAfterSeconds: studentRl.retryAfterSeconds },
      { status: 429 }
    );
  }

  // Identity format
  if (!isValidStudentId(studentId)) {
    return NextResponse.json(
      { error: "Student ID must be exactly 9 digits", code: "INVALID_STUDENT_ID" },
      { status: 422 }
    );
  }
  if (!isValidStudentEmail(email, studentId)) {
    return NextResponse.json(
      { error: `Email must be ${studentId}@dau.ac.in`, code: "INVALID_EMAIL" },
      { status: 422 }
    );
  }

  // All three lookups key off the slug rather than the exam's id, so they run
  // as one round trip instead of four sequential ones. Round trips dominate the
  // cost of this route whenever the database is a network hop from the function.
  const [exam, rosterEntry, existingAttempts] = await Promise.all([
    db.exam.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        availabilityStart: true,
        availabilityEnd: true,
        continueAfterAvailability: true,
        allowExternalStudents: true,
        attemptsAllowed: true,
        durationMinutes: true,
        timerMode: true,
        perQuestionSeconds: true,
        randomizeQuestions: true,
        randomizeOptions: true,
        allowBacktracking: true,
        reconnectGraceSeconds: true,
        maxTabViolations: true,
        isDeleted: true,
        questions: {
          where: { isDeleted: false },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            displayOrder: true,
            options: { select: { id: true }, orderBy: { displayOrder: "asc" } },
          },
        },
      },
    }),
    db.studentRoster.findFirst({
      where: { exam: { slug }, studentId },
      select: { id: true },
    }),
    db.examAttempt.findMany({
      where: { exam: { slug }, studentId },
      orderBy: { attemptNumber: "asc" },
      select: {
        id: true,
        status: true,
        attemptNumber: true,
        expiresAt: true,
        lastActiveAt: true,
        deviceFingerprint: true,
        sessionToken: true,
      },
    }),
  ]);

  if (!exam || exam.isDeleted) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const now = new Date();
  const access = checkExamAccess(
    {
      status: exam.status,
      availabilityStart: exam.availabilityStart,
      availabilityEnd: exam.availabilityEnd,
      continueAfterAvailability: exam.continueAfterAvailability,
    },
    now
  );

  if (access === "DRAFT") {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  if (access !== "ACCESSIBLE") {
    return NextResponse.json({ error: "Exam is not currently accessible", code: access }, { status: 403 });
  }

  // Roster check — the lookup above ran unconditionally so it could be
  // parallelised; the result is only consulted when the exam is roster-gated.
  if (!exam.allowExternalStudents && !rosterEntry) {
    return NextResponse.json(
      { error: "You are not registered for this exam", code: "NOT_ON_ROSTER" },
      { status: 403 }
    );
  }

  // Device locking: if an in-progress attempt exists, enforce one-device policy.
  // Uses the exam-configured grace period (default 30s).
  const RECONNECT_GRACE_SECONDS = exam.reconnectGraceSeconds;
  // Already present in existingAttempts — no separate query needed.
  const inProgressFull = existingAttempts.find((a) => a.status === "IN_PROGRESS") ?? null;

  if (inProgressFull) {
    const secondsSinceActive =
      (now.getTime() - inProgressFull.lastActiveAt.getTime()) / 1000;

    // If the caller presents the current session token (stored in their sessionStorage),
    // they are the same browser session — grant immediate reconnect, no grace period needed.
    const isSameBrowserSession =
      resumeToken != null &&
      inProgressFull.sessionToken != null &&
      resumeToken === inProgressFull.sessionToken;

    // A different device is actively using this attempt — deny reconnect
    if (!isSameBrowserSession && secondsSinceActive < RECONNECT_GRACE_SECONDS) {
      return NextResponse.json(
        {
          error: "Another device is currently active on this attempt. Please wait before reconnecting.",
          code: "DEVICE_LOCKED",
          retryAfterSeconds: Math.ceil(RECONNECT_GRACE_SECONDS - secondsSinceActive),
        },
        { status: 409 }
      );
    }

    // Grace period elapsed — allow reconnect; detect device change
    const deviceChanged =
      deviceFingerprint != null &&
      inProgressFull.deviceFingerprint != null &&
      deviceFingerprint !== inProgressFull.deviceFingerprint;

    const sessionToken = crypto.randomUUID();
    // The event is written as a nested create so the update and the log are a
    // single round trip.
    const updated = await db.examAttempt.update({
      where: { id: inProgressFull.id },
      data: {
        sessionToken,
        sessionTokenIssuedAt: now,
        lastActiveAt: now,
        deviceFingerprint: deviceFingerprint ?? inProgressFull.deviceFingerprint,
        ipAddress: ip,
        userAgent,
        events: {
          create: {
            eventType: deviceChanged ? "DEVICE_CHANGED" : "RECONNECTED",
            metadata: { ip, userAgent },
          },
        },
      },
    });

    return NextResponse.json({
      attemptId: updated.id,
      sessionToken,
      expiresAt: updated.expiresAt.toISOString(),
      isReconnect: true,
      deviceChanged,
    });
  }

  // Attempts exhausted?
  const completedCount = existingAttempts.length;
  if (completedCount >= exam.attemptsAllowed) {
    return NextResponse.json(
      { error: "You have used all allowed attempts for this exam", code: "ATTEMPTS_EXHAUSTED" },
      { status: 403 }
    );
  }

  const attemptNumber = completedCount + 1;

  // Questions came back with the exam above (ids only — never correct answers).
  const { questionOrder, optionOrders } = buildRandomizedOrders(
    exam.questions.map((q) => ({
      id: q.id,
      displayOrder: q.displayOrder,
      optionIds: q.options.map((o: { id: string }) => o.id),
    })),
    exam.randomizeQuestions,
    exam.randomizeOptions
  );

  // Server-authoritative expiry
  const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
  const sessionToken = crypto.randomUUID();

  // Create attempt — unique constraint on [examId, studentId, attemptNumber] provides
  // race-safety: concurrent requests will get a unique violation and one will fail.
  let attempt;
  try {
    attempt = await db.examAttempt.create({
      data: {
        examId: exam.id,
        studentId,
        studentName: name,
        studentEmail: email,
        attemptNumber,
        status: "IN_PROGRESS",
        startedAt: now,
        expiresAt,
        sessionToken,
        sessionTokenIssuedAt: now,
        lastActiveAt: now,
        deviceFingerprint: deviceFingerprint ?? null,
        randomizedQuestionOrder: questionOrder,
        randomizedOptionOrders: optionOrders,
        // Snapshot integrity settings so mid-exam admin changes don't affect active students
        maxTabViolationsSnapshot: exam.maxTabViolations,
        ipAddress: ip,
        userAgent,
        // Nested so the attempt and its STARTED event are one round trip.
        events: { create: { eventType: "STARTED", metadata: { ip, userAgent } } },
      },
    });
  } catch (err: unknown) {
    // Unique constraint violation → race condition; another request created the attempt
    if (
      err instanceof Error &&
      "code" in (err as unknown as Record<string, unknown>) &&
      (err as unknown as Record<string, unknown>).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Attempt already created — please refresh and try again", code: "RACE_CONFLICT" },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json(
    {
      attemptId: attempt.id,
      sessionToken,
      expiresAt: attempt.expiresAt.toISOString(),
      isReconnect: false,
    },
    { status: 201 }
  );
}
