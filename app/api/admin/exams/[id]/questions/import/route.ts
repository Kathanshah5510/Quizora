import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  extractQuestionsFromText,
  QuestionExtractionNotConfiguredError,
  QuestionExtractionError,
  type ExtractedQuestion,
} from "@/lib/ai/extractQuestions";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

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

  // ── Confirm: accept reviewed questions as JSON body ───────────────────────────
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

  // ── Extract: receive file, run AI, return preview ─────────────────────────────
  let fileText: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file (field name: file)" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
    }
    fileText = await file.text();
    if (!fileText.trim()) {
      return NextResponse.json({ error: "The file appears to be empty" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  try {
    const { questions } = await extractQuestionsFromText(fileText);
    return NextResponse.json({ preview: true, count: questions.length, questions });
  } catch (err) {
    if (err instanceof QuestionExtractionNotConfiguredError) {
      return NextResponse.json(
        { error: "AI extraction is not configured. Add GEMINI_API_KEY to your environment variables." },
        { status: 503 }
      );
    }
    if (err instanceof QuestionExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Extraction failed. Please try again." }, { status: 500 });
  }
}
