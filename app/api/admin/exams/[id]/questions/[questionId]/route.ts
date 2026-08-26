import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UpdateQuestionSchema } from "@/lib/validation/question";

type Params = { params: Promise<{ id: string; questionId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, questionId } = await params;
  const question = await db.question.findFirst({
    where: { id: questionId, examId },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      mediaAsset: { select: { id: true, filename: true, mimeType: true, storageKey: true } },
      _count: { select: { responses: true } },
    },
  });

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  return NextResponse.json({ question });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, questionId } = await params;

  const existing = await db.question.findFirst({
    where: { id: questionId, examId },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  if (existing._count.responses > 0) {
    return NextResponse.json(
      { error: "Cannot edit a question that has student responses" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = UpdateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data = parsed.data;

  const question = await db.$transaction(async (tx) => {
    // If options are being replaced, delete old ones and recreate
    if (data.options !== undefined) {
      await tx.questionOption.deleteMany({ where: { questionId } });
    }

    return tx.question.update({
      where: { id: questionId },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.text !== undefined && { text: data.text }),
        ...(data.marks !== undefined && { marks: data.marks }),
        ...(data.negativeMarks !== undefined && { negativeMarks: data.negativeMarks }),
        ...(data.mediaAssetId !== undefined && { mediaAssetId: data.mediaAssetId }),
        ...(data.numericalAnswer !== undefined && { numericalAnswer: data.numericalAnswer }),
        ...(data.numericalTolerance !== undefined && { numericalTolerance: data.numericalTolerance }),
        ...(data.textAnswer !== undefined && { textAnswer: data.textAnswer }),
        ...(data.options !== undefined && {
          options: {
            create: data.options.map((opt) => ({
              text: opt.text,
              isCorrect: opt.isCorrect,
              displayOrder: opt.displayOrder,
              mediaAssetId: opt.mediaAssetId ?? null,
            })),
          },
        }),
      },
      include: {
        options: { orderBy: { displayOrder: "asc" } },
        mediaAsset: { select: { id: true, filename: true, mimeType: true, storageKey: true } },
      },
    });
  });

  return NextResponse.json({ question });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId, questionId } = await params;
  const question = await db.question.findFirst({
    where: { id: questionId, examId },
    include: { _count: { select: { responses: true } } },
  });

  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  if (question._count.responses > 0) {
    return NextResponse.json(
      { error: "Cannot delete a question that has student responses" },
      { status: 409 }
    );
  }

  await db.question.delete({ where: { id: questionId } });
  return NextResponse.json({ success: true });
}
