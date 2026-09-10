import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: targetExamId } = await params;

  let body: { sourceExamId?: string; questionIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sourceExamId, questionIds } = body;
  if (!sourceExamId || !Array.isArray(questionIds) || questionIds.length === 0) {
    return NextResponse.json({ error: "sourceExamId and questionIds are required" }, { status: 400 });
  }
  if (sourceExamId === targetExamId) {
    return NextResponse.json({ error: "Cannot copy questions to the same exam" }, { status: 400 });
  }

  // Verify target exam exists
  const targetExam = await db.exam.findUnique({
    where: { id: targetExamId },
    select: { id: true, status: true },
  });
  if (!targetExam) return NextResponse.json({ error: "Target exam not found" }, { status: 404 });
  if (targetExam.status === "CLOSED") {
    return NextResponse.json({ error: "Cannot add questions to a closed exam" }, { status: 400 });
  }

  // Fetch the source questions (only from sourceExamId, not deleted, and IDs must match)
  const sourceQuestions = await db.question.findMany({
    where: { id: { in: questionIds }, examId: sourceExamId, isDeleted: false },
    orderBy: { displayOrder: "asc" },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  });

  if (sourceQuestions.length === 0) {
    return NextResponse.json({ error: "No valid questions found" }, { status: 404 });
  }

  // Find the current max displayOrder in the target exam
  const maxOrderRow = await db.question.aggregate({
    where: { examId: targetExamId, isDeleted: false },
    _max: { displayOrder: true },
  });
  let nextOrder = (maxOrderRow._max.displayOrder ?? -1) + 1;

  // Create questions
  const created = await db.$transaction(async (tx) => {
    const newQuestions = [];
    for (const q of sourceQuestions) {
      const newQ = await tx.question.create({
        data: {
          examId: targetExamId,
          type: q.type,
          text: q.text,
          mediaAssetId: q.mediaAssetId,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          numericalAnswer: q.numericalAnswer,
          numericalTolerance: q.numericalTolerance,
          textAnswer: q.textAnswer,
          displayOrder: nextOrder++,
        },
      });
      if (q.options.length > 0) {
        await tx.questionOption.createMany({
          data: q.options.map((o) => ({
            questionId: newQ.id,
            text: o.text,
            mediaAssetId: o.mediaAssetId,
            isCorrect: o.isCorrect,
            displayOrder: o.displayOrder,
          })),
        });
      }
      newQuestions.push(newQ.id);
    }
    return newQuestions;
  });

  return NextResponse.json({ copied: created.length });
}
