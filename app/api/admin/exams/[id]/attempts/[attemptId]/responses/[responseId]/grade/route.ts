import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deriveGradingStatus,
  recalculateTotalScore,
} from "@/lib/results/resultDomain";
import type { PerQuestionMark } from "@/lib/results/resultDomain";

const GradeSchema = z.object({
  earnedMarks: z.number().min(0),
});

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; attemptId: string; responseId: string }>;
  }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, attemptId, responseId } = await params;

  const response = await db.studentResponse.findFirst({
    where: { id: responseId, attemptId },
    select: {
      id: true,
      questionId: true,
      textAnswer: true,
      attempt: {
        select: {
          examId: true,
          result: {
            select: {
              id: true,
              perQuestionMarks: true,
            },
          },
        },
      },
      question: {
        select: { marks: true, type: true },
      },
    },
  });

  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 });
  if (response.attempt.examId !== examId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (response.question.type !== "SHORT_TEXT") {
    return NextResponse.json(
      { error: "Only SHORT_TEXT questions support manual grading" },
      { status: 400 }
    );
  }

  const result = response.attempt.result;
  if (!result) {
    return NextResponse.json(
      { error: "Result record not found" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = GradeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { earnedMarks } = parsed.data;
  const maxMarks = Number(response.question.marks);

  if (earnedMarks > maxMarks) {
    return NextResponse.json(
      { error: `Earned marks cannot exceed ${maxMarks}` },
      { status: 400 }
    );
  }

  const perQ = (result.perQuestionMarks ?? {}) as unknown as Record<string, PerQuestionMark>;
  perQ[response.questionId] = {
    earned: earnedMarks,
    max: maxMarks,
    isCorrect: earnedMarks > 0,
    status: "graded",
  };

  const newTotalScore = recalculateTotalScore(perQ);
  const newGradingStatus = deriveGradingStatus(perQ);

  const perQJson = perQ as unknown as Parameters<
    typeof db.result.update
  >[0]["data"]["perQuestionMarks"];

  const updated = await db.result.update({
    where: { id: result.id },
    data: {
      perQuestionMarks: perQJson,
      totalScore: newTotalScore,
      gradingStatus: newGradingStatus,
    },
    select: {
      totalScore: true,
      maxScore: true,
      gradingStatus: true,
    },
  });

  return NextResponse.json({
    success: true,
    questionId: response.questionId,
    earnedMarks,
    gradingStatus: updated.gradingStatus,
    totalScore: Number(updated.totalScore),
    maxScore: Number(updated.maxScore),
  });
}
