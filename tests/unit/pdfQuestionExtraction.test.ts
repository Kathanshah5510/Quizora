import { describe, it, expect } from "vitest";

// ── Test the pure normalization functions in isolation ────────────────────────
// We re-implement the same logic here since it's not exported from the module.
// The tests verify the parsing contracts the route and client rely on.

type QuestionType = "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_TEXT" | "NUMERICAL";

interface ExtractedOption {
  text: string;
  isCorrect: boolean;
}

interface ExtractedQuestion {
  type: QuestionType;
  text: string;
  options: ExtractedOption[];
  marks: number;
  negativeMarks: number;
  numericalAnswer: number | null;
  numericalTolerance: number | null;
  textAnswer: string | null;
}

function normalizeType(raw: string): QuestionType | null {
  const map: Record<string, QuestionType> = {
    MCQ: "MCQ",
    MSQ: "MSQ",
    TRUE_FALSE: "TRUE_FALSE",
    "TRUE/FALSE": "TRUE_FALSE",
    SHORT_TEXT: "SHORT_TEXT",
    NUMERICAL: "NUMERICAL",
    NUMERIC: "NUMERICAL",
  };
  return map[String(raw).toUpperCase().trim()] ?? null;
}

function normalizeQuestion(raw: unknown): ExtractedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;

  const type = normalizeType(String(q.type ?? ""));
  if (!type) return null;

  const text = String(q.text ?? "").trim();
  if (!text) return null;

  const marks = Math.max(0, Number(q.marks ?? 1));
  const negativeMarks = Math.max(0, Number(q.negativeMarks ?? 0));

  const rawOptions = Array.isArray(q.options) ? q.options : [];
  const options: ExtractedOption[] = rawOptions
    .map((o) => {
      if (!o || typeof o !== "object") return null;
      const opt = o as Record<string, unknown>;
      const optText = String(opt.text ?? "").trim();
      if (!optText) return null;
      return { text: optText, isCorrect: Boolean(opt.isCorrect) };
    })
    .filter((o): o is ExtractedOption => o !== null);

  if (type === "TRUE_FALSE" && options.length === 0) {
    options.push({ text: "True", isCorrect: false }, { text: "False", isCorrect: false });
  }

  return {
    type,
    text,
    options,
    marks,
    negativeMarks,
    numericalAnswer: q.numericalAnswer != null ? Number(q.numericalAnswer) : null,
    numericalTolerance: q.numericalTolerance != null ? Number(q.numericalTolerance) : null,
    textAnswer: q.textAnswer ? String(q.textAnswer).trim() : null,
  };
}

// ── Type normalisation ────────────────────────────────────────────────────────

describe("normalizeType", () => {
  it("accepts MCQ", () => expect(normalizeType("MCQ")).toBe("MCQ"));
  it("accepts MSQ", () => expect(normalizeType("MSQ")).toBe("MSQ"));
  it("accepts TRUE_FALSE", () => expect(normalizeType("TRUE_FALSE")).toBe("TRUE_FALSE"));
  it("accepts TRUE/FALSE alias", () => expect(normalizeType("TRUE/FALSE")).toBe("TRUE_FALSE"));
  it("accepts SHORT_TEXT", () => expect(normalizeType("SHORT_TEXT")).toBe("SHORT_TEXT"));
  it("accepts NUMERICAL", () => expect(normalizeType("NUMERICAL")).toBe("NUMERICAL"));
  it("accepts NUMERIC alias", () => expect(normalizeType("NUMERIC")).toBe("NUMERICAL"));
  it("is case-insensitive", () => expect(normalizeType("mcq")).toBe("MCQ"));
  it("returns null for unknown type", () => expect(normalizeType("ESSAY")).toBeNull());
  it("returns null for empty string", () => expect(normalizeType("")).toBeNull());
});

// ── normalizeQuestion ─────────────────────────────────────────────────────────

describe("normalizeQuestion: rejects invalid input", () => {
  it("returns null for null", () => expect(normalizeQuestion(null)).toBeNull());
  it("returns null for string", () => expect(normalizeQuestion("text")).toBeNull());
  it("returns null for unknown type", () => {
    expect(normalizeQuestion({ type: "ESSAY", text: "q?" })).toBeNull();
  });
  it("returns null for empty text", () => {
    expect(normalizeQuestion({ type: "MCQ", text: "  " })).toBeNull();
  });
});

describe("normalizeQuestion: defaults", () => {
  it("defaults marks to 1 when absent", () => {
    const q = normalizeQuestion({ type: "MCQ", text: "Hello?" });
    expect(q?.marks).toBe(1);
  });

  it("defaults negativeMarks to 0 when absent", () => {
    const q = normalizeQuestion({ type: "MCQ", text: "Hello?" });
    expect(q?.negativeMarks).toBe(0);
  });

  it("clamps marks to 0 minimum (no negative marks field)", () => {
    const q = normalizeQuestion({ type: "MCQ", text: "Hello?", marks: -5 });
    expect(q?.marks).toBe(0);
  });
});

describe("normalizeQuestion: MCQ", () => {
  const raw = {
    type: "MCQ",
    text: "What is 2+2?",
    options: [
      { text: "3", isCorrect: false },
      { text: "4", isCorrect: true },
      { text: "5", isCorrect: false },
    ],
    marks: 2,
    negativeMarks: 0.5,
  };

  it("maps options correctly", () => {
    const q = normalizeQuestion(raw)!;
    expect(q.options).toHaveLength(3);
    expect(q.options[1].isCorrect).toBe(true);
    expect(q.options[0].isCorrect).toBe(false);
  });

  it("preserves marks", () => {
    expect(normalizeQuestion(raw)?.marks).toBe(2);
  });

  it("drops options with empty text", () => {
    const q = normalizeQuestion({ ...raw, options: [{ text: "", isCorrect: false }, { text: "Yes", isCorrect: true }] })!;
    expect(q.options).toHaveLength(1);
  });
});

describe("normalizeQuestion: TRUE_FALSE auto-fills options", () => {
  it("creates True/False options when none provided", () => {
    const q = normalizeQuestion({ type: "TRUE_FALSE", text: "Is water wet?" })!;
    expect(q.options).toHaveLength(2);
    expect(q.options[0].text).toBe("True");
    expect(q.options[1].text).toBe("False");
  });

  it("keeps provided options if present", () => {
    const q = normalizeQuestion({
      type: "TRUE_FALSE",
      text: "Is fire hot?",
      options: [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }],
    })!;
    expect(q.options[0].isCorrect).toBe(true);
  });
});

describe("normalizeQuestion: NUMERICAL", () => {
  it("maps numericalAnswer", () => {
    const q = normalizeQuestion({ type: "NUMERICAL", text: "g=?", numericalAnswer: 9.8, options: [] })!;
    expect(q.numericalAnswer).toBe(9.8);
  });

  it("maps numericalTolerance", () => {
    const q = normalizeQuestion({ type: "NUMERICAL", text: "g=?", numericalAnswer: 9.8, numericalTolerance: 0.1, options: [] })!;
    expect(q.numericalTolerance).toBe(0.1);
  });

  it("null when not provided", () => {
    const q = normalizeQuestion({ type: "NUMERICAL", text: "g=?", options: [] })!;
    expect(q.numericalAnswer).toBeNull();
    expect(q.numericalTolerance).toBeNull();
  });
});

describe("normalizeQuestion: SHORT_TEXT", () => {
  it("maps textAnswer", () => {
    const q = normalizeQuestion({ type: "SHORT_TEXT", text: "Capital of France?", textAnswer: "Paris", options: [] })!;
    expect(q.textAnswer).toBe("Paris");
  });

  it("null when absent", () => {
    const q = normalizeQuestion({ type: "SHORT_TEXT", text: "Answer:", options: [] })!;
    expect(q.textAnswer).toBeNull();
  });

  it("trims whitespace from textAnswer", () => {
    const q = normalizeQuestion({ type: "SHORT_TEXT", text: "Q?", textAnswer: "  answer  ", options: [] })!;
    expect(q.textAnswer).toBe("answer");
  });
});

// ── JSON extraction from AI response ─────────────────────────────────────────

function extractJsonArray(rawText: string): unknown[] | null {
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

describe("extractJsonArray from AI response text", () => {
  it("extracts bare JSON array", () => {
    const result = extractJsonArray('[{"type":"MCQ","text":"Q?"}]');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
  });

  it("extracts JSON array from text with surrounding prose", () => {
    const result = extractJsonArray('Here are the questions:\n[{"type":"MCQ","text":"Q?"}]\nDone.');
    expect(result).toHaveLength(1);
  });

  it("returns null when no array present", () => {
    expect(extractJsonArray("Sorry, I cannot extract questions from this document.")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(extractJsonArray("[{type: MCQ, text: Q?}]")).toBeNull();
  });

  it("returns null when AI response has no JSON array", () => {
    expect(extractJsonArray('{"questions":"none"}')).toBeNull();
  });

  it("handles multi-question response", () => {
    const payload = JSON.stringify([
      { type: "MCQ", text: "Q1?", options: [{ text: "A", isCorrect: true }], marks: 1, negativeMarks: 0 },
      { type: "NUMERICAL", text: "Q2?", options: [], numericalAnswer: 42, marks: 2, negativeMarks: 0 },
    ]);
    const result = extractJsonArray(payload)!;
    expect(result).toHaveLength(2);
  });
});

// ── Confirm-step validation (mirrors route logic) ─────────────────────────────

const ALLOWED_TYPES = new Set(["MCQ", "MSQ", "TRUE_FALSE", "SHORT_TEXT", "NUMERICAL"]);

function validateForImport(questions: unknown[]): { ok: boolean; error?: string } {
  for (const q of questions) {
    if (!q || typeof q !== "object") return { ok: false, error: "Invalid question entry" };
    const qObj = q as Record<string, unknown>;
    if (!ALLOWED_TYPES.has(String(qObj.type))) return { ok: false, error: `Invalid type: ${qObj.type}` };
    if (!String(qObj.text ?? "").trim()) return { ok: false, error: "Empty question text" };
  }
  return { ok: true };
}

describe("confirm-step validation", () => {
  it("passes for valid questions", () => {
    const qs = [{ type: "MCQ", text: "Q?", options: [], marks: 1, negativeMarks: 0 }];
    expect(validateForImport(qs).ok).toBe(true);
  });

  it("rejects unknown type", () => {
    const qs = [{ type: "ESSAY", text: "Q?", options: [] }];
    expect(validateForImport(qs).ok).toBe(false);
  });

  it("rejects empty text", () => {
    const qs = [{ type: "MCQ", text: "   ", options: [] }];
    expect(validateForImport(qs).ok).toBe(false);
  });

  it("rejects null entry", () => {
    expect(validateForImport([null]).ok).toBe(false);
  });
});
