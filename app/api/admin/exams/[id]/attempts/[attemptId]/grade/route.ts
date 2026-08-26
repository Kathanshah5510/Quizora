import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { gradeAttempt, AttemptQuestionInput } from "@/lib/grading/gradeAttempt";
import type { ExamGradingSettings, QuestionData } from "@/lib/grading/gradeQuestion";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, attemptId } = await params;

  // Load attempt with its exam, questions, and responses
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId },
    include: {
      exam: {
        select: {
          msqGradingPolicy: true,
          numericalTolerance: true,
          textGradingMode: true,
        },
      },
      responses: {
        select: {
          questionId: true,
          selectedOptionIds: true,
          textAnswer: true,
          numericalAnswer: true,
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status === "IN_PROGRESS") {
    return NextResponse.json({ error: "Cannot grade an in-progress attempt" }, { status: 409 });
  }

  // Load questions for this exam (with correct option IDs)
  const questions = await db.question.findMany({
    where: { examId },
    select: {
      id: true,
      type: true,
      marks: true,
      negativeMarks: true,
      numericalAnswer: true,
      numericalTolerance: true,
      textAnswer: true,
      options: { select: { id: true, isCorrect: true } },
    },
  });

  const responseMap = new Map(
    attempt.responses.map((r) => [r.questionId, r])
  );

  const settings: ExamGradingSettings = {
    msqGradingPolicy: attempt.exam.msqGradingPolicy as ExamGradingSettings["msqGradingPolicy"],
    numericalTolerance:
      attempt.exam.numericalTolerance !== null
        ? Number(attempt.exam.numericalTolerance)
        : null,
    textGradingMode: attempt.exam.textGradingMode as ExamGradingSettings["textGradingMode"],
  };

  const inputs: AttemptQuestionInput[] = questions.map((q) => {
    const resp = responseMap.get(q.id) ?? null;
    const questionData: QuestionData = {
      type: q.type as QuestionData["type"],
      marks: Number(q.marks),
      negativeMarks: Number(q.negativeMarks),
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      numericalAnswer: q.numericalAnswer !== null ? Number(q.numericalAnswer) : null,
      numericalTolerance: q.numericalTolerance !== null ? Number(q.numericalTolerance) : null,
      textAnswer: q.textAnswer,
    };
    const responseData = resp
      ? {
          selectedOptionIds: Array.isArray(resp.selectedOptionIds)
            ? (resp.selectedOptionIds as string[])
            : null,
          textAnswer: resp.textAnswer,
          numericalAnswer:
            resp.numericalAnswer !== null ? Number(resp.numericalAnswer) : null,
        }
      : null;
    return { questionId: q.id, question: questionData, response: responseData };
  });

  const gradeResult = gradeAttempt(inputs, settings);

  // Upsert Result record
  // Cast to unknown→Prisma.InputJsonValue to satisfy Prisma's Json field type
  const perQuestionMarksJson = gradeResult.perQuestionMarks as unknown as Parameters<typeof db.result.upsert>[0]["create"]["perQuestionMarks"];

  const result = await db.result.upsert({
    where: { attemptId },
    create: {
      attemptId,
      totalScore: gradeResult.totalScore,
      maxScore: gradeResult.maxScore,
      gradingStatus: gradeResult.gradingStatus,
      perQuestionMarks: perQuestionMarksJson,
    },
    update: {
      totalScore: gradeResult.totalScore,
      maxScore: gradeResult.maxScore,
      gradingStatus: gradeResult.gradingStatus,
      perQuestionMarks: perQuestionMarksJson,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    resultId: result.id,
    totalScore: gradeResult.totalScore,
    maxScore: gradeResult.maxScore,
    gradingStatus: gradeResult.gradingStatus,
    perQuestionMarks: gradeResult.perQuestionMarks,
  });
}
