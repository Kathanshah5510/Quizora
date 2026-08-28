/**
 * Pure, server-authoritative result domain logic — no DB access.
 * Clients never compute or supply scores, percentages, or grading status.
 */

import type { GradeStatus } from "@/lib/grading/gradeQuestion";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GradingStatus = "PENDING" | "PARTIAL" | "COMPLETE";
export type ResultRelease = "AUTO" | "MANUAL";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "ABANDONED";

export interface PerQuestionMark {
  earned: number;
  max: number;
  isCorrect: boolean;
  status: GradeStatus;
}

export interface ResultSummary {
  totalScore: number;
  maxScore: number;
  percentage: number | null;
  gradingStatus: GradingStatus;
  isReleased: boolean;
  releasedAt: Date | null;
}

export interface AttemptResultContext {
  attemptStatus: AttemptStatus;
  resultRelease: ResultRelease;
  result: ResultSummary | null;
}

// ─── Calculations ─────────────────────────────────────────────────────────────

/**
 * Returns percentage (0–100) rounded to two decimal places,
 * or null when maxScore is zero (no gradeable questions).
 */
export function computePercentage(totalScore: number, maxScore: number): number | null {
  if (maxScore <= 0) return null;
  const pct = (totalScore / maxScore) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Derive a GradingStatus from a perQuestionMarks map.
 * Mirrors gradeAttempt() logic so callers can re-derive status
 * after a manual grade update without re-running the full grader.
 */
export function deriveGradingStatus(
  perQuestionMarks: Record<string, PerQuestionMark>
): GradingStatus {
  const entries = Object.values(perQuestionMarks);
  if (entries.length === 0) return "COMPLETE";

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const gradedCount = entries.filter((e) => e.status !== "pending").length;

  if (pendingCount === 0) return "COMPLETE";
  if (gradedCount === 0) return "PENDING";
  return "PARTIAL";
}

/**
 * Recalculate totalScore from a perQuestionMarks map after a manual grade update.
 * Skipped questions contribute 0; pending questions contribute 0 until graded.
 */
export function recalculateTotalScore(
  perQuestionMarks: Record<string, PerQuestionMark>
): number {
  return Object.values(perQuestionMarks).reduce((sum, q) => sum + q.earned, 0);
}

/**
 * Determine whether a result is visible to the student based on
 * the exam's resultRelease policy and the result's release state.
 *
 * AUTO  — released immediately once gradingStatus is COMPLETE.
 * MANUAL — released only when an admin explicitly sets isReleased = true.
 */
export function isResultVisibleToStudent(
  policy: ResultRelease,
  gradingStatus: GradingStatus,
  isReleased: boolean
): boolean {
  if (policy === "AUTO") return gradingStatus === "COMPLETE";
  return isReleased;
}

/**
 * Build a sanitized result summary safe for admin consumption.
 * Percentage is computed here; it is never stored or client-supplied.
 */
export function buildResultSummary(result: {
  totalScore: number | { toNumber(): number };
  maxScore: number | { toNumber(): number };
  gradingStatus: string;
  isReleased: boolean;
  releasedAt: Date | null;
}): ResultSummary {
  const total =
    typeof result.totalScore === "number"
      ? result.totalScore
      : result.totalScore.toNumber();
  const max =
    typeof result.maxScore === "number"
      ? result.maxScore
      : result.maxScore.toNumber();

  return {
    totalScore: total,
    maxScore: max,
    percentage: computePercentage(total, max),
    gradingStatus: result.gradingStatus as GradingStatus,
    isReleased: result.isReleased,
    releasedAt: result.releasedAt,
  };
}
