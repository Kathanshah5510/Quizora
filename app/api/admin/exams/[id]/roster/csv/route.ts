import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { StudentIdentitySchema } from "@/lib/validation/student";
import { parseRosterCSV } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exam = await db.exam.findUnique({ where: { id }, select: { id: true } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const MAX_BYTES = 2 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 413 });
  }

  const text = await file.text();
  const rows = parseRosterCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no valid data rows" }, { status: 400 });
  }

  let added = 0;
  let errors = 0;
  const rowErrors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = StudentIdentitySchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors++;
      rowErrors.push({ row: i + 1, message: parsed.error.errors[0].message });
      continue;
    }
    try {
      await db.studentRoster.upsert({
        where: { examId_studentId: { examId: id, studentId: parsed.data.studentId } },
        create: { examId: id, studentId: parsed.data.studentId, name: parsed.data.name, email: parsed.data.email },
        update: { name: parsed.data.name, email: parsed.data.email },
      });
      added++;
    } catch {
      errors++;
      rowErrors.push({ row: i + 1, message: "Database error" });
    }
  }

  return NextResponse.json({ added, errors, total: rows.length, rowErrors });
}
