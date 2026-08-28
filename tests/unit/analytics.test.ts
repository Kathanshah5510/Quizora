import { describe, it, expect } from "vitest";

// ─── Statistical functions (mirrors analytics route logic) ────────────────────

function mean(arr: number[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr: number[], avg: number): number | null {
  if (arr.length < 2) return null;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

describe("statistical helpers — mean", () => {
  it("returns null for empty array", () => expect(mean([])).toBeNull());
  it("returns the single value for one-element array", () => expect(mean([5])).toBe(5));
  it("averages a symmetric set", () => expect(mean([2, 4, 6])).toBe(4));
  it("handles zeros", () => expect(mean([0, 0, 0])).toBe(0));
  it("handles decimals", () => expect(mean([1.5, 2.5])).toBeCloseTo(2));
});

describe("statistical helpers — median", () => {
  it("returns null for empty array", () => expect(median([])).toBeNull());
  it("returns middle value for odd-length array", () => expect(median([1, 2, 3])).toBe(2));
  it("returns average of two middle values for even-length array", () => expect(median([1, 3])).toBe(2));
  it("handles unsorted input", () => expect(median([9, 1, 5])).toBe(5));
  it("single element", () => expect(median([42])).toBe(42));
});

describe("statistical helpers — stddev", () => {
  it("returns null for one-element array", () => expect(stddev([5], 5)).toBeNull());
  it("returns 0 for all-same values", () => expect(stddev([3, 3, 3], 3)).toBe(0));
  it("computes population std dev correctly", () => {
    // Values: 2, 4, 4, 4, 5, 5, 7, 9  → mean=5, variance=4, sd=2
    const arr = [2, 4, 4, 4, 5, 5, 7, 9];
    const avg = mean(arr)!;
    expect(stddev(arr, avg)).toBeCloseTo(2);
  });
});

// ─── Question-level stat aggregation ─────────────────────────────────────────

interface PerQMark {
  earned: number;
  max: number;
  isCorrect: boolean;
  status: "graded" | "pending" | "skipped";
}

function aggregateQuestionStats(
  attemptPerQMaps: Array<Record<string, PerQMark>>
): Record<string, { correct: number; attempted: number; totalEarned: number }> {
  const stats: Record<string, { correct: number; attempted: number; totalEarned: number }> = {};
  for (const perQ of attemptPerQMaps) {
    for (const [qId, mark] of Object.entries(perQ)) {
      if (!stats[qId]) stats[qId] = { correct: 0, attempted: 0, totalEarned: 0 };
      if (mark.status !== "skipped") {
        stats[qId].attempted++;
        if (mark.isCorrect) stats[qId].correct++;
        stats[qId].totalEarned += mark.earned;
      }
    }
  }
  return stats;
}

describe("question-level stat aggregation", () => {
  const attempt1 = {
    "q1": { earned: 2, max: 2, isCorrect: true, status: "graded" as const },
    "q2": { earned: 0, max: 2, isCorrect: false, status: "graded" as const },
    "q3": { earned: 0, max: 2, isCorrect: false, status: "skipped" as const },
  };
  const attempt2 = {
    "q1": { earned: 0, max: 2, isCorrect: false, status: "graded" as const },
    "q2": { earned: 2, max: 2, isCorrect: true, status: "graded" as const },
    "q3": { earned: 1, max: 2, isCorrect: true, status: "graded" as const },
  };

  const stats = aggregateQuestionStats([attempt1, attempt2]);

  it("counts correct responses correctly", () => {
    expect(stats["q1"].correct).toBe(1);
    expect(stats["q2"].correct).toBe(1);
    expect(stats["q3"].correct).toBe(1);
  });

  it("skipped responses are excluded from attempted count", () => {
    expect(stats["q3"].attempted).toBe(1); // attempt1 skipped, attempt2 graded
  });

  it("counts total earned marks per question", () => {
    expect(stats["q1"].totalEarned).toBe(2); // 2+0
    expect(stats["q2"].totalEarned).toBe(2); // 0+2
  });
});

// ─── Attempt status breakdown ─────────────────────────────────────────────────

describe("attempt status breakdown", () => {
  const attempts = [
    { status: "SUBMITTED" },
    { status: "SUBMITTED" },
    { status: "EXPIRED" },
    { status: "IN_PROGRESS" },
    { status: "ABANDONED" },
  ] as Array<{ status: string }>;

  const terminalStatuses = ["SUBMITTED", "EXPIRED"];
  const terminalCount = attempts.filter((a) => terminalStatuses.includes(a.status)).length;
  const submittedCount = attempts.filter((a) => a.status === "SUBMITTED").length;
  const expiredCount = attempts.filter((a) => a.status === "EXPIRED").length;
  const total = attempts.length;
  const abandonedCount = total - terminalCount;

  it("counts submitted correctly", () => expect(submittedCount).toBe(2));
  it("counts expired correctly", () => expect(expiredCount).toBe(1));
  it("abandoned = total minus terminal", () => expect(abandonedCount).toBe(2));
  it("terminal count = submitted + expired", () => expect(terminalCount).toBe(3));
});
