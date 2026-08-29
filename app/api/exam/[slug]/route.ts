import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkExamAccess } from "@/lib/exam/examAccess";

// Fields returned to students — never includes correct answers or admin-only data
const EXAM_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  instructorName: true,
  taNames: true,
  status: true,
  availabilityStart: true,
  availabilityEnd: true,
  durationMinutes: true,
  timerMode: true,
  perQuestionSeconds: true,
  attemptsAllowed: true,
  allowBacktracking: true,
  allowExternalStudents: true,
  fullScreenRequired: true,
  continueAfterAvailability: true,
  isDeleted: true,
  course: { select: { name: true, code: true } },
  _count: { select: { questions: true } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const exam = await db.exam.findUnique({
    where: { slug },
    select: EXAM_SELECT,
  });

  if (!exam || exam.isDeleted) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

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

  return NextResponse.json({ exam, access });
}
