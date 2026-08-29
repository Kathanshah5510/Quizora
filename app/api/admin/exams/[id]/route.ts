import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UpdateExamSchema } from "@/lib/validation/exam";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, name: true, code: true } },
      _count: { select: { questions: true, attempts: true, roster: true } },
    },
  });

  if (!exam || exam.isDeleted) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  return NextResponse.json({ exam });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = UpdateExamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam || exam.isDeleted) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (parsed.data.slug && parsed.data.slug !== exam.slug) {
    const existing = await db.exam.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const data = parsed.data;
  const updated = await db.exam.update({
    where: { id },
    data: {
      ...(data.courseId !== undefined && { courseId: data.courseId }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.instructorName !== undefined && { instructorName: data.instructorName }),
      ...(data.taNames !== undefined && { taNames: data.taNames }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.availabilityStart !== undefined && {
        availabilityStart: data.availabilityStart ? new Date(data.availabilityStart) : null,
      }),
      ...(data.availabilityEnd !== undefined && {
        availabilityEnd: data.availabilityEnd ? new Date(data.availabilityEnd) : null,
      }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.timerMode !== undefined && { timerMode: data.timerMode }),
      ...(data.perQuestionSeconds !== undefined && { perQuestionSeconds: data.perQuestionSeconds }),
      ...(data.attemptsAllowed !== undefined && { attemptsAllowed: data.attemptsAllowed }),
      ...(data.randomizeQuestions !== undefined && { randomizeQuestions: data.randomizeQuestions }),
      ...(data.randomizeOptions !== undefined && { randomizeOptions: data.randomizeOptions }),
      ...(data.allowBacktracking !== undefined && { allowBacktracking: data.allowBacktracking }),
      ...(data.allowExternalStudents !== undefined && { allowExternalStudents: data.allowExternalStudents }),
      ...(data.continueAfterAvailability !== undefined && { continueAfterAvailability: data.continueAfterAvailability }),
      ...(data.fullScreenRequired !== undefined && { fullScreenRequired: data.fullScreenRequired }),
      ...(data.defaultMarks !== undefined && { defaultMarks: data.defaultMarks }),
      ...(data.defaultNegativeMarks !== undefined && { defaultNegativeMarks: data.defaultNegativeMarks }),
      ...(data.msqGradingPolicy !== undefined && { msqGradingPolicy: data.msqGradingPolicy }),
      ...(data.numericalTolerance !== undefined && { numericalTolerance: data.numericalTolerance }),
      ...(data.textGradingMode !== undefined && { textGradingMode: data.textGradingMode }),
      ...(data.resultRelease !== undefined && { resultRelease: data.resultRelease }),
    },
  });

  return NextResponse.json({ exam: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exam = await db.exam.findUnique({ where: { id } });

  if (!exam || exam.isDeleted) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  await db.exam.update({ where: { id }, data: { isDeleted: true } });
  return NextResponse.json({ success: true });
}
