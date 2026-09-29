import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateClose } from "@/lib/services/exam-lifecycle";
import { requireExamAccess } from "@/lib/courseAccess";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireExamAccess(id))) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const err = validateClose(exam);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const updated = await db.exam.update({ where: { id }, data: { status: "CLOSED" } });
  return NextResponse.json({ exam: updated });
}
