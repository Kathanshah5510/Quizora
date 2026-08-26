import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkExamAccess } from "@/lib/exam/examAccess";
import { isValidStudentId, isValidStudentEmail } from "@/lib/exam/studentIdentity";
import { buildRandomizedOrders } from "@/lib/exam/randomize";

const BodySchema = z.object({
  studentId: z.string().trim(),
  email: z.string().trim().toLowerCase(),
  name: z.string().trim().min(1),
  deviceFingerprint: z.string().optional(),
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

  const { studentId, email, name, deviceFingerprint } = body;

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

  // Load exam
  const exam = await db.exam.findUnique({
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
    },
  });

  if (!exam) {
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

  // Roster check
  if (!exam.allowExternalStudents) {
    const rosterEntry = await db.studentRoster.findUnique({
      where: { examId_studentId: { examId: exam.id, studentId } },
    });
    if (!rosterEntry) {
      return NextResponse.json(
        { error: "You are not registered for this exam", code: "NOT_ON_ROSTER" },
        { status: 403 }
      );
    }
  }

  // Existing attempts for this student
  const existingAttempts = await db.examAttempt.findMany({
    where: { examId: exam.id, studentId },
    select: { id: true, status: true, attemptNumber: true, expiresAt: true },
    orderBy: { attemptNumber: "asc" },
  });

  // Reconnect: return existing in-progress attempt with fresh session token
  const inProgress = existingAttempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    const sessionToken = crypto.randomUUID();
    const updated = await db.examAttempt.update({
      where: { id: inProgress.id },
      data: {
        sessionToken,
        sessionTokenIssuedAt: now,
        lastActiveAt: now,
        deviceFingerprint: deviceFingerprint ?? null,
        ipAddress: ip,
        userAgent,
      },
    });
    return NextResponse.json({
      attemptId: updated.id,
      sessionToken,
      expiresAt: updated.expiresAt.toISOString(),
      isReconnect: true,
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

  // Load questions for randomization (never send correct answers)
  const questions = await db.question.findMany({
    where: { examId: exam.id },
    select: {
      id: true,
      displayOrder: true,
      options: { select: { id: true }, orderBy: { displayOrder: "asc" } },
    },
    orderBy: { displayOrder: "asc" },
  });

  const { questionOrder, optionOrders } = buildRandomizedOrders(
    questions.map((q) => ({
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
        ipAddress: ip,
        userAgent,
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
