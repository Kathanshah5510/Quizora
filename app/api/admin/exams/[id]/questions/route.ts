import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CreateQuestionSchema } from "@/lib/validation/question";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { displayOrder: "asc" },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      mediaAsset: { select: { id: true, filename: true, mimeType: true, storageKey: true } },
      _count: { select: { responses: true } },
    },
  });

  return NextResponse.json({ questions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true, status: true } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  if (exam.status === "CLOSED") {
    return NextResponse.json({ error: "Cannot add questions to a closed exam" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = CreateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data = parsed.data;

  // Auto-assign displayOrder as next after existing max
  const maxOrder = await db.question.aggregate({
    where: { examId },
    _max: { displayOrder: true },
  });
  const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const question = await db.question.create({
    data: {
      examId,
      type: data.type,
      text: data.text,
      marks: data.marks,
      negativeMarks: data.negativeMarks,
      mediaAssetId: data.mediaAssetId ?? null,
      numericalAnswer: data.numericalAnswer ?? null,
      numericalTolerance: data.numericalTolerance ?? null,
      textAnswer: data.textAnswer ?? null,
      displayOrder,
      options: {
        create: data.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          displayOrder: opt.displayOrder,
          mediaAssetId: opt.mediaAssetId ?? null,
        })),
      },
    },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      mediaAsset: { select: { id: true, filename: true, mimeType: true, storageKey: true } },
    },
  });

  return NextResponse.json({ question }, { status: 201 });
}
