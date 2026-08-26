import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { validateClose } from "@/lib/services/exam-lifecycle";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const err = validateClose(exam);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const updated = await db.exam.update({ where: { id }, data: { status: "CLOSED" } });
  return NextResponse.json({ exam: updated });
}
