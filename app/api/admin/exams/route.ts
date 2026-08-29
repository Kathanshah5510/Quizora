import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CreateExamSchema } from "@/lib/validation/exam";
import { generateExamSlug } from "@/lib/utils";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exams = await db.exam.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { id: true, name: true, code: true } },
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return NextResponse.json({ exams });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = CreateExamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const course = await db.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const slug = generateExamSlug(parsed.data.title);

  const exam = await db.exam.create({
    data: {
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      instructorName: parsed.data.instructorName,
      taNames: parsed.data.taNames ?? [],
      slug,
      durationMinutes: parsed.data.durationMinutes,
      timerMode: parsed.data.timerMode,
      perQuestionSeconds: parsed.data.perQuestionSeconds ?? null,
      attemptsAllowed: parsed.data.attemptsAllowed,
      randomizeQuestions: parsed.data.randomizeQuestions,
      randomizeOptions: parsed.data.randomizeOptions,
      allowBacktracking: parsed.data.allowBacktracking,
      allowExternalStudents: parsed.data.allowExternalStudents,
      continueAfterAvailability: parsed.data.continueAfterAvailability,
      fullScreenRequired: parsed.data.fullScreenRequired,
      defaultMarks: parsed.data.defaultMarks,
      defaultNegativeMarks: parsed.data.defaultNegativeMarks,
      msqGradingPolicy: parsed.data.msqGradingPolicy,
      numericalTolerance: parsed.data.numericalTolerance ?? null,
      textGradingMode: parsed.data.textGradingMode,
      resultRelease: parsed.data.resultRelease,
      availabilityStart: parsed.data.availabilityStart ? new Date(parsed.data.availabilityStart) : null,
      availabilityEnd: parsed.data.availabilityEnd ? new Date(parsed.data.availabilityEnd) : null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ exam }, { status: 201 });
}
