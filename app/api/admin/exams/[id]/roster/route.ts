import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { StudentIdentitySchema } from "@/lib/validation/student";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roster = await db.studentRoster.findMany({
    where: { examId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ roster, total: roster.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = StudentIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const exam = await db.exam.findUnique({ where: { id }, select: { id: true } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const entry = await db.studentRoster.upsert({
    where: { examId_studentId: { examId: id, studentId: parsed.data.studentId } },
    create: {
      examId: id,
      studentId: parsed.data.studentId,
      name: parsed.data.name,
      email: parsed.data.email,
    },
    update: { name: parsed.data.name, email: parsed.data.email },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
