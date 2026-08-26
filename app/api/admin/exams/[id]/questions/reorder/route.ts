import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ReorderQuestionsSchema } from "@/lib/validation/question";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = ReorderQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { questions } = parsed.data;

  // Verify all question IDs belong to this exam
  const existingIds = await db.question.findMany({
    where: { examId },
    select: { id: true },
  });
  const existingIdSet = new Set(existingIds.map((q) => q.id));
  const invalidId = questions.find((q) => !existingIdSet.has(q.id));
  if (invalidId) {
    return NextResponse.json({ error: `Question ${invalidId.id} does not belong to this exam` }, { status: 400 });
  }

  // Update all displayOrder values in a transaction
  await db.$transaction(
    questions.map((q) =>
      db.question.update({
        where: { id: q.id },
        data: { displayOrder: q.displayOrder },
      })
    )
  );

  return NextResponse.json({ success: true });
}
