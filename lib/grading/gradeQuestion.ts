/**
 * Pure, server-side question grading — no DB access.
 * Callers must convert Prisma Decimal fields to numbers before calling.
 */

export type QuestionType =
  | "MCQ"
  | "MSQ"
  | "TRUE_FALSE"
  | "SHORT_TEXT"
  | "NUMERICAL"
  | "IMAGE_BASED";

export type MsqGradingPolicy = "STRICT" | "PARTIAL";
export type TextGradingMode = "EXACT" | "MANUAL" | "AI_ASSISTED";
export type GradeStatus = "graded" | "pending" | "skipped";

export interface QuestionData {
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  /** IDs of correct options — for option-based types */
  correctOptionIds: string[];
  numericalAnswer: number | null;
  /** Question-level tolerance; overrides exam-level when set */
  numericalTolerance: number | null;
  textAnswer: string | null;
}

export interface ResponseData {
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  numericalAnswer: number | null;
}

export interface ExamGradingSettings {
  msqGradingPolicy: MsqGradingPolicy;
  /** Exam-level fallback for NUMERICAL when question has no tolerance */
  numericalTolerance: number | null;
  textGradingMode: TextGradingMode;
}

export interface QuestionGradeResult {
  /** Marks earned for this question (may be negative for wrong answers) */
  earned: number;
  /** Maximum possible marks */
  max: number;
  isCorrect: boolean;
  status: GradeStatus;
}

/** Normalize -0 to 0 so callers get consistent results. */
function n(v: number): number {
  return v === 0 ? 0 : v;
}

export function gradeQuestion(
  question: QuestionData,
  response: ResponseData | null,
  settings: ExamGradingSettings
): QuestionGradeResult {
  const { type, marks, negativeMarks } = question;
  const skipped: QuestionGradeResult = { earned: 0, max: marks, isCorrect: false, status: "skipped" };

  // ── Option-based types ────────────────────────────────────────────────────
  if (type === "MCQ" || type === "TRUE_FALSE" || type === "IMAGE_BASED") {
    const selected = response?.selectedOptionIds ?? [];
    if (selected.length === 0) return skipped;
    const isCorrect =
      selected.length === 1 &&
      question.correctOptionIds.length === 1 &&
      selected[0] === question.correctOptionIds[0];
    return {
      earned: n(isCorrect ? marks : -negativeMarks),
      max: marks,
      isCorrect,
      status: "graded",
    };
  }

  if (type === "MSQ") {
    const selected = response?.selectedOptionIds ?? [];
    if (selected.length === 0) return skipped;

    const correctSet = new Set(question.correctOptionIds);
    const correctSelected = selected.filter((id) => correctSet.has(id)).length;
    const wrongSelected = selected.filter((id) => !correctSet.has(id)).length;
    const numCorrect = question.correctOptionIds.length;

    if (settings.msqGradingPolicy === "STRICT") {
      const isCorrect = correctSelected === numCorrect && wrongSelected === 0;
      if (isCorrect) return { earned: marks, max: marks, isCorrect: true, status: "graded" };
      // Any wrong option selected → apply negative marks; incomplete but no wrong → 0
      const earned = n(wrongSelected > 0 ? -negativeMarks : 0);
      return { earned, max: marks, isCorrect: false, status: "graded" };
    }

    // PARTIAL: each correct option earns a fraction; each wrong option loses a fraction
    const perCorrectMark = numCorrect > 0 ? marks / numCorrect : 0;
    const numWrongOptions = Math.max(1, selected.length - correctSelected + wrongSelected);
    const perWrongPenalty = negativeMarks / numWrongOptions;
    const earned = Math.max(
      -negativeMarks,
      Math.min(marks, correctSelected * perCorrectMark - wrongSelected * perWrongPenalty)
    );
    const isCorrect = correctSelected === numCorrect && wrongSelected === 0;
    return { earned: n(earned), max: marks, isCorrect, status: "graded" };
  }

  // ── NUMERICAL ─────────────────────────────────────────────────────────────
  if (type === "NUMERICAL") {
    const ans = response?.numericalAnswer ?? null;
    if (ans === null || question.numericalAnswer === null) return skipped;
    const tolerance =
      question.numericalTolerance !== null
        ? question.numericalTolerance
        : (settings.numericalTolerance ?? 0);
    const isCorrect = Math.abs(ans - question.numericalAnswer) <= tolerance;
    return {
      earned: n(isCorrect ? marks : -negativeMarks),
      max: marks,
      isCorrect,
      status: "graded",
    };
  }

  // ── SHORT_TEXT ────────────────────────────────────────────────────────────
  if (type === "SHORT_TEXT") {
    if (settings.textGradingMode !== "EXACT") {
      return { earned: 0, max: marks, isCorrect: false, status: "pending" };
    }
    const ans = response?.textAnswer?.trim() ?? "";
    if (!ans) return skipped;
    const isCorrect =
      !!question.textAnswer &&
      ans.toLowerCase() === question.textAnswer.trim().toLowerCase();
    return {
      earned: n(isCorrect ? marks : -negativeMarks),
      max: marks,
      isCorrect,
      status: "graded",
    };
  }

  return skipped;
}
