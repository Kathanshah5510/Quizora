import { describe, it, expect } from "vitest";
import {
  deriveGradingStatus,
  recalculateTotalScore,
} from "@/lib/results/resultDomain";
import type { PerQuestionMark } from "@/lib/results/resultDomain";

// ─── Input validation ─────────────────────────────────────────────────────────

function validateGradeInput(
  earnedMarks: unknown,
  maxMarks: number
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof earnedMarks !== "number" || isNaN(earnedMarks)) {
    return { ok: false, error: "Invalid earnedMarks" };
  }
  if (earnedMarks < 0) {
    return { ok: false, error: "earnedMarks cannot be negative" };
  }
  if (earnedMarks > maxMarks) {
    return { ok: false, error: `earnedMarks cannot exceed ${maxMarks}` };
  }
  return { ok: true, value: earnedMarks };
}

describe("manual grade input validation", () => {
  it("accepts valid earned marks", () => {
    expect(validateGradeInput(3, 5)).toEqual({ ok: true, value: 3 });
  });

  it("accepts zero earned marks (incorrect answer)", () => {
    expect(validateGradeInput(0, 5)).toEqual({ ok: true, value: 0 });
  });

  it("accepts full marks", () => {
    expect(validateGradeInput(5, 5)).toEqual({ ok: true, value: 5 });
  });

  it("accepts partial marks with decimals", () => {
    expect(validateGradeInput(2.5, 5)).toEqual({ ok: true, value: 2.5 });
  });

  it("rejects marks exceeding max", () => {
    const r = validateGradeInput(6, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("5");
  });

  it("rejects negative earned marks", () => {
    const r = validateGradeInput(-1, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("negative");
  });

  it("rejects non-number input", () => {
    const r = validateGradeInput("3", 5);
    expect(r.ok).toBe(false);
  });

  it("rejects NaN", () => {
    const r = validateGradeInput(NaN, 5);
    expect(r.ok).toBe(false);
  });
});

// ─── perQuestionMarks patch logic ────────────────────────────────────────────

function applyManualGrade(
  perQ: Record<string, PerQuestionMark>,
  questionId: string,
  earnedMarks: number,
  maxMarks: number
): Record<string, PerQuestionMark> {
  return {
    ...perQ,
    [questionId]: {
      earned: earnedMarks,
      max: maxMarks,
      isCorrect: earnedMarks > 0,
      status: "graded",
    },
  };
}

describe("manual grade patch applied to perQuestionMarks", () => {
  const initial: Record<string, PerQuestionMark> = {
    "q-auto": { earned: 2, max: 2, isCorrect: true, status: "graded" },
    "q-text": { earned: 0, max: 3, isCorrect: false, status: "pending" },
  };

  it("sets earned and status=graded for the target question", () => {
    const updated = applyManualGrade(initial, "q-text", 2, 3);
    expect(updated["q-text"].earned).toBe(2);
    expect(updated["q-text"].status).toBe("graded");
  });

  it("sets isCorrect=true when earned > 0", () => {
    const updated = applyManualGrade(initial, "q-text", 1, 3);
    expect(updated["q-text"].isCorrect).toBe(true);
  });

  it("sets isCorrect=false when earned=0", () => {
    const updated = applyManualGrade(initial, "q-text", 0, 3);
    expect(updated["q-text"].isCorrect).toBe(false);
  });

  it("does not mutate other questions", () => {
    const updated = applyManualGrade(initial, "q-text", 2, 3);
    expect(updated["q-auto"]).toEqual(initial["q-auto"]);
  });

  it("does not mutate the original perQ map", () => {
    applyManualGrade(initial, "q-text", 2, 3);
    expect(initial["q-text"].status).toBe("pending");
  });
});

// ─── Grading status transition after manual grade ─────────────────────────────

describe("grading status transitions after manual grade", () => {
  it("PARTIAL → COMPLETE when last pending question is graded", () => {
    const perQ: Record<string, PerQuestionMark> = {
      "q1": { earned: 2, max: 2, isCorrect: true, status: "graded" },
      "q2": { earned: 1.5, max: 3, isCorrect: true, status: "graded" },
    };
    expect(deriveGradingStatus(perQ)).toBe("COMPLETE");
  });

  it("PENDING → PARTIAL when first of many pending is graded", () => {
    const perQ: Record<string, PerQuestionMark> = {
      "q1": { earned: 1, max: 3, isCorrect: true, status: "graded" },
      "q2": { earned: 0, max: 3, isCorrect: false, status: "pending" },
      "q3": { earned: 0, max: 3, isCorrect: false, status: "pending" },
    };
    expect(deriveGradingStatus(perQ)).toBe("PARTIAL");
  });

  it("PENDING stays when no question graded yet", () => {
    const perQ: Record<string, PerQuestionMark> = {
      "q1": { earned: 0, max: 3, isCorrect: false, status: "pending" },
    };
    expect(deriveGradingStatus(perQ)).toBe("PENDING");
  });
});

// ─── totalScore recalculation after manual grade ──────────────────────────────

describe("totalScore recalculation after manual grade", () => {
  it("adds newly graded earned marks to running total", () => {
    const perQ: Record<string, PerQuestionMark> = {
      "q1": { earned: 2, max: 2, isCorrect: true, status: "graded" },
      "q2": { earned: 2.5, max: 3, isCorrect: true, status: "graded" },
      "q3": { earned: 0, max: 3, isCorrect: false, status: "skipped" },
    };
    expect(recalculateTotalScore(perQ)).toBeCloseTo(4.5);
  });

  it("pending questions contribute 0 to total", () => {
    const perQ: Record<string, PerQuestionMark> = {
      "q1": { earned: 2, max: 2, isCorrect: true, status: "graded" },
      "q2": { earned: 0, max: 3, isCorrect: false, status: "pending" },
    };
    expect(recalculateTotalScore(perQ)).toBe(2);
  });

  it("full manual grade brings total up correctly", () => {
    const before: Record<string, PerQuestionMark> = {
      "q1": { earned: 2, max: 2, isCorrect: true, status: "graded" },
      "q2": { earned: 0, max: 4, isCorrect: false, status: "pending" },
    };
    const after = applyManualGrade(before, "q2", 3, 4);
    expect(recalculateTotalScore(after)).toBe(5);
  });
});
