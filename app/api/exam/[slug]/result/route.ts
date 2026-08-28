import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildResultSummary, isResultVisibleToStudent } from "@/lib/results/resultDomain";
import type { PerQuestionMark } from "@/lib/results/resultDomain";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const attemptId = searchParams.get("attemptId");
  const sessionToken = req.headers.get("x-session-token");

  if (!attemptId || !sessionToken) {
    return NextResponse.json(
      { error: "attemptId and X-Session-Token header are required" },
      { status: 400 }
    );
  }

  // Verify session — same pattern as all other exam routes
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, sessionToken, exam: { slug } },
    select: {
      id: true,
      status: true,
      studentId: true,
      studentName: true,
      startedAt: true,
      submittedAt: true,
      submissionId: true,
      examId: true,
      exam: {
        select: {
          title: true,
          resultRelease: true,
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
    return NextResponse.json({ error: "Attempt not found or invalid session" }, { status: 404 });
  }

  if (attempt.status === "IN_PROGRESS" || attempt.status === "ABANDONED") {
    return NextResponse.json(
      { error: "Results are available only after the exam is submitted" },
      { status: 400 }
    );
  }

  if (!attempt.result) {
    return NextResponse.json({ visible: false, reason: "GRADING_PENDING" });
  }

  const summary = buildResultSummary(attempt.result);
  const visible = isResultVisibleToStudent(
    attempt.exam.resultRelease as "AUTO" | "MANUAL",
    summary.gradingStatus,
    attempt.result.isReleased
  );

  if (!visible) {
    return NextResponse.json({
      visible: false,
      reason:
        attempt.exam.resultRelease === "AUTO"
          ? "GRADING_INCOMPLETE"
          : "NOT_RELEASED",
    });
  }

  // Build per-question breakdown with correct answers (only sent when result is released)
  const questions = await db.question.findMany({
    where: { examId: attempt.examId },
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
        select: { id: true, text: true, isCorrect: true },
      },
    },
  });

  const responseMap = new Map(attempt.responses.map((r) => [r.questionId, r]));
  const perQ = (attempt.result.perQuestionMarks ?? {}) as unknown as Record<string, PerQuestionMark>;

  const questionBreakdown = questions.map((q) => {
    const resp = responseMap.get(q.id) ?? null;
    const grade = perQ[q.id] ?? null;

    return {
      questionId: q.id,
      type: q.type,
      text: q.text,
      displayOrder: q.displayOrder,
      marks: Number(q.marks),
      // Student's response
      selectedOptionIds: resp
        ? (Array.isArray(resp.selectedOptionIds)
            ? (resp.selectedOptionIds as string[])
            : null)
        : null,
      textAnswer: resp?.textAnswer ?? null,
      numericalAnswer: resp?.numericalAnswer != null ? Number(resp.numericalAnswer) : null,
      // Correct answer (only in released results — not during active exam)
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      correctNumericalAnswer: q.numericalAnswer != null ? Number(q.numericalAnswer) : null,
      correctNumericalTolerance: q.numericalTolerance != null ? Number(q.numericalTolerance) : null,
      expectedTextAnswer: q.textAnswer,
      // Options list for MCQ/MSQ display
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
      // Per-question grade
      earned: grade?.earned ?? null,
      maxForQuestion: grade?.max ?? Number(q.marks),
      isCorrect: grade?.isCorrect ?? null,
      gradingStatus: grade?.status ?? "pending",
    };
  });

  return NextResponse.json({
    visible: true,
    examTitle: attempt.exam.title,
    studentName: attempt.studentName,
    studentId: attempt.studentId,
    submissionId: attempt.submissionId,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    totalScore: summary.totalScore,
    maxScore: summary.maxScore,
    percentage: summary.percentage,
    gradingStatus: summary.gradingStatus,
    questions: questionBreakdown,
  });
}
