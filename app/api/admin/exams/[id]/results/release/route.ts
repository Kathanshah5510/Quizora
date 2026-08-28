import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const ReleaseSchema = z.object({
  attemptId: z.string().optional(),
  isReleased: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, resultRelease: true },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (exam.resultRelease !== "MANUAL") {
    return NextResponse.json(
      { error: "Release control is only available for MANUAL release policy exams" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ReleaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { attemptId, isReleased } = parsed.data;
  const releasedAt = isReleased ? new Date() : null;

  if (attemptId) {
    // Single attempt release — verify it belongs to this exam
    const attempt = await db.examAttempt.findFirst({
      where: { id: attemptId, examId },
      select: { id: true, result: { select: { id: true } } },
    });
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (!attempt.result) return NextResponse.json({ error: "No result record for this attempt" }, { status: 400 });

    await db.result.update({
      where: { id: attempt.result.id },
      data: { isReleased, releasedAt },
    });

    return NextResponse.json({ success: true, updated: 1, isReleased });
  }

  // Bulk — release all results for this exam via their attempts
  const { count } = await db.result.updateMany({
    where: { attempt: { examId } },
    data: { isReleased, releasedAt },
  });

  return NextResponse.json({ success: true, updated: count, isReleased });
}
