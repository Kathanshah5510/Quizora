import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  extractQuestionsFromPDF,
  QuestionExtractionNotConfiguredError,
  QuestionExtractionError,
  type ExtractedQuestion,
} from "@/lib/ai/extractQuestions";

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

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

  // ── Confirm: accept JSON body with reviewed questions ─────────────────────────
  if (confirm) {
    let questions: ExtractedQuestion[];
    try {
      const body = await req.json();
      if (!Array.isArray(body.questions)) {
        return NextResponse.json({ error: "Request body must have a questions array" }, { status: 400 });
      }
      questions = body.questions as ExtractedQuestion[];
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions to import" }, { status: 422 });
    }

    const ALLOWED_TYPES = new Set(["MCQ", "MSQ", "TRUE_FALSE", "SHORT_TEXT", "NUMERICAL"]);
    for (const q of questions) {
      if (!ALLOWED_TYPES.has(q.type)) {
        return NextResponse.json({ error: `Invalid question type: ${q.type}` }, { status: 422 });
      }
      if (!q.text?.trim()) {
        return NextResponse.json({ error: "All questions must have non-empty text" }, { status: 422 });
      }
    }

    const maxOrder = await db.question.aggregate({
      where: { examId },
      _max: { displayOrder: true },
    });
    let nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

    const created = await db.$transaction(
      questions.map((q) => {
        const order = nextOrder++;
        return db.question.create({
          data: {
            examId,
            type: q.type,
            text: q.text.trim(),
            marks: Math.max(0, Number(q.marks) || 1),
            negativeMarks: Math.max(0, Number(q.negativeMarks) || 0),
            numericalAnswer: q.numericalAnswer ?? null,
            numericalTolerance: q.numericalTolerance ?? null,
            textAnswer: q.textAnswer?.trim() || null,
            displayOrder: order,
            options: {
              create: (q.options ?? []).map((o, i) => ({
                text: o.text.trim(),
                isCorrect: Boolean(o.isCorrect),
                displayOrder: i,
              })),
            },
          },
          select: { id: true },
        });
      })
    );

    return NextResponse.json({ success: true, imported: created.length });
  }

  // ── Extract: receive PDF, call AI, return preview ─────────────────────────────
  let pdfBase64: string;
  let fileSize: number;
  try {
    const formData = await req.formData();
    const file = formData.get("pdf");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing PDF file (field name: pdf)" }, { status: 400 });
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }
    const mimeOk =
      file.type === "application/pdf" ||
      file.type === "application/x-pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!mimeOk) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
    }
    fileSize = file.size;
    const buf = await file.arrayBuffer();
    pdfBase64 = Buffer.from(buf).toString("base64");
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  try {
    const { questions } = await extractQuestionsFromPDF(pdfBase64, fileSize);
    return NextResponse.json({ preview: true, count: questions.length, questions });
  } catch (err) {
    if (err instanceof QuestionExtractionNotConfiguredError) {
      return NextResponse.json(
        { error: "PDF question extraction is not configured. Contact your administrator." },
        { status: 503 }
      );
    }
    if (err instanceof QuestionExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
