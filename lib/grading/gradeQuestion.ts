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

/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length, k = b.length;
  const dp: number[] = Array.from({ length: k + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= k; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[k];
}

/**
 * Fuzzy-match student answer against one expected answer.
 * Allows 1 edit per ~7 chars (15 %), capped at 3 — enough to catch
 * plurals, single-letter typos, and swapped chars without confusing
 * semantically distinct words (e.g. "supervised" ≠ "unsupervised").
 */
function fuzzyMatch(studentAns: string, expected: string): boolean {
  if (studentAns === expected) return true;
  const maxLen = Math.max(studentAns.length, expected.length);
  const threshold = Math.min(3, Math.floor(maxLen * 0.15));
  return threshold > 0 && levenshtein(studentAns, expected) <= threshold;
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
    // textAnswer may contain multiple accepted values separated by "|"
    const normalizedAns = ans.toLowerCase();
    const acceptedAnswers = (question.textAnswer ?? "")
      .split("|")
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    // Exact match first, then fuzzy (catches typos / plurals like neurons→neuron)
    const isCorrect =
      acceptedAnswers.length > 0 &&
      acceptedAnswers.some((expected) => fuzzyMatch(normalizedAns, expected));
    return {
      earned: n(isCorrect ? marks : -negativeMarks),
      max: marks,
      isCorrect,
      status: "graded",
    };
  }

  return skipped;
}
