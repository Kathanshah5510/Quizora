/**
 * Server-side auto-grading: loads an attempt from the DB, runs the grading
 * engine, and upserts the Result record.
 *
 * Idempotent — safe to call multiple times for the same attempt (upsert).
 * Race-safe — upsert is a single atomic DB operation.
 * Call this after any status transition that terminates an attempt
 * (SUBMITTED or EXPIRED).
 */

import { db } from "@/lib/db";
import { gradeAttempt, type AttemptQuestionInput } from "./gradeAttempt";
import type { ExamGradingSettings, QuestionData } from "./gradeQuestion";

export interface AutoGradeResult {
  resultId: string;
  totalScore: number;
  maxScore: number;
  gradingStatus: "PENDING" | "PARTIAL" | "COMPLETE";
}

export async function autoGradeAttempt(
  attemptId: string
): Promise<AutoGradeResult | null> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      status: true,
      responses: {
        select: {
          questionId: true,
          selectedOptionIds: true,
          textAnswer: true,
          numericalAnswer: true,
        },
      },
      exam: {
        select: {
          msqGradingPolicy: true,
          numericalTolerance: true,
          textGradingMode: true,
        },
      },
    },
  });

  if (!attempt) return null;

  // Only grade terminal attempts — never grade an in-progress one
  if (attempt.status === "IN_PROGRESS" || attempt.status === "ABANDONED") {
    return null;
  }

  const questions = await db.question.findMany({
    where: { examId: attempt.examId },
    select: {
      id: true,
      type: true,
      text: true,
      marks: true,
      negativeMarks: true,
      numericalAnswer: true,
      numericalTolerance: true,
      textAnswer: true,
      options: { select: { id: true, isCorrect: true } },
    },
  });

  const responseMap = new Map(attempt.responses.map((r) => [r.questionId, r]));

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
      numericalTolerance:
        q.numericalTolerance !== null ? Number(q.numericalTolerance) : null,
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

  // ── AI-assisted grading for SHORT_TEXT ─────────────────────────────────────
  if (settings.textGradingMode === "AI_ASSISTED") {
    const { gradeTextWithAI } = await import("@/lib/ai/gradeText");
    const updatedPerQuestion = { ...gradeResult.perQuestionMarks };
    let aiScoreAdded = 0;

    for (const q of questions) {
      if (q.type !== "SHORT_TEXT") continue;
      if (updatedPerQuestion[q.id]?.status !== "pending") continue;
      const resp = responseMap.get(q.id);
      if (!resp?.textAnswer) continue;

      try {
        const ai = await gradeTextWithAI({
          questionText: q.text,
          expectedAnswer: q.textAnswer ?? null,
          studentAnswer: resp.textAnswer,
          maxMarks: Number(q.marks),
        });
        aiScoreAdded += ai.suggestedScore;
        updatedPerQuestion[q.id] = {
          earned: ai.suggestedScore,
          max: Number(q.marks),
          isCorrect: ai.suggestedScore >= Number(q.marks),
          status: "graded",
        };
      } catch {
        // AI call failed — leave question as pending for manual review
      }
    }

    gradeResult.perQuestionMarks = updatedPerQuestion;
    gradeResult.totalScore += aiScoreAdded;
    const pendingCount = Object.values(updatedPerQuestion).filter((r) => r.status === "pending").length;
    const gradedCount = Object.values(updatedPerQuestion).filter((r) => r.status !== "pending").length;
    gradeResult.gradingStatus = pendingCount === 0 ? "COMPLETE" : gradedCount === 0 ? "PENDING" : "PARTIAL";
  }

  const perQuestionMarksJson = gradeResult.perQuestionMarks as unknown as Parameters<
    typeof db.result.upsert
  >[0]["create"]["perQuestionMarks"];

  const result = await db.result.upsert({
    where: { attemptId },
    create: {
      attemptId,
      totalScore: gradeResult.totalScore,
      maxScore: gradeResult.maxScore,
      gradingStatus: gradeResult.gradingStatus,
      perQuestionMarks: perQuestionMarksJson,
      isReleased: false,
    },
    update: {
      totalScore: gradeResult.totalScore,
      maxScore: gradeResult.maxScore,
      gradingStatus: gradeResult.gradingStatus,
      perQuestionMarks: perQuestionMarksJson,
      updatedAt: new Date(),
    },
  });

  return {
    resultId: result.id,
    totalScore: gradeResult.totalScore,
    maxScore: gradeResult.maxScore,
    gradingStatus: gradeResult.gradingStatus,
  };
}
