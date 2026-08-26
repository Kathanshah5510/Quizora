import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseQuestionsCSV } from "@/lib/utils/csvImport";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true, status: true } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  if (exam.status === "CLOSED") {
    return NextResponse.json({ error: "Cannot import questions into a closed exam" }, { status: 409 });
  }

  const url = new URL(req.url);
  const confirm = url.searchParams.get("confirm") === "true";

  // Parse multipart
  let csvText: string;
  try {
    const formData = await req.formData();
    const file = formData.get("csv");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing CSV file (field name: csv)" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 413 });
    }
    const mimeOk = file.type === "text/csv" || file.type === "text/plain" || file.name.endsWith(".csv");
    if (!mimeOk) {
      return NextResponse.json({ error: "Only CSV files are accepted" }, { status: 415 });
    }
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  const result = parseQuestionsCSV(csvText);

  if (!confirm) {
    // Preview (dry run): return validation results without writing
    return NextResponse.json({
      preview: true,
      totalRows: result.totalRows,
      validCount: result.valid.length,
      errorCount: result.errors.length,
      errors: result.errors,
      questions: result.valid,
    });
  }

  // ── Actual import ────────────────────────────────────────────────────────────
  if (result.valid.length === 0) {
    return NextResponse.json(
      { error: "No valid questions to import", errors: result.errors },
      { status: 422 }
    );
  }

  const maxOrder = await db.question.aggregate({
    where: { examId },
    _max: { displayOrder: true },
  });
  let nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const created = await db.$transaction(
    result.valid.map((q) => {
      const order = nextOrder++;
      return db.question.create({
        data: {
          examId,
          type: q.type,
          text: q.text,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          numericalAnswer: q.numericalAnswer,
          numericalTolerance: q.numericalTolerance,
          textAnswer: q.textAnswer,
          displayOrder: order,
          options: {
            create: q.options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              displayOrder: o.displayOrder,
            })),
          },
        },
        select: { id: true },
      });
    })
  );

  return NextResponse.json({
    success: true,
    imported: created.length,
    skipped: result.errors.length > 0 ? result.totalRows - result.valid.length : 0,
    errors: result.errors,
  });
}
