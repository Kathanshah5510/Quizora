/**
 * Aggregate per-question grades into an attempt-level result.
 * Pure function — no DB access.
 */

import { gradeQuestion, QuestionData, ResponseData, ExamGradingSettings, QuestionGradeResult } from "./gradeQuestion";

export interface AttemptQuestionInput {
  questionId: string;
  question: QuestionData;
  response: ResponseData | null;
}

export interface AttemptGradeResult {
  totalScore: number;
  maxScore: number;
  perQuestionMarks: Record<string, QuestionGradeResult>;
  /** COMPLETE when all auto-gradeable; PARTIAL when some need manual review; PENDING when all need review */
  gradingStatus: "PENDING" | "PARTIAL" | "COMPLETE";
}

export function gradeAttempt(
  questions: AttemptQuestionInput[],
  settings: ExamGradingSettings
): AttemptGradeResult {
  const perQuestionMarks: Record<string, QuestionGradeResult> = {};
  let totalScore = 0;
  let maxScore = 0;
  let pendingCount = 0;
  let gradedCount = 0;

  for (const { questionId, question, response } of questions) {
    const result = gradeQuestion(question, response, settings);
    perQuestionMarks[questionId] = result;
    totalScore += result.earned;
    maxScore += result.max;
    if (result.status === "pending") pendingCount++;
    else gradedCount++;
  }

  let gradingStatus: AttemptGradeResult["gradingStatus"];
  if (pendingCount === 0) {
    gradingStatus = "COMPLETE";
  } else if (gradedCount === 0) {
    gradingStatus = "PENDING";
  } else {
    gradingStatus = "PARTIAL";
  }

  return { totalScore, maxScore, perQuestionMarks, gradingStatus };
}
