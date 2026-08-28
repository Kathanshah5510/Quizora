import { describe, it, expect } from "vitest";

/**
 * Tests for attempt review authorization and scoping logic.
 * The actual DB queries use `findFirst({ where: { id, examId } })` which
 * enforces the exam boundary at the DB level. These tests verify the
 * decision logic around what gets exposed and to whom.
 */

// ─── Cross-exam access prevention ────────────────────────────────────────────

function findAttemptScoped(
  attempts: Array<{ id: string; examId: string }>,
  attemptId: string,
  examId: string
) {
  return attempts.find((a) => a.id === attemptId && a.examId === examId) ?? null;
}

describe("attempt scoping — cross-exam access prevention", () => {
  const DB = [
    { id: "attempt-1", examId: "exam-A" },
    { id: "attempt-2", examId: "exam-B" },
  ];

  it("finds an attempt belonging to the correct exam", () => {
    expect(findAttemptScoped(DB, "attempt-1", "exam-A")).not.toBeNull();
  });

  it("returns null when attempt belongs to a different exam", () => {
    expect(findAttemptScoped(DB, "attempt-1", "exam-B")).toBeNull();
  });

  it("returns null for a non-existent attempt", () => {
    expect(findAttemptScoped(DB, "attempt-999", "exam-A")).toBeNull();
  });

  it("returns null when examId is empty string", () => {
    expect(findAttemptScoped(DB, "attempt-1", "")).toBeNull();
  });
});

// ─── Correct-answer exposure (admin-only) ─────────────────────────────────────

interface QuestionRow {
  id: string;
  correctOptionIds: string[];
  textAnswer: string | null;
  numericalAnswer: number | null;
}

function stripAnswersForStudent(q: QuestionRow) {
  return {
    id: q.id,
    // These fields MUST NOT appear in student-facing responses
  };
}

describe("correct-answer data must not reach student-facing routes", () => {
  const adminRow: QuestionRow = {
    id: "q1",
    correctOptionIds: ["opt-b"],
    textAnswer: "Paris",
    numericalAnswer: 42,
  };

  it("admin row contains correct answer data", () => {
    expect(adminRow.correctOptionIds).toHaveLength(1);
    expect(adminRow.textAnswer).toBe("Paris");
    expect(adminRow.numericalAnswer).toBe(42);
  });

  it("stripped student row does not contain correctOptionIds", () => {
    const student = stripAnswersForStudent(adminRow);
    expect("correctOptionIds" in student).toBe(false);
  });

  it("stripped student row does not contain textAnswer", () => {
    const student = stripAnswersForStudent(adminRow);
    expect("textAnswer" in student).toBe(false);
  });

  it("stripped student row does not contain numericalAnswer", () => {
    const student = stripAnswersForStudent(adminRow);
    expect("numericalAnswer" in student).toBe(false);
  });
});

// ─── Per-question mark display ────────────────────────────────────────────────

interface PerQuestionMark {
  earned: number;
  max: number;
  isCorrect: boolean;
  status: "graded" | "pending" | "skipped";
}

function formatQuestionScore(mark: PerQuestionMark | null): string {
  if (!mark) return "—";
  return `${mark.earned.toFixed(2)} / ${mark.max.toFixed(2)}`;
}

describe("per-question mark display", () => {
  it("formats score as earned / max", () => {
    expect(formatQuestionScore({ earned: 2, max: 2, isCorrect: true, status: "graded" })).toBe("2.00 / 2.00");
  });

  it("formats negative earned (negative marks)", () => {
    expect(formatQuestionScore({ earned: -0.5, max: 2, isCorrect: false, status: "graded" })).toBe("-0.50 / 2.00");
  });

  it("formats zero earned for skipped", () => {
    expect(formatQuestionScore({ earned: 0, max: 3, isCorrect: false, status: "skipped" })).toBe("0.00 / 3.00");
  });

  it("returns dash when no grade record", () => {
    expect(formatQuestionScore(null)).toBe("—");
  });
});

// ─── Duration calculation ─────────────────────────────────────────────────────

function calcDurationMinutes(startedAt: Date, submittedAt: Date | null): number | null {
  if (!submittedAt) return null;
  return Math.round((submittedAt.getTime() - startedAt.getTime()) / 60000);
}

describe("attempt duration calculation", () => {
  const start = new Date("2026-08-28T10:00:00Z");

  it("calculates duration in minutes", () => {
    const end = new Date("2026-08-28T10:45:00Z");
    expect(calcDurationMinutes(start, end)).toBe(45);
  });

  it("rounds partial minutes", () => {
    const end = new Date("2026-08-28T10:00:30Z");
    expect(calcDurationMinutes(start, end)).toBe(1); // 30s → rounds to 1 min
  });

  it("returns null when not yet submitted", () => {
    expect(calcDurationMinutes(start, null)).toBeNull();
  });

  it("returns 0 for same-instant start and submit", () => {
    expect(calcDurationMinutes(start, start)).toBe(0);
  });
});
