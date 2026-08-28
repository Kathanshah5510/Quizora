import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  gradeTextWithAI,
  AIGradingNotConfiguredError,
  AIGradingError,
} from "@/lib/ai/gradeText";
import {
  deriveGradingStatus,
  recalculateTotalScore,
} from "@/lib/results/resultDomain";
import type { PerQuestionMark } from "@/lib/results/resultDomain";

type RouteParams = { params: Promise<{ id: string; attemptId: string; responseId: string }> };

// ─── POST — trigger AI grading ────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, attemptId, responseId } = await params;

  const response = await db.studentResponse.findFirst({
    where: { id: responseId, attemptId },
    select: {
      id: true,
      questionId: true,
      textAnswer: true,
      attempt: { select: { examId: true } },
      question: {
        select: { type: true, textAnswer: true, marks: true, text: true },
      },
    },
  });

  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 });
  if (response.attempt.examId !== examId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (response.question.type !== "SHORT_TEXT") {
    return NextResponse.json({ error: "AI grading only applies to SHORT_TEXT questions" }, { status: 400 });
  }

  try {
    const gradeResult = await gradeTextWithAI({
      questionText: response.question.text,
      expectedAnswer: response.question.textAnswer,
      studentAnswer: response.textAnswer ?? "",
      maxMarks: Number(response.question.marks),
    });

    const aiGrading = await db.aIGrading.upsert({
      where: { responseId: response.id },
      create: {
        responseId: response.id,
        aiScore: gradeResult.suggestedScore,
        aiRationale: gradeResult.rationale,
        aiModel: gradeResult.model,
        status: "PENDING_REVIEW",
      },
      update: {
        aiScore: gradeResult.suggestedScore,
        aiRationale: gradeResult.rationale,
        aiModel: gradeResult.model,
        status: "PENDING_REVIEW",
        adminApprovedScore: null,
        approvedAt: null,
        reviewedById: null,
      },
      select: {
        id: true,
        aiScore: true,
        aiRationale: true,
        aiModel: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      aiGradingId: aiGrading.id,
      suggestedScore: Number(aiGrading.aiScore),
      rationale: aiGrading.aiRationale,
      model: aiGrading.aiModel,
      status: aiGrading.status,
    });
  } catch (err) {
    if (err instanceof AIGradingNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AIGradingError) {
      return NextResponse.json({ error: `AI grading failed: ${err.message}` }, { status: 502 });
    }
    throw err;
  }
}

// ─── PATCH — approve / reject AI grade ───────────────────────────────────────

const ApproveSchema = z.union([
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("override"), score: z.number().min(0) }),
  z.object({ action: z.literal("reject") }),
]);

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, attemptId, responseId } = await params;

  const response = await db.studentResponse.findFirst({
    where: { id: responseId, attemptId },
    select: {
      id: true,
      questionId: true,
      attempt: {
        select: {
          examId: true,
          result: { select: { id: true, perQuestionMarks: true } },
        },
      },
      question: { select: { marks: true } },
      aiGrading: {
        select: {
          id: true,
          aiScore: true,
          status: true,
        },
      },
    },
  });

  if (!response) return NextResponse.json({ error: "Response not found" }, { status: 404 });
  if (response.attempt.examId !== examId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!response.aiGrading) {
    return NextResponse.json({ error: "No AI grading record found for this response" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { action } = parsed.data;
  const maxMarks = Number(response.question.marks);

  if (action === "reject") {
    await db.aIGrading.update({
      where: { id: response.aiGrading.id },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        approvedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, action: "rejected" });
  }

  // approve or override — compute the score to apply
  const earnedMarks =
    action === "override"
      ? Math.min(maxMarks, Math.max(0, parsed.data.score))
      : Math.min(maxMarks, Math.max(0, Number(response.aiGrading.aiScore)));

  // Update AIGrading record
  await db.aIGrading.update({
    where: { id: response.aiGrading.id },
    data: {
      status: "APPROVED",
      adminApprovedScore: earnedMarks,
      reviewedById: user.id,
      approvedAt: new Date(),
    },
  });

  // Apply grade to Result.perQuestionMarks
  const result = response.attempt.result;
  if (result) {
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

    await db.result.update({
      where: { id: result.id },
      data: {
        perQuestionMarks: perQJson,
        totalScore: newTotalScore,
        gradingStatus: newGradingStatus,
      },
    });
  }

  return NextResponse.json({
    success: true,
    action,
    earnedMarks,
    questionId: response.questionId,
  });
}
