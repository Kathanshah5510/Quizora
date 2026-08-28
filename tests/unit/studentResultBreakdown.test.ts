import { describe, it, expect } from "vitest";
import { isResultVisibleToStudent, deriveGradingStatus } from "@/lib/results/resultDomain";
import type { PerQuestionMark } from "@/lib/results/resultDomain";

// ─── Per-question breakdown helpers ──────────────────────────────────────────

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionRow {
  id: string;
  type: string;
  marks: number;
  numericalAnswer: number | null;
  numericalTolerance: number | null;
  textAnswer: string | null;
  options: QuestionOption[];
}

interface ResponseRow {
  questionId: string;
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  numericalAnswer: number | null;
}

function buildQuestionBreakdown(
  questions: QuestionRow[],
  responses: ResponseRow[],
  perQ: Record<string, PerQuestionMark>
) {
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  return questions.map((q) => {
    const resp = responseMap.get(q.id) ?? null;
    const grade = perQ[q.id] ?? null;
    return {
      questionId: q.id,
      type: q.type,
      selectedOptionIds: resp?.selectedOptionIds ?? null,
      textAnswer: resp?.textAnswer ?? null,
      numericalAnswer: resp?.numericalAnswer ?? null,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      correctNumericalAnswer: q.numericalAnswer,
      correctNumericalTolerance: q.numericalTolerance,
      expectedTextAnswer: q.textAnswer,
      options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      earned: grade?.earned ?? null,
      maxForQuestion: grade?.max ?? q.marks,
      isCorrect: grade?.isCorrect ?? null,
      gradingStatus: grade?.status ?? "pending",
    };
  });
}

// ─── correctOptionIds extraction ───────────────────────────────────────────────

describe("correctOptionIds extraction", () => {
  const mcqQuestion: QuestionRow = {
    id: "q1",
    type: "MCQ",
    marks: 2,
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
    options: [
      { id: "o1", text: "Option A", isCorrect: false },
      { id: "o2", text: "Option B", isCorrect: true },
      { id: "o3", text: "Option C", isCorrect: false },
    ],
  };

  it("returns only correct option IDs", () => {
    const rows = buildQuestionBreakdown([mcqQuestion], [], {});
    expect(rows[0].correctOptionIds).toEqual(["o2"]);
  });

  it("returns multiple correct option IDs for MSQ", () => {
    const msq: QuestionRow = {
      ...mcqQuestion,
      id: "q2",
      type: "MSQ",
      options: [
        { id: "a", text: "A", isCorrect: true },
        { id: "b", text: "B", isCorrect: false },
        { id: "c", text: "C", isCorrect: true },
      ],
    };
    const rows = buildQuestionBreakdown([msq], [], {});
    expect(rows[0].correctOptionIds).toEqual(["a", "c"]);
  });

  it("returns empty array when no correct options", () => {
    const q: QuestionRow = { ...mcqQuestion, options: [{ id: "o1", text: "X", isCorrect: false }] };
    const rows = buildQuestionBreakdown([q], [], {});
    expect(rows[0].correctOptionIds).toEqual([]);
  });

  it("returns empty array when question has no options (NUMERICAL)", () => {
    const numerical: QuestionRow = {
      id: "q3",
      type: "NUMERICAL",
      marks: 3,
      numericalAnswer: 42,
      numericalTolerance: 0.5,
      textAnswer: null,
      options: [],
    };
    const rows = buildQuestionBreakdown([numerical], [], {});
    expect(rows[0].correctOptionIds).toEqual([]);
    expect(rows[0].correctNumericalAnswer).toBe(42);
    expect(rows[0].correctNumericalTolerance).toBe(0.5);
  });
});

// ─── Response mapping ─────────────────────────────────────────────────────────

describe("response map lookup", () => {
  const q: QuestionRow = {
    id: "q1",
    type: "MCQ",
    marks: 2,
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
    options: [{ id: "o1", text: "A", isCorrect: true }],
  };

  it("maps student's selectedOptionIds", () => {
    const resp: ResponseRow = { questionId: "q1", selectedOptionIds: ["o1"], textAnswer: null, numericalAnswer: null };
    const rows = buildQuestionBreakdown([q], [resp], {});
    expect(rows[0].selectedOptionIds).toEqual(["o1"]);
  });

  it("returns null selectedOptionIds for unanswered MCQ", () => {
    const rows = buildQuestionBreakdown([q], [], {});
    expect(rows[0].selectedOptionIds).toBeNull();
  });

  it("maps textAnswer for SHORT_TEXT", () => {
    const textQ: QuestionRow = {
      id: "q2",
      type: "SHORT_TEXT",
      marks: 2,
      numericalAnswer: null,
      numericalTolerance: null,
      textAnswer: "expected answer",
      options: [],
    };
    const resp: ResponseRow = { questionId: "q2", selectedOptionIds: null, textAnswer: "student answer", numericalAnswer: null };
    const rows = buildQuestionBreakdown([textQ], [resp], {});
    expect(rows[0].textAnswer).toBe("student answer");
    expect(rows[0].expectedTextAnswer).toBe("expected answer");
  });

  it("maps numericalAnswer for NUMERICAL", () => {
    const numQ: QuestionRow = {
      id: "q3",
      type: "NUMERICAL",
      marks: 2,
      numericalAnswer: 10,
      numericalTolerance: 1,
      textAnswer: null,
      options: [],
    };
    const resp: ResponseRow = { questionId: "q3", selectedOptionIds: null, textAnswer: null, numericalAnswer: 9.5 };
    const rows = buildQuestionBreakdown([numQ], [resp], {});
    expect(rows[0].numericalAnswer).toBe(9.5);
  });

  it("does not return wrong question's response", () => {
    const q2: QuestionRow = { ...q, id: "q2" };
    const resp: ResponseRow = { questionId: "q1", selectedOptionIds: ["o1"], textAnswer: null, numericalAnswer: null };
    const rows = buildQuestionBreakdown([q2], [resp], {});
    expect(rows[0].selectedOptionIds).toBeNull();
  });
});

// ─── Per-question grade lookup ────────────────────────────────────────────────

describe("per-question grade lookup", () => {
  const q: QuestionRow = {
    id: "q1",
    type: "MCQ",
    marks: 4,
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
    options: [{ id: "o1", text: "A", isCorrect: true }],
  };

  it("uses grade data when available", () => {
    const perQ: Record<string, PerQuestionMark> = {
      q1: { earned: 4, max: 4, isCorrect: true, status: "graded" },
    };
    const rows = buildQuestionBreakdown([q], [], perQ);
    expect(rows[0].earned).toBe(4);
    expect(rows[0].isCorrect).toBe(true);
    expect(rows[0].gradingStatus).toBe("graded");
  });

  it("defaults to pending when no grade exists", () => {
    const rows = buildQuestionBreakdown([q], [], {});
    expect(rows[0].earned).toBeNull();
    expect(rows[0].isCorrect).toBeNull();
    expect(rows[0].gradingStatus).toBe("pending");
    expect(rows[0].maxForQuestion).toBe(4);
  });

  it("uses question marks as maxForQuestion when no grade record", () => {
    const rows = buildQuestionBreakdown([q], [], {});
    expect(rows[0].maxForQuestion).toBe(4);
  });

  it("uses grade.max as maxForQuestion when grade record exists", () => {
    const perQ: Record<string, PerQuestionMark> = {
      q1: { earned: 2, max: 4, isCorrect: false, status: "graded" },
    };
    const rows = buildQuestionBreakdown([q], [], perQ);
    expect(rows[0].maxForQuestion).toBe(4);
  });

  it("reflects partial grade (skipped) correctly", () => {
    const perQ: Record<string, PerQuestionMark> = {
      q1: { earned: 0, max: 4, isCorrect: false, status: "skipped" },
    };
    const rows = buildQuestionBreakdown([q], [], perQ);
    expect(rows[0].earned).toBe(0);
    expect(rows[0].gradingStatus).toBe("skipped");
  });
});

// ─── Result visibility gating (correct answers must not leak early) ────────────

describe("result visibility — correct answers only in released results", () => {
  it("AUTO: visible when COMPLETE", () => {
    expect(isResultVisibleToStudent("AUTO", "COMPLETE", false)).toBe(true);
  });

  it("AUTO: not visible when PARTIAL", () => {
    expect(isResultVisibleToStudent("AUTO", "PARTIAL", false)).toBe(false);
  });

  it("AUTO: not visible when PENDING", () => {
    expect(isResultVisibleToStudent("AUTO", "PENDING", false)).toBe(false);
  });

  it("MANUAL: not visible when not released, even if COMPLETE", () => {
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", false)).toBe(false);
  });

  it("MANUAL: visible when released + COMPLETE", () => {
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", true)).toBe(true);
  });

  it("MANUAL: visible when released even if PARTIAL (admin decides when to release)", () => {
    expect(isResultVisibleToStudent("MANUAL", "PARTIAL", true)).toBe(true);
  });
});

// ─── Order preservation ────────────────────────────────────────────────────────

describe("question order preservation", () => {
  const questions: QuestionRow[] = [
    { id: "q3", type: "MCQ", marks: 1, numericalAnswer: null, numericalTolerance: null, textAnswer: null, options: [] },
    { id: "q1", type: "MCQ", marks: 1, numericalAnswer: null, numericalTolerance: null, textAnswer: null, options: [] },
    { id: "q2", type: "MCQ", marks: 1, numericalAnswer: null, numericalTolerance: null, textAnswer: null, options: [] },
  ];

  it("preserves original question order from DB", () => {
    const rows = buildQuestionBreakdown(questions, [], {});
    expect(rows.map((r) => r.questionId)).toEqual(["q3", "q1", "q2"]);
  });
});

// ─── deriveGradingStatus integration with per-question marks ─────────────────

describe("gradingStatus derived from perQuestionMarks", () => {
  it("COMPLETE when all graded", () => {
    const perQ: Record<string, PerQuestionMark> = {
      q1: { earned: 2, max: 2, isCorrect: true, status: "graded" },
      q2: { earned: 0, max: 3, isCorrect: false, status: "skipped" },
    };
    expect(deriveGradingStatus(perQ)).toBe("COMPLETE");
  });

  it("PENDING when all pending", () => {
    const perQ: Record<string, PerQuestionMark> = {
      q1: { earned: 0, max: 2, isCorrect: false, status: "pending" },
    };
    expect(deriveGradingStatus(perQ)).toBe("PENDING");
  });

  it("PARTIAL when mixed", () => {
    const perQ: Record<string, PerQuestionMark> = {
      q1: { earned: 2, max: 2, isCorrect: true, status: "graded" },
      q2: { earned: 0, max: 2, isCorrect: false, status: "pending" },
    };
    expect(deriveGradingStatus(perQ)).toBe("PARTIAL");
  });

  it("COMPLETE when perQ is empty", () => {
    expect(deriveGradingStatus({})).toBe("COMPLETE");
  });
});
