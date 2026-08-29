"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  CreateQuestionSchema,
  UpdateQuestionSchema,
  ReorderQuestionsSchema,
} from "@/lib/validation/question";

export type QuestionActionResult = { error: string; success: false } | { error: null; success: true; questionId?: string };

async function getExamOrFail(examId: string) {
  return db.exam.findUnique({ where: { id: examId }, select: { id: true, status: true } });
}

export async function createQuestionAction(
  examId: string,
  data: unknown
): Promise<QuestionActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const exam = await getExamOrFail(examId);
  if (!exam) return { error: "Exam not found", success: false };
  if (exam.status === "CLOSED") return { error: "Cannot add questions to a closed exam", success: false };

  const parsed = CreateQuestionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const d = parsed.data;
  const maxOrder = await db.question.aggregate({
    where: { examId },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const question = await db.question.create({
    data: {
      examId,
      type: d.type,
      text: d.text,
      marks: d.marks,
      negativeMarks: d.negativeMarks,
      mediaAssetId: d.mediaAssetId ?? null,
      numericalAnswer: d.numericalAnswer ?? null,
      numericalTolerance: d.numericalTolerance ?? null,
      textAnswer: d.textAnswer ?? null,
      displayOrder,
      options: {
        create: d.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          displayOrder: opt.displayOrder,
          mediaAssetId: opt.mediaAssetId ?? null,
        })),
      },
    },
  });

  revalidatePath(`/admin/exams/${examId}/questions`);
  redirect(`/admin/exams/${examId}/questions`);
}

export async function updateQuestionAction(
  examId: string,
  questionId: string,
  data: unknown
): Promise<QuestionActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const existing = await db.question.findFirst({
    where: { id: questionId, examId, isDeleted: false },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) return { error: "Question not found", success: false };
  if (existing._count.responses > 0) {
    return { error: "Cannot edit a question that has student responses", success: false };
  }

  const parsed = UpdateQuestionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const d = parsed.data;

  await db.$transaction(async (tx) => {
    if (d.options !== undefined) {
      await tx.questionOption.deleteMany({ where: { questionId } });
    }
    await tx.question.update({
      where: { id: questionId },
      data: {
        ...(d.type !== undefined && { type: d.type }),
        ...(d.text !== undefined && { text: d.text }),
        ...(d.marks !== undefined && { marks: d.marks }),
        ...(d.negativeMarks !== undefined && { negativeMarks: d.negativeMarks }),
        ...(d.mediaAssetId !== undefined && { mediaAssetId: d.mediaAssetId }),
        ...(d.numericalAnswer !== undefined && { numericalAnswer: d.numericalAnswer }),
        ...(d.numericalTolerance !== undefined && { numericalTolerance: d.numericalTolerance }),
        ...(d.textAnswer !== undefined && { textAnswer: d.textAnswer }),
        ...(d.options !== undefined && {
          options: {
            create: d.options.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              displayOrder: opt.displayOrder,
              mediaAssetId: opt.mediaAssetId ?? null,
            })),
          },
        }),
      },
    });
  });

  revalidatePath(`/admin/exams/${examId}/questions`);
  revalidatePath(`/admin/exams/${examId}/questions/${questionId}`);
  return { error: null, success: true };
}

export async function deleteQuestionAction(
  examId: string,
  questionId: string
): Promise<QuestionActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const question = await db.question.findFirst({
    where: { id: questionId, examId, isDeleted: false },
    include: { _count: { select: { responses: true } } },
  });
  if (!question) return { error: "Question not found", success: false };
  if (question._count.responses > 0) {
    return { error: "Cannot delete a question that has student responses", success: false };
  }

  await db.question.update({ where: { id: questionId }, data: { isDeleted: true } });
  revalidatePath(`/admin/exams/${examId}/questions`);
  redirect(`/admin/exams/${examId}/questions`);
}

export async function duplicateQuestionAction(
  examId: string,
  questionId: string
): Promise<QuestionActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const source = await db.question.findFirst({
    where: { id: questionId, examId },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  });
  if (!source) return { error: "Question not found", success: false };

  const maxOrder = await db.question.aggregate({
    where: { examId },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const copy = await db.question.create({
    data: {
      examId,
      type: source.type,
      text: source.text + " (Copy)",
      marks: source.marks,
      negativeMarks: source.negativeMarks,
      mediaAssetId: source.mediaAssetId,
      numericalAnswer: source.numericalAnswer,
      numericalTolerance: source.numericalTolerance,
      textAnswer: source.textAnswer,
      displayOrder,
      options: {
        create: source.options.map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          displayOrder: o.displayOrder,
          mediaAssetId: o.mediaAssetId,
        })),
      },
    },
  });

  revalidatePath(`/admin/exams/${examId}/questions`);
  return { error: null, success: true, questionId: copy.id };
}

export async function reorderQuestionsAction(
  examId: string,
  data: unknown
): Promise<QuestionActionResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const parsed = ReorderQuestionsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message, success: false };

  const { questions } = parsed.data;

  const existingIds = await db.question.findMany({
    where: { examId },
    select: { id: true },
  });
  const existingIdSet = new Set(existingIds.map((q) => q.id));
  const invalid = questions.find((q) => !existingIdSet.has(q.id));
  if (invalid) return { error: `Question ${invalid.id} does not belong to this exam`, success: false };

  await db.$transaction(
    questions.map((q) =>
      db.question.update({ where: { id: q.id }, data: { displayOrder: q.displayOrder } })
    )
  );

  revalidatePath(`/admin/exams/${examId}/questions`);
  return { error: null, success: true };
}
