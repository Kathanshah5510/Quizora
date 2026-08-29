import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkExamAccess } from "@/lib/exam/examAccess";
import { isValidStudentId, isValidStudentEmail } from "@/lib/exam/studentIdentity";
import { checkRateLimit } from "@/lib/exam/rateLimit";

const BodySchema = z.object({
  studentId: z.string().trim(),
  email: z.string().trim().toLowerCase(),
  name: z.string().trim().min(1, "Name is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit: 10 validate attempts per IP per minute
  const rl = checkRateLimit(`validate:${ip}:${slug}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait.", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 }
    );
  }

  // Parse + validate request body
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { studentId, email, name } = body;

  // Identity format checks
  if (!isValidStudentId(studentId)) {
    return NextResponse.json(
      { error: "Student ID must be exactly 9 digits", code: "INVALID_STUDENT_ID" },
      { status: 422 }
    );
  }
  if (!isValidStudentEmail(email, studentId)) {
    return NextResponse.json(
      {
        error: `Email must be ${studentId}@dau.ac.in`,
        code: "INVALID_EMAIL",
      },
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
      isDeleted: true,
    },
  });

  if (!exam || exam.isDeleted) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  // Exam access check
  const access = checkExamAccess(
    {
      status: exam.status,
      availabilityStart: exam.availabilityStart,
      availabilityEnd: exam.availabilityEnd,
      continueAfterAvailability: exam.continueAfterAvailability,
    },
    new Date()
  );

  if (access === "DRAFT") {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  if (access !== "ACCESSIBLE") {
    return NextResponse.json({ error: "Exam is not currently accessible", code: access }, { status: 403 });
  }

  // Roster check (skip if external students allowed)
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

  // Attempt history check
  const existingAttempts = await db.examAttempt.findMany({
    where: { examId: exam.id, studentId },
    select: { id: true, status: true, attemptNumber: true },
    orderBy: { attemptNumber: "asc" },
  });

  // Check for an in-progress attempt
  const inProgress = existingAttempts.find((a) => a.status === "IN_PROGRESS");
  if (inProgress) {
    return NextResponse.json({
      eligible: true,
      hasActiveAttempt: true,
      attemptId: inProgress.id,
      studentId,
      name,
      email,
    });
  }

  // Check attempts exhausted
  const completedAttempts = existingAttempts.filter(
    (a) => a.status !== "IN_PROGRESS"
  ).length;
  if (completedAttempts >= exam.attemptsAllowed) {
    return NextResponse.json(
      { error: "You have used all allowed attempts for this exam", code: "ATTEMPTS_EXHAUSTED" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    eligible: true,
    hasActiveAttempt: false,
    attemptNumber: completedAttempts + 1,
    studentId,
    name,
    email,
  });
}
