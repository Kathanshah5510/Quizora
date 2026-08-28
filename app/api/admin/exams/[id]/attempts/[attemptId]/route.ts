import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildResultSummary } from "@/lib/results/resultDomain";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, attemptId } = await params;

  // Scope by examId to prevent cross-exam access
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      studentEmail: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      expiresAt: true,
      submissionId: true,
      tabViolations: true,
      ipAddress: true,
      userAgent: true,
      exam: {
        select: {
          id: true,
          title: true,
          slug: true,
          durationMinutes: true,
          msqGradingPolicy: true,
          numericalTolerance: true,
          textGradingMode: true,
          resultRelease: true,
          course: { select: { code: true, name: true } },
        },
      },
      responses: {
        select: {
          questionId: true,
          selectedOptionIds: true,
          textAnswer: true,
          numericalAnswer: true,
          savedAt: true,
        },
      },
      result: {
        select: {
          totalScore: true,
          maxScore: true,
          gradingStatus: true,
          isReleased: true,
          releasedAt: true,
          perQuestionMarks: true,
        },
      },
    },
  });

  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  // Load questions with correct options (admin-only — never sent to students)
  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      type: true,
      text: true,
      marks: true,
      negativeMarks: true,
      numericalAnswer: true,
      numericalTolerance: true,
      textAnswer: true,
      displayOrder: true,
      options: {
        orderBy: { displayOrder: "asc" },
        select: { id: true, text: true, isCorrect: true, displayOrder: true },
      },
    },
  });

  const responseMap = new Map(attempt.responses.map((r) => [r.questionId, r]));
  const perQuestionMarks = (attempt.result?.perQuestionMarks ?? {}) as Record<
    string,
    { earned: number; max: number; isCorrect: boolean; status: string }
  >;

  const questionRows = questions.map((q) => {
    const resp = responseMap.get(q.id) ?? null;
    const grade = perQuestionMarks[q.id] ?? null;
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      displayOrder: q.displayOrder,
      marks: Number(q.marks),
      negativeMarks: Number(q.negativeMarks),
      // Correct answer — admin-only
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      numericalAnswer: q.numericalAnswer !== null ? Number(q.numericalAnswer) : null,
      numericalTolerance: q.numericalTolerance !== null ? Number(q.numericalTolerance) : null,
      textAnswer: q.textAnswer,
      options: q.options,
      // Student's response
      response: resp
        ? {
            selectedOptionIds: Array.isArray(resp.selectedOptionIds)
              ? (resp.selectedOptionIds as string[])
              : null,
            textAnswer: resp.textAnswer,
            numericalAnswer:
              resp.numericalAnswer !== null ? Number(resp.numericalAnswer) : null,
            savedAt: resp.savedAt.toISOString(),
          }
        : null,
      // Grading outcome for this question
      grade: grade
        ? { earned: grade.earned, max: grade.max, isCorrect: grade.isCorrect, status: grade.status }
        : null,
    };
  });

  const resultSummary = attempt.result ? buildResultSummary(attempt.result) : null;

  return NextResponse.json({
    id: attempt.id,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    studentEmail: attempt.studentEmail,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    expiresAt: attempt.expiresAt.toISOString(),
    submissionId: attempt.submissionId,
    tabViolations: attempt.tabViolations,
    exam: {
      ...attempt.exam,
      course: attempt.exam.course,
    },
    result: resultSummary,
    questions: questionRows,
  });
}
