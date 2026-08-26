import { describe, it, expect } from "vitest";
import { gradeQuestion, QuestionData, ResponseData, ExamGradingSettings } from "@/lib/grading/gradeQuestion";
import { gradeAttempt } from "@/lib/grading/gradeAttempt";

const STRICT_SETTINGS: ExamGradingSettings = {
  msqGradingPolicy: "STRICT",
  numericalTolerance: null,
  textGradingMode: "EXACT",
};

const PARTIAL_SETTINGS: ExamGradingSettings = {
  ...STRICT_SETTINGS,
  msqGradingPolicy: "PARTIAL",
};

// ─── MCQ ──────────────────────────────────────────────────────────────────────

describe("gradeQuestion — MCQ", () => {
  const mcq: QuestionData = {
    type: "MCQ",
    marks: 2,
    negativeMarks: 0.5,
    correctOptionIds: ["opt-b"],
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
  };

  it("earns full marks for correct answer", () => {
    const r = gradeQuestion(mcq, { selectedOptionIds: ["opt-b"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(2);
    expect(r.isCorrect).toBe(true);
    expect(r.status).toBe("graded");
  });

  it("applies negative marks for wrong answer", () => {
    const r = gradeQuestion(mcq, { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(-0.5);
    expect(r.isCorrect).toBe(false);
    expect(r.status).toBe("graded");
  });

  it("returns 0 earned for wrong when negativeMarks is 0", () => {
    const noNeg: QuestionData = { ...mcq, negativeMarks: 0 };
    const r = gradeQuestion(noNeg, { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(0);
    expect(r.isCorrect).toBe(false);
  });

  it("skips when no options selected", () => {
    const r = gradeQuestion(mcq, { selectedOptionIds: [], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(0);
    expect(r.status).toBe("skipped");
  });

  it("skips when response is null", () => {
    const r = gradeQuestion(mcq, null, STRICT_SETTINGS);
    expect(r.status).toBe("skipped");
    expect(r.earned).toBe(0);
  });

  it("marks wrong when multiple options selected (single-correct type)", () => {
    const r = gradeQuestion(mcq, { selectedOptionIds: ["opt-a", "opt-b"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.isCorrect).toBe(false);
  });

  it("max is always the question marks", () => {
    const r = gradeQuestion(mcq, null, STRICT_SETTINGS);
    expect(r.max).toBe(2);
  });
});

// ─── TRUE_FALSE ───────────────────────────────────────────────────────────────

describe("gradeQuestion — TRUE_FALSE", () => {
  const tf: QuestionData = {
    type: "TRUE_FALSE",
    marks: 1,
    negativeMarks: 0.25,
    correctOptionIds: ["opt-true"],
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
  };

  it("earns full marks for correct", () => {
    const r = gradeQuestion(tf, { selectedOptionIds: ["opt-true"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(1);
    expect(r.isCorrect).toBe(true);
  });

  it("applies negative marks for wrong", () => {
    const r = gradeQuestion(tf, { selectedOptionIds: ["opt-false"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(-0.25);
    expect(r.isCorrect).toBe(false);
  });
});

// ─── MSQ STRICT ───────────────────────────────────────────────────────────────

describe("gradeQuestion — MSQ STRICT", () => {
  const msq: QuestionData = {
    type: "MSQ",
    marks: 3,
    negativeMarks: 1,
    correctOptionIds: ["opt-a", "opt-c"],
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
  };

  it("earns full marks when exactly correct set selected", () => {
    const r = gradeQuestion(msq, { selectedOptionIds: ["opt-a", "opt-c"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(3);
    expect(r.isCorrect).toBe(true);
    expect(r.status).toBe("graded");
  });

  it("earns 0 when correct subset selected but no wrong (incomplete)", () => {
    const r = gradeQuestion(msq, { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(0);
    expect(r.isCorrect).toBe(false);
    expect(r.status).toBe("graded");
  });

  it("applies negative marks when a wrong option is selected", () => {
    const r = gradeQuestion(msq, { selectedOptionIds: ["opt-a", "opt-b"], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(-1);
    expect(r.isCorrect).toBe(false);
  });

  it("skips when no options selected", () => {
    const r = gradeQuestion(msq, { selectedOptionIds: [], textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.status).toBe("skipped");
  });
});

// ─── MSQ PARTIAL ──────────────────────────────────────────────────────────────

describe("gradeQuestion — MSQ PARTIAL", () => {
  const msq: QuestionData = {
    type: "MSQ",
    marks: 4,
    negativeMarks: 0,
    correctOptionIds: ["opt-a", "opt-b", "opt-c", "opt-d"],
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: null,
  };

  it("earns full marks when all correct selected", () => {
    const r = gradeQuestion(msq, { selectedOptionIds: ["opt-a", "opt-b", "opt-c", "opt-d"], textAnswer: null, numericalAnswer: null }, PARTIAL_SETTINGS);
    expect(r.earned).toBe(4);
    expect(r.isCorrect).toBe(true);
  });

  it("earns partial marks when some correct selected", () => {
    const r = gradeQuestion(msq, { selectedOptionIds: ["opt-a", "opt-b"], textAnswer: null, numericalAnswer: null }, PARTIAL_SETTINGS);
    expect(r.earned).toBe(2); // 2/4 correct = half marks
    expect(r.isCorrect).toBe(false);
  });
});

// ─── NUMERICAL ────────────────────────────────────────────────────────────────

describe("gradeQuestion — NUMERICAL", () => {
  const num: QuestionData = {
    type: "NUMERICAL",
    marks: 2,
    negativeMarks: 0,
    correctOptionIds: [],
    numericalAnswer: 3.14,
    numericalTolerance: 0.01,
    textAnswer: null,
  };

  it("earns full marks when within tolerance", () => {
    const r = gradeQuestion(num, { selectedOptionIds: null, textAnswer: null, numericalAnswer: 3.145 }, STRICT_SETTINGS);
    expect(r.earned).toBe(2);
    expect(r.isCorrect).toBe(true);
  });

  it("earns full marks for exact match", () => {
    const r = gradeQuestion(num, { selectedOptionIds: null, textAnswer: null, numericalAnswer: 3.14 }, STRICT_SETTINGS);
    expect(r.earned).toBe(2);
    expect(r.isCorrect).toBe(true);
  });

  it("earns 0 when outside tolerance (no negative marks)", () => {
    const r = gradeQuestion(num, { selectedOptionIds: null, textAnswer: null, numericalAnswer: 3.2 }, STRICT_SETTINGS);
    expect(r.earned).toBe(0);
    expect(r.isCorrect).toBe(false);
  });

  it("applies negative marks when wrong", () => {
    const withNeg: QuestionData = { ...num, negativeMarks: 0.5 };
    const r = gradeQuestion(withNeg, { selectedOptionIds: null, textAnswer: null, numericalAnswer: 99 }, STRICT_SETTINGS);
    expect(r.earned).toBe(-0.5);
    expect(r.isCorrect).toBe(false);
  });

  it("falls back to exam-level tolerance when question has none", () => {
    const noTol: QuestionData = { ...num, numericalTolerance: null };
    const settingsWithTol: ExamGradingSettings = { ...STRICT_SETTINGS, numericalTolerance: 0.1 };
    const r = gradeQuestion(noTol, { selectedOptionIds: null, textAnswer: null, numericalAnswer: 3.2 }, settingsWithTol);
    // |3.2 - 3.14| = 0.06 < 0.1 → correct
    expect(r.isCorrect).toBe(true);
  });

  it("skips when no numerical answer provided", () => {
    const r = gradeQuestion(num, { selectedOptionIds: null, textAnswer: null, numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.status).toBe("skipped");
  });
});

// ─── SHORT_TEXT ───────────────────────────────────────────────────────────────

describe("gradeQuestion — SHORT_TEXT", () => {
  const st: QuestionData = {
    type: "SHORT_TEXT",
    marks: 1,
    negativeMarks: 0,
    correctOptionIds: [],
    numericalAnswer: null,
    numericalTolerance: null,
    textAnswer: "Support Vector Machine",
  };

  it("earns full marks for exact match (case-insensitive)", () => {
    const r = gradeQuestion(st, { selectedOptionIds: null, textAnswer: "support vector machine", numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(1);
    expect(r.isCorrect).toBe(true);
  });

  it("earns full marks with trimmed whitespace", () => {
    const r = gradeQuestion(st, { selectedOptionIds: null, textAnswer: "  Support Vector Machine  ", numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.isCorrect).toBe(true);
  });

  it("earns 0 for wrong answer", () => {
    const r = gradeQuestion(st, { selectedOptionIds: null, textAnswer: "SVM", numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.earned).toBe(0);
    expect(r.isCorrect).toBe(false);
    expect(r.status).toBe("graded");
  });

  it("skips when text answer is empty", () => {
    const r = gradeQuestion(st, { selectedOptionIds: null, textAnswer: "", numericalAnswer: null }, STRICT_SETTINGS);
    expect(r.status).toBe("skipped");
  });

  it("returns pending for MANUAL grading mode", () => {
    const manualSettings: ExamGradingSettings = { ...STRICT_SETTINGS, textGradingMode: "MANUAL" };
    const r = gradeQuestion(st, { selectedOptionIds: null, textAnswer: "Support Vector Machine", numericalAnswer: null }, manualSettings);
    expect(r.status).toBe("pending");
    expect(r.earned).toBe(0);
  });

  it("returns pending for AI_ASSISTED grading mode", () => {
    const aiSettings: ExamGradingSettings = { ...STRICT_SETTINGS, textGradingMode: "AI_ASSISTED" };
    const r = gradeQuestion(st, { selectedOptionIds: null, textAnswer: "SVM", numericalAnswer: null }, aiSettings);
    expect(r.status).toBe("pending");
  });
});

// ─── gradeAttempt ─────────────────────────────────────────────────────────────

describe("gradeAttempt", () => {
  const mcqQ: QuestionData = {
    type: "MCQ", marks: 2, negativeMarks: 0.5,
    correctOptionIds: ["opt-b"], numericalAnswer: null, numericalTolerance: null, textAnswer: null,
  };
  const numQ: QuestionData = {
    type: "NUMERICAL", marks: 3, negativeMarks: 0,
    correctOptionIds: [], numericalAnswer: 100, numericalTolerance: 0, textAnswer: null,
  };
  const stQ: QuestionData = {
    type: "SHORT_TEXT", marks: 1, negativeMarks: 0,
    correctOptionIds: [], numericalAnswer: null, numericalTolerance: null, textAnswer: "Yes",
  };

  it("computes totalScore and maxScore correctly", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcqQ, response: { selectedOptionIds: ["opt-b"], textAnswer: null, numericalAnswer: null } },
      { questionId: "q2", question: numQ, response: { selectedOptionIds: null, textAnswer: null, numericalAnswer: 100 } },
    ], STRICT_SETTINGS);
    expect(result.totalScore).toBe(5); // 2 + 3
    expect(result.maxScore).toBe(5);
    expect(result.gradingStatus).toBe("COMPLETE");
  });

  it("sets PARTIAL status when some questions are pending", () => {
    const manualSettings: ExamGradingSettings = { ...STRICT_SETTINGS, textGradingMode: "MANUAL" };
    const result = gradeAttempt([
      { questionId: "q1", question: mcqQ, response: { selectedOptionIds: ["opt-b"], textAnswer: null, numericalAnswer: null } },
      { questionId: "q2", question: stQ, response: { selectedOptionIds: null, textAnswer: "Yes", numericalAnswer: null } },
    ], manualSettings);
    expect(result.gradingStatus).toBe("PARTIAL");
  });

  it("sets PENDING status when all questions are pending", () => {
    const manualSettings: ExamGradingSettings = { ...STRICT_SETTINGS, textGradingMode: "MANUAL" };
    const result = gradeAttempt([
      { questionId: "q1", question: stQ, response: { selectedOptionIds: null, textAnswer: "Yes", numericalAnswer: null } },
    ], manualSettings);
    expect(result.gradingStatus).toBe("PENDING");
  });

  it("sets COMPLETE when all skipped or graded (no pending)", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcqQ, response: null },
      { questionId: "q2", question: numQ, response: null },
    ], STRICT_SETTINGS);
    expect(result.gradingStatus).toBe("COMPLETE");
  });

  it("populates perQuestionMarks keyed by questionId", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcqQ, response: { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null } },
    ], STRICT_SETTINGS);
    expect(result.perQuestionMarks["q1"]).toBeDefined();
    expect(result.perQuestionMarks["q1"].isCorrect).toBe(false);
  });

  it("handles negative marks reducing totalScore", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcqQ, response: { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null } },
    ], STRICT_SETTINGS);
    expect(result.totalScore).toBe(-0.5);
  });
});
