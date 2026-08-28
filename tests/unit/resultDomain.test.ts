import { describe, it, expect } from "vitest";
import {
  computePercentage,
  deriveGradingStatus,
  recalculateTotalScore,
  isResultVisibleToStudent,
  buildResultSummary,
  type PerQuestionMark,
} from "@/lib/results/resultDomain";

// ─── computePercentage ────────────────────────────────────────────────────────

describe("computePercentage", () => {
  it("returns null when maxScore is zero", () => {
    expect(computePercentage(0, 0)).toBeNull();
    expect(computePercentage(5, 0)).toBeNull();
  });

  it("returns 100 for full marks", () => {
    expect(computePercentage(10, 10)).toBe(100);
  });

  it("returns 0 for zero score", () => {
    expect(computePercentage(0, 10)).toBe(0);
  });

  it("rounds to two decimal places", () => {
    // 1/3 * 100 = 33.333... → 33.33
    expect(computePercentage(1, 3)).toBe(33.33);
  });

  it("handles negative totalScore (from negative marks)", () => {
    expect(computePercentage(-2, 10)).toBe(-20);
  });

  it("handles fractional marks correctly", () => {
    expect(computePercentage(7.5, 10)).toBe(75);
  });

  it("returns null when maxScore is negative (invalid)", () => {
    expect(computePercentage(5, -1)).toBeNull();
  });
});

// ─── deriveGradingStatus ─────────────────────────────────────────────────────

const graded = (earned: number, max: number): PerQuestionMark => ({
  earned, max, isCorrect: earned > 0, status: "graded",
});
const pending = (max: number): PerQuestionMark => ({
  earned: 0, max, isCorrect: false, status: "pending",
});
const skipped = (max: number): PerQuestionMark => ({
  earned: 0, max, isCorrect: false, status: "skipped",
});

describe("deriveGradingStatus", () => {
  it("returns COMPLETE when all questions are graded", () => {
    expect(deriveGradingStatus({ q1: graded(2, 2), q2: graded(1, 1) })).toBe("COMPLETE");
  });

  it("returns COMPLETE when all questions are skipped", () => {
    expect(deriveGradingStatus({ q1: skipped(2) })).toBe("COMPLETE");
  });

  it("returns COMPLETE for empty question set", () => {
    expect(deriveGradingStatus({})).toBe("COMPLETE");
  });

  it("returns PENDING when all questions are pending", () => {
    expect(deriveGradingStatus({ q1: pending(2), q2: pending(1) })).toBe("PENDING");
  });

  it("returns PARTIAL when some graded and some pending", () => {
    expect(deriveGradingStatus({ q1: graded(2, 2), q2: pending(1) })).toBe("PARTIAL");
  });

  it("returns PARTIAL when some skipped and some pending", () => {
    expect(deriveGradingStatus({ q1: skipped(2), q2: pending(1) })).toBe("PARTIAL");
  });
});

// ─── recalculateTotalScore ────────────────────────────────────────────────────

describe("recalculateTotalScore", () => {
  it("sums all earned values", () => {
    expect(recalculateTotalScore({ q1: graded(2, 2), q2: graded(3, 3) })).toBe(5);
  });

  it("returns 0 for all skipped", () => {
    expect(recalculateTotalScore({ q1: skipped(2) })).toBe(0);
  });

  it("handles negative earned (from negative marks)", () => {
    const neg: PerQuestionMark = { earned: -0.5, max: 2, isCorrect: false, status: "graded" };
    expect(recalculateTotalScore({ q1: neg, q2: graded(2, 2) })).toBe(1.5);
  });

  it("returns 0 for empty set", () => {
    expect(recalculateTotalScore({})).toBe(0);
  });
});

// ─── isResultVisibleToStudent ─────────────────────────────────────────────────

describe("isResultVisibleToStudent", () => {
  it("AUTO + COMPLETE → visible", () => {
    expect(isResultVisibleToStudent("AUTO", "COMPLETE", false)).toBe(true);
  });

  it("AUTO + PARTIAL → not visible", () => {
    expect(isResultVisibleToStudent("AUTO", "PARTIAL", false)).toBe(false);
  });

  it("AUTO + PENDING → not visible", () => {
    expect(isResultVisibleToStudent("AUTO", "PENDING", false)).toBe(false);
  });

  it("AUTO + COMPLETE + isReleased=true → visible (isReleased irrelevant for AUTO)", () => {
    expect(isResultVisibleToStudent("AUTO", "COMPLETE", true)).toBe(true);
  });

  it("MANUAL + not released → not visible even if COMPLETE", () => {
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", false)).toBe(false);
  });

  it("MANUAL + released → visible regardless of grading status", () => {
    expect(isResultVisibleToStudent("MANUAL", "PARTIAL", true)).toBe(true);
    expect(isResultVisibleToStudent("MANUAL", "PENDING", true)).toBe(true);
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", true)).toBe(true);
  });
});

// ─── buildResultSummary ───────────────────────────────────────────────────────

describe("buildResultSummary", () => {
  it("builds summary from plain numbers", () => {
    const summary = buildResultSummary({
      totalScore: 8,
      maxScore: 10,
      gradingStatus: "COMPLETE",
      isReleased: false,
      releasedAt: null,
    });
    expect(summary.totalScore).toBe(8);
    expect(summary.maxScore).toBe(10);
    expect(summary.percentage).toBe(80);
    expect(summary.gradingStatus).toBe("COMPLETE");
    expect(summary.isReleased).toBe(false);
  });

  it("builds summary from Prisma Decimal-like objects", () => {
    const summary = buildResultSummary({
      totalScore: { toNumber: () => 5 },
      maxScore: { toNumber: () => 10 },
      gradingStatus: "PARTIAL",
      isReleased: true,
      releasedAt: new Date("2026-08-28"),
    });
    expect(summary.totalScore).toBe(5);
    expect(summary.maxScore).toBe(10);
    expect(summary.percentage).toBe(50);
    expect(summary.gradingStatus).toBe("PARTIAL");
    expect(summary.isReleased).toBe(true);
    expect(summary.releasedAt).toEqual(new Date("2026-08-28"));
  });

  it("returns null percentage when maxScore is 0", () => {
    const summary = buildResultSummary({
      totalScore: 0,
      maxScore: 0,
      gradingStatus: "COMPLETE",
      isReleased: false,
      releasedAt: null,
    });
    expect(summary.percentage).toBeNull();
  });
});
